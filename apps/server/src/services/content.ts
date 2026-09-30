/**
 * Abbildung zwischen dem Inhaltsmodell (ResumeContent) und den relationalen Tabellen.
 * Speichern ersetzt alle Einträge eines Inhalts innerhalb einer Transaktion (atomar).
 */
import {
  normalizeContent,
  type LanguageLevel,
  type ResumeContent,
  type SectionConfig,
} from '@cv-studio/shared';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/types.js';

type Tx = Kysely<Database> | Transaction<Database>;

/** '' → NULL (DB), NULL → '' (Modell) */
const n = (v: string): string | null => (v === '' ? null : v);
const s = (v: string | null | undefined): string => v ?? '';

const CONTENT_TABLES = [
  'personal_links',
  'content_sections',
  'work_experiences',
  'educations',
  'trainings',
  'skills',
  'skill_groups',
  'languages',
  'certificates',
  'projects',
  'internships',
  'volunteering',
  'interests',
  'cv_references',
] as const;

/** Liefert nur die Dokument-IDs, die tatsächlich dem Benutzer gehören (Schutz vor IDOR). */
export async function filterOwnedDocumentIds(tx: Tx, userId: string, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const rows = await tx.selectFrom('documents').select('id').where('user_id', '=', userId).where('id', 'in', unique).execute();
  return new Set(rows.map((r) => r.id));
}

export async function createContent(tx: Tx, userId: string, content: ResumeContent): Promise<string> {
  const row = await tx.insertInto('cv_contents').values({ user_id: userId }).returning('id').executeTakeFirstOrThrow();
  await writeContent(tx, row.id, userId, content);
  return row.id;
}

