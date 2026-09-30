import { z } from 'zod';
import {
  CERTIFICATE_CATEGORIES,
  DATE_FORMATS,
  INTEREST_CATEGORIES,
  LANGUAGE_LEVELS,
  LIMITS,
  LOCALES,
  PERSONAL_FIELD_KEYS,
  SECTION_COLUMNS,
  SECTION_KEYS,
  SKILL_DISPLAY_MODES,
  TEMPLATE_KEYS,
  TRAINING_KINDS,
} from '../constants.js';
import { bulletList, idSchema, longText, mediumText, partialDate, shortText } from './common.js';
import { designSettingsSchema } from './design.js';

/* ------------------------------------------------------------------ */
/* Persönliche Daten                                                   */
/* ------------------------------------------------------------------ */

export const personalLinkSchema = z.object({
  id: idSchema,
  label: shortText,
  url: mediumText,
  visible: z.boolean().default(true),
});

export const personalDataSchema = z.object({
  firstName: shortText,
  lastName: shortText,
  jobTitle: shortText,
  photoId: idSchema.nullable().default(null),
  birthDate: partialDate,
  birthPlace: shortText,
  nationality: shortText,
  maritalStatus: shortText,
  street: shortText,
  postalCode: z.string().max(20).default(''),
  city: shortText,
  country: shortText,
  phone: z.string().max(40).default(''),
  email: z.string().max(254).default(''),
  website: mediumText,
  linkedin: mediumText,
  github: mediumText,
  links: z.array(personalLinkSchema).max(LIMITS.links).default([]),
  /** Felder, die im Lebenslauf NICHT angezeigt werden sollen. */
  hidden: z.array(z.enum(PERSONAL_FIELD_KEYS)).default([]),
});

/* ------------------------------------------------------------------ */
/* Abschnitte                                                          */
/* ------------------------------------------------------------------ */

export const sectionOptionsSchema = z.object({
  /** Darstellung bei Kenntnissen/Sprachen/Interessen. */
  display: z.enum(SKILL_DISPLAY_MODES).optional(),
  /** Referenzen: "Referenzen auf Anfrage" statt Einzelangaben. */
  onRequest: z.boolean().optional(),
  /** Spaltenzuordnung bei zweispaltigen Vorlagen. */
  column: z.enum(SECTION_COLUMNS).optional(),
});

export const sectionConfigSchema = z.object({
  key: z.enum(SECTION_KEYS),
  visible: z.boolean().default(true),
  /** Eigener Titel; leer = Standardtitel der Lebenslaufsprache. */
  title: z.string().max(80).default(''),
  options: sectionOptionsSchema.default({}),
});

export const profileSummarySchema = z.object({
  headline: shortText,
  summary: longText,
  /** z. B. "12 Jahre" */
  experience: shortText,
  /** Fachgebiet */
  expertise: shortText,
  /** Persönliche Schwerpunkte */
  strengths: bulletList,
});

const baseItem = {
  id: idSchema,
  visible: z.boolean().default(true),
};

export const experienceItemSchema = z.object({
  ...baseItem,
  employer: shortText,
  jobTitle: shortText,
  location: shortText,
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  description: longText,
  tasks: bulletList,
  achievements: bulletList,
  projects: bulletList,
});

export const educationItemSchema = z.object({
  ...baseItem,
  institution: shortText,
  degree: shortText,
  fieldOfStudy: shortText,
  location: shortText,
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  grade: z.string().max(60).default(''),
  description: longText,
});

export const trainingItemSchema = z.object({
  ...baseItem,
  kind: z.enum(TRAINING_KINDS).default('training'),
  title: shortText,
  provider: shortText,
  date: partialDate,
  duration: z.string().max(80).default(''),
  certificate: shortText,
  description: longText,
});

export const skillSchema = z.object({
  id: idSchema,
  name: z.string().max(120).default(''),
  /** 1–5 oder null (ohne Bewertung) */
  level: z.number().int().min(1).max(5).nullable().default(null),
});

export const skillGroupSchema = z.object({
  ...baseItem,
  name: shortText,
  items: z.array(skillSchema).max(LIMITS.skillsPerGroup).default([]),
});

export const languageItemSchema = z.object({
  ...baseItem,
  name: shortText,
  level: z.enum(LANGUAGE_LEVELS).nullable().default(null),
  note: shortText,
});

export const certificateItemSchema = z.object({
  ...baseItem,
  category: z.enum(CERTIFICATE_CATEGORIES).default('professional'),
  name: shortText,
  issuer: shortText,
  date: partialDate,
  validUntil: partialDate,
  credentialId: z.string().max(100).default(''),
  description: longText,
});

export const projectItemSchema = z.object({
  ...baseItem,
  name: shortText,
  role: shortText,
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  description: longText,
  technologies: bulletList,
  results: bulletList,
  link: mediumText,
});

