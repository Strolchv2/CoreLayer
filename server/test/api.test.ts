import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { AUTH_SIGNATURE_CONTEXT, ENVELOPE_BUCKETS, SEALED_BOX_OVERHEAD } from '@corelayer/protocol';
import { buildApp } from '../src/app.js';
import { ChallengeService, TokenService, accountIdFromAuthKey } from '../src/auth.js';
import { sweepExpired } from '../src/cleanup.js';
import { createPool, migrate, type Db } from '../src/db.js';
import { coarseExpiry } from '../src/privacy.js';

const DB_URL = process.env.TEST_DATABASE_URL;
const SECRET = Buffer.alloc(32, 7);

function edKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return { raw, sign: (m: Buffer) => sign(null, m, privateKey) };
}
const b64 = (n: number) => randomBytes(n).toString('base64');

describe('bearer tokens', () => {
  it('rejects tampered, foreign and expired tokens', () => {
    const t = new TokenService(Buffer.alloc(32, 1));
    const token = t.create('7F3A-91D2-8C41-0B5E');
    expect(t.verify(token)).toBe('7F3A-91D2-8C41-0B5E');
    expect(t.verify(token.replace('7F3A', '0000'))).toBeNull();
    expect(new TokenService(Buffer.alloc(32, 2)).verify(token)).toBeNull();
    const [v, id, , mac] = token.split('.');
    expect(t.verify(`${v}.${id}.1.${mac}`)).toBeNull();
    expect(() => new TokenService(Buffer.alloc(8))).toThrow();
  });
});