export async function writeContent(tx: Tx, contentId: string, userId: string, input: ResumeContent): Promise<void> {
  const c = normalizeContent(input);
  const owned = await filterOwnedDocumentIds(tx, userId, c.personal.photoId ? [c.personal.photoId] : []);
  const photoId = c.personal.photoId && owned.has(c.personal.photoId) ? c.personal.photoId : null;

  for (const table of CONTENT_TABLES) {
    await tx.deleteFrom(table).where('content_id', '=', contentId).execute();
  }

  const p = c.personal;
  const personal = {
    first_name: n(p.firstName),
    last_name: n(p.lastName),
    job_title: n(p.jobTitle),
    photo_document_id: photoId,
    birth_date: n(p.birthDate),
    birth_place: n(p.birthPlace),
    nationality: n(p.nationality),
    marital_status: n(p.maritalStatus),
    street: n(p.street),
    postal_code: n(p.postalCode),
    city: n(p.city),
    country: n(p.country),
    phone: n(p.phone),
    email: n(p.email),
    website: n(p.website),
    linkedin: n(p.linkedin),
    github: n(p.github),
    hidden_fields: [...new Set(p.hidden)],
  };
  await tx
    .insertInto('personal_data')
    .values({ content_id: contentId, ...personal })
    .onConflict((oc) => oc.column('content_id').doUpdateSet(personal))
    .execute();

  const pr = c.profile;
  const profile = {
    headline: n(pr.headline),
    summary: n(pr.summary),
    experience: n(pr.experience),
    expertise: n(pr.expertise),
    strengths: pr.strengths,
  };
  await tx
    .insertInto('profile_summaries')
    .values({ content_id: contentId, ...profile })
    .onConflict((oc) => oc.column('content_id').doUpdateSet(profile))
    .execute();

  const base = <T extends { id: string }>(item: T, position: number) => ({ content_id: contentId, id: item.id, position });

  if (p.links.length)
    await tx
      .insertInto('personal_links')
      .values(p.links.map((l, i) => ({ ...base(l, i), label: n(l.label), url: n(l.url), visible: l.visible })))
      .execute();

  await tx
    .insertInto('content_sections')
    .values(
      c.sections.map((sec, i) => ({
        content_id: contentId,
        section_key: sec.key,
        position: i,
        visible: sec.visible,
        custom_title: n(sec.title),
        options: JSON.stringify(sec.options ?? {}),
      })),
    )
    .execute();

  if (c.experience.length)
    await tx
      .insertInto('work_experiences')
      .values(
        c.experience.map((e, i) => ({
          ...base(e, i),
          visible: e.visible,
          employer: n(e.employer),
          job_title: n(e.jobTitle),
          location: n(e.location),
          start_date: n(e.startDate),
          end_date: n(e.endDate),
          is_current: e.current,
          description: n(e.description),
          tasks: e.tasks,
          achievements: e.achievements,
          projects: e.projects,
        })),
      )
      .execute();

  if (c.education.length)
    await tx
      .insertInto('educations')
      .values(
        c.education.map((e, i) => ({
          ...base(e, i),
          visible: e.visible,
          institution: n(e.institution),
          degree: n(e.degree),
          field_of_study: n(e.fieldOfStudy),
          location: n(e.location),
          start_date: n(e.startDate),
          end_date: n(e.endDate),
          is_current: e.current,
          grade: n(e.grade),
          description: n(e.description),
        })),
      )
      .execute();

  if (c.trainings.length)
    await tx
      .insertInto('trainings')
      .values(
        c.trainings.map((t, i) => ({
          ...base(t, i),
          visible: t.visible,
          kind: t.kind,
          title: n(t.title),
          provider: n(t.provider),
          date: n(t.date),
          duration: n(t.duration),
          certificate: n(t.certificate),
          description: n(t.description),
        })),
      )
      .execute();

  if (c.skills.length) {
    await tx
      .insertInto('skill_groups')
      .values(c.skills.map((g, i) => ({ ...base(g, i), visible: g.visible, name: n(g.name) })))
      .execute();
    const skills = c.skills.flatMap((g) =>
      g.items.map((sk, i) => ({ content_id: contentId, group_id: g.id, id: sk.id, position: i, name: n(sk.name), level: sk.level })),
    );
    // Doppelte Skill-IDs (z. B. durch Kopieren zwischen Gruppen) verhindern Primärschlüsselkonflikte
    const seen = new Set<string>();
    const uniqueSkills = skills.filter((sk) => (seen.has(sk.id) ? false : (seen.add(sk.id), true)));
    if (uniqueSkills.length) await tx.insertInto('skills').values(uniqueSkills).execute();
  }

  if (c.languages.length)
    await tx
      .insertInto('languages')
      .values(c.languages.map((l, i) => ({ ...base(l, i), visible: l.visible, name: n(l.name), level: l.level, note: n(l.note) })))
      .execute();

  if (c.certificates.length)
    await tx
      .insertInto('certificates')
      .values(
        c.certificates.map((ct, i) => ({
          ...base(ct, i),
          visible: ct.visible,
          category: ct.category,
          name: n(ct.name),
          issuer: n(ct.issuer),
          date: n(ct.date),
          valid_until: n(ct.validUntil),
          credential_id: n(ct.credentialId),
          description: n(ct.description),
        })),
      )
      .execute();

  if (c.projects.length)
    await tx
      .insertInto('projects')
      .values(
        c.projects.map((pj, i) => ({
          ...base(pj, i),
          visible: pj.visible,
          name: n(pj.name),
          role: n(pj.role),
          start_date: n(pj.startDate),
          end_date: n(pj.endDate),
          is_current: pj.current,
          description: n(pj.description),
          technologies: pj.technologies,
          results: pj.results,
          link: n(pj.link),
        })),
      )
      .execute();

  if (c.internships.length)
    await tx
      .insertInto('internships')
      .values(
        c.internships.map((it, i) => ({
          ...base(it, i),
          visible: it.visible,
          company: n(it.company),
          job_title: n(it.jobTitle),
          location: n(it.location),
          start_date: n(it.startDate),
          end_date: n(it.endDate),
          description: n(it.description),
        })),
      )
      .execute();

  if (c.volunteering.length)
    await tx
      .insertInto('volunteering')
      .values(
        c.volunteering.map((v, i) => ({
          ...base(v, i),
          visible: v.visible,
          organization: n(v.organization),
          role: n(v.role),
          location: n(v.location),
          start_date: n(v.startDate),
          end_date: n(v.endDate),
          is_current: v.current,
          description: n(v.description),
        })),
      )
      .execute();

  if (c.interests.length)
    await tx
      .insertInto('interests')
      .values(
        c.interests.map((it, i) => ({
          ...base(it, i),
          visible: it.visible,
          category: it.category,
          name: n(it.name),
          description: n(it.description),
        })),
      )
      .execute();

  if (c.references.length)
    await tx
      .insertInto('cv_references')
      .values(
        c.references.map((r, i) => ({
          ...base(r, i),
          visible: r.visible,
          name: n(r.name),
          job_title: n(r.jobTitle),
          company: n(r.company),
          phone: n(r.phone),
          email: n(r.email),
        })),
      )
      .execute();

  await tx.updateTable('cv_contents').set({ updated_at: new Date() }).where('id', '=', contentId).execute();
}

