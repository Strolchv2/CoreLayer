import {
  cloneContentWithNewIds,
  createDemoContent,
  createEmptyContent,
  getTemplateMeta,
  LIMITS,
  normalizeDesign,
  type DateFormat,
  type Locale,
  type ResumeContent,
  type ResumeCreateInput,
  type ResumeDTO,
  type ResumePatchInput,
  type ResumeSaveInput,
  type ResumeSummaryDTO,
  type TemplateKey,
} from '@cv-studio/shared';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import type { ResumeRow } from '../db/types.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { createContent, deleteContent, filterOwnedDocumentIds, readContent, readHeadlines, writeContent } from './content.js';
import { getOwnedProfile } from './profiles.js';
import { isTemplateActive } from './templates.js';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toSummary(row: ResumeRow, headline?: { fullName: string; jobTitle: string }): ResumeSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    language: row.language as Locale,
    templateKey: row.template_key as TemplateKey,
    fullName: headline?.fullName ?? '',
    jobTitle: headline?.jobTitle ?? '',
    archivedAt: iso(row.archived_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastExportedAt: iso(row.last_exported_at),
    profileId: row.profile_id,
  };
}

/** Lädt einen Lebenslauf ausschließlich für seinen Eigentümer (Schutz vor IDOR). */
export async function getOwnedResumeRow(userId: string, id: string): Promise<ResumeRow> {
  const row = await db.selectFrom('resumes').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw notFound();
  return row;
}

export async function listResumes(userId: string, filter: 'active' | 'archived' | 'all' = 'active'): Promise<ResumeSummaryDTO[]> {
  let q = db.selectFrom('resumes').selectAll().where('user_id', '=', userId).orderBy('updated_at', 'desc');
  if (filter === 'active') q = q.where('archived_at', 'is', null);
  if (filter === 'archived') q = q.where('archived_at', 'is not', null);
  const rows = await q.execute();
  const headlines = await readHeadlines(db, rows.map((r) => r.content_id));
  return rows.map((r) => toSummary(r, headlines.get(r.content_id)));
}

export async function getResume(userId: string, id: string): Promise<ResumeDTO> {
  const row = await getOwnedResumeRow(userId, id);
  return buildResumeDTO(row);
}

async function buildResumeDTO(row: ResumeRow): Promise<ResumeDTO> {
  const [content, attachments] = await Promise.all([
    readContent(db, row.content_id),
    db.selectFrom('resume_attachments').select('document_id').where('resume_id', '=', row.id).orderBy('position').execute(),
  ]);
  const { fullName: _f, jobTitle: _j, ...summary } = toSummary(row);
  return {
    ...summary,
    design: normalizeDesign(row.design, getTemplateMeta(row.template_key).defaultDesign),
    dateFormat: row.date_format as DateFormat,
    version: row.version,
    content,
    attachmentIds: attachments.map((a) => a.document_id),
  };
}

async function assertResumeLimit(userId: string): Promise<void> {
  const { c } = await db
    .selectFrom('resumes')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  if (Number(c) >= LIMITS.resumesPerUser) throw conflict('resume_limit_reached');
}

