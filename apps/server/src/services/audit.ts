import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';

/**
 * Protokolliert sicherheits- und betriebsrelevante Ereignisse.
 * `meta` darf KEINE personenbezogenen Daten oder Lebenslaufinhalte enthalten.
 */
export async function audit(userId: string | null, action: string, meta: Record<string, string | number | boolean | null> = {}): Promise<void> {
  try {
    await db.insertInto('audit_log').values({ user_id: userId, action, meta: JSON.stringify(meta) }).execute();
  } catch (err) {
    logger.warn({ err: (err as Error).message, action }, 'Audit-Eintrag fehlgeschlagen');
  }
}