describe('login challenges', () => {
  it('are authentic, expire and are bound to the secret', () => {
    const c = new ChallengeService(Buffer.alloc(32, 1));
    const ch = c.issue();
    expect(Buffer.from(ch, 'base64')).toHaveLength(32);
    expect(c.check(ch)).not.toBeNull();
    expect(new ChallengeService(Buffer.alloc(32, 2)).check(ch)).toBeNull();
    const raw = Buffer.from(ch, 'base64');
    raw.writeUInt32BE(0xffffffff, 12); // tampered expiry
    expect(c.check(raw.toString('base64'))).toBeNull();
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      expect(c.check(ch)).toBeNull(); // expired
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('privacy helpers', () => {
  it('rounds expiry up to the minute', () => {
    const d = coarseExpiry(5, Date.UTC(2026, 0, 1, 12, 0, 30));
    expect(d.toISOString()).toBe('2026-01-01T12:01:00.000Z');
  });
});

describe.skipIf(!DB_URL)('relay API', () => {
  let app: FastifyInstance;
  let db: Db;

  beforeAll(async () => {
    db = createPool(DB_URL!);
    await db.query('DROP TABLE IF EXISTS used_challenges, recovery_backups, blobs, mailbox, one_time_prekeys, accounts CASCADE');
    await migrate(db);
    app = await buildApp({
      config: { host: '127.0.0.1', port: 0, databaseUrl: DB_URL!, allowedOrigins: ['https://chat.example'], trustProxy: false, sessionSecret: SECRET },
      db,
    });
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });
  beforeEach(async () => {
    await db.query('TRUNCATE used_challenges, recovery_backups, blobs, mailbox, one_time_prekeys, accounts CASCADE');
  });

  const challenge = async () => (await app.inject({ method: 'GET', url: '/api/v1/auth/challenge' })).json().challenge as string;

  async function register(keys = edKeys(), overrides: Record<string, unknown> = {}) {
    const c = await challenge();
    return app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      payload: {
        authPublicKey: keys.raw.toString('base64'),
        sealingPublicKey: b64(32),
        sealingKeySignature: b64(64),
        identityKey: b64(33),
        registrationId: 42,
        signedPreKey: { keyId: 1, publicKey: b64(33), signature: b64(64) },
        preKeys: [
          { keyId: 1, publicKey: b64(33) },
          { keyId: 2, publicKey: b64(33) },
        ],
        challenge: c,
        signature: keys.sign(Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.register), Buffer.from(c, 'base64')])).toString('base64'),
        ...overrides,
      },
    });
  }

  async function session(keys: ReturnType<typeof edKeys>) {
    const c = await challenge();
    const accountId = accountIdFromAuthKey(keys.raw);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      payload: {
        accountId,
        challenge: c,
        signature: keys.sign(Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.session), Buffer.from(c, 'base64')])).toString('base64'),
      },
    });
    return { res, accountId };
  }

  it('registers an anonymous account derived from the key, and stores no personal data', async () => {
    const keys = edKeys();
    const res = await register(keys);
    expect(res.statusCode).toBe(201);
    expect(res.json().accountId).toBe(accountIdFromAuthKey(keys.raw));
    expect(res.json().accountId).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' ORDER BY 1`);
    const names = cols.rows.map((r) => r.column_name).join(',');
    for (const forbidden of ['ip', 'email', 'phone', 'name', 'created', 'last_seen', 'user_agent']) {
      expect(names.split(',')).not.toContain(forbidden);
    }
  });

  it('rejects bad signatures and reused challenges', async () => {
    const keys = edKeys();
    expect((await register(keys, { signature: b64(64) })).statusCode).toBe(401);
    const c = await challenge();
    const sig = keys.sign(Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.register), Buffer.from(c, 'base64')])).toString('base64');
    expect((await register(keys, { challenge: c, signature: sig })).statusCode).toBe(201);
    expect((await register(edKeys(), { challenge: c, signature: sig })).statusCode).toBe(401);
  });

  it('issues sessions only to the key holder', async () => {
    const keys = edKeys();
    await register(keys);
    const { res } = await session(keys);
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    const token = res.json().token;
    const count = await app.inject({ method: 'GET', url: '/api/v1/keys', headers: { authorization: `Bearer ${token}` } });
    expect(count.json().count).toBe(2);
    expect((await app.inject({ method: 'GET', url: '/api/v1/keys', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401);
  });

  it('hands out each one-time prekey once', async () => {
    const keys = edKeys();
    const id = (await register(keys)).json().accountId;
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await app.inject({ method: 'GET', url: `/api/v1/keys/${id}` })).json().preKey?.keyId);
    expect(ids).toEqual(expect.arrayContaining([1, 2]));
    expect(ids[2]).toBeUndefined();
  });

  it('accepts only padded envelopes and stores no sender', async () => {
    const id = (await register()).json().accountId;
    const bad = await app.inject({ method: 'POST', url: '/api/v1/messages', payload: { to: id, envelope: b64(100), ttlSeconds: 60 } });
    expect(bad.statusCode).toBe(400);
    const good = await app.inject({
      method: 'POST',
      url: '/api/v1/messages',
      payload: { to: id, envelope: b64(ENVELOPE_BUCKETS[0] + SEALED_BOX_OVERHEAD), ttlSeconds: 60 },
    });
    expect(good.statusCode).toBe(202);
    const badTtl = await app.inject({
      method: 'POST',
      url: '/api/v1/messages',
      payload: { to: id, envelope: b64(ENVELOPE_BUCKETS[0] + SEALED_BOX_OVERHEAD), ttlSeconds: 1234 },
    });
    expect(badTtl.statusCode).toBe(400);
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/v1/messages',
      payload: { to: '0000-0000-0000-0000', envelope: b64(ENVELOPE_BUCKETS[0] + SEALED_BOX_OVERHEAD), ttlSeconds: 60 },
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('deletes expired data and inactive accounts', async () => {
    const id = (await register()).json().accountId;
    await db.query(`INSERT INTO mailbox (recipient_id, envelope, expires_at) VALUES ($1, '\\x00', now() - interval '1 second')`, [id]);
    await db.query(`INSERT INTO blobs (id, data, expires_at) VALUES ('${'a'.repeat(32)}', '\\x00', now() - interval '1 second')`);
    await sweepExpired(db);
    expect((await db.query('SELECT 1 FROM mailbox')).rowCount).toBe(0);
    expect((await db.query('SELECT 1 FROM blobs')).rowCount).toBe(0);
    await db.query(`UPDATE accounts SET retain_until = current_date - 1`);
    await sweepExpired(db);
    expect((await db.query('SELECT 1 FROM accounts')).rowCount).toBe(0);
  });

  it('rejects unpadded blobs and serves padded ones', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/blobs?ttl=60',
      headers: { 'content-type': 'application/octet-stream' },
      payload: randomBytes(1000),
    });
    expect(bad.statusCode).toBe(400);
    const data = randomBytes(64 * 1024 + 40);
    const up = await app.inject({ method: 'POST', url: '/api/v1/blobs?ttl=60', headers: { 'content-type': 'application/octet-stream' }, payload: data });
    expect(up.statusCode).toBe(201);
    const down = await app.inject({ method: 'GET', url: `/api/v1/blobs/${up.json().id}` });
    expect(Buffer.compare(down.rawPayload, data)).toBe(0);
  });

  it('blocks cross-origin state-changing requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/messages', headers: { origin: 'https://evil.example' }, payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it('sends hardened headers and never caches', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('deletes everything on account deletion', async () => {
    const keys = edKeys();
    const id = (await register(keys)).json().accountId;
    const { res } = await session(keys);
    const token = res.json().token;
    await app.inject({ method: 'PUT', url: `/api/v1/recovery/${'b'.repeat(64)}`, headers: { authorization: `Bearer ${token}` }, payload: { blob: b64(100) } });
    expect((await db.query('SELECT 1 FROM recovery_backups')).rowCount).toBe(1);
    const del = await app.inject({ method: 'DELETE', url: '/api/v1/accounts/me', headers: { authorization: `Bearer ${token}` } });
    expect(del.statusCode).toBe(204);
    for (const t of ['accounts', 'one_time_prekeys', 'recovery_backups']) expect((await db.query(`SELECT 1 FROM ${t}`)).rowCount).toBe(0);
    expect((await app.inject({ method: 'GET', url: '/api/v1/keys', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/api/v1/keys/${id}` })).statusCode).toBe(404);
  });

  it('delivers across relay nodes sharing one database', async () => {
    const keys = edKeys();
    const id = (await register(keys)).json().accountId;
    const { res } = await session(keys);
    const token = res.json().token;
    const nodeB = await buildApp({
      config: { host: '127.0.0.1', port: 0, databaseUrl: DB_URL!, allowedOrigins: [], trustProxy: false, sessionSecret: SECRET },
      db,
    });
    await nodeB.listen({ host: '127.0.0.1', port: 0 });
    try {
      const port = (nodeB.server.address() as { port: number }).port;
      // A token issued by node A is accepted by node B (stateless, shared secret).
      const tokB = token;
      // A challenge issued by node B can be redeemed on node A, but only once.
      const cB = (await nodeB.inject({ method: 'GET', url: '/api/v1/auth/challenge' })).json().challenge as string;
      const sig = keys.sign(Buffer.concat([Buffer.from(AUTH_SIGNATURE_CONTEXT.session), Buffer.from(cB, 'base64')])).toString('base64');
      const login = () => app.inject({ method: 'POST', url: '/api/v1/auth/session', payload: { accountId: id, challenge: cB, signature: sig } });
      expect((await login()).statusCode).toBe(200);
      expect((await login()).statusCode).toBe(401);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const received: { t: string; id?: string }[] = [];
      ws.on('message', (d) => received.push(JSON.parse(String(d))));
      await new Promise((r) => ws.on('open', r));
      ws.send(JSON.stringify({ t: 'auth', token: tokB }));
      await vi.waitFor(() => expect(received.some((m) => m.t === 'ready')).toBe(true));

      // Sent through node A, received on node B.
      const sent = await app.inject({
        method: 'POST',
        url: '/api/v1/messages',
        payload: { to: id, envelope: b64(ENVELOPE_BUCKETS[0] + SEALED_BOX_OVERHEAD), ttlSeconds: 60 },
      });
      expect(sent.statusCode).toBe(202);
      const msg = await vi.waitFor(() => {
        const m = received.find((x) => x.t === 'msg');
        expect(m).toBeDefined();
        return m!;
      });
      ws.send(JSON.stringify({ t: 'ack', ids: [msg.id] }));
      await vi.waitFor(async () => expect((await db.query('SELECT 1 FROM mailbox')).rowCount).toBe(0));
      ws.close();
    } finally {
      await nodeB.close();
    }
  });
});
