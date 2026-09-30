import { sql, type Kysely } from 'kysely';

/**
 * Initiales Datenbankschema.
 *
 * Aufbau:
 *  - users / sessions / password_reset_tokens     Konten & Authentifizierung
 *  - cv_contents                                  Container für Lebenslaufinhalte
 *      ├─ personal_data, personal_links           Persönliche Daten
 *      ├─ content_sections                        Reihenfolge, Sichtbarkeit, Titel der Abschnitte
 *      ├─ profile_summaries                       "Über mich"
 *      └─ work_experiences, educations, trainings, skill_groups/skills, languages,
 *         certificates, projects, internships, volunteering, interests, cv_references
 *  - profiles  (1:1 cv_contents)                  Wiederverwendbare Profile ("Elektrotechnik" …)
 *  - resumes   (1:1 cv_contents)                  Lebensläufe mit Design, Vorlage, Version
 *  - documents, resume_attachments                Uploads (Zeugnisse, Zertifikate, Fotos)
 *  - cover_letters                                Anschreiben
 *  - templates                                    Vorlagen-Verwaltung (Admin)
 *  - export_events, audit_log                     Statistik & Protokoll (ohne Lebenslaufinhalte)
 *
 * Eintrags-IDs werden clientseitig erzeugt (UUID); Primärschlüssel der Einträge ist
 * (content_id, id), damit IDs nur innerhalb eines Inhalts eindeutig sein müssen.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(254) NOT NULL,
      password_hash text NOT NULL,
      display_name varchar(100) NOT NULL DEFAULT '',
      role varchar(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
      locale varchar(5) NOT NULL DEFAULT 'de',
      theme varchar(8) NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
      default_date_format varchar(12) NOT NULL DEFAULT 'MM/YYYY',
      onboarding_completed boolean NOT NULL DEFAULT false,
      failed_login_count integer NOT NULL DEFAULT 0,
      locked_until timestamptz,
      last_login_at timestamptz,
      password_changed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_email_lowercase CHECK (email = lower(email))
    );
    CREATE UNIQUE INDEX users_email_key ON users (email);

    CREATE TABLE sessions (
      id char(64) PRIMARY KEY,               -- SHA-256 des Session-Tokens (Token selbst wird nie gespeichert)
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

    CREATE TABLE password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash char(64) NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

    CREATE TABLE templates (
      key varchar(32) PRIMARY KEY,
      name varchar(80) NOT NULL,
      description varchar(300) NOT NULL DEFAULT '',
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      category varchar(24) NOT NULL CHECK (category IN
        ('school_report', 'employment_reference', 'certificate', 'drivers_license', 'photo', 'other')),
      title varchar(200) NOT NULL,
      original_name varchar(255) NOT NULL,
      storage_key varchar(80) NOT NULL UNIQUE,  -- zufälliger Dateiname ohne Endung
      mime_type varchar(40) NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
      size_bytes integer NOT NULL CHECK (size_bytes > 0),
      sha256 char(64) NOT NULL,
      page_count integer,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX documents_user_idx ON documents (user_id, created_at DESC);

    CREATE TABLE cv_contents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX cv_contents_user_idx ON cv_contents (user_id);

    CREATE TABLE personal_data (
      content_id uuid PRIMARY KEY REFERENCES cv_contents (id) ON DELETE CASCADE,
      first_name varchar(200),
      last_name varchar(200),
      job_title varchar(200),
      photo_document_id uuid REFERENCES documents (id) ON DELETE SET NULL,
      birth_date varchar(10),
      birth_place varchar(200),
      nationality varchar(200),
      marital_status varchar(200),
      street varchar(200),
      postal_code varchar(20),
      city varchar(200),
      country varchar(200),
      phone varchar(40),
      email varchar(254),
      website varchar(500),
      linkedin varchar(500),
      github varchar(500),
      hidden_fields text[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE personal_links (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      label varchar(200),
      url varchar(500),
      visible boolean NOT NULL DEFAULT true,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE content_sections (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      section_key varchar(32) NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      custom_title varchar(80),
      options jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (content_id, section_key)
    );

    CREATE TABLE profile_summaries (
      content_id uuid PRIMARY KEY REFERENCES cv_contents (id) ON DELETE CASCADE,
      headline varchar(200),
      summary text,
      experience varchar(200),
      expertise varchar(200),
      strengths text[] NOT NULL DEFAULT '{}'
    );

    CREATE TABLE work_experiences (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      employer varchar(200),
      job_title varchar(200),
      location varchar(200),
      start_date varchar(10),
      end_date varchar(10),
      is_current boolean NOT NULL DEFAULT false,
      description text,
      tasks text[] NOT NULL DEFAULT '{}',
      achievements text[] NOT NULL DEFAULT '{}',
      projects text[] NOT NULL DEFAULT '{}',
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE educations (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      institution varchar(200),
      degree varchar(200),
      field_of_study varchar(200),
      location varchar(200),
      start_date varchar(10),
      end_date varchar(10),
      is_current boolean NOT NULL DEFAULT false,
      grade varchar(60),
      description text,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE trainings (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      kind varchar(20) NOT NULL DEFAULT 'training',
      title varchar(200),
      provider varchar(200),
      date varchar(10),
      duration varchar(80),
      certificate varchar(200),
      description text,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE skill_groups (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      name varchar(200),
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE skills (
      content_id uuid NOT NULL,
      group_id uuid NOT NULL,
      id uuid NOT NULL,
      position integer NOT NULL,
      name varchar(120),
      level smallint CHECK (level BETWEEN 1 AND 5),
      PRIMARY KEY (content_id, id),
      FOREIGN KEY (content_id, group_id) REFERENCES skill_groups (content_id, id) ON DELETE CASCADE
    );

    CREATE TABLE languages (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      name varchar(200),
      level varchar(8) CHECK (level IN ('native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1')),
      note varchar(200),
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE certificates (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      category varchar(24) NOT NULL DEFAULT 'professional',
      name varchar(200),
      issuer varchar(200),
      date varchar(10),
      valid_until varchar(10),
      credential_id varchar(100),
      description text,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE projects (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      name varchar(200),
      role varchar(200),
      start_date varchar(10),
      end_date varchar(10),
      is_current boolean NOT NULL DEFAULT false,
      description text,
      technologies text[] NOT NULL DEFAULT '{}',
      results text[] NOT NULL DEFAULT '{}',
      link varchar(500),
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE internships (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      company varchar(200),
      job_title varchar(200),
      location varchar(200),
      start_date varchar(10),
      end_date varchar(10),
      description text,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE volunteering (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      organization varchar(200),
      role varchar(200),
      location varchar(200),
      start_date varchar(10),
      end_date varchar(10),
      is_current boolean NOT NULL DEFAULT false,
      description text,
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE interests (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      category varchar(16) NOT NULL DEFAULT 'interest',
      name varchar(200),
      description varchar(500),
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE cv_references (
      content_id uuid NOT NULL REFERENCES cv_contents (id) ON DELETE CASCADE,
      id uuid NOT NULL,
      position integer NOT NULL,
      visible boolean NOT NULL DEFAULT true,
      name varchar(200),
      job_title varchar(200),
      company varchar(200),
      phone varchar(40),
      email varchar(254),
      PRIMARY KEY (content_id, id)
    );

    CREATE TABLE profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      content_id uuid NOT NULL UNIQUE REFERENCES cv_contents (id) ON DELETE CASCADE,
      name varchar(100) NOT NULL,
      description varchar(300) NOT NULL DEFAULT '',
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX profiles_user_idx ON profiles (user_id, updated_at DESC);

    CREATE TABLE resumes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      content_id uuid NOT NULL UNIQUE REFERENCES cv_contents (id) ON DELETE CASCADE,
      profile_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
      title varchar(150) NOT NULL,
      language varchar(5) NOT NULL DEFAULT 'de',
      template_key varchar(32) NOT NULL REFERENCES templates (key) ON UPDATE CASCADE,
      design jsonb NOT NULL DEFAULT '{}'::jsonb,
      date_format varchar(12) NOT NULL DEFAULT 'MM/YYYY',
      version integer NOT NULL DEFAULT 1,
      archived_at timestamptz,
      last_exported_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX resumes_user_idx ON resumes (user_id, archived_at, updated_at DESC);

    CREATE TABLE resume_attachments (
      resume_id uuid NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
      document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
      position integer NOT NULL,
      PRIMARY KEY (resume_id, document_id)
    );

    CREATE TABLE cover_letters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      resume_id uuid REFERENCES resumes (id) ON DELETE SET NULL,
      title varchar(150) NOT NULL,
      language varchar(5) NOT NULL DEFAULT 'de',
      use_resume_design boolean NOT NULL DEFAULT true,
      template_key varchar(32) NOT NULL REFERENCES templates (key) ON UPDATE CASCADE,
      design jsonb NOT NULL DEFAULT '{}'::jsonb,
      date_format varchar(12) NOT NULL DEFAULT 'DD.MM.YYYY',
      sender jsonb NOT NULL DEFAULT '{}'::jsonb,
      recipient jsonb NOT NULL DEFAULT '{}'::jsonb,
      place varchar(200),
      letter_date varchar(10),
      subject varchar(300),
      salutation varchar(200),
      body text,
      closing varchar(200),
      signature_name varchar(200),
      signature_document_id uuid REFERENCES documents (id) ON DELETE SET NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX cover_letters_user_idx ON cover_letters (user_id, updated_at DESC);

    CREATE TABLE export_events (
      id bigserial PRIMARY KEY,
      user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      resume_id uuid REFERENCES resumes (id) ON DELETE SET NULL,
      kind varchar(24) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX export_events_user_idx ON export_events (user_id);
    CREATE INDEX export_events_created_idx ON export_events (created_at);

    -- Protokoll sicherheitsrelevanter Ereignisse. Enthält KEINE Lebenslaufinhalte.
    CREATE TABLE audit_log (
      id bigserial PRIMARY KEY,
      user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      action varchar(60) NOT NULL,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
    CREATE INDEX audit_log_action_idx ON audit_log (action);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS audit_log, export_events, cover_letters, resume_attachments, resumes, profiles,
      cv_references, interests, volunteering, internships, projects, certificates, languages, skills,
      skill_groups, trainings, educations, work_experiences, profile_summaries, content_sections,
      personal_links, personal_data, cv_contents, documents, templates, password_reset_tokens, sessions, users CASCADE;
  `.execute(db);
}
