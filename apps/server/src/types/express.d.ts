import type { AuthUser } from '../services/sessions.js';

declare global {
  namespace Express {
    interface Request {
      /** Angemeldeter Benutzer (durch sessionMiddleware gesetzt) */
      user?: AuthUser;
      /** SHA-256 des Session-Tokens */
      sessionId?: string;
    }
  }
}

export {};
