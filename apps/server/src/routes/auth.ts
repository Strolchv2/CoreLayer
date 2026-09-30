import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@cv-studio/shared';
import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { getDummyHash, hashPassword, verifyPassword } from '../lib/passwords.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { authLimiter, resetLimiter } from '../middleware/rateLimit.js';
import { audit } from '../services/audit.js';
import { sendMail } from '../services/mail.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  toAuthUser,
  toUserDTO,
} from '../services/sessions.js';

export const authRouter = Router();

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Liefert das CSRF-Cookie (wird von der CSRF-Middleware gesetzt) – für den ersten Seitenaufruf. */
authRouter.get('/csrf', (_req, res) => {
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? toUserDTO(req.user) : null });
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  const existing = await db.selectFrom('users').select('id').where('email', '=', input.email).executeTakeFirst();
  if (existing) throw conflict('email_taken');

  const passwordHash = await hashPassword(input.password);
  const user = await db
    .insertInto('users')
    .values({
      email: input.email,
      password_hash: passwordHash,
      display_name: input.displayName,
      locale: input.locale,
      password_changed_at: new Date(),
      last_login_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await createSession(res, user.id);
  await audit(user.id, 'auth.register');
  res.status(201).json({ user: toUserDTO(toAuthUser(user)) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await db.selectFrom('users').selectAll().where('email', '=', input.email).executeTakeFirst();

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    await audit(null, 'auth.login.failed', { reason: 'unknown_user' });
    throw unauthorized('invalid_credentials');
  }
  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    await audit(user.id, 'auth.login.locked');
    throw new AppError(429, 'account_locked');
  }
  const valid = await verifyPassword(user.password_hash, input.password);
  if (!valid) {
    const failed = user.failed_login_count + 1;
    await db
      .updateTable('users')
      .set({
        failed_login_count: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        locked_until: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where('id', '=', user.id)
      .execute();
    await audit(user.id, 'auth.login.failed', { reason: 'invalid_password' });
    throw unauthorized('invalid_credentials');
  }
  if (user.status !== 'active') {
    await audit(user.id, 'auth.login.blocked');
    throw forbidden('account_blocked');
  }

  await db
    .updateTable('users')
    .set({ failed_login_count: 0, locked_until: null, last_login_at: new Date() })
    .where('id', '=', user.id)
    .execute();
  // Session-Fixation verhindern: bestehende Session dieses Browsers beenden, neue erzeugen
  if (req.sessionId) await destroySession(req.sessionId);
  await createSession(res, user.id);
  await audit(user.id, 'auth.login.success');
  res.json({ user: toUserDTO(toAuthUser(user)) });
});

authRouter.post('/logout', async (req, res) => {
  if (req.sessionId) await destroySession(req.sessionId);
  if (req.user) await audit(req.user.id, 'auth.logout');
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Beendet alle anderen Sessions (z. B. nach Verlust eines Geräts). */
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const user = currentUser(req);
  await destroyUserSessions(user.id, req.sessionId);
  await audit(user.id, 'auth.logout_all');
  res.json({ ok: true });
});

authRouter.post('/forgot-password', resetLimiter, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  const user = await db.selectFrom('users').select(['id', 'locale', 'status']).where('email', '=', email).executeTakeFirst();
  // Antwort ist immer gleich – verrät nicht, ob ein Konto existiert
  if (user && user.status === 'active') {
    const token = randomToken(32);
    await db.deleteFrom('password_reset_tokens').where('user_id', '=', user.id).where('used_at', 'is', null).execute();
    await db
      .insertInto('password_reset_tokens')
      .values({ user_id: user.id, token_hash: sha256(token), expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS) })
      .execute();
    const link = `${config.appUrl}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
    const en = user.locale === 'en';
    await sendMail({
      to: email,
      subject: en ? 'Reset your CV Studio password' : 'CV Studio – Passwort zurücksetzen',
      text: en
        ? `Hello,\n\nyou requested to reset your password. Open the following link within 60 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this email.\n\nCV Studio`
        : `Hallo,\n\ndu hast angefordert, dein Passwort zurückzusetzen. Öffne innerhalb von 60 Minuten folgenden Link:\n\n${link}\n\nFalls du das nicht warst, kannst du diese E-Mail ignorieren.\n\nCV Studio`,
    });
    await audit(user.id, 'auth.password_reset.requested');
  }
  res.json({ ok: true });
});

authRouter.post('/reset-password', resetLimiter, async (req, res) => {
  const input = parse(resetPasswordSchema, req.body);
  const row = await db
    .selectFrom('password_reset_tokens')
    .selectAll()
    .where('token_hash', '=', sha256(input.token))
    .executeTakeFirst();
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) throw badRequest('reset_token_invalid');

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({
        password_hash: await hashPassword(input.password),
        password_changed_at: new Date(),
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date(),
      })
      .where('id', '=', row.user_id)
      .execute();
    await trx.updateTable('password_reset_tokens').set({ used_at: new Date() }).where('id', '=', row.id).execute();
    await trx.deleteFrom('sessions').where('user_id', '=', row.user_id).execute();
  });
  await audit(row.user_id, 'auth.password_reset.completed');
  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const user = currentUser(req);
  const input = parse(changePasswordSchema, req.body);
  const row = await db.selectFrom('users').select('password_hash').where('id', '=', user.id).executeTakeFirstOrThrow();
  if (!(await verifyPassword(row.password_hash, input.currentPassword))) {
    throw badRequest('current_password_wrong', undefined, { currentPassword: 'current_password_wrong' });
  }
  await db
    .updateTable('users')
    .set({ password_hash: await hashPassword(input.newPassword), password_changed_at: new Date(), updated_at: new Date() })
    .where('id', '=', user.id)
    .execute();
  // Andere Geräte abmelden
  await destroyUserSessions(user.id, req.sessionId);
  await audit(user.id, 'auth.password_changed');
  res.json({ ok: true });
});
