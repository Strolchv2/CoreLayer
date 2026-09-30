import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { randomToken, safeEqual } from '../lib/crypto.js';
import { forbidden } from '../lib/errors.js';
import { CSRF_COOKIE } from '../services/sessions.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF-Schutz (Double-Submit-Cookie):
 *  - Server setzt ein zufälliges Token in ein lesbares Cookie (SameSite=Strict).
 *  - Das Frontend sendet es bei jeder verändernden Anfrage im Header X-CSRF-Token.
 *  - Zusätzlich wird der Origin-Header gegen APP_URL geprüft (falls vorhanden).
 * Das Session-Cookie selbst ist httpOnly und SameSite=Lax.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.[CSRF_COOKIE];
  if (typeof token !== 'string' || token.length < 20) {
    token = randomToken(24);
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: config.sessionTtlMs,
    });
    // Beim ersten Kontakt kann eine verändernde Anfrage noch kein gültiges Token haben
    if (!SAFE_METHODS.has(req.method)) return next(forbidden('csrf_invalid'));
  }
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) return next(forbidden('csrf_origin'));

  const header = req.get('x-csrf-token');
  if (!header || !safeEqual(header, token)) return next(forbidden('csrf_invalid'));
  next();
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const allowed = new URL(config.appUrl).origin;
    return origin === allowed || (!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  } catch {
    return false;
  }
}