export async function createResume(userId: string, input: ResumeCreateInput, defaultDateFormat: DateFormat): Promise<ResumeDTO> {
  await assertResumeLimit(userId);
  if (!(await isTemplateActive(input.templateKey))) throw badRequest('template_inactive');

  let content: ResumeContent;
  let profileId: string | null = null;
  switch (input.source.type) {
    case 'demo':
      content = createDemoContent(input.language);
      break;
    case 'profile': {
      const profile = await getOwnedProfile(userId, input.source.profileId);
      content = cloneContentWithNewIds(await readContent(db, profile.content_id));
      profileId = profile.id;
      break;
    }
    case 'content':
      content = input.source.content;
      break;
    default:
      content = createEmptyContent();
  }

  const template = getTemplateMeta(input.templateKey);
  const row = await db.transaction().execute(async (trx) => {
    const contentId = await createContent(trx, userId, content);
    return trx
      .insertInto('resumes')
      .values({
        user_id: userId,
        content_id: contentId,
        profile_id: profileId,
        title: input.title,
        language: input.language,
        template_key: input.templateKey,
        design: JSON.stringify(template.defaultDesign),
        date_format: input.dateFormat ?? defaultDateFormat,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
  return buildResumeDTO(row);
}

/**
 * Vollständiges Speichern (Autosave). Optimistische Sperre über `version`:
 * Wurde der Lebenslauf zwischenzeitlich woanders geändert, antwortet der Server mit 409.
 */
export async function saveResume(userId: string, id: string, input: ResumeSaveInput): Promise<{ version: number; updatedAt: string }> {
  const current = await getOwnedResumeRow(userId, id);
  if (current.template_key !== input.templateKey && !(await isTemplateActive(input.templateKey))) {
    throw badRequest('template_inactive');
  }
  return db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('resumes')
      .set({
        title: input.title,
        language: input.language,
        template_key: input.templateKey,
        design: JSON.stringify(input.design),
        date_format: input.dateFormat,
        version: sql`version + 1`,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('version', '=', input.version)
      .returning(['version', 'updated_at', 'content_id'])
      .executeTakeFirst();
    if (!updated) throw conflict('version_conflict', 'Resume was modified elsewhere');

    await writeContent(trx, updated.content_id, userId, input.content);

    // Anhänge: nur eigene Dokumente zulassen
    const owned = await filterOwnedDocumentIds(trx, userId, input.attachmentIds);
    await trx.deleteFrom('resume_attachments').where('resume_id', '=', id).execute();
    const attachments = [...new Set(input.attachmentIds)].filter((d) => owned.has(d));
    if (attachments.length) {
      await trx
        .insertInto('resume_attachments')
        .values(attachments.map((documentId, position) => ({ resume_id: id, document_id: documentId, position })))
        .execute();
    }
    return { version: updated.version, updatedAt: updated.updated_at.toISOString() };
  });
}

export async function patchResume(userId: string, id: string, input: ResumePatchInput): Promise<ResumeSummaryDTO> {
  const current = await getOwnedResumeRow(userId, id);
  if (input.templateKey && input.templateKey !== current.template_key && !(await isTemplateActive(input.templateKey))) {
    throw badRequest('template_inactive');
  }
  const set: Record<string, unknown> = { updated_at: new Date(), version: sql`version + 1` };
  if (input.title !== undefined) set.title = input.title;
  if (input.language !== undefined) set.language = input.language;
  if (input.archived !== undefined) set.archived_at = input.archived ? new Date() : null;
  if (input.templateKey !== undefined) {
    set.template_key = input.templateKey;
    // Beim Vorlagenwechsel über die Liste: professionelle Standardeinstellungen der neuen Vorlage
    set.design = JSON.stringify(getTemplateMeta(input.templateKey).defaultDesign);
  }
  const row = await db
    .updateTable('resumes')
    .set(set)
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow();
  const headlines = await readHeadlines(db, [row.content_id]);
  return toSummary(row, headlines.get(row.content_id));
}

export async function duplicateResume(userId: string, id: string): Promise<ResumeDTO> {
  await assertResumeLimit(userId);
  const source = await getOwnedResumeRow(userId, id);
  const content = await readContent(db, source.content_id);
  const suffix = source.language === 'en' ? ' (copy)' : ' (Kopie)';
  const title = (source.title.length + suffix.length > LIMITS.resumeTitle ? source.title.slice(0, LIMITS.resumeTitle - suffix.length) : source.title) + suffix;
  const row = await db.transaction().execute(async (trx) => {
    const contentId = await createContent(trx, userId, cloneContentWithNewIds(content));
    const created = await trx
      .insertInto('resumes')
      .values({
        user_id: userId,
        content_id: contentId,
        profile_id: source.profile_id,
        title,
        language: source.language,
        template_key: source.template_key,
        design: JSON.stringify(source.design),
        date_format: source.date_format,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const attachments = await trx.selectFrom('resume_attachments').selectAll().where('resume_id', '=', source.id).execute();
    if (attachments.length) {
      await trx
        .insertInto('resume_attachments')
        .values(attachments.map((a) => ({ resume_id: created.id, document_id: a.document_id, position: a.position })))
        .execute();
    }
    return created;
  });
  return buildResumeDTO(row);
}

export async function deleteResume(userId: string, id: string): Promise<void> {
  const row = await getOwnedResumeRow(userId, id);
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('resumes').where('id', '=', row.id).where('user_id', '=', userId).execute();
    await deleteContent(trx, row.content_id);
  });
}

export async function recordExport(userId: string, resumeId: string | null, kind: string): Promise<void> {
  await db.insertInto('export_events').values({ user_id: userId, resume_id: resumeId, kind }).execute();
  if (resumeId) {
    await db.updateTable('resumes').set({ last_exported_at: new Date() }).where('id', '=', resumeId).where('user_id', '=', userId).execute();
  }
}
