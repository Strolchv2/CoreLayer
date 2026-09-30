import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Not found' } });
};

/**
 * Zentrale Fehlerbehandlung: Benutzer erhalten nur Fehlercodes und neutrale Meldungen,
 * niemals Stacktraces. Unerwartete Fehler werden ohne personenbezogene Daten protokolliert.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
    return;
  }
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: { code: tooLarge ? 'file_too_large' : 'upload_failed', message: tooLarge ? 'File too large' : 'Upload failed' },
    });
    return;
  }
  const e = err as { type?: string; status?: number; name?: string; message?: string; code?: string };
  if (e.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Payload too large' } });
    return;
  }
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Invalid JSON' } });
    return;
  }
  logger.error(
    { errName: e.name, errCode: e.code, errMessage: e.message, route: req.route?.path ?? req.path.replace(/[0-9a-f-]{36}/gi, ':id'), method: req.method },
    'Unerwarteter Serverfehler',
  );
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
};
