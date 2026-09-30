import { resumeCreateSchema, resumePatchSchema, resumeSaveSchema } from '@cv-studio/shared';
import { Router } from 'express';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import {
  createResume,
  deleteResume,
  duplicateResume,
  getResume,
  listResumes,
  patchResume,
  saveResume,
} from '../services/resumes.js';
import { resumeExportRouter } from './resumeExport.js';

export const resumesRouter = Router();
resumesRouter.use(requireAuth);

resumesRouter.get('/', async (req, res) => {
  const filter = req.query.filter === 'archived' ? 'archived' : req.query.filter === 'all' ? 'all' : 'active';
  res.json({ resumes: await listResumes(currentUser(req).id, filter) });
});

resumesRouter.post('/', async (req, res) => {
  const user = currentUser(req);
  const input = parse(resumeCreateSchema, req.body);
  const resume = await createResume(user.id, input, user.defaultDateFormat);
  await audit(user.id, 'resume.created', { source: input.source.type });
  res.status(201).json({ resume });
});

resumesRouter.get('/:id', async (req, res) => {
  res.json({ resume: await getResume(currentUser(req).id, parseUuidParam(req.params.id)) });
});

/** Autosave: vollständiger Stand inkl. Versionsnummer (optimistische Sperre). */
resumesRouter.put('/:id', async (req, res) => {
  const input = parse(resumeSaveSchema, req.body);
  res.json(await saveResume(currentUser(req).id, parseUuidParam(req.params.id), input));
});

/** Teilaktualisierung aus der Übersicht: umbenennen, archivieren, Vorlage/Sprache wechseln. */
resumesRouter.patch('/:id', async (req, res) => {
  const input = parse(resumePatchSchema, req.body);
  res.json({ resume: await patchResume(currentUser(req).id, parseUuidParam(req.params.id), input) });
});

resumesRouter.post('/:id/duplicate', async (req, res) => {
  const user = currentUser(req);
  const resume = await duplicateResume(user.id, parseUuidParam(req.params.id));
  await audit(user.id, 'resume.duplicated');
  res.status(201).json({ resume });
});

resumesRouter.delete('/:id', async (req, res) => {
  const user = currentUser(req);
  await deleteResume(user.id, parseUuidParam(req.params.id));
  await audit(user.id, 'resume.deleted');
  res.json({ ok: true });
});

resumesRouter.use('/:id', resumeExportRouter);
