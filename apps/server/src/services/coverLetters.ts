import {
  coverLetterContentSchema,
  createDemoCoverLetter,
  getTemplateMeta,
  LIMITS,
  normalizeDesign,
  type CoverLetterContent,
  type CoverLetterCreateInput,
  type CoverLetterDTO,
  type CoverLetterSaveInput,
  type CoverLetterSummaryDTO,
  type DateFormat,
  type Locale,
  type TemplateKey,
} from '@cv-studio/shared';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import type { CoverLetterRow } from '../db/types.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { filterOwnedDocumentIds, readContent } from './content.js';

const n = (v: string): string | null => (v === '' ? null : v);

export async function getOwnedCoverLetterRow(userId: string, id: string): Promise<CoverLetterRow> {
  const row = await db.selectFrom('cover_letters').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw notFound();
  return row;
}

function toContent(row: CoverLetterRow): CoverLetterContent {
  return coverLetterContentSchema.parse({
    sender: row.sender,
    recipient: row.recipient,
    place: row.place ?? '',
    date: row.letter_date ?? '',
    subject: row.subject ?? '',
    salutation: row.salutation ?? '',
    body: row.body ?? '',
    closing: row.closing ?? '',
    signatureName: row.signature_name ?? '',
    signatureDocumentId: row.signature_document_id,
  });
}

export function toCoverLetterDTO(row: CoverLetterRow): CoverLetterDTO {
  return {
    id: row.id,
    title: row.title,
    language: row.language as Locale,
    resumeId: row.resume_id,
    useResumeDesign: row.use_resume_design,
    templateKey: row.template_key as TemplateKey,
    design: normalizeDesign(row.design, getTemplateMeta(row.template_key).defaultDesign),
    dateFormat: row.date_format as DateFormat,
    version: row.version,
    content: toContent(row),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listCoverLetters(userId: string): Promise<CoverLetterSummaryDTO[]> {
  const rows = await db
    .selectFrom('cover_letters')
    .leftJoin('resumes', 'resumes.id', 'cover_letters.resume_id')
    .select([
      'cover_letters.id',
      'cover_letters.title',
      'cover_letters.language',
      'cover_letters.resume_id',
      'cover_letters.subject',
      'cover_letters.recipient',
      'cover_letters.created_at',
      'cover_letters.updated_at',
      'resumes.title as resume_title',
    ])
    .where('cover_letters.user_id', '=', userId)
    .orderBy('cover_letters.updated_at', 'desc')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    language: r.language as Locale,
    resumeId: r.resume_id,
    resumeTitle: r.resume_title ?? null,
    subject: r.subject ?? '',
    company: String((r.recipient as Record<string, unknown>)?.company ?? ''),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function getCoverLetter(userId: string, id: string): Promise<CoverLetterDTO> {
  return toCoverLetterDTO(await getOwnedCoverLetterRow(userId, id));
}

export async function createCoverLetter(userId: string, input: CoverLetterCreateInput & { demo?: boolean }): Promise<CoverLetterDTO> {
  const { c } = await db
    .selectFrom('cover_letters')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  if (Number(c) >= LIMITS.coverLettersPerUser) throw conflict('cover_letter_limit_reached');

  let content: CoverLetterContent = input.demo ? createDemoCoverLetter(input.language) : coverLetterContentSchema.parse({});
  let templateKey = 'classic';
  let design = getTemplateMeta('classic').defaultDesign;
  let dateFormat: DateFormat = 'DD.MM.YYYY';

  if (input.resumeId) {
    const resume = await db
      .selectFrom('resumes')
      .selectAll()
      .where('id', '=', input.resumeId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!resume) throw notFound();
    templateKey = resume.template_key;
    design = normalizeDesign(resume.design, getTemplateMeta(resume.template_key).defaultDesign);
    // Absenderdaten aus dem Lebenslauf übernehmen
    const rc = await readContent(db, resume.content_id);
    const p = rc.personal;
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
    content = {
      ...content,
      sender: { name, street: p.street, postalCode: p.postalCode, city: p.city, phone: p.phone, email: p.email },
      place: content.place || p.city,
      signatureName: content.signatureName || name,
    };
  }
  if (!content.salutation) content.salutation = input.language === 'en' ? 'Dear Sir or Madam,' : 'Sehr geehrte Damen und Herren,';
  if (!content.closing) content.closing = input.language === 'en' ? 'Kind regards,' : 'Mit freundlichen Grüßen';

  const row = await db
    .insertInto('cover_letters')
    .values({
      user_id: userId,
      resume_id: input.resumeId,
      title: input.title,
      language: input.language,
      use_resume_design: Boolean(input.resumeId),
      template_key: templateKey,
      design: JSON.stringify(design),
      date_format: dateFormat,
      ...contentColumns(content),
      signature_document_id: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toCoverLetterDTO(row);
}

function contentColumns(c: CoverLetterContent) {
  return {
    sender: JSON.stringify(c.sender),
    recipient: JSON.stringify(c.recipient),
    place: n(c.place),
    letter_date: n(c.date),
    subject: n(c.subject),
    salutation: n(c.salutation),
    body: n(c.body),
    closing: n(c.closing),
    signature_name: n(c.signatureName),
  };
}

export async function saveCoverLetter(userId: string, id: string, input: CoverLetterSaveInput): Promise<{ version: number; updatedAt: string }> {
  await getOwnedCoverLetterRow(userId, id);
  if (input.resumeId) {
    const exists = await db.selectFrom('resumes').select('id').where('id', '=', input.resumeId).where('user_id', '=', userId).executeTakeFirst();
    if (!exists) throw badRequest('resume_not_found');
  }
  const owned = await filterOwnedDocumentIds(db, userId, input.content.signatureDocumentId ? [input.content.signatureDocumentId] : []);
  const signatureId = input.content.signatureDocumentId && owned.has(input.content.signatureDocumentId) ? input.content.signatureDocumentId : null;
  const updated = await db
    .updateTable('cover_letters')
    .set({
      title: input.title,
      language: input.language,
      resume_id: input.resumeId,
      use_resume_design: input.useResumeDesign,
      template_key: input.templateKey,
      design: JSON.stringify(input.design),
      date_format: input.dateFormat,
      ...contentColumns(input.content),
      signature_document_id: signatureId,
      version: sql`version + 1`,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .where('version', '=', input.version)
    .returning(['version', 'updated_at'])
    .executeTakeFirst();
  if (!updated) throw conflict('version_conflict');
  return { version: updated.version, updatedAt: updated.updated_at.toISOString() };
}

export async function duplicateCoverLetter(userId: string, id: string): Promise<CoverLetterDTO> {
  const s = await getOwnedCoverLetterRow(userId, id);
  const { id: _id, created_at: _c, updated_at: _u, version: _v, ...rest } = s;
  const row = await db
    .insertInto('cover_letters')
    .values({
      ...rest,
      title: `${s.title.slice(0, 140)} (${s.language === 'en' ? 'copy' : 'Kopie'})`,
      design: JSON.stringify(s.design),
      sender: JSON.stringify(s.sender),
      recipient: JSON.stringify(s.recipient),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toCoverLetterDTO(row);
}

export async function deleteCoverLetter(userId: string, id: string): Promise<void> {
  await getOwnedCoverLetterRow(userId, id);
  await db.deleteFrom('cover_letters').where('id', '=', id).where('user_id', '=', userId).execute();
}
