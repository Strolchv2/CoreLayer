import type { Locale, SectionKey } from '../constants.js';
import { comparePartialDates, datePrecision, toMonthIndex, currentPartialMonth } from '../dates.js';
import { getCvLabels } from '../labels.js';
import type { ResumeContent } from '../schemas/resume.js';
import { sectionHasContent, splitParagraphs } from '../text.js';
import { EMAIL_PATTERN, PHONE_PATTERN, isSafeHttpUrl } from '../urls.js';
import { buildReport, type CheckItem, type CheckReport } from './types.js';

/** Ab dieser Zeichenzahl gilt ein einzelner Absatz als "sehr großer Textblock". */
export const LARGE_TEXT_BLOCK_CHARS = 700;
const LONG_BULLET_CHARS = 220;
const GAP_MONTHS = 6;

type Tr = (de: string, en: string) => string;

/**
 * Automatischer Qualitätscheck eines Lebenslaufs.
 * Liefert Bestätigungen (✓), Warnungen (⚠) und Hinweise (ℹ) mit konkreten Vorschlägen.
 */
export function runQualityCheck(content: ResumeContent, locale: Locale = 'de'): CheckReport {
  const t: Tr = (de, en) => (locale === 'en' ? en : de);
  const labels = getCvLabels(locale);
  const items: CheckItem[] = [];
  const p = content.personal;
  const hidden = new Set(p.hidden);
  const visibleSection = (key: SectionKey) => content.sections.find((s) => s.key === key)?.visible ?? false;

  /* --- Kontaktdaten ------------------------------------------------ */
  if (p.firstName.trim() && p.lastName.trim()) {
    items.push({ id: 'name', status: 'ok', title: t('Vor- und Nachname vorhanden', 'First and last name present'), section: 'personal' });
  } else {
    items.push({
      id: 'name',
      status: 'warning',
      title: t('Name unvollständig', 'Name incomplete'),
      suggestion: t('Trage Vor- und Nachnamen ein.', 'Enter your first and last name.'),
      section: 'personal',
    });
  }

  const email = p.email.trim();
  if (!email || hidden.has('email')) {
    items.push({
      id: 'email',
      status: 'warning',
      title: t('E-Mail-Adresse fehlt', 'Email address missing'),
      suggestion: t('Ohne E-Mail-Adresse können Personaler dich kaum erreichen. Ergänze eine seriöse Adresse.', 'Recruiters need an email address to contact you. Add a professional address.'),
      section: 'personal',
    });
  } else if (!EMAIL_PATTERN.test(email)) {
    items.push({
      id: 'email',
      status: 'warning',
      title: t('E-Mail-Adresse ist ungültig', 'Email address is invalid'),
      suggestion: t('Prüfe die Schreibweise (z. B. name@beispiel.de).', 'Check the spelling (e.g. name@example.com).'),
      section: 'personal',
    });
  } else {
    items.push({ id: 'email', status: 'ok', title: t('E-Mail-Adresse vorhanden', 'Email address present'), section: 'personal' });
  }

  const phone = p.phone.trim();
  if (!phone || hidden.has('phone')) {
    items.push({
      id: 'phone',
      status: 'warning',
      title: t('Telefonnummer fehlt', 'Phone number missing'),
      suggestion: t('Eine Telefonnummer ermöglicht schnelle Rückfragen.', 'A phone number allows quick follow-up questions.'),
      section: 'personal',
    });
  } else if (!PHONE_PATTERN.test(phone)) {
    items.push({
      id: 'phone',
      status: 'warning',
      title: t('Telefonnummer enthält unzulässige Zeichen', 'Phone number contains invalid characters'),
      suggestion: t('Erlaubt sind Ziffern, Leerzeichen sowie + / - ( ).', 'Allowed are digits, spaces and + / - ( ).'),
      section: 'personal',
    });
  } else {
    items.push({ id: 'phone', status: 'ok', title: t('Telefonnummer vorhanden', 'Phone number present'), section: 'personal' });
  }

  if (!p.city.trim() || hidden.has('address')) {
    items.push({
      id: 'city',
      status: 'info',
      title: t('Wohnort nicht angegeben', 'Place of residence not shown'),
      suggestion: t('Für Bewerbungen in Deutschland ist zumindest der Wohnort üblich.', 'Adding at least your city is common for applications.'),
      section: 'personal',
    });
  }

  if (!p.jobTitle.trim() || hidden.has('jobTitle')) {
    items.push({
      id: 'jobTitle',
      status: 'info',
      title: t('Keine Berufsbezeichnung', 'No job title'),
      suggestion: t('Eine Berufsbezeichnung unter dem Namen zeigt sofort, wofür du stehst.', 'A job title below your name immediately shows your focus.'),
      section: 'personal',
    });
  }

  const urlFields: [string, string][] = [
    [p.website, labels.website],
    [p.linkedin, 'LinkedIn'],
    [p.github, 'GitHub'],
    ...p.links.map((l) => [l.url, l.label || 'Link'] as [string, string]),
  ];
  for (const [url, label] of urlFields) {
    if (url.trim() && !isSafeHttpUrl(url)) {
      items.push({
        id: `url-${label}`,
        status: 'warning',
        title: t(`Link „${label}“ ist ungültig`, `Link "${label}" is invalid`),
        suggestion: t('Gib eine vollständige Webadresse an (z. B. https://www.beispiel.de).', 'Enter a complete web address (e.g. https://www.example.com).'),
        section: 'personal',
      });
    }
  }

  /* --- Profil -------------------------------------------------------- */
  const summary = content.profile.summary.trim();
  if (visibleSection('profile') && summary) {
    items.push({ id: 'profile', status: 'ok', title: t('Profil vorhanden', 'Profile present'), section: 'profile' });
    if (summary.length < 150) {
      items.push({
        id: 'profile-short',
        status: 'info',
        title: t('Profiltext ist sehr kurz', 'Profile text is very short'),
        suggestion: t('Beschreibe in 3–5 Sätzen Erfahrung, Fachgebiet und Ziel.', 'Describe your experience, expertise and goal in 3–5 sentences.'),
        section: 'profile',
      });
    } else if (summary.length > 1200) {
      items.push({
        id: 'profile-long',
        status: 'warning',
        title: t('Profiltext ist sehr lang', 'Profile text is very long'),
        suggestion: t('Kürze das Profil auf das Wesentliche (ca. 400–900 Zeichen).', 'Shorten the profile to the essentials (approx. 400–900 characters).'),
        section: 'profile',
      });
    }
  } else {
    items.push({
      id: 'profile',
      status: 'warning',
      title: t('Kein Kurzprofil', 'No summary'),
      suggestion: t('Ein kurzes Profil („Über mich“) fasst deine Stärken zusammen und erleichtert den Einstieg.', 'A short summary highlights your strengths and helps readers get started.'),
      section: 'profile',
    });
  }

  /* --- Berufserfahrung ---------------------------------------------- */
  const experience = content.experience.filter((e) => e.visible);
  if (visibleSection('experience') && experience.length > 0) {
    items.push({ id: 'experience', status: 'ok', title: t('Berufserfahrung vorhanden', 'Work experience present'), section: 'experience' });
  } else {
    items.push({
      id: 'experience',
      status: visibleSection('internships') && content.internships.some((i) => i.visible) ? 'info' : 'warning',
      title: t('Keine Berufserfahrung angegeben', 'No work experience listed'),
      suggestion: t('Ergänze Arbeitsstellen, Nebenjobs oder Praktika.', 'Add jobs, part-time jobs or internships.'),
      section: 'experience',
    });
  }
  for (const e of experience) {
    const name = e.jobTitle || e.employer || t('Eintrag', 'Entry');
    if (!e.jobTitle.trim() || !e.employer.trim()) {
      items.push({
        id: `exp-fields-${e.id}`,
        status: 'warning',
        title: t(`„${name}“: Position oder Arbeitgeber fehlt`, `"${name}": position or employer missing`),
        section: 'experience',
        itemId: e.id,
      });
    }
    if (!e.description.trim() && e.tasks.every((x) => !x.trim()) && e.achievements.every((x) => !x.trim())) {
      items.push({
        id: `exp-desc-${e.id}`,
        status: 'warning',
        title: t(`Berufserfahrung „${name}“ enthält keine Beschreibung`, `Experience "${name}" has no description`),
        suggestion: t('Nenne 2–5 Aufgaben oder Erfolge – möglichst mit messbaren Ergebnissen.', 'List 2–5 responsibilities or achievements – ideally with measurable results.'),
        section: 'experience',
        itemId: e.id,
      });
    }
    if (!e.startDate) {
      items.push({
        id: `exp-start-${e.id}`,
        status: 'warning',
        title: t(`„${name}“: Beginn fehlt`, `"${name}": start date missing`),
        section: 'experience',
        itemId: e.id,
      });
    } else if (!e.current && !e.endDate) {
      items.push({
        id: `exp-end-${e.id}`,
        status: 'info',
        title: t(`„${name}“: Ende fehlt`, `"${name}": end date missing`),
        suggestion: t('Gib ein Enddatum an oder markiere „aktuell beschäftigt“.', 'Add an end date or mark it as current.'),
        section: 'experience',
        itemId: e.id,
      });
    }
  }

  /* --- Ausbildung ------------------------------------------------------ */
  const education = content.education.filter((e) => e.visible);
  if (visibleSection('education') && education.length > 0) {
    items.push({ id: 'education', status: 'ok', title: t('Ausbildung vorhanden', 'Education present'), section: 'education' });
  } else {
    items.push({
      id: 'education',
      status: 'warning',
      title: t('Keine Ausbildung angegeben', 'No education listed'),
      suggestion: t('Ergänze Schulabschluss, Ausbildung oder Studium.', 'Add your school degree, apprenticeship or university studies.'),
      section: 'education',
    });
  }

  /* --- Kenntnisse & Sprachen ----------------------------------------- */
  const skillCount = content.skills.filter((g) => g.visible).reduce((n, g) => n + g.items.filter((s) => s.name.trim()).length, 0);
  if (visibleSection('skills') && skillCount > 0) {
    items.push({ id: 'skills', status: 'ok', title: t('Kenntnisse vorhanden', 'Skills present'), section: 'skills' });
  } else {
    items.push({
      id: 'skills',
      status: 'info',
      title: t('Keine Kenntnisse angegeben', 'No skills listed'),
      suggestion: t('Fachkenntnisse und Software-Kenntnisse sind wichtige Suchbegriffe für Personaler.', 'Technical and software skills are important search terms for recruiters.'),
      section: 'skills',
    });
  }
  if (!(visibleSection('languages') && content.languages.some((l) => l.visible && l.name.trim()))) {
    items.push({
      id: 'languages',
      status: 'info',
      title: t('Keine Sprachkenntnisse angegeben', 'No languages listed'),
      section: 'languages',
    });
  }

  /* --- Textblöcke ------------------------------------------------------ */
  const texts: { text: string; section: SectionKey; itemId?: string; label: string }[] = [
    { text: content.profile.summary, section: 'profile', label: labels.sections.profile },
    ...content.experience.map((e) => ({ text: e.description, section: 'experience' as const, itemId: e.id, label: e.jobTitle || e.employer })),
    ...content.education.map((e) => ({ text: e.description, section: 'education' as const, itemId: e.id, label: e.degree || e.institution })),
    ...content.projects.map((e) => ({ text: e.description, section: 'projects' as const, itemId: e.id, label: e.name })),
    ...content.volunteering.map((e) => ({ text: e.description, section: 'volunteering' as const, itemId: e.id, label: e.organization })),
    ...content.internships.map((e) => ({ text: e.description, section: 'internships' as const, itemId: e.id, label: e.company })),
  ];
  const large = texts.filter((x) => splitParagraphs(x.text).some((para) => para.length > LARGE_TEXT_BLOCK_CHARS));
  if (large.length > 0) {
    items.push({
      id: 'large-text',
      status: 'warning',
      title: t('Lebenslauf enthält sehr große Textblöcke', 'CV contains very large text blocks'),
      suggestion: t(
        `Betroffen: ${large.map((x) => x.label || labels.sections[x.section]).join(', ')}. Teile lange Absätze auf oder nutze Aufzählungspunkte.`,
        `Affected: ${large.map((x) => x.label || labels.sections[x.section]).join(', ')}. Split long paragraphs or use bullet points.`,
      ),
      section: large[0]!.section,
      itemId: large[0]!.itemId,
    });
  }
  const longBullets = content.experience.some((e) => [...e.tasks, ...e.achievements].some((b) => b.length > LONG_BULLET_CHARS));
  if (longBullets) {
    items.push({
      id: 'long-bullets',
      status: 'info',
      title: t('Einige Aufzählungspunkte sind sehr lang', 'Some bullet points are very long'),
      suggestion: t('Formuliere Aufzählungspunkte knapp – idealerweise eine Zeile.', 'Keep bullet points short – ideally one line.'),
      section: 'experience',
    });
  }

  /* --- Datumsangaben ---------------------------------------------------- */
  const rangeDates = [
    ...content.experience.filter((x) => x.visible).flatMap((x) => [x.startDate, x.current ? '' : x.endDate]),
    ...content.education.filter((x) => x.visible).flatMap((x) => [x.startDate, x.current ? '' : x.endDate]),
    ...content.internships.filter((x) => x.visible).flatMap((x) => [x.startDate, x.endDate]),
  ].filter(Boolean);
  const precisions = new Set(rangeDates.map(datePrecision).filter(Boolean));
  if (precisions.size > 1) {
    items.push({
      id: 'date-consistency',
      status: 'warning',
      title: t('Uneinheitliche Datumsformate', 'Inconsistent date formats'),
      suggestion: t(
        'Einige Zeiträume enthalten nur das Jahr, andere Monat und Jahr. Gib nach Möglichkeit überall Monat und Jahr an.',
        'Some periods only contain the year, others month and year. Use month and year everywhere if possible.',
      ),
      section: 'experience',
    });
  } else if (rangeDates.length > 0) {
    items.push({ id: 'date-consistency', status: 'ok', title: t('Einheitliche Datumsangaben', 'Consistent dates'), section: 'experience' });
  }

  const now = currentPartialMonth();
  const withRanges = [
    ...content.experience.map((x) => ({ ...x, label: x.jobTitle || x.employer, section: 'experience' as const })),
    ...content.education.map((x) => ({ ...x, label: x.degree || x.institution, section: 'education' as const })),
  ].filter((x) => x.visible);
  for (const x of withRanges) {
    if (x.startDate && x.endDate && !x.current && comparePartialDates(x.endDate, x.startDate) < 0) {
      items.push({
        id: `date-order-${x.id}`,
        status: 'warning',
        title: t(`„${x.label}“: Ende liegt vor dem Beginn`, `"${x.label}": end date is before start date`),
        section: x.section,
        itemId: x.id,
      });
    }
    if (x.startDate && comparePartialDates(x.startDate.slice(0, 7), now) > 0 && x.section === 'experience') {
      items.push({
        id: `date-future-${x.id}`,
        status: 'info',
        title: t(`„${x.label}“: Beginn liegt in der Zukunft`, `"${x.label}": start date is in the future`),
        section: x.section,
        itemId: x.id,
      });
    }
  }

  // Lücken im Lebenslauf (Berufserfahrung + Ausbildung zusammen betrachtet)
  const periods = withRanges
    .map((x) => ({
      start: toMonthIndex(x.startDate),
      end: x.current ? toMonthIndex(now) : toMonthIndex(x.endDate),
    }))
    .filter((x): x is { start: number; end: number } => x.start !== null && x.end !== null)
    .sort((a, b) => a.start - b.start);
  let coveredUntil: number | null = null;
  let gaps = 0;
  for (const period of periods) {
    if (coveredUntil !== null && period.start - coveredUntil > GAP_MONTHS) gaps += 1;
    coveredUntil = coveredUntil === null ? period.end : Math.max(coveredUntil, period.end);
  }
  if (gaps > 0) {
    items.push({
      id: 'gaps',
      status: 'info',
      title: t(`${gaps} zeitliche Lücke(n) von mehr als ${GAP_MONTHS} Monaten`, `${gaps} gap(s) of more than ${GAP_MONTHS} months`),
      suggestion: t(
        'Erkläre längere Lücken kurz (z. B. Elternzeit, Weiterbildung, Reisen) – das wirkt transparent.',
        'Briefly explain longer gaps (e.g. parental leave, training, travel) – it shows transparency.',
      ),
      section: 'experience',
    });
  }

  /* --- Ausgeblendete Abschnitte mit Inhalt ----------------------------- */
  for (const s of content.sections) {
    if (!s.visible && sectionHasContent(content, { ...s, visible: true })) {
      items.push({
        id: `hidden-${s.key}`,
        status: 'info',
        title: t(`Abschnitt „${s.title || labels.sections[s.key]}“ ist ausgeblendet`, `Section "${s.title || labels.sections[s.key]}" is hidden`),
        suggestion: t('Der Inhalt bleibt gespeichert und kann jederzeit wieder eingeblendet werden.', 'The content is kept and can be shown again at any time.'),
        section: s.key,
      });
    }
  }

  return buildReport(items);
}
