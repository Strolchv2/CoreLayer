import { z } from 'zod';
import { DOCUMENT_CATEGORIES } from '../constants.js';

export const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    category: z.enum(DOCUMENT_CATEGORIES),
  })
  .partial();

export const exportOptionsSchema = z.object({
  includeResume: z.boolean().default(true),
  coverLetterId: z.uuid().nullable().default(null),
  /** Ausgewählte Dokumente (Zeugnisse, Zertifikate, Anlagen) */
  documentIds: z.array(z.uuid()).max(50).default([]),
  /** 'merged' = eine PDF-Datei, 'zip' = einzelne Dateien in ZIP */
  mode: z.enum(['merged', 'zip']).default('merged'),
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
