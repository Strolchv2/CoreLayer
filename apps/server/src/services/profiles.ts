import {
  cloneContentWithNewIds,
  createEmptyContent,
  LIMITS,
  type ProfileDTO,
  type ProfileSaveInput,
  type ProfileSummaryDTO,
} from '@cv-studio/shared';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import type { ProfileRow } from '../db/types.js';
import { conflict, notFound } from '../lib/errors.js';
import { createContent, deleteContent, readContent, readHeadlines, writeContent } from './content.js';

/**
 * Profile sind wiederverwendbare Inhaltsvorlagen ("Elektrotechnik", "Projektleiter" …),
 * aus denen beliebig viele Lebensläufe erzeugt werden können.
 */
export async function getOwnedProfile(userId: string, id: string): Promise<ProfileRow> {
  const row = await db.selectFrom('profiles').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw notFound();
  return row;
}

export async function listProfiles(userId: string): Promise<ProfileSummaryDTO[]> {
  const rows = await db
    .selectFrom('profiles')
    .selectAll('profiles')
    .select((eb) =>
      eb.selectFrom('resumes').select(eb.fn.countAll<string>().as('c')).whereRef('resumes.profile_id', '=', 'profiles.id').as('resume_count'),
    )
    .where('profiles.user_id', '=', userId)
    .orderBy('profiles.updated_at', 'desc')
    .execute();
  const headlines = await readHeadlines(db, rows.map((r) => r.content_id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    fullName: headlines.get(r.content_id)?.fullName ?? '',
    jobTitle: headlines.get(r.content_id)?.jobTitle ?? '',
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    resumeCount: Number(r.resume_count ?? 0),
  }));
}

export async function getProfile(userId: string, id: string): Promise<ProfileDTO> {
  const row = await getOwnedProfile(userId, id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    version: row.version,
    content: await readContent(db, row.content_id),
  };
}

export async function createProfile(
  userId: string,
  input: { name: string; description: string; fromResumeId?: string },
): Promise<ProfileDTO> {
  const { c } = await db
    .selectFrom('profiles')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  if (Number(c) >= LIMITS.profilesPerUser) throw conflict('profile_limit_reached');

  let content = createEmptyContent();
  if (input.fromResumeId) {
    const resume = await db
      .selectFrom('resumes')
      .select('content_id')
      .where('id', '=', input.fromResumeId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!resume) throw notFound();
    content = cloneContentWithNewIds(await readContent(db, resume.content_id));
  }
  const row = await db.transaction().execute(async (trx) => {
    const contentId = await createContent(trx, userId, content);
    return trx
      .insertInto('profiles')
      .values({ user_id: userId, content_id: contentId, name: input.name, description: input.description })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
  return getProfile(userId, row.id);
}

export async function saveProfile(userId: string, id: string, input: ProfileSaveInput): Promise<{ version: number; updatedAt: string }> {
  await getOwnedProfile(userId, id);
  return db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('profiles')
      .set({ name: input.name, description: input.description, version: sql`version + 1`, updated_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('version', '=', input.version)
      .returning(['version', 'updated_at', 'content_id'])
      .executeTakeFirst();
    if (!updated) throw conflict('version_conflict');
    await writeContent(trx, updated.content_id, userId, input.content);
    return { version: updated.version, updatedAt: updated.updated_at.toISOString() };
  });
}

export async function duplicateProfile(userId: string, id: string): Promise<ProfileDTO> {
  const source = await getOwnedProfile(userId, id);
  const content = cloneContentWithNewIds(await readContent(db, source.content_id));
  const row = await db.transaction().execute(async (trx) => {
    const contentId = await createContent(trx, userId, content);
    return trx
      .insertInto('profiles')
      .values({ user_id: userId, content_id: contentId, name: `${source.name.slice(0, 90)} (Kopie)`, description: source.description })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
  return getProfile(userId, row.id);
}

export async function deleteProfile(userId: string, id: string): Promise<void> {
  const row = await getOwnedProfile(userId, id);
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('profiles').where('id', '=', row.id).execute();
    await deleteContent(trx, row.content_id);
  });
}
