import { profileCreateSchema, profileSaveSchema } from '@cv-studio/shared';
import { Router } from 'express';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { createProfile, deleteProfile, duplicateProfile, getProfile, listProfiles, saveProfile } from '../services/profiles.js';

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

profilesRouter.get('/', async (req, res) => {
  res.json({ profiles: await listProfiles(currentUser(req).id) });
});

profilesRouter.post('/', async (req, res) => {
  const input = parse(profileCreateSchema, req.body);
  const fromResumeId = input.fromResumeId ? parseUuidParam(input.fromResumeId) : undefined;
  res.status(201).json({ profile: await createProfile(currentUser(req).id, { ...input, fromResumeId }) });
});

profilesRouter.get('/:id', async (req, res) => {
  res.json({ profile: await getProfile(currentUser(req).id, parseUuidParam(req.params.id)) });
});

profilesRouter.put('/:id', async (req, res) => {
  const input = parse(profileSaveSchema, req.body);
  res.json(await saveProfile(currentUser(req).id, parseUuidParam(req.params.id), input));
});

profilesRouter.post('/:id/duplicate', async (req, res) => {
  res.status(201).json({ profile: await duplicateProfile(currentUser(req).id, parseUuidParam(req.params.id)) });
});

profilesRouter.delete('/:id', async (req, res) => {
  await deleteProfile(currentUser(req).id, parseUuidParam(req.params.id));
  res.json({ ok: true });
});
