/**
 * Typdefinitionen der Datenbanktabellen für Kysely (typsichere, parametrisierte Queries).
 * Muss mit den Migrationen in ./migrations übereinstimmen.
 */
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
/** Zeitstempel mit DB-Default (beim Einfügen optional) */
type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type Json<T = Record<string, unknown>> = ColumnType<T, string | T, string | T>;
type TextArray = ColumnType<string[], string[] | undefined, string[]>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  display_name: Generated<string>;
  role: Generated<'user' | 'admin'>;
  status: Generated<'active' | 'blocked'>;
  locale: Generated<string>;
  theme: Generated<string>;
  default_date_format: Generated<string>;
  onboarding_completed: Generated<boolean>;
  failed_login_count: Generated<number>;
  locked_until: NullableTimestamp;
  last_login_at: NullableTimestamp;
  password_changed_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  created_at: GeneratedTimestamp;
  last_seen_at: GeneratedTimestamp;
  expires_at: Timestamp;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  used_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
}

export interface TemplatesTable {
  key: string;
  name: string;
  description: Generated<string>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  updated_at: GeneratedTimestamp;
}

export interface DocumentsTable {
  id: Generated<string>;
  user_id: string;
  category: string;
  title: string;
  original_name: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  page_count: number | null;
  created_at: GeneratedTimestamp;
}

export interface CvContentsTable {
  id: Generated<string>;
  user_id: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface PersonalDataTable {
  content_id: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  photo_document_id: string | null;
  birth_date: string | null;
  birth_place: string | null;
  nationality: string | null;
  marital_status: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  hidden_fields: TextArray;
}

interface ItemBase {
  content_id: string;
  id: string;
  position: number;
}

interface VisibleItem extends ItemBase {
  visible: boolean;
}

export interface PersonalLinksTable extends VisibleItem {
  label: string | null;
  url: string | null;
}

export interface ContentSectionsTable {
  content_id: string;
  section_key: string;
  position: number;
  visible: boolean;
  custom_title: string | null;
  options: Json;
}

export interface ProfileSummariesTable {
  content_id: string;
  headline: string | null;
  summary: string | null;
  experience: string | null;
  expertise: string | null;
  strengths: TextArray;
}

export interface WorkExperiencesTable extends VisibleItem {
  employer: string | null;
  job_title: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  tasks: TextArray;
  achievements: TextArray;
  projects: TextArray;
}

export interface EducationsTable extends VisibleItem {
  institution: string | null;
  degree: string | null;
  field_of_study: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  grade: string | null;
  description: string | null;
}

export interface TrainingsTable extends VisibleItem {
  kind: string;
  title: string | null;
  provider: string | null;
  date: string | null;
  duration: string | null;
  certificate: string | null;
  description: string | null;
}

export interface SkillGroupsTable extends VisibleItem {
  name: string | null;
}

export interface SkillsTable extends ItemBase {
  group_id: string;
  name: string | null;
  level: number | null;
}

export interface LanguagesTable extends VisibleItem {
  name: string | null;
  level: string | null;
  note: string | null;
}

export interface CertificatesTable extends VisibleItem {
  category: string;
  name: string | null;
  issuer: string | null;
  date: string | null;
  valid_until: string | null;
  credential_id: string | null;
  description: string | null;
}

export interface ProjectsTable extends VisibleItem {
  name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  technologies: TextArray;
  results: TextArray;
  link: string | null;
}

export interface InternshipsTable extends VisibleItem {
  company: string | null;
  job_title: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface VolunteeringTable extends VisibleItem {
  organization: string | null;
  role: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

export interface InterestsTable extends VisibleItem {
  category: string;
  name: string | null;
  description: string | null;
}

export interface CvReferencesTable extends VisibleItem {
  name: string | null;
  job_title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
}

export interface ProfilesTable {
  id: Generated<string>;
  user_id: string;
  content_id: string;
  name: string;
  description: Generated<string>;
  version: Generated<number>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ResumesTable {
  id: Generated<string>;
  user_id: string;
  content_id: string;
  profile_id: string | null;
  title: string;
  language: Generated<string>;
  template_key: string;
  design: Json;
  date_format: Generated<string>;
  version: Generated<number>;
  archived_at: NullableTimestamp;
  last_exported_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ResumeAttachmentsTable {
  resume_id: string;
  document_id: string;
  position: number;
}

export interface CoverLettersTable {
  id: Generated<string>;
  user_id: string;
  resume_id: string | null;
  title: string;
  language: Generated<string>;
  use_resume_design: Generated<boolean>;
  template_key: string;
  design: Json;
  date_format: Generated<string>;
  sender: Json;
  recipient: Json;
  place: string | null;
  letter_date: string | null;
  subject: string | null;
  salutation: string | null;
  body: string | null;
  closing: string | null;
  signature_name: string | null;
  signature_document_id: string | null;
  version: Generated<number>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ExportEventsTable {
  id: Generated<string>;
  user_id: string | null;
  resume_id: string | null;
  kind: string;
  created_at: GeneratedTimestamp;
}

export interface AuditLogTable {
  id: Generated<string>;
  user_id: string | null;
  action: string;
  meta: Json;
  created_at: GeneratedTimestamp;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  password_reset_tokens: PasswordResetTokensTable;
  templates: TemplatesTable;
  documents: DocumentsTable;
  cv_contents: CvContentsTable;
  personal_data: PersonalDataTable;
  personal_links: PersonalLinksTable;
  content_sections: ContentSectionsTable;
  profile_summaries: ProfileSummariesTable;
  work_experiences: WorkExperiencesTable;
  educations: EducationsTable;
  trainings: TrainingsTable;
  skill_groups: SkillGroupsTable;
  skills: SkillsTable;
  languages: LanguagesTable;
  certificates: CertificatesTable;
  projects: ProjectsTable;
  internships: InternshipsTable;
  volunteering: VolunteeringTable;
  interests: InterestsTable;
  cv_references: CvReferencesTable;
  profiles: ProfilesTable;
  resumes: ResumesTable;
  resume_attachments: ResumeAttachmentsTable;
  cover_letters: CoverLettersTable;
  export_events: ExportEventsTable;
  audit_log: AuditLogTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type ResumeRow = Selectable<ResumesTable>;
export type DocumentRow = Selectable<DocumentsTable>;
export type CoverLetterRow = Selectable<CoverLettersTable>;
export type ProfileRow = Selectable<ProfilesTable>;
