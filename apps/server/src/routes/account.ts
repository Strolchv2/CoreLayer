import { deleteAccountSchema, updateSettingsSchema } from '@cv-studio/shared';
import { Router } from 'express';
import { db } from '../db/index.js';
import { badRequest } from '../lib/errors.js';
import { verifyPassword } from '../lib/passwords.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { authLimiter, exportLimiter } from '../middleware/rateLimit.js';
import { deleteUserAccount, streamUserDataExport } from '../services/account.js';
import { audit } from '../services/audit.js';
import { clearSessionCookie, toAuthUser, toUserDTO } from '../services/sessions.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.patch('/settings', async (req, res) => {
  const user = currentUser(req);
  const input = parse(updateSettingsSchema, req.body);
  const row = await db
    .updateTable('users')
    .set({
      ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.defaultDateFormat !== undefined ? { default_date_format: input.defaultDateFormat } : {}),
      ...(input.onboardingCompleted !== undefined ? { onboarding_completed: input.onboardingCompleted } : {}),
      updated_at: new Date(),
    })
    .where('id', '=', user.id)
    .returningAll()
    .executeTakeFirstOrThrow();
  res.json({ user: toUserDTO(toAuthUser(row)) });
});

/** "Meine Daten exportieren" (DSGVO) */
accountRouter.get('/export', exportLimiter, async (req, res) => {
  const user = currentUser(req);
  await audit(user.id, 'account.data_export');
  await streamUserDataExport(user.id, res);
});

/** Konto und alle Daten endgültig löschen – erfordert Passwortbestätigung. */
accountRouter.delete('/', authLimiter, async (req, res) => {
  const user = currentUser(req);
  const { password } = parse(deleteAccountSchema, req.body);
  const row = await db.selectFrom('users').select(['password_hash', 'role']).where('id', '=', user.id).executeTakeFirstOrThrow();
  if (!(await verifyPassword(row.password_hash, password))) {
    throw badRequest('current_password_wrong', undefined, { password: 'current_password_wrong' });
  }
  if (row.role === 'admin') {
    const { c } = await db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('c'))
      .where('role', '=', 'admin')
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();
    if (Number(c) <= 1) throw badRequest('last_admin');
  }
  await deleteUserAccount(user.id);
  await audit(null, 'account.deleted');
  clearSessionCookie(res);
  res.json({ ok: true });
});
