import type { DateFormat } from './constants.js';
import { formatDateRange, formatPartialDate } from './dates.js';
import { fullName } from './factory.js';
import type { CvLabels } from './labels.js';
import type { ResumeContent, SectionConfig } from './schemas/resume.js';

/** Sichtbare Abschnitte in Anzeigereihenfolge. */
export function visibleSections(content: ResumeContent): SectionConfig[] {
  return content.sections.filter((s) => s.visible);
}

export function sectionTitle(section: SectionConfig, labels: CvLabels): string {
  return section.title.trim() || labels.sections[section.key];
}

/** Absätze eines Freitexts (leere Zeilen trennen Absätze, einzelne Umbrüche bleiben erhalten). */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function nonEmpty(list: string[]): string[] {
  return list.map((s) => s.trim()).filter(Boolean);
}

/**
 * Wandelt den Lebenslauf in reinen Text um (ATS-Prüfung, Schlüsselwortsuche, KI-Kontext, DOCX-Fallback).
 * Berücksichtigt nur sichtbare Abschnitte und Einträge.
 */
export function resumeToPlainText(content: ResumeContent, labels: CvLabels, format: DateFormat): string {
  const out: string[] = [];
  const p = content.personal;
  const hidden = new Set(p.hidden);
  out.push(fullName(content));
  if (p.jobTitle && !hidden.has('jobTitle')) out.push(p.jobTitle);
  const contact: string[] = [];
  if (!hidden.has('address')) contact.push([p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', '));
  if (!hidden.has('phone')) contact.push(p.phone);
  if (!hidden.has('email')) contact.push(p.email);
  if (!hidden.has('website')) contact.push(p.website);
  if (!hidden.has('linkedin')) contact.push(p.linkedin);
  if (!hidden.has('github')) contact.push(p.github);
  for (const l of p.links) if (l.visible) contact.push(`${l.label} ${l.url}`.trim());
  out.push(contact.filter(Boolean).join(' | '));
  if (!hidden.has('birthDate') && p.birthDate) out.push(`${labels.birthDate}: ${formatPartialDate(p.birthDate, 'DD.MM.YYYY')}`);
  if (!hidden.has('birthPlace') && p.birthPlace) out.push(`${labels.birthPlace}: ${p.birthPlace}`);
  if (!hidden.has('nationality') && p.nationality) out.push(`${labels.nationality}: ${p.nationality}`);

  const range = (s: string, e: string, cur: boolean) => formatDateRange(s, e, cur, format, { present: labels.present });

  for (const section of visibleSections(content)) {
    const lines: string[] = [];
    switch (section.key) {
      case 'profile': {
        const pr = content.profile;
        lines.push(pr.headline, pr.summary);
        if (pr.experience) lines.push(`${labels.experienceYears}: ${pr.experience}`);
        if (pr.expertise) lines.push(`${labels.expertise}: ${pr.expertise}`);
        lines.push(...nonEmpty(pr.strengths));
        break;
      }
      case 'experience':
        for (const i of content.experience.filter((x) => x.visible)) {
          lines.push([range(i.startDate, i.endDate, i.current), i.jobTitle, i.employer, i.location].filter(Boolean).join(' | '));
          lines.push(i.description, ...nonEmpty(i.tasks), ...nonEmpty(i.achievements), ...nonEmpty(i.projects));
        }
        break;
      case 'education':
        for (const i of content.education.filter((x) => x.visible)) {
          lines.push([range(i.startDate, i.endDate, i.current), i.degree, i.fieldOfStudy, i.institution, i.location].filter(Boolean).join(' | '));
          if (i.grade) lines.push(`${labels.grade}: ${i.grade}`);
          lines.push(i.description);
        }
        break;
      case 'internships':
        for (const i of content.internships.filter((x) => x.visible)) {
          lines.push([range(i.startDate, i.endDate, false), i.jobTitle, i.company, i.location].filter(Boolean).join(' | '), i.description);
        }
        break;
      case 'trainings':
        for (const i of content.trainings.filter((x) => x.visible)) {
          lines.push([formatPartialDate(i.date, format), i.title, i.provider, i.duration, i.certificate].filter(Boolean).join(' | '), i.description);
        }
        break;
      case 'certificates':
        for (const i of content.certificates.filter((x) => x.visible)) {
          lines.push([i.name, i.issuer, formatPartialDate(i.date, format)].filter(Boolean).join(' | '), i.description);
        }
        break;
      case 'skills':
        for (const g of content.skills.filter((x) => x.visible)) {
          const names = g.items.map((s) => s.name.trim()).filter(Boolean).join(', ');
          lines.push(g.name ? `${g.name}: ${names}` : names);
        }
        break;
      case 'languages':
        for (const l of content.languages.filter((x) => x.visible)) {
          lines.push([l.name, l.level ? labels.languageLevels[l.level] : '', l.note].filter(Boolean).join(' – '));
        }
        break;
      case 'projects':
        for (const i of content.projects.filter((x) => x.visible)) {
          lines.push([range(i.startDate, i.endDate, i.current), i.name, i.role].filter(Boolean).join(' | '), i.description);
          if (i.technologies.length) lines.push(`${labels.technologies}: ${nonEmpty(i.technologies).join(', ')}`);
          lines.push(...nonEmpty(i.results), i.link);
        }
        break;
      case 'volunteering':
        for (const i of content.volunteering.filter((x) => x.visible)) {
          lines.push([range(i.startDate, i.endDate, i.current), i.role, i.organization].filter(Boolean).join(' | '), i.description);
        }
        break;
      case 'interests':
        lines.push(content.interests.filter((x) => x.visible).map((i) => i.name).filter(Boolean).join(', '));
        break;
      case 'references':
        if (section.options.onRequest) lines.push(labels.referencesOnRequest);
        else
          for (const r of content.references.filter((x) => x.visible)) {
            lines.push([r.name, r.jobTitle, r.company, r.phone, r.email].filter(Boolean).join(' | '));
          }
        break;
    }
    const body = lines.map((l) => l.trim()).filter(Boolean);
    if (body.length) out.push('', sectionTitle(section, labels).toUpperCase(), ...body);
  }
  return out.filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}

/** Hat ein Abschnitt darstellbaren Inhalt? (Leere Abschnitte werden im Lebenslauf nicht angezeigt.) */
export function sectionHasContent(content: ResumeContent, section: SectionConfig): boolean {
  switch (section.key) {
    case 'profile': {
      const p = content.profile;
      return Boolean(p.summary.trim() || p.headline.trim() || p.experience.trim() || p.expertise.trim() || nonEmpty(p.strengths).length);
    }
    case 'references':
      return Boolean(section.options.onRequest) || content.references.some((r) => r.visible && r.name.trim());
    case 'skills':
      return content.skills.some((g) => g.visible && g.items.some((s) => s.name.trim()));
    default: {
      const list = content[section.key] as { visible: boolean }[];
      return list.some((i) => i.visible);
    }
  }
}
