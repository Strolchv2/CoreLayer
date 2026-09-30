import { z } from 'zod';
import { idSchema } from './common.js';
import { resumeContentSchema } from './resume.js';

export const profileCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).default(''),
  /** Optional: Inhalt eines bestehenden Lebenslaufs übernehmen */
  fromResumeId: idSchema.optional(),
});

export const profileSaveSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).default(''),
  content: resumeContentSchema,
  version: z.number().int().min(1),
});
export type ProfileSaveInput = z.infer<typeof profileSaveSchema>;
