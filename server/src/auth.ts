import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import { ACCOUNT_ID_DOMAIN, formatAccountId } from '@corelayer/protocol';

/**
 * Anonymous authentication.
 *
 * An account is nothing but an Ed25519 key pair generated on the device. To
 * log in, the device signs a one-time server challenge. The server hands out
 * a short-lived signed bearer token (no session table, no cookies). Clients
 * re-authenticate automatically with their key when it expires.
 */

const CHALLENGE_TTL_MS = 60_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function accountIdFromAuthKey(authPublicKey: Uint8Array): string {
  const digest = createHash('sha256')
    .update(Buffer.from(ACCOUNT_ID_DOMAIN, 'utf8'))
    .update(authPublicKey)
    .digest();
  return formatAccountId(digest);
}

export function verifyEd25519(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, message, key, signature);
  } catch {
    return false;
  }
}

/**
 * Login challenges: `nonce(12) || expiry(4, seconds) || HMAC tag(16)`.
 * Issuing one stores nothing (so anonymous GETs cannot fill a table), and any
 * relay node can check it. Single use is enforced when a challenge is
 * redeemed: its tag is recorded in `used_challenges` until it expires.
 */
export class ChallengeService {
  constructor(private readonly secret: Buffer) {}

  issue(): string {
    const payload = Buffer.alloc(16);
    randomBytes(12).copy(payload);
    payload.writeUInt32BE(Math.floor((Date.now() + CHALLENGE_TTL_MS) / 1000), 12);
    return Buffer.concat([payload, this.tag(payload)]).toString('base64');
  }

  /** Checks authenticity and expiry. Returns the tag and expiry for the replay check, or null. */
  check(challenge: string): { tag: Buffer; expiresAt: Date } | null {
    const raw = Buffer.from(challenge, 'base64');
    if (raw.length !== 32) return null;
    const payload = raw.subarray(0, 16);
    const tag = raw.subarray(16);
    if (!timingSafeEqual(tag, this.tag(payload))) return null;
    const exp = payload.readUInt32BE(12) * 1000;
    if (exp <= Date.now()) return null;
    return { tag: Buffer.from(tag), expiresAt: new Date(exp) };
  }

  private tag(payload: Buffer): Buffer {
    return createHmac('sha256', this.secret).update('challenge').update(payload).digest().subarray(0, 16);
  }
}

/**
 * Stateless bearer tokens: `v1.<accountId>.<expiry>.<HMAC-SHA256>`.
 * Nothing is stored server-side, and every relay node sharing the secret can
 * verify them. Revocation happens by deleting the account: tokens are only
 * accepted for accounts that still exist.
 */
export class TokenService {
  readonly ttlSeconds = SESSION_TTL_MS / 1000;

  constructor(private readonly secret: Buffer) {
    if (secret.length < 32) throw new Error('session secret must be at least 32 bytes');
  }

  create(accountId: string): string {
    const body = `v1.${accountId}.${Math.floor((Date.now() + SESSION_TTL_MS) / 1000)}`;
    return `${body}.${this.mac(body)}`;
  }

  /** Returns the account id if the token is authentic and not expired. */
  verify(token: string | undefined): string | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    const [, accountId, exp, mac] = parts as [string, string, string, string];
    const expected = Buffer.from(this.mac(`v1.${accountId}.${exp}`));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    if (!/^\d+$/.test(exp) || Number(exp) * 1000 <= Date.now()) return null;
    return accountId;
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}
