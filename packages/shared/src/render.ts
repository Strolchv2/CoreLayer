/**
 * Datenformat, das an das Render-Bundle übergeben wird – identisch für
 * Live-Vorschau (Browser) und PDF-Erzeugung (Headless Chromium).
 */
import type { DateFormat, Locale, TemplateKey } from './constants.js';
import type { CoverLetterContent } from './schemas/coverLetter.js';
import type { DesignSettings } from './schemas/design.js';
import type { PersonalData, ResumeContent } from './schemas/resume.js';

export interface ResumeRenderData {
  content: ResumeContent;
  design: DesignSettings;
  templateKey: TemplateKey;
  language: Locale;
  dateFormat: DateFormat;
  /** URL oder data:-URL des Profilbilds (null = kein Bild) */
  photoUrl: string | null;
}

export interface CoverLetterRenderData {
  content: CoverLetterContent;
  design: DesignSettings;
  templateKey: TemplateKey;
  language: Locale;
  dateFormat: DateFormat;
  signatureUrl: string | null;
  /** Persönliche Daten aus dem verknüpften Lebenslauf (für den Briefkopf) */
  personal: PersonalData | null;
}

export type RenderRequest =
  | { kind: 'resume'; data: ResumeRenderData; title: string }
  | { kind: 'cover-letter'; data: CoverLetterRenderData; title: string };
