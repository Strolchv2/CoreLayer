import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import {
  API_PREFIX,
  AUTH_SIGNATURE_CONTEXT,
  DEFAULT_DEVICE_ID,
  MAX_BACKUP_BYTES,
  MAX_BLOB_BYTES,
  MAX_RETENTION_SECONDS,
  WS_PATH,
  accountIdSchema,
  backupIdSchema,
  blobIdSchema,
  clientWsMessageSchema,
  isValidBlobLength,
  isValidEnvelopeLength,
  recoveryBlobSchema,
  registerRequestSchema,
  sendMessageRequestSchema,
  sessionRequestSchema,
  ttlSchema,
  uploadKeysRequestSchema,
  type KeyBundle,
  type PublicIdentity,
  type ServerWsMessage,
} from '@corelayer/protocol';
import { ChallengeStore, TokenService, accountIdFromAuthKey, verifyEd25519 } from './auth.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { anonymizeAddress, coarseExpiry } from './privacy.js';
import { Relay, type Receiver } from './relay.js';

const b = (s: string) => Buffer.from(s, 'base64');
const s64 = (buf: Buffer) => buf.toString('base64');

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(400, 'invalid request');
  return r.data;
}

export interface AppDeps {
  config: Config;
  db: Db;
}

export async function buildApp({ config, db }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    // No request logging at all: access logs are the classic source of
    // IP/timestamp/account correlation.
    logger: false,
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024,
  });

  const challenges = new ChallengeStore();
  const tokens = new TokenService(config.sessionSecret);
  const relay = new Relay(db);
  await relay.start();
  app.addHook('onClose', async () => relay.stop());

  // --- Security headers (nginx sets them too; this is defence in depth) ----
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  // --- Rate limiting on an anonymised, rotating network key ---------------
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => anonymizeAddress(req.ip),
    // In-memory LRU store: nothing is written to disk.
    cache: 50_000,
  });

  // --- Cross-site protection ---------------------------------------------
  // There are no cookies, so classic CSRF is not possible (bearer tokens are
  // never sent automatically). We additionally reject cross-origin
  // state-changing requests from browsers.
  app.addHook('onRequest', async (req) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.length > 0 && !config.allowedOrigins.includes(origin)) {
      throw new HttpError(403, 'origin not allowed');
    }
  });

  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: MAX_BLOB_BYTES }, (_req, body, done) =>
    done(null, body),
  );

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) console.error(`internal error (${(err as { code?: string }).code ?? err.name})`);
    return reply.status(status).send({ error: status === 429 ? 'rate limited' : status === 500 ? 'internal error' : 'bad request' });
  });

  /** Resolves a bearer token to an existing account, or null. */
  const resolveToken = async (token: string | undefined): Promise<string | null> => {
    const accountId = tokens.verify(token);
    if (!accountId) return null;
    const r = await db.query('SELECT 1 FROM accounts WHERE id = $1', [accountId]);
    return r.rowCount === 1 ? accountId : null;
  };

  const requireAccount = async (req: FastifyRequest): Promise<string> => {
    const h = req.headers.authorization;
    const accountId = await resolveToken(h?.startsWith('Bearer ') ? h.slice(7) : undefined);
    if (!accountId) throw new HttpError(401, 'unauthorized');
    return accountId;
  };

  const refreshRetention = (accountId: string) =>
    db.query(
      `UPDATE accounts SET retain_until = (date_trunc('month', now()) + interval '7 months')::date WHERE id = $1`,
      [accountId],
    );

  // ------------------------------------------------------------------------
  // Health (no information about users)
  // ------------------------------------------------------------------------
  app.get(`${API_PREFIX}/health`, async () => ({ ok: true }));

  // ------------------------------------------------------------------------
  // Anonymous authentication
  // ------------------------------------------------------------------------
  app.get(`${API_PREFIX}/auth/challenge`, async () => ({ challenge: challenges.issue() }));

  app.post(
    `${API_PREFIX}/accounts`,
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const body = parse(registerRequestSchema, req.body);
      if (!challenges.consume(body.challenge)) throw new HttpError(401, 'invalid challenge');
      const authKey = b(body.authPublicKey);
      const msg = Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.register), b(body.challenge)]);
      if (!verifyEd25519(authKey, msg, b(body.signature))) throw new HttpError(401, 'invalid signature');

      const accountId = accountIdFromAuthKey(authKey);
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO accounts (id, auth_public_key, sealing_public_key, sealing_key_signature, identity_key,
             registration_id, signed_prekey_id, signed_prekey, signed_prekey_signature, retain_until)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(date_trunc('month', now()) + interval '7 months')::date)
           ON CONFLICT DO NOTHING`,
          [
            accountId,
            authKey,
            b(body.sealingPublicKey),
            b(body.sealingKeySignature),
            b(body.identityKey),
            body.registrationId,
            body.signedPreKey.keyId,
            b(body.signedPreKey.publicKey),
            b(body.signedPreKey.signature),
          ],
        );
        if (inserted.rowCount !== 1) throw new HttpError(409, 'account exists');
        await insertPreKeys(client, accountId, body.preKeys);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return reply.status(201).send({ accountId });
    },
  );

  app.post(`${API_PREFIX}/auth/session`, { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const body = parse(sessionRequestSchema, req.body);
    if (!challenges.consume(body.challenge)) throw new HttpError(401, 'invalid challenge');
    const row = await db.query<{ auth_public_key: Buffer }>('SELECT auth_public_key FROM accounts WHERE id = $1', [
      body.accountId,
    ]);
    const key = row.rows[0]?.auth_public_key;
    const msg = Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.session), b(body.challenge)]);
    if (!key || !verifyEd25519(key, msg, b(body.signature))) throw new HttpError(401, 'invalid signature');
    await refreshRetention(body.accountId);
    return { token: tokens.create(body.accountId), expiresInSeconds: tokens.ttlSeconds };
  });

  app.delete(`${API_PREFIX}/accounts/me`, async (req, reply) => {
    const accountId = await requireAccount(req);
    // Cascades to prekeys, mailbox and recovery backup.
    await db.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    relay.disconnect(accountId);
    return reply.status(204).send();
  });

  // ------------------------------------------------------------------------
  // Key directory
  // ------------------------------------------------------------------------

  interface AccountKeysRow {
    registration_id: number;
    identity_key: Buffer;
    sealing_public_key: Buffer;
    sealing_key_signature: Buffer;
    signed_prekey_id: number;
    signed_prekey: Buffer;
    signed_prekey_signature: Buffer;
  }
  const loadAccountKeys = async (accountId: string) => {
    const r = await db.query<AccountKeysRow>(
      `SELECT registration_id, identity_key, sealing_public_key, sealing_key_signature,
              signed_prekey_id, signed_prekey, signed_prekey_signature
       FROM accounts WHERE id = $1`,
      [accountId],
    );
    const a = r.rows[0];
    if (!a) throw new HttpError(404, 'not found');
    return a;
  };
  const publicIdentity = (accountId: string, a: AccountKeysRow): PublicIdentity => ({
    accountId,
    identityKey: s64(a.identity_key),
    sealingPublicKey: s64(a.sealing_public_key),
    sealingKeySignature: s64(a.sealing_key_signature),
  });

  // Key lookups are unauthenticated on purpose: the server must not learn
  // *who* is looking up whom. Rate limited to make draining one-time prekeys
  // expensive.
  app.get<{ Params: { id: string } }>(
    `${API_PREFIX}/keys/:id/identity`,
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req) => {
      const accountId = parse(accountIdSchema, req.params.id);
      return publicIdentity(accountId, await loadAccountKeys(accountId));
    },
  );

  app.get<{ Params: { id: string } }>(
    `${API_PREFIX}/keys/:id`,
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const accountId = parse(accountIdSchema, req.params.id);
      const a = await loadAccountKeys(accountId);
      const pk = await db.query<{ key_id: number; public_key: Buffer }>(
        `DELETE FROM one_time_prekeys WHERE ctid IN (
           SELECT ctid FROM one_time_prekeys WHERE account_id = $1 LIMIT 1 FOR UPDATE SKIP LOCKED
         ) RETURNING key_id, public_key`,
        [accountId],
      );
      const p = pk.rows[0];
      const bundle: KeyBundle = {
        ...publicIdentity(accountId, a),
        deviceId: DEFAULT_DEVICE_ID,
        registrationId: a.registration_id,
        signedPreKey: {
          keyId: a.signed_prekey_id,
          publicKey: s64(a.signed_prekey),
          signature: s64(a.signed_prekey_signature),
        },
        ...(p ? { preKey: { keyId: p.key_id, publicKey: s64(p.public_key) } } : {}),
      };
      return bundle;
    },
  );

  app.get(`${API_PREFIX}/keys`, async (req) => {
    const accountId = await requireAccount(req);
    const r = await db.query<{ count: string }>('SELECT count(*) FROM one_time_prekeys WHERE account_id = $1', [
      accountId,
    ]);
    return { count: Number(r.rows[0]?.count ?? 0) };
  });

  app.put(`${API_PREFIX}/keys`, async (req, reply) => {
    const accountId = await requireAccount(req);
    const body = parse(uploadKeysRequestSchema, req.body);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (body.replaceAll) await client.query('DELETE FROM one_time_prekeys WHERE account_id = $1', [accountId]);
      if (body.signedPreKey) {
        await client.query(
          `UPDATE accounts SET signed_prekey_id = $2, signed_prekey = $3, signed_prekey_signature = $4 WHERE id = $1`,
          [accountId, body.signedPreKey.keyId, b(body.signedPreKey.publicKey), b(body.signedPreKey.signature)],
        );
      }
      await insertPreKeys(client, accountId, body.preKeys);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return reply.status(204).send();
  });

  // ------------------------------------------------------------------------
  // Sealed-sender message relay
  // ------------------------------------------------------------------------

  // Unauthenticated on purpose: the request carries no sender identity. The
  // server stores (recipient, ciphertext, coarse expiry) and nothing else.
  app.post(`${API_PREFIX}/messages`, { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = parse(sendMessageRequestSchema, req.body);
    const envelope = b(body.envelope);
    if (!isValidEnvelopeLength(envelope.length)) throw new HttpError(400, 'envelope not padded');
    const expiresAt = coarseExpiry(Math.min(body.ttlSeconds, MAX_RETENTION_SECONDS));
    const r = await db.query<{ seq: string }>(
      `INSERT INTO mailbox (recipient_id, envelope, expires_at)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM accounts WHERE id = $1)
       RETURNING seq`,
      [body.to, envelope, expiresAt],
    );
    if (!r.rows[0]) throw new HttpError(404, 'unknown recipient');
    await relay.announce(body.to);
    return reply.status(202).send();
  });

  // ------------------------------------------------------------------------
  // Encrypted attachments
  // ------------------------------------------------------------------------
  app.post<{ Querystring: { ttl?: string } }>(
    `${API_PREFIX}/blobs`,
    { bodyLimit: MAX_BLOB_BYTES, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const ttl = parse(ttlSchema, Number(req.query.ttl));
      const data = req.body;
      if (!Buffer.isBuffer(data) || !isValidBlobLength(data.length)) throw new HttpError(400, 'blob not padded');
      const id = randomBytes(16).toString('hex');
      await db.query('INSERT INTO blobs (id, data, expires_at) VALUES ($1, $2, $3)', [id, data, coarseExpiry(ttl)]);
      return reply.status(201).send({ id });
    },
  );

  app.get<{ Params: { id: string } }>(
    `${API_PREFIX}/blobs/:id`,
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const id = parse(blobIdSchema, req.params.id);
      const r = await db.query<{ data: Buffer }>('SELECT data FROM blobs WHERE id = $1 AND expires_at > now()', [id]);
      const row = r.rows[0];
      if (!row) throw new HttpError(404, 'not found');
      return reply.type('application/octet-stream').send(row.data);
    },
  );

  // ------------------------------------------------------------------------
  // Optional encrypted recovery backup
  // ------------------------------------------------------------------------
  app.put<{ Params: { id: string } }>(`${API_PREFIX}/recovery/:id`, async (req, reply) => {
    const accountId = await requireAccount(req);
    const id = parse(backupIdSchema, req.params.id);
    const blob = b(parse(recoveryBlobSchema, req.body).blob);
    if (blob.length > MAX_BACKUP_BYTES) throw new HttpError(400, 'too large');
    await db.query(
      `INSERT INTO recovery_backups (id, account_id, blob) VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET id = EXCLUDED.id, blob = EXCLUDED.blob`,
      [id, accountId, blob],
    );
    return reply.status(204).send();
  });

  app.delete(`${API_PREFIX}/recovery`, async (req, reply) => {
    const accountId = await requireAccount(req);
    await db.query('DELETE FROM recovery_backups WHERE account_id = $1', [accountId]);
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>(
    `${API_PREFIX}/recovery/:id`,
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const id = parse(backupIdSchema, req.params.id);
      const r = await db.query<{ blob: Buffer }>('SELECT blob FROM recovery_backups WHERE id = $1', [id]);
      const row = r.rows[0];
      if (!row) throw new HttpError(404, 'not found');
      return { blob: s64(row.blob) };
    },
  );

  // ------------------------------------------------------------------------
  // WebSocket: authenticated, receive-only delivery channel
  // ------------------------------------------------------------------------
  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024,
      verifyClient: ({ origin }: { origin?: string }) =>
        !origin || config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin),
    },
  });

  app.register(async (scope) => {
    scope.get(WS_PATH, { websocket: true }, (socket) => {
      let accountId: string | null = null;
      let budget = 60; // simple per-connection message rate limit
      const refill = setInterval(() => (budget = 60), 10_000);
      const authTimeout = setTimeout(() => socket.close(4000, 'auth timeout'), 10_000);
      const send = (m: ServerWsMessage) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(m));

      // Messages pushed on this connection but not yet acknowledged.
      const inFlight = new Set<string>();
      let flushing: Promise<void> = Promise.resolve();
      const receiver: Receiver = {
        flush: () =>
          (flushing = flushing.then(async () => {
            if (!accountId) return;
            const r = await db.query<{ seq: string; envelope: Buffer }>(
              `SELECT seq, envelope FROM mailbox WHERE recipient_id = $1 AND expires_at > now() ORDER BY seq LIMIT 1000`,
              [accountId],
            );
            for (const row of r.rows) {
              if (inFlight.has(row.seq)) continue;
              inFlight.add(row.seq);
              send({ t: 'msg', id: row.seq, envelope: s64(row.envelope) });
            }
          })),
        close: (code, reason) => socket.close(code, reason),
      };

      socket.on('message', async (raw: Buffer) => {
        if (--budget < 0) return socket.close(4029, 'rate limited');
        let msg;
        try {
          msg = clientWsMessageSchema.parse(JSON.parse(raw.toString('utf8')));
        } catch {
          return send({ t: 'error', error: 'invalid message' });
        }
        try {
          if (msg.t === 'ping') return send({ t: 'pong' });
          if (msg.t === 'auth') {
            if (accountId) return;
            const id = await resolveToken(msg.token);
            if (!id) return socket.close(4001, 'unauthorized');
            accountId = id;
            clearTimeout(authTimeout);
            relay.add(id, receiver);
            send({ t: 'ready' });
            await receiver.flush();
            return;
          }
          if (!accountId) return socket.close(4001, 'unauthorized');
          if (msg.t === 'ack' && msg.ids.length > 0) {
            // Delete-on-acknowledge: delivered ciphertext does not linger.
            await db.query('DELETE FROM mailbox WHERE recipient_id = $1 AND seq = ANY($2::bigint[])', [accountId, msg.ids]);
            for (const id of msg.ids) inFlight.delete(id);
          }
        } catch {
          send({ t: 'error', error: 'internal error' });
        }
      });

      socket.on('close', () => {
        clearTimeout(authTimeout);
        clearInterval(refill);
        if (accountId) relay.remove(accountId, receiver);
      });
    });
  });

  return app;
}

async function insertPreKeys(
  client: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  accountId: string,
  preKeys: { keyId: number; publicKey: string }[],
): Promise<void> {
  if (preKeys.length === 0) return;
  await client.query(
    `INSERT INTO one_time_prekeys (account_id, key_id, public_key)
     SELECT $1, k, p FROM unnest($2::int[], $3::bytea[]) AS t(k, p)
     ON CONFLICT (account_id, key_id) DO UPDATE SET public_key = EXCLUDED.public_key`,
    [accountId, preKeys.map((k) => k.keyId), preKeys.map((k) => b(k.publicKey))],
  );
}

