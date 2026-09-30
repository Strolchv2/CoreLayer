import type { DateFormat, Locale, ThemePreference, UserDTO, UserRole } from '@cv-studio/shared';
import type { Response } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import type { UserRow } from '../db/types.js';
import { randomToken, sha256 } from '../lib/crypto.js';

export const SESSION_COOKIE = 'cvs_session';
export const CSRF_COOKIE = 'cvs_csrf';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  locale: Locale;
  theme: ThemePreference;
  defaultDateFormat: DateFormat;
  onboardingCompleted: boolean;
  createdAt: Date;
}

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.display_name,
    locale: (u.locale as Locale) ?? 'de',
    theme: (u.theme as ThemePreference) ?? 'system',
    defaultDateFormat: (u.default_date_format as DateFormat) ?? 'MM/YYYY',
    onboardingCompleted: u.onboarding_completed,
    createdAt: u.created_at,
  };
}

export function toUserDTO(u: AuthUser): UserDTO {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    locale: u.locale,
    theme: u.theme,
    defaultDateFormat: u.defaultDateFormat,
    onboardingCompleted: u.onboardingCompleted,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Erstellt eine neue Session und setzt das Cookie. Das Token wird nur gehasht gespeichert. */
export async function createSession(res: Response, userId: string): Promise<string> {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  await db.insertInto('sessions').values({ id, user_id: userId, expires_at: expiresAt }).execute();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlMs,
  });
  return id;
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' });
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  let q = db.deleteFrom('sessions').where('user_id', '=', userId);
  if (exceptSessionId) q = q.where('id', '!=', exceptSessionId);
  await q.execute();
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Lädt Benutzer zur Session; verlängert die Laufzeit gleitend (höchstens alle 5 Minuten). */
export async function resolveSession(token: string): Promise<{ sessionId: string; user: AuthUser } | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = await db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .selectAll('users')
    .select(['sessions.expires_at as session_expires_at', 'sessions.last_seen_at as session_last_seen_at'])
    .where('sessions.id', '=', id)
    .executeTakeFirst();
  if (!row) return null;
  if (row.session_expires_at.getTime() < Date.now() || row.status !== 'active') {
    await destroySession(id);
    return null;
  }
  if (Date.now() - row.session_last_seen_at.getTime() > TOUCH_INTERVAL_MS) {
    await db
      .updateTable('sessions')
      .set({ last_seen_at: new Date(), expires_at: new Date(Date.now() + config.sessionTtlMs) })
      .where('id', '=', id)
      .execute();
  }
  const { session_expires_at: _e, session_last_seen_at: _l, ...user } = row;
  return { sessionId: id, user: toAuthUser(user) };
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.deleteFrom('sessions').where('expires_at', '<', new Date()).execute();
  await db.deleteFrom('password_reset_tokens').where('expires_at', '<', new Date(Date.now() - 24 * 3600 * 1000)).execute();
}