export const internshipItemSchema = z.object({
  ...baseItem,
  company: shortText,
  jobTitle: shortText,
  location: shortText,
  startDate: partialDate,
  endDate: partialDate,
  description: longText,
});

export const volunteeringItemSchema = z.object({
  ...baseItem,
  organization: shortText,
  role: shortText,
  location: shortText,
  startDate: partialDate,
  endDate: partialDate,
  current: z.boolean().default(false),
  description: longText,
});

export const interestItemSchema = z.object({
  ...baseItem,
  category: z.enum(INTEREST_CATEGORIES).default('interest'),
  name: shortText,
  description: mediumText,
});

export const referenceItemSchema = z.object({
  ...baseItem,
  name: shortText,
  jobTitle: shortText,
  company: shortText,
  phone: z.string().max(40).default(''),
  email: z.string().max(254).default(''),
});

const list = <T extends z.ZodType>(item: T) => z.array(item).max(LIMITS.itemsPerSection).default([]);

/** Gesamter Inhalt eines Lebenslaufs bzw. Profils (ohne Design). */
export const resumeContentSchema = z.object({
  personal: personalDataSchema.default(personalDataSchema.parse({})),
  sections: z.array(sectionConfigSchema).max(SECTION_KEYS.length).default([]),
  profile: profileSummarySchema.default(profileSummarySchema.parse({})),
  experience: list(experienceItemSchema),
  education: list(educationItemSchema),
  trainings: list(trainingItemSchema),
  skills: list(skillGroupSchema),
  languages: list(languageItemSchema),
  certificates: list(certificateItemSchema),
  projects: list(projectItemSchema),
  internships: list(internshipItemSchema),
  volunteering: list(volunteeringItemSchema),
  interests: list(interestItemSchema),
  references: list(referenceItemSchema),
});

export type PersonalLink = z.infer<typeof personalLinkSchema>;
export type PersonalData = z.infer<typeof personalDataSchema>;
export type SectionOptions = z.infer<typeof sectionOptionsSchema>;
export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type TrainingItem = z.infer<typeof trainingItemSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;
export type CertificateItem = z.infer<typeof certificateItemSchema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;
export type InternshipItem = z.infer<typeof internshipItemSchema>;
export type VolunteeringItem = z.infer<typeof volunteeringItemSchema>;
export type InterestItem = z.infer<typeof interestItemSchema>;
export type ReferenceItem = z.infer<typeof referenceItemSchema>;
export type ResumeContent = z.infer<typeof resumeContentSchema>;

/** Abschnitte, deren Inhalt eine Liste von Einträgen ist. */
export type ListSectionKey = Exclude<(typeof SECTION_KEYS)[number], 'profile'>;

export interface ListSectionItemMap {
  experience: ExperienceItem;
  education: EducationItem;
  trainings: TrainingItem;
  skills: SkillGroup;
  languages: LanguageItem;
  certificates: CertificateItem;
  projects: ProjectItem;
  internships: InternshipItem;
  volunteering: VolunteeringItem;
  interests: InterestItem;
  references: ReferenceItem;
}

/* ------------------------------------------------------------------ */
/* Lebenslauf-Metadaten (API)                                          */
/* ------------------------------------------------------------------ */

export const resumeMetaSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.resumeTitle),
  language: z.enum(LOCALES),
  templateKey: z.enum(TEMPLATE_KEYS),
  design: designSettingsSchema,
  dateFormat: z.enum(DATE_FORMATS),
});

/** Vollständiges Speichern (Autosave) eines Lebenslaufs. */
export const resumeSaveSchema = resumeMetaSchema.extend({
  content: resumeContentSchema,
  attachmentIds: z.array(idSchema).max(50).default([]),
  /** Optimistische Sperre gegen parallele Überschreibungen. */
  version: z.number().int().min(1),
});
export type ResumeSaveInput = z.infer<typeof resumeSaveSchema>;

export const resumeCreateSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.resumeTitle),
  language: z.enum(LOCALES).default('de'),
  templateKey: z.enum(TEMPLATE_KEYS).default('modern'),
  /** Leer, aus Profil, mit Beispieldaten oder aus vorhandenem Inhalt (Import/Onboarding). */
  source: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('empty') }),
      z.object({ type: z.literal('demo') }),
      z.object({ type: z.literal('profile'), profileId: idSchema }),
      z.object({ type: z.literal('content'), content: resumeContentSchema }),
    ])
    .default({ type: 'empty' }),
  dateFormat: z.enum(DATE_FORMATS).optional(),
});
export type ResumeCreateInput = z.infer<typeof resumeCreateSchema>;

export const resumePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(LIMITS.resumeTitle),
    archived: z.boolean(),
    templateKey: z.enum(TEMPLATE_KEYS),
    language: z.enum(LOCALES),
  })
  .partial();
export type ResumePatchInput = z.infer<typeof resumePatchSchema>;
