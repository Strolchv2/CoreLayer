import { z } from 'zod';
import { DATE_FORMATS, LIMITS, LOCALES, TEMPLATE_KEYS } from '../constants.js';
import { idSchema, partialDate, shortText } from './common.js';
import { designSettingsSchema } from './design.js';

export const coverLetterContentSchema = z.object({
  sender: z
    .object({
      name: shortText,
      street: shortText,
      postalCode: z.string().max(20).default(''),
      city: shortText,
      phone: z.string().max(40).default(''),
      email: z.string().max(254).default(''),
    })
    .default({ name: '', street: '', postalCode: '', city: '', phone: '', email: '' }),
  recipient: z
    .object({
      company: shortText,
      contactPerson: shortText,
      department: shortText,
      street: shortText,
      postalCode: z.string().max(20).default(''),
      city: shortText,
    })
    .default({ company: '', contactPerson: '', department: '', street: '', postalCode: '', city: '' }),
  place: shortText,
  date: partialDate,
  subject: z.string().max(300).default(''),
  salutation: shortText,
  body: z.string().max(10000).default(''),
  closing: shortText,
  signatureName: shortText,
  /** Optionales Unterschriftsbild (Dokument des Benutzers) */
  signatureDocumentId: idSchema.nullable().default(null),
});
export type CoverLetterContent = z.infer<typeof coverLetterContentSchema>;

export const coverLetterMetaSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.resumeTitle),
  language: z.enum(LOCALES),
  /** Verknüpfter Lebenslauf – liefert Design und Absenderdaten */
  resumeId: idSchema.nullable(),
  useResumeDesign: z.boolean(),
  templateKey: z.enum(TEMPLATE_KEYS),
  design: designSettingsSchema,
  dateFormat: z.enum(DATE_FORMATS),
});

export const coverLetterSaveSchema = coverLetterMetaSchema.extend({
  content: coverLetterContentSchema,
  version: z.number().int().min(1),
});
export type CoverLetterSaveInput = z.infer<typeof coverLetterSaveSchema>;

export const coverLetterCreateSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.resumeTitle),
  resumeId: idSchema.nullable().default(null),
  language: z.enum(LOCALES).default('de'),
});
export type CoverLetterCreateInput = z.infer<typeof coverLetterCreateSchema>;
