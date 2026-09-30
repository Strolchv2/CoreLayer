import {
  DATE_FORMATS,
  designSettingsSchema,
  LIMITS,
  LOCALES,
  normalizeContent,
  parseResumeText,
  resumeContentSchema,
  TEMPLATE_KEYS,
  type ImportResultDTO,
} from '@cv-studio/shared';
import { Router } from 'express';
import mammoth from 'mammoth';
import multer from 'multer';
import { extractText, getDocumentProxy } from 'unpdf';
import { z } from 'zod';
import { badRequest, unsupportedMedia } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { detectMimeType } from '../services/documents.js';

export const importRouter = Router();
importRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.importMaxBytes, files: 1 } });

const backupSchema = z.object({
  format: z.literal('cv-studio/resume@1'),
  resume: z.object({
    title: z.string().max(150),
    language: z.enum(LOCALES),
    templateKey: z.enum(TEMPLATE_KEYS),
    dateFormat: z.enum(DATE_FORMATS),
    design: designSettingsSchema,
    content: resumeContentSchema,
  }),
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

/**
 * Import aus PDF, DOCX, TXT oder JSON-Sicherung. Die Datei wird NICHT gespeichert –
 * der erkannte Inhalt geht zur Prüfung an den Benutzer zurück.
 */
importRouter.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest('file_missing');
  const name = file.originalname.toLowerCase();
  const ext = name.match(/\.[a-z0-9]+$/)?.[0] ?? '';

  let text = '';
  let sourceType: ImportResultDTO['sourceType'];
  try {
    if (ext === '.pdf') {
      if (detectMimeType(file.buffer) !== 'application/pdf') throw unsupportedMedia('mime_type_mismatch');
      sourceType = 'pdf';
      text = await extractPdfText(file.buffer);
    } else if (ext === '.docx') {
      // DOCX = ZIP-Container ("PK\x03\x04")
      if (file.buffer.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') throw unsupportedMedia('mime_type_mismatch');
      sourceType = 'docx';
      text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
    } else if (ext === '.txt') {
      sourceType = 'txt';
      text = file.buffer.toString('utf8');
      if (text.includes('\u0000')) throw unsupportedMedia('unsupported_file_type');
    } else if (ext === '.json') {
      const parsed = backupSchema.safeParse(JSON.parse(file.buffer.toString('utf8')));
      if (!parsed.success) throw badRequest('import_invalid_backup');
      const r = parsed.data.resume;
      const result: ImportResultDTO = {
        content: normalizeContent(r.content),
        detected: { sections: [], warnings: [] },
        sourceType: 'json',
        meta: { title: r.title, templateKey: r.templateKey, language: r.language, dateFormat: r.dateFormat, design: r.design },
      };
      res.json(result);
      return;
    } else {
      throw unsupportedMedia('unsupported_file_type');
    }
  } catch (err) {
    if ((err as { status?: number }).status) throw err;
    logger.warn({ errName: (err as Error).name }, 'Import: Datei konnte nicht gelesen werden');
    throw badRequest('import_unreadable');
  }

  if (text.trim().length < 30) throw badRequest('import_no_text');
  const parsed = parseResumeText(text.slice(0, 100_000));
  const result: ImportResultDTO = {
    content: parsed.content,
    detected: { sections: parsed.detectedSections, warnings: parsed.warnings },
    sourceType,
  };
  res.json(result);
});
