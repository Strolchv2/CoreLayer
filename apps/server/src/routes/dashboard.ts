import type { DashboardDTO } from '@cv-studio/shared';
import { Router } from 'express';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { listResumes } from '../services/resumes.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req, res) => {
  const userId = currentUser(req).id;
  const [counts, resumes] = await Promise.all([
    db
      .selectNoFrom((eb) => [
        eb.selectFrom('resumes').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).where('archived_at', 'is', null).as('resumes'),
        eb.selectFrom('resumes').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).where('archived_at', 'is not', null).as('archived'),
        eb
          .selectFrom('resumes')
          .select(sql<string>`count(*)`.as('c'))
          .where('user_id', '=', userId)
          .where('archived_at', 'is', null)
          .where('last_exported_at', 'is', null)
          .as('drafts'),
        eb.selectFrom('export_events').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).as('exports'),
        eb.selectFrom('cover_letters').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).as('letters'),
        eb.selectFrom('documents').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).where('category', '!=', 'photo').as('documents'),
        eb.selectFrom('profiles').select(sql<string>`count(*)`.as('c')).where('user_id', '=', userId).as('profiles'),
      ])
      .executeTakeFirstOrThrow(),
    listResumes(userId, 'active'),
  ]);
  const body: DashboardDTO = {
    resumeCount: Number(counts.resumes),
    archivedCount: Number(counts.archived),
    draftCount: Number(counts.drafts),
    exportCount: Number(counts.exports),
    coverLetterCount: Number(counts.letters),
    documentCount: Number(counts.documents),
    profileCount: Number(counts.profiles),
    recentResumes: resumes.slice(0, 6),
    lastEdited: resumes[0] ?? null,
  };
  res.json(body);
});
