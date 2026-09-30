import type { RequestHandler } from 'express';
import { rateLimit, type Options, type Store } from 'express-rate-limit';
import { Redis } from 'ioredis';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Rate Limiting. Mit REDIS_URL wird der Zähler in Redis gehalten (mehrere Instanzen),
 * sonst im Arbeitsspeicher der Instanz.
 */
export let redis: Redis | null = null;
if (config.redisUrl) {
  redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  redis.on('error', (err) => logger.warn({ err: err.message }, 'Redis-Verbindungsfehler'));
}

function store(prefix: string): Store | undefined {
  if (!redis) return undefined;
  const client = redis;
  return new RedisStore({
    prefix: `cvs:rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) => client.call(command, ...args) as Promise<RedisReply>,
  });
}

function limiter(prefix: string, options: Partial<Options>): RequestHandler {
  if (config.rateLimitDisabled) return (_req, _res, next) => next();
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: store(prefix),
    passOnStoreError: true,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests' } });
    },
    ...options,
  });
}

/** Allgemeines API-Limit */
export const apiLimiter = limiter('api', { windowMs: 60_000, limit: 300 });
/** Login/Registrierung: Schutz vor Brute-Force */
export const authLimiter = limiter('auth', { windowMs: 15 * 60_000, limit: 20, skipSuccessfulRequests: true });
/** Passwort-Reset-Mails */
export const resetLimiter = limiter('reset', { windowMs: 60 * 60_000, limit: 5 });
/** Rechenintensive Exporte (PDF/DOCX) */
export const exportLimiter = limiter('export', { windowMs: 60_000, limit: 20 });
/** Uploads & Import */
export const uploadLimiter = limiter('upload', { windowMs: 60_000, limit: 30 });
/** KI-Anfragen */
export const aiLimiter = limiter('ai', { windowMs: 60_000, limit: 15 });
