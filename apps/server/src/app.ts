import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { sessionMiddleware } from './middleware/auth.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { apiRouter } from './routes/index.js';

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** Entfernt IDs und Query-Strings aus URLs, damit Logs keine Rückschlüsse auf Personen erlauben. */
function scrubUrl(url: string): string {
  return url.split('?')[0]!.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', parseTrustProxy(config.trustProxy));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ["'self'", 'blob:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'self'"],
          ...(config.cookieSecure ? { 'upgrade-insecure-requests': [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: config.cookieSecure ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: scrubUrl(req.url) }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    '/api',
    express.json({ limit: '2mb' }),
    cookieParser(),
    csrfMiddleware,
    sessionMiddleware,
    apiLimiter,
    (_req, res, next) => {
      // API-Antworten enthalten persönliche Daten: niemals in gemeinsamen Caches speichern
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    apiRouter,
  );
  app.use('/api', notFoundHandler);

  // Optional: gebautes Frontend direkt ausliefern (Einzel-Container-Betrieb)
  if (process.env.SERVE_WEB === 'true') {
    const webDir = config.renderBundleDir;
    const indexFile = path.join(webDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      app.use(express.static(webDir, { index: false, maxAge: '1y', immutable: true, setHeaders: noCacheHtml }));
      app.get(/^(?!\/api\/).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexFile);
      });
    } else {
      logger.warn('SERVE_WEB=true, aber kein Frontend-Build gefunden');
    }
  }

  app.use(errorHandler);
  return app;
}

function noCacheHtml(res: express.Response, filePath: string): void {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
}
