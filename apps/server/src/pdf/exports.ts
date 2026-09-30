/**
 * Export-Funktionen: Lebenslauf-PDF, Anschreiben-PDF und Bewerbungspaket
 * (zusammengeführt als eine PDF oder als einzelne Dateien im ZIP).
 */
import {
  buildExportFileName,
  fullName,
  getCvLabels,
  getTemplateMeta,
  normalizeDesign,
  type CoverLetterRenderData,
  type ExportOptions,
  type Locale,
  type RenderRequest,
  type ResumeDTO,
  type ResumeRenderData,
} from '@cv-studio/shared';
import { PDFDocument, PageSizes } from 'pdf-lib';
import { db } from '../db/index.js';
import { badRequest } from '../lib/errors.js';
import type { DocumentRow } from '../db/types.js';
import { readContent } from '../services/content.js';
import { getCoverLetter } from '../services/coverLetters.js';
import { documentAsDataUrl, readDocumentData } from '../services/documents.js';
import { getResume } from '../services/resumes.js';
import { pdfRenderer } from './renderer.js';

export interface ExportFile {
  fileName: string;
  data: Buffer;
  contentType: string;
}

export async function resumeRenderRequest(userId: string, resume: ResumeDTO): Promise<RenderRequest> {
  const photoHidden = resume.content.personal.hidden.includes('photo') || !resume.design.showPhoto;
  const data: ResumeRenderData = {
    content: resume.content,
    design: resume.design,
    templateKey: resume.templateKey,
    language: resume.language,
    dateFormat: resume.dateFormat,
    photoUrl: photoHidden ? null : await documentAsDataUrl(userId, resume.content.personal.photoId),
  };
  const labels = getCvLabels(resume.language);
  return { kind: 'resume', data, title: [fullName(resume.content), labels.resumeWord].filter(Boolean).join(' – ') };
}

async function withMetadata(pdf: Buffer, meta: { title: string; author: string; language: Locale }): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  if (meta.author) doc.setAuthor(meta.author);
  doc.setCreator('CV Studio');
  doc.setProducer('CV Studio (Chromium)');
  doc.setLanguage(meta.language === 'en' ? 'en-GB' : 'de-DE');
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  return Buffer.from(await doc.save());
}

export async function exportResumePdf(userId: string, resumeId: string): Promise<ExportFile> {
  const resume = await getResume(userId, resumeId);
  const request = await resumeRenderRequest(userId, resume);
  const raw = await pdfRenderer.render(request);
  const name = fullName(resume.content);
  const labels = getCvLabels(resume.language);
  const data = await withMetadata(raw, { title: request.title, author: name, language: resume.language });
  const p = resume.content.personal;
  return {
    fileName: buildExportFileName([p.firstName, p.lastName, labels.resumeWord === 'CV' ? 'CV' : 'Lebenslauf'], 'pdf'),
    data,
    contentType: 'application/pdf',
  };
}

