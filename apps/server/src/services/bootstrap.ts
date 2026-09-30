import { emailSchema, passwordSchema } from '@cv-studio/shared';
import { db } from '../db/index.js';
import { hashPassword } from '../lib/passwords.js';
import { logger } from '../lib/logger.js';

/**
 * Legt einen Administrator an bzw. befördert ein bestehendes Konto.
 * Zugangsdaten kommen ausschließlich aus Umgebungsvariablen/CLI – nie aus dem Quellcode.
 */
export async function ensureAdmin(emailInput: string, password: string): Promise<'created' | 'promoted' | 'unchanged'> {
  const email = emailSchema.parse(emailInput);
  const existing = await db.selectFrom('users').select(['id', 'role']).where('email', '=', email).executeTakeFirst();
  if (existing) {
    if (existing.role === 'admin') return 'unchanged';
    await db.updateTable('users').set({ role: 'admin', updated_at: new Date() }).where('id', '=', existing.id).execute();
    return 'promoted';
  }
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new Error('Das Admin-Passwort erfüllt die Passwortrichtlinie nicht (mind. 10 Zeichen, Buchstaben + Ziffer/Sonderzeichen).');
  await db
    .insertInto('users')
    .values({
      email,
      password_hash: await hashPassword(password),
      role: 'admin',
      display_name: 'Administrator',
      onboarding_completed: true,
      password_changed_at: new Date(),
    })
    .execute();
  logger.info('Administrator-Konto angelegt');
  return 'created';
}
