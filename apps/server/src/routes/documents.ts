import { DOCUMENT_CATEGORIES, documentUpdateSchema, LIMITS, type DocumentCategory } from '@cv-studio/shared';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { badRequest } from '../lib/errors.js';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { audit } from '../services/audit.js';
import {
  createDocument,
  deleteDocument,
  getOwnedDocument,
  readDocumentData,
  toDocumentDTO,
  validateUpload,
} from '../services/documents.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

/** Uploads bleiben im Arbeitsspeicher, bis sie geprüft sind – nichts Ungeprüftes landet auf der Platte. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.uploadMaxBytes, files: 1, fields: 5, fieldSize: 2000 },
});

documentsRouter.get('/', async (req, res) => {
  const rows = await db
    .selectFrom('documents')
    .selectAll()
    .where('user_id', '=', currentUser(req).id)
    .orderBy('created_at', 'desc')
    .execute();
  res.json({ documents: rows.map(toDocumentDTO) });
});

documentsRouter.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  const user = currentUser(req);
  if (!req.file) throw badRequest('file_missing');
  const category = String(req.body?.category ?? 'other') as DocumentCategory;
  if (!DOCUMENT_CATEGORIES.includes(category)) throw badRequest('invalid_category');
  const isPhoto = category === 'photo';
  const validated = await validateUpload(
    { buffer: req.file.buffer, originalName: req.file.originalname, declaredMime: req.file.mimetype },
    { imagesOnly: isPhoto, photo: isPhoto, maxBytes: isPhoto ? LIMITS.photoMaxBytes : LIMITS.uploadMaxBytes },
  );
  const row = await createDocument(user.id, validated, category, String(req.body?.title ?? ''));
  await audit(user.id, 'document.uploaded', { category, mime: validated.mimeType });
  res.status(201).json({ document: toDocumentDTO(row) });
});

documentsRouter.get('/:id', async (req, res) => {
  const row = await getOwnedDocument(currentUser(req).id, parseUuidParam(req.params.id));
  res.json({ document: toDocumentDTO(row) });
});

/** Datei ausliefern – nur an den Eigentümer, mit restriktiven Headern. */
documentsRouter.get('/:id/file', async (req, res) => {
  const row = await getOwnedDocument(currentUser(req).id, parseUuidParam(req.params.id));
  const data = await readDocumentData(row);
  const download = req.query.download === '1';
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Length', String(data.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Inhalte des Uploads dürfen keinerlei aktive Inhalte ausführen
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'");
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${row.original_name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
  );
  res.end(data);
});

documentsRouter.patch('/:id', async (req, res) => {
  const user = currentUser(req);
  const input = parse(documentUpdateSchema, req.body);
  const row = await getOwnedDocument(user.id, parseUuidParam(req.params.id));
  const updated = await db
    .updateTable('documents')
    .set({ ...(input.title ? { title: input.title } : {}), ...(input.category ? { category: input.category } : {}) })
    .where('id', '=', row.id)
    .where('user_id', '=', user.id)
    .returningAll()
    .executeTakeFirstOrThrow();
  res.json({ document: toDocumentDTO(updated) });
});

documentsRouter.delete('/:id', async (req, res) => {
  const user = currentUser(req);
  await deleteDocument(user.id, parseUuidParam(req.params.id));
  await audit(user.id, 'document.deleted');
  res.json({ ok: true });
});