export async function coverLetterRenderRequest(userId: string, letterId: string): Promise<{ request: RenderRequest; author: string; language: Locale }> {
  const letter = await getCoverLetter(userId, letterId);
  let templateKey = letter.templateKey;
  let design = letter.design;
  let personal: CoverLetterRenderData['personal'] = null;
  if (letter.resumeId) {
    const resume = await db
      .selectFrom('resumes')
      .selectAll()
      .where('id', '=', letter.resumeId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (resume) {
      personal = (await readContent(db, resume.content_id)).personal;
      if (letter.useResumeDesign) {
        templateKey = resume.template_key as typeof templateKey;
        design = normalizeDesign(resume.design, getTemplateMeta(resume.template_key).defaultDesign);
      }
    }
  }
  const data: CoverLetterRenderData = {
    content: letter.content,
    design,
    templateKey,
    language: letter.language,
    dateFormat: letter.dateFormat,
    signatureUrl: await documentAsDataUrl(userId, letter.content.signatureDocumentId),
    personal,
  };
  const labels = getCvLabels(letter.language);
  const author = letter.content.sender.name;
  return {
    request: { kind: 'cover-letter', data, title: [author, labels.coverLetterWord].filter(Boolean).join(' – ') },
    author,
    language: letter.language,
  };
}

export async function exportCoverLetterPdf(userId: string, letterId: string): Promise<ExportFile> {
  const { request, author, language } = await coverLetterRenderRequest(userId, letterId);
  const raw = await pdfRenderer.render(request);
  const data = await withMetadata(raw, { title: request.title, author, language });
  const [first = '', ...rest] = author.split(' ');
  return {
    fileName: buildExportFileName([first, rest.join(' '), language === 'en' ? 'Cover_Letter' : 'Anschreiben'], 'pdf'),
    data,
    contentType: 'application/pdf',
  };
}

/** Wandelt ein hochgeladenes Dokument in PDF-Seiten um (Bilder werden auf A4 eingepasst). */
async function documentToPdf(row: DocumentRow): Promise<PDFDocument> {
  const data = await readDocumentData(row);
  if (row.mime_type === 'application/pdf') return PDFDocument.load(data);
  const doc = await PDFDocument.create();
  const image = row.mime_type === 'image/png' ? await doc.embedPng(data) : await doc.embedJpg(data);
  const [pageWidth, pageHeight] = PageSizes.A4;
  const margin = 36; // 12,7 mm
  const scale = Math.min((pageWidth - 2 * margin) / image.width, (pageHeight - 2 * margin) / image.height, 1.5);
  const w = image.width * scale;
  const h = image.height * scale;
  const page = doc.addPage([pageWidth, pageHeight]);
  page.drawImage(image, { x: (pageWidth - w) / 2, y: pageHeight - margin - h, width: w, height: h });
  doc.setTitle(row.title);
  return doc;
}

async function mergePdfs(parts: PDFDocument[], title: string, author: string, language: Locale): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const part of parts) {
    const pages = await out.copyPages(part, part.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  out.setTitle(title, { showInWindowTitleBar: true });
  if (author) out.setAuthor(author);
  out.setCreator('CV Studio');
  out.setProducer('CV Studio');
  out.setLanguage(language === 'en' ? 'en-GB' : 'de-DE');
  return Buffer.from(await out.save());
}

const GROUPS = {
  references: ['school_report', 'employment_reference'],
  certificates: ['certificate'],
  other: ['drivers_license', 'other'],
} as const;

/**
 * Bewerbungspaket:
 *   ZIP:    01_Lebenslauf.pdf, 02_Anschreiben.pdf, 03_Zeugnisse.pdf, 04_Zertifikate.pdf, 05_Anlagen.pdf
 *   Merged: Bewerbung_Vorname_Nachname.pdf
 */
export async function buildApplicationPackage(
  userId: string,
  resumeId: string,
  options: ExportOptions,
): Promise<{ mode: 'merged'; file: ExportFile } | { mode: 'zip'; zipName: string; files: ExportFile[] }> {
  const resume = await getResume(userId, resumeId);
  const en = resume.language === 'en';
  const p = resume.content.personal;
  const author = fullName(resume.content);

  const docs = options.documentIds.length
    ? await db.selectFrom('documents').selectAll().where('user_id', '=', userId).where('id', 'in', options.documentIds).execute()
    : [];
  // Reihenfolge der Auswahl beibehalten, Fotos ausschließen
  const ordered = options.documentIds.map((id) => docs.find((d) => d.id === id)).filter((d): d is DocumentRow => Boolean(d) && d!.category !== 'photo');

  const files: ExportFile[] = [];
  if (options.includeResume) {
    const cv = await exportResumePdf(userId, resumeId);
    files.push({ ...cv, fileName: en ? '01_CV.pdf' : '01_Lebenslauf.pdf' });
  }
  if (options.coverLetterId) {
    const letter = await exportCoverLetterPdf(userId, options.coverLetterId);
    files.push({ ...letter, fileName: en ? '02_Cover_Letter.pdf' : '02_Anschreiben.pdf' });
  }
  const groupFiles: [keyof typeof GROUPS, string, string][] = [
    ['references', '03_Zeugnisse.pdf', '03_References.pdf'],
    ['certificates', '04_Zertifikate.pdf', '04_Certificates.pdf'],
    ['other', '05_Anlagen.pdf', '05_Attachments.pdf'],
  ];
  for (const [group, deName, enName] of groupFiles) {
    const members = ordered.filter((d) => (GROUPS[group] as readonly string[]).includes(d.category));
    if (members.length === 0) continue;
    const parts = await Promise.all(members.map(documentToPdf));
    files.push({ fileName: en ? enName : deName, data: await mergePdfs(parts, en ? enName : deName, author, resume.language), contentType: 'application/pdf' });
  }
  if (files.length === 0) throw badRequest('nothing_selected');

  const baseName = buildExportFileName([en ? 'Application' : 'Bewerbung', p.firstName, p.lastName], 'pdf');
  if (options.mode === 'merged') {
    const parts = await Promise.all(files.map((f) => PDFDocument.load(f.data)));
    const labels = getCvLabels(resume.language);
    const data = await mergePdfs(parts, [labels.applicationWord, author].filter(Boolean).join(' – '), author, resume.language);
    return { mode: 'merged', file: { fileName: baseName, data, contentType: 'application/pdf' } };
  }
  return { mode: 'zip', zipName: baseName.replace(/\.pdf$/, '.zip'), files };
}
