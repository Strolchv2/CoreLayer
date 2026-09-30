import { z } from 'zod';
import { DATE_FORMATS, LOCALES, PASSWORD_MIN_LENGTH, THEMES } from '../constants.js';
import { EMAIL_PATTERN } from '../urls.js';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(EMAIL_PATTERN, 'invalid_email');

/**
 * Passwortrichtlinie: Mindestlänge statt komplizierter Zeichenregeln (NIST SP 800-63B),
 * zusätzlich mindestens ein Buchstabe und eine Ziffer oder ein Sonderzeichen.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'password_too_short')
  .max(200, 'password_too_long')
  .refine((p) => /[A-Za-zÄÖÜäöüß]/.test(p) && /[^A-Za-zÄÖÜäöüß]/.test(p), 'password_too_weak');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(100).default(''),
  locale: z.enum(LOCALES).default('de'),
  acceptTerms: z.literal(true, { error: 'terms_required' }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
});

export const updateSettingsSchema = z
  .object({
    displayName: z.string().trim().max(100),
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES),
    defaultDateFormat: z.enum(DATE_FORMATS),
    onboardingCompleted: z.boolean(),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