export async function readContent(tx: Tx, contentId: string): Promise<ResumeContent> {
  const [personal, links, sections, profile, experience, education, trainings, groups, skills, languages, certificates, projects, internships, volunteering, interests, references] =
    await Promise.all([
      tx.selectFrom('personal_data').selectAll().where('content_id', '=', contentId).executeTakeFirst(),
      tx.selectFrom('personal_links').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('content_sections').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('profile_summaries').selectAll().where('content_id', '=', contentId).executeTakeFirst(),
      tx.selectFrom('work_experiences').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('educations').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('trainings').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('skill_groups').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('skills').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('languages').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('certificates').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('projects').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('internships').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('volunteering').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('interests').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
      tx.selectFrom('cv_references').selectAll().where('content_id', '=', contentId).orderBy('position').execute(),
    ]);

  const content = {
    personal: {
      firstName: s(personal?.first_name),
      lastName: s(personal?.last_name),
      jobTitle: s(personal?.job_title),
      photoId: personal?.photo_document_id ?? null,
      birthDate: s(personal?.birth_date),
      birthPlace: s(personal?.birth_place),
      nationality: s(personal?.nationality),
      maritalStatus: s(personal?.marital_status),
      street: s(personal?.street),
      postalCode: s(personal?.postal_code),
      city: s(personal?.city),
      country: s(personal?.country),
      phone: s(personal?.phone),
      email: s(personal?.email),
      website: s(personal?.website),
      linkedin: s(personal?.linkedin),
      github: s(personal?.github),
      links: links.map((l) => ({ id: l.id, label: s(l.label), url: s(l.url), visible: l.visible })),
      hidden: personal?.hidden_fields ?? [],
    },
    sections: sections.map(
      (sec): SectionConfig => ({
        key: sec.section_key as SectionConfig['key'],
        visible: sec.visible,
        title: s(sec.custom_title),
        options: (sec.options ?? {}) as SectionConfig['options'],
      }),
    ),
    profile: {
      headline: s(profile?.headline),
      summary: s(profile?.summary),
      experience: s(profile?.experience),
      expertise: s(profile?.expertise),
      strengths: profile?.strengths ?? [],
    },
    experience: experience.map((e) => ({
      id: e.id,
      visible: e.visible,
      employer: s(e.employer),
      jobTitle: s(e.job_title),
      location: s(e.location),
      startDate: s(e.start_date),
      endDate: s(e.end_date),
      current: e.is_current,
      description: s(e.description),
      tasks: e.tasks,
      achievements: e.achievements,
      projects: e.projects,
    })),
    education: education.map((e) => ({
      id: e.id,
      visible: e.visible,
      institution: s(e.institution),
      degree: s(e.degree),
      fieldOfStudy: s(e.field_of_study),
      location: s(e.location),
      startDate: s(e.start_date),
      endDate: s(e.end_date),
      current: e.is_current,
      grade: s(e.grade),
      description: s(e.description),
    })),
    trainings: trainings.map((t) => ({
      id: t.id,
      visible: t.visible,
      kind: t.kind,
      title: s(t.title),
      provider: s(t.provider),
      date: s(t.date),
      duration: s(t.duration),
      certificate: s(t.certificate),
      description: s(t.description),
    })),
    skills: groups.map((g) => ({
      id: g.id,
      visible: g.visible,
      name: s(g.name),
      items: skills.filter((sk) => sk.group_id === g.id).map((sk) => ({ id: sk.id, name: s(sk.name), level: sk.level })),
    })),
    languages: languages.map((l) => ({
      id: l.id,
      visible: l.visible,
      name: s(l.name),
      level: (l.level as LanguageLevel | null) ?? null,
      note: s(l.note),
    })),
    certificates: certificates.map((ct) => ({
      id: ct.id,
      visible: ct.visible,
      category: ct.category,
      name: s(ct.name),
      issuer: s(ct.issuer),
      date: s(ct.date),
      validUntil: s(ct.valid_until),
      credentialId: s(ct.credential_id),
      description: s(ct.description),
    })),
    projects: projects.map((pj) => ({
      id: pj.id,
      visible: pj.visible,
      name: s(pj.name),
      role: s(pj.role),
      startDate: s(pj.start_date),
      endDate: s(pj.end_date),
      current: pj.is_current,
      description: s(pj.description),
      technologies: pj.technologies,
      results: pj.results,
      link: s(pj.link),
    })),
    internships: internships.map((it) => ({
      id: it.id,
      visible: it.visible,
      company: s(it.company),
      jobTitle: s(it.job_title),
      location: s(it.location),
      startDate: s(it.start_date),
      endDate: s(it.end_date),
      description: s(it.description),
    })),
    volunteering: volunteering.map((v) => ({
      id: v.id,
      visible: v.visible,
      organization: s(v.organization),
      role: s(v.role),
      location: s(v.location),
      startDate: s(v.start_date),
      endDate: s(v.end_date),
      current: v.is_current,
      description: s(v.description),
    })),
    interests: interests.map((it) => ({
      id: it.id,
      visible: it.visible,
      category: it.category,
      name: s(it.name),
      description: s(it.description),
    })),
    references: references.map((r) => ({
      id: r.id,
      visible: r.visible,
      name: s(r.name),
      jobTitle: s(r.job_title),
      company: s(r.company),
      phone: s(r.phone),
      email: s(r.email),
    })),
  };
  return normalizeContent(content);
}

/** Name und Berufsbezeichnung für Listenansichten (eine Abfrage für viele Inhalte). */
export async function readHeadlines(tx: Tx, contentIds: string[]): Promise<Map<string, { fullName: string; jobTitle: string }>> {
  const map = new Map<string, { fullName: string; jobTitle: string }>();
  if (contentIds.length === 0) return map;
  const rows = await tx
    .selectFrom('personal_data')
    .select(['content_id', 'first_name', 'last_name', 'job_title'])
    .where('content_id', 'in', contentIds)
    .execute();
  for (const r of rows) {
    map.set(r.content_id, {
      fullName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      jobTitle: s(r.job_title),
    });
  }
  return map;
}

export async function deleteContent(tx: Tx, contentId: string): Promise<void> {
  await tx.deleteFrom('cv_contents').where('id', '=', contentId).execute();
}
