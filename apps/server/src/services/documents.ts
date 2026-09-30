import {
  LIMITS,
  sanitizeUploadName,
  type AllowedUploadMimeType,
  type DocumentCategory,
  type DocumentDTO,
} from '@cv-studio/shared';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { db } from '../db/index.js';
import type { DocumentRow } from '../db/types.js';
import { sha256 } from '../lib/crypto.js';
import { badRequest, conflict, notFound, payloadTooLarge, unsupportedMedia } from '../lib/errors.js';
import { deleteStoredFile, newStorageKey, readStoredFile, writeStoredFile } from './storage.js';

const EXTENSIONS: Record<AllowedUploadMimeType, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

/** Erkennt den tatsächlichen Dateityp anhand der Signatur ("Magic Bytes"). */
export function detectMimeType(buf: Buffer): AllowedUploadMimeType | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  declaredMime: string;
}

export interface ValidatedUpload {
  data: Buffer;
  mimeType: AllowedUploadMimeType;
  originalName: string;
  pageCount: number | null;
}

/**
 * Prüft Dateiendung, deklarierten MIME-Type UND tatsächlichen Inhalt.
 * Bilder werden neu kodiert (entfernt Metadaten wie GPS, neutralisiert manipulierte Dateien),
 * PDFs werden vollständig geparst; verschlüsselte PDFs werden abgelehnt.
 */
export async function validateUpload(input: UploadInput, options: { maxBytes?: number; imagesOnly?: boolean; photo?: boolean } = {}): Promise<ValidatedUpload> {
  const maxBytes = options.maxBytes ?? LIMITS.uploadMaxBytes;
  if (input.buffer.length === 0) throw badRequest('file_empty');
  if (input.buffer.length > maxBytes) throw payloadTooLarge('file_too_large');

  const originalName = sanitizeUploadName(input.originalName);
  const ext = originalName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  const detected = detectMimeType(input.buffer);
  if (!detected) throw unsupportedMedia('unsupported_file_type');
  if (options.imagesOnly && detected === 'application/pdf') throw unsupportedMedia('image_required');
  if (!EXTENSIONS[detected].includes(ext)) throw unsupportedMedia('file_extension_mismatch');
  const declared = input.declaredMime.toLowerCase();
  const declaredOk = declared === detected || (detected === 'image/jpeg' && declared === 'image/jpg');
  if (!declaredOk) throw unsupportedMedia('mime_type_mismatch');

  if (detected === 'application/pdf') {
    let pageCount = 0;
    try {
      const pdf = await PDFDocument.load(input.buffer, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch (err) {
      if (/encrypt/i.test((err as Error).message)) throw badRequest('pdf_encrypted');
      throw badRequest('pdf_invalid');
    }
    if (pageCount === 0) throw badRequest('pdf_invalid');
    if (pageCount > 100) throw badRequest('pdf_too_many_pages');
    return { data: input.buffer, mimeType: detected, originalName, pageCount };
  }

  try {
    const maxSide = options.photo ? 1200 : 2480;
    let pipeline = sharp(input.buffer, { limitInputPixels: 40_000_000, failOn: 'error' })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
    pipeline = detected === 'image/png' && !options.photo ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 88, mozjpeg: true });
    const data = await pipeline.toBuffer();
    const mimeType: AllowedUploadMimeType = detected === 'image/png' && !options.photo ? 'image/png' : 'image/jpeg';
    const name = mimeType === 'image/jpeg' ? originalName.replace(/\.png$/i, '.jpg') : originalName;
    return { data, mimeType, originalName: name, pageCount: 1 };
  } catch {
    throw badRequest('image_invalid');
  }
}

export function toDocumentDTO(row: DocumentRow): DocumentDTO {
  return {
    id: row.id,
    title: row.title,
    category: row.category as DocumentCategory,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createDocument(userId: string, upload: ValidatedUpload, category: DocumentCategory, title: string): Promise<DocumentRow> {
  const count = await db
    .selectFrom('documents')
    .select((eb) => eb.fn.countAll<string>().as('c'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  if (Number(count.c) >= LIMITS.documentsPerUser) throw conflict('document_limit_reached');

  const key = newStorageKey();
  await writeStoredFile(key, upload.data);
  try {
    return await db
      .insertInto('documents')
      .values({
        user_id: userId,
        category,
        title: title.trim().slice(0, 200) || upload.originalName.replace(/\.[a-z0-9]+$/i, ''),
        original_name: upload.originalName,
        storage_key: key,
        mime_type: upload.mimeType,
        size_bytes: upload.data.length,
        sha256: sha256(upload.data),
        page_count: upload.pageCount,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (err) {
    await deleteStoredFile(key);
    throw err;
  }
}

/** Lädt ein Dokument NUR, wenn es dem Benutzer gehört – sonst 404 (kein Hinweis auf Existenz). */
export async function getOwnedDocument(userId: string, id: string): Promise<DocumentRow> {
  const row = await db.selectFrom('documents').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row) throw notFound();
  return row;
}

export async function readDocumentData(row: DocumentRow): Promise<Buffer> {
  return readStoredFile(row.storage_key);
}

export async function deleteDocument(userId: string, id: string): Promise<void> {
  const row = await getOwnedDocument(userId, id);
  await db.deleteFrom('documents').where('id', '=', row.id).where('user_id', '=', userId).execute();
  await deleteStoredFile(row.storage_key);
}

/** Bild als data:-URL (für die serverseitige PDF-Erzeugung ohne weitere Requests). */
export async function documentAsDataUrl(userId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const row = await db.selectFrom('documents').selectAll().where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
  if (!row || !row.mime_type.startsWith('image/')) return null;
  const data = await readStoredFile(row.storage_key);
  return `data:${row.mime_type};base64,${data.toString('base64')}`;
}
