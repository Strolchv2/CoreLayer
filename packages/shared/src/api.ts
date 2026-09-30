/**
 * Typen der REST-API (Antwortobjekte). Eingaben werden über die Zod-Schemas definiert.
 */
import type {
  DateFormat,
  DocumentCategory,
  Locale,
  TemplateKey,
  ThemePreference,
  UserRole,
} from './constants.js';
import type { CoverLetterContent } from './schemas/coverLetter.js';
import type { DesignSettings } from './schemas/design.js';
import type { ResumeContent } from './schemas/resume.js';

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  locale: Locale;
  theme: ThemePreference;
  defaultDateFormat: DateFormat;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface ResumeSummaryDTO {
  id: string;
  title: string;
  language: Locale;
  templateKey: TemplateKey;
  fullName: string;
  jobTitle: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastExportedAt: string | null;
  profileId: string | null;
}

export interface ResumeDTO extends Omit<ResumeSummaryDTO, 'fullName' | 'jobTitle'> {
  design: DesignSettings;
  dateFormat: DateFormat;
  version: number;
  content: ResumeContent;
  attachmentIds: string[];
}

export interface ProfileSummaryDTO {
  id: string;
  name: string;
  description: string;
  fullName: string;
  jobTitle: string;
  createdAt: string;
  updatedAt: string;
  resumeCount: number;
}

export interface ProfileDTO extends Omit<ProfileSummaryDTO, 'fullName' | 'jobTitle' | 'resumeCount'> {
  version: number;
  content: ResumeContent;
}

export interface CoverLetterSummaryDTO {
  id: string;
  title: string;
  language: Locale;
  resumeId: string | null;
  resumeTitle: string | null;
  subject: string;
  company: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterDTO {
  id: string;
  title: string;
  language: Locale;
  resumeId: string | null;
  useResumeDesign: boolean;
  templateKey: TemplateKey;
  design: DesignSettings;
  dateFormat: DateFormat;
  version: number;
  content: CoverLetterContent;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDTO {
  id: string;
  title: string;
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  createdAt: string;
}

export interface TemplateDTO {
  key: TemplateKey;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  usageCount?: number;
}

export interface DashboardDTO {
  resumeCount: number;
  archivedCount: number;
  draftCount: number;
  exportCount: number;
  coverLetterCount: number;
  documentCount: number;
  profileCount: number;
  recentResumes: ResumeSummaryDTO[];
  lastEdited: ResumeSummaryDTO | null;
}

export interface ApiErrorBody {
  error: {
    /** Maschinenlesbarer Fehlercode – das Frontend übersetzt ihn in eine verständliche Meldung. */
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface AiStatusDTO {
  enabled: boolean;
}

export const AI_ACTIONS = ['improve', 'professional', 'shorten', 'from_bullets', 'spellcheck'] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export interface AiSuggestionDTO {
  original: string;
  suggestion: string;
  action: AiAction;
}

export interface ImportResultDTO {
  content: ResumeContent;
  detected: {
    sections: string[];
    warnings: string[];
  };
  sourceType: 'pdf' | 'docx' | 'txt' | 'json';
  /** Nur bei JSON-Sicherungen: ursprüngliche Einstellungen */
  meta?: { title: string; templateKey: TemplateKey; language: Locale; dateFormat: DateFormat; design: DesignSettings };
}

export interface AdminStatsDTO {
  users: { total: number; active: number; blocked: number; admins: number; newLast7Days: number; newLast30Days: number };
  resumes: { total: number; archived: number; createdLast30Days: number };
  coverLetters: number;
  documents: { total: number; totalBytes: number };
  exports: { total: number; last30Days: number; byKind: Record<string, number> };
  templates: { key: string; count: number }[];
}

export interface AdminSystemStatusDTO {
  version: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memory: { rssBytes: number; heapUsedBytes: number };
  database: { ok: boolean; latencyMs: number | null; sizeBytes: number | null };
  redis: { configured: boolean; ok: boolean | null };
  pdfRenderer: { ok: boolean; message: string };
  storage: { uploadBytes: number; backupCount: number };
  ai: { enabled: boolean };
  mail: { transport: string };
}

export interface AdminUserDTO {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'blocked';
  createdAt: string;
  lastLoginAt: string | null;
  resumeCount: number;
  documentCount: number;
}

export interface AuditLogEntryDTO {
  id: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface BackupDTO {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
