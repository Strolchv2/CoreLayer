import pino from 'pino';
import { config } from '../config.js';

/**
 * Anwendungs-Logger. Personenbezogene Daten werden nicht protokolliert:
 * - keine Request-/Response-Bodies
 * - Cookies, Authorization-Header und E-Mail-/Passwortfelder werden entfernt
 * - URLs werden ohne Query-String protokolliert (siehe httpLogger)
 */
export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.email',
      '*.password',
      '*.token',
    ],
    remove: true,
  },
  transport:
    !config.isProduction && !config.isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
