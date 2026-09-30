import { coverLetterCreateSchema, coverLetterSaveSchema } from '@cv-studio/shared';
import { Router } from 'express';
import { z } from 'zod';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import {
  createCoverLetter,
  deleteCoverLetter,
  duplicateCoverLetter,
  getCoverLetter,
  listCoverLetters,
  saveCoverLetter,
} from '../services/coverLetters.js';
import { coverLetterExportRouter } from './coverLetterExport.js';

export const coverLettersRouter = Router();
coverLettersRouter.use(requireAuth);

coverLettersRouter.get('/', async (req, res) => {
  res.json({ coverLetters: await listCoverLetters(currentUser(req).id) });
});

coverLettersRouter.post('/', async (req, res) => {
  const input = parse(coverLetterCreateSchema.extend({ demo: z.boolean().default(false) }), req.body);
  res.status(201).json({ coverLetter: await createCoverLetter(currentUser(req).id, input) });
});

coverLettersRouter.get('/:id', async (req, res) => {
  res.json({ coverLetter: await getCoverLetter(currentUser(req).id, parseUuidParam(req.params.id)) });
});

coverLettersRouter.put('/:id', async (req, res) => {
  const input = parse(coverLetterSaveSchema, req.body);
  res.json(await saveCoverLetter(currentUser(req).id, parseUuidParam(req.params.id), input));
});

coverLettersRouter.post('/:id/duplicate', async (req, res) => {
  res.status(201).json({ coverLetter: await duplicateCoverLetter(currentUser(req).id, parseUuidParam(req.params.id)) });
});

coverLettersRouter.delete('/:id', async (req, res) => {
  await deleteCoverLetter(currentUser(req).id, parseUuidParam(req.params.id));
  res.json({ ok: true });
});

coverLettersRouter.use('/:id', coverLetterExportRouter);
