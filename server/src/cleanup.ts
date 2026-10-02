import type { Db } from './db.js';

/**
 * Deletes everything whose retention period has ended. Runs every minute.
 * Expired rows are also filtered out on read, so a delayed sweep never
 * delivers expired data.
 */
export async function sweepExpired(db: Db): Promise<void> {
  await db.query('DELETE FROM mailbox WHERE expires_at <= now()');
  await db.query('DELETE FROM blobs WHERE expires_at <= now()');
  await db.query('DELETE FROM accounts WHERE retain_until < current_date');
}

export function startCleanup(db: Db, intervalMs = 60_000): () => void {
  const timer = setInterval(() => {
    sweepExpired(db).catch((err: { code?: string }) => {
      // Only the error code: messages can contain row data.
      console.error(`retention sweep failed (${err.code ?? 'unknown'})`);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
