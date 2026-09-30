import { Router } from 'express';
import { sql } from 'kysely';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { accountRouter } from './account.js';
import { adminRouter } from './admin.js';
import { aiRouter } from './ai.js';
import { authRouter } from './auth.js';
import { coverLettersRouter } from './coverLetters.js';
import { dashboardRouter } from './dashboard.js';
import { documentsRouter } from './documents.js';
import { importRouter } from './import.js';
import { profilesRouter } from './profiles.js';
import { resumesRouter } from './resumes.js';
import { templatesRouter } from './templates.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  try {
    await sql`select 1`.execute(db);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

/** Angaben des Betreibers für Impressum/Datenschutz (aus der Server-Konfiguration). */
apiRouter.get('/legal', (_req, res) => {
  res.json({ ...config.legal, appUrl: config.appUrl });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/account', accountRouter);
apiRouter.use('/templates', templatesRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/resumes', resumesRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/cover-letters', coverLettersRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/import', importRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/admin', adminRouter);
