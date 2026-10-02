import { createHmac, randomBytes } from 'node:crypto';

/**
 * Network addresses are needed for exactly one thing: rate limiting. They are
 * never stored, logged or linked to an account. Instead of the address we use
 * an HMAC with a random in-memory key that is replaced every 24 hours, so a
 * rate-limit key cannot be reversed and cannot be linked across days. The key
 * is never written to disk; a restart forgets everything.
 */
const ROTATE_MS = 24 * 60 * 60 * 1000;
let salt = randomBytes(32);
let rotatedAt = Date.now();

export function anonymizeAddress(ip: string): string {
  if (Date.now() - rotatedAt > ROTATE_MS) {
    salt = randomBytes(32);
    rotatedAt = Date.now();
  }
  return createHmac('sha256', salt).update(ip).digest('base64url').slice(0, 22);
}

/** Expiry rounded up to the next full minute, to avoid precise timestamps. */
export function coarseExpiry(ttlSeconds: number, now = Date.now()): Date {
  const minute = 60_000;
  return new Date(Math.ceil((now + ttlSeconds * 1000) / minute) * minute);
}
