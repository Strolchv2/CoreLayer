import { z } from 'zod';
import { LIMITS } from '../constants.js';
import { isValidPartialDate } from '../dates.js';

/** Kurzer Text (Namen, Bezeichnungen). Leerer String bedeutet "nicht gesetzt". */
export const shortText = z.string().max(LIMITS.shortText).default('');
export const mediumText = z.string().max(LIMITS.mediumText).default('');
export const longText = z.string().max(LIMITS.longText).default('');

/** Aufzählungspunkte (Aufgaben, Erfolge …). */
export const bulletList = z
  .array(z.string().max(LIMITS.bulletText))
  .max(LIMITS.bulletsPerList)
  .default([]);

/** Teil-Datum: '' | YYYY | YYYY-MM | YYYY-MM-DD, kalendarisch gültig. */
export const partialDate = z
  .string()
  .max(10)
  .refine(isValidPartialDate, { message: 'invalid_date' })
  .default('');

export const idSchema = z.uuid();

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid_color');
