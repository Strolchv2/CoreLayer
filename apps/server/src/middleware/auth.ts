import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { clearSessionCookie, resolveSession, SESSION_COOKIE } from '../services/sessions.js';

/** Lädt (falls vorhanden) die Session aus dem httpOnly-Cookie. */
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token) {
    const session = await resolveSession(token);
    if (session) {
      req.user = session.user;
      req.sessionId = session.sessionId;
    } else {
      clearSessionCookie(res);
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized('not_authenticated'));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized('not_authenticated'));
  if (req.user.role !== 'admin') return next(forbidden('admin_required'));
  next();
}

/** Liefert den angemeldeten Benutzer (nach requireAuth garantiert vorhanden). */
export function currentUser(req: Request) {
  if (!req.user) throw unauthorized('not_authenticated');
  return req.user;
}
