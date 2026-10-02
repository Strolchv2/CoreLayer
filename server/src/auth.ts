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
const MAX_PENDING_CHALLENGES = 100_000;

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

export class ChallengeStore {
  private pending = new Map<string, number>();

  issue(): string {
    this.sweep();
    if (this.pending.size >= MAX_PENDING_CHALLENGES) throw new Error('challenge store full');
    const c = randomBytes(32).toString('base64');
    this.pending.set(c, Date.now() + CHALLENGE_TTL_MS);
    return c;
  }

  /** Single use: a challenge is consumed whether or not the signature is valid. */
  consume(challenge: string): boolean {
    const exp = this.pending.get(challenge);
    this.pending.delete(challenge);
    return exp !== undefined && exp > Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [c, exp] of this.pending) if (exp <= now) this.pending.delete(c);
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
