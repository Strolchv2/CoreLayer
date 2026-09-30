/**
 * Zentrale Konstanten des Datenmodells.
 * Alle Listen sind `as const`, damit daraus Union-Typen abgeleitet werden können.
 */

/** Unterstützte UI- und Lebenslaufsprachen. Weitere Sprachen hier ergänzen. */
export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Sortierbare Abschnitte eines Lebenslaufs (persönliche Daten bilden immer den Kopf). */
export const SECTION_KEYS = [
  'profile',
  'experience',
  'education',
  'internships',
  'trainings',
  'certificates',
  'skills',
  'languages',
  'projects',
  'volunteering',
  'interests',
  'references',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Felder der persönlichen Daten, die einzeln ein-/ausgeblendet werden können. */
export const PERSONAL_FIELD_KEYS = [
  'jobTitle',
  'photo',
  'birthDate',
  'birthPlace',
  'nationality',
  'maritalStatus',
  'address',
  'phone',
  'email',
  'website',
  'linkedin',
  'github',
] as const;
export type PersonalFieldKey = (typeof PERSONAL_FIELD_KEYS)[number];

export const DATE_FORMATS = ['MM/YYYY', 'MM.YYYY', 'YYYY', 'DD.MM.YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const LANGUAGE_LEVELS = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const TRAINING_KINDS = ['training', 'certificate', 'seminar', 'course', 'workshop'] as const;
export type TrainingKind = (typeof TRAINING_KINDS)[number];

export const CERTIFICATE_CATEGORIES = [
  'drivers_license',
  'first_aid',
  'safety',
  'professional',
  'technical',
  'other',
] as const;
export type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number];

export const INTEREST_CATEGORIES = ['interest', 'hobby', 'club', 'sport', 'other'] as const;
export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];

export const SKILL_DISPLAY_MODES = ['text', 'tags', 'bars', 'stars'] as const;
export type SkillDisplayMode = (typeof SKILL_DISPLAY_MODES)[number];

export const SECTION_COLUMNS = ['auto', 'main', 'sidebar'] as const;
export type SectionColumn = (typeof SECTION_COLUMNS)[number];

export const TEMPLATE_KEYS = [
  'classic',
  'modern',
  'minimal',
  'professional',
  'executive',
  'creative',
  'ats',
  'technical',
  'elegant',
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const FONT_KEYS = [
  'inter',
  'roboto',
  'lato',
  'open-sans',
  'source-sans',
  'ibm-plex-sans',
  'arimo',
  'merriweather',
  'eb-garamond',
  'playfair',
  'jetbrains-mono',
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const DOCUMENT_CATEGORIES = [
  'school_report',
  'employment_reference',
  'certificate',
  'drivers_license',
  'photo',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Berufsbereiche für das Onboarding. */
export const CAREER_FIELDS = [
  'trades',
  'it',
  'engineering',
  'business',
  'healthcare',
  'sales',
  'management',
  'education',
  'other',
] as const;
export type CareerField = (typeof CAREER_FIELDS)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEMES)[number];

/** Obergrenzen gegen Missbrauch und übergroße Dokumente. */
export const LIMITS = {
  shortText: 200,
  mediumText: 500,
  longText: 5000,
  bulletText: 600,
  bulletsPerList: 30,
  itemsPerSection: 50,
  skillsPerGroup: 60,
  links: 10,
  resumeTitle: 150,
  resumesPerUser: 200,
  profilesPerUser: 50,
  coverLettersPerUser: 200,
  documentsPerUser: 200,
  uploadMaxBytes: 10 * 1024 * 1024,
  photoMaxBytes: 8 * 1024 * 1024,
  importMaxBytes: 10 * 1024 * 1024,
} as const;

export const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const PASSWORD_MIN_LENGTH = 10;
