/**
 * Heuristischer Parser: erkennt Inhalte eines Lebenslaufs aus reinem Text
 * (extrahiert aus PDF, DOCX oder TXT) und sortiert sie in die Felder ein.
 * Das Ergebnis ist immer ein Vorschlag – der Benutzer prüft alles vor der Übernahme.
 */
import type { LanguageLevel, SectionKey } from '../constants.js';
import { parseDateInput } from '../dates.js';
import { createEmptyContent, createItem, createSkill } from '../factory.js';
import { createId } from '../ids.js';
import type { ResumeContent } from '../schemas/resume.js';
import { EMAIL_PATTERN } from '../urls.js';

export interface ParsedResume {
  content: ResumeContent;
  detectedSections: SectionKey[];
  warnings: string[];
}

const HEADINGS: Record<SectionKey, RegExp> = {
  profile: /^(profil|kurzprofil|über mich|zusammenfassung|persönliches profil|profile|summary|about me|professional summary)$/i,
  experience: /^(berufserfahrung|berufliche erfahrung|beruflicher werdegang|werdegang|berufspraxis|praxiserfahrung|experience|work experience|professional experience|employment history|work history)$/i,
  education: /^(ausbildung|schulbildung|bildung|bildungsweg|studium|schul- und berufsausbildung|education|academic background)$/i,
  internships: /^(praktika|praktikum|internships?)$/i,
  trainings: /^(weiterbildungen?|fortbildungen?|fort- und weiterbildungen?|seminare|schulungen|lehrgänge|further training|training|courses)$/i,
  certificates: /^(zertifikate|zertifizierungen|qualifikationen|zusatzqualifikationen|bescheinigungen|certifications?|certificates|qualifications)$/i,
  skills: /^(kenntnisse|fähigkeiten|fachkenntnisse|it-kenntnisse|edv-kenntnisse|kompetenzen|skills|technical skills|competencies|expertise)$/i,
  languages: /^(sprachen|sprachkenntnisse|fremdsprachen|languages|language skills)$/i,
  projects: /^(projekte|projekterfahrung|ausgewählte projekte|projects|selected projects)$/i,
  volunteering: /^(ehrenamt|ehrenamtliches engagement|soziales engagement|engagement|volunteering|volunteer work|volunteer experience)$/i,
  interests: /^(interessen|hobbys|hobbies|freizeit|interessen & hobbys|interessen und hobbys|interests|hobbies & interests)$/i,
  references: /^(referenzen|references)$/i,
};

const BULLET = /^\s*[-•*▪◦●–·]\s+/;
const MONTH_NAMES: Record<string, number> = {
  jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mär: 3, mrz: 3, märz: 3, mar: 3, march: 3,
  apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11,
  dez: 12, dezember: 12, dec: 12, december: 12,
};

const DATE_TOKEN = String.raw`(?:\d{1,2}[./]\d{1,2}[./]\d{4}|\d{1,2}\s*[./]\s*\d{4}|[A-Za-zäÄ]{3,9}\.?\s+\d{4}|\d{4})`;
const PRESENT = String.raw`(?:heute|aktuell|jetzt|dato|present|current|now|today|laufend)`;
const RANGE_RE = new RegExp(String.raw`(${DATE_TOKEN})\s*(?:-|–|—|bis|to|until)\s*(${DATE_TOKEN}|${PRESENT})`, 'i');
const SINGLE_DATE_RE = new RegExp(String.raw`(?:^|\s|\()(?:seit|since)?\s*(${DATE_TOKEN})(?:$|\s|\))`, 'i');

function parseDateToken(token: string): string {
  const s = token.trim().replace(/\s+/g, ' ');
  const named = s.match(/^([A-Za-zäÄ]{3,9})\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTH_NAMES[named[1]!.toLowerCase()];
    return month ? `${named[2]}-${String(month).padStart(2, '0')}` : named[2]!;
  }
  return parseDateInput(s) ?? '';
}

function parseRange(line: string): { start: string; end: string; current: boolean; rest: string } | null {
  const m = line.match(RANGE_RE);
  if (!m) {
    const since = line.match(new RegExp(String.raw`(?:seit|since)\s+(${DATE_TOKEN})`, 'i'));
    if (since) {
      return { start: parseDateToken(since[1]!), end: '', current: true, rest: line.replace(since[0], '').trim() };
    }
    return null;
  }
  const current = new RegExp(`^${PRESENT}$`, 'i').test(m[2]!.trim());
  return {
    start: parseDateToken(m[1]!),
    end: current ? '' : parseDateToken(m[2]!),
    current,
    rest: line.replace(m[0], '').replace(/^[\s,|:–-]+|[\s,|:–-]+$/g, '').trim(),
  };
}

function detectHeading(line: string): SectionKey | null {
  const clean = line.replace(/[:：]$/, '').replace(/\s+/g, ' ').trim();
  if (clean.length > 45) return null;
  for (const [key, re] of Object.entries(HEADINGS) as [SectionKey, RegExp][]) {
    if (re.test(clean)) return key;
  }
  return null;
}

function splitList(text: string): string[] {
  return text
    .split(/[,;•|·]|\s{2,}|\n/)
    .map((s) => s.replace(BULLET, '').trim())
    .filter((s) => s.length > 1 && s.length < 80);
}

interface Entry {
  range: { start: string; end: string; current: boolean } | null;
  head: string[];
  bullets: string[];
  text: string[];
}

/** Zerlegt einen Abschnitt in Einträge – jeder Eintrag beginnt mit einer Zeitraumangabe. */
function splitEntries(lines: string[]): Entry[] {
  const entries: Entry[] = [];
  let cur: Entry | null = null;
  for (const line of lines) {
    const range = parseRange(line);
    if (range && !BULLET.test(line)) {
      cur = { range, head: range.rest ? [range.rest] : [], bullets: [], text: [] };
      entries.push(cur);
      continue;
    }
    if (!cur) {
      cur = { range: null, head: [], bullets: [], text: [] };
      entries.push(cur);
    }
    if (BULLET.test(line)) cur.bullets.push(line.replace(BULLET, '').trim());
    else if (cur.head.length < 2 && cur.bullets.length === 0 && cur.text.length === 0 && line.length < 120) cur.head.push(line);
    else cur.text.push(line);
  }
  return entries.filter((e) => e.head.length || e.bullets.length || e.text.length);
}

function splitOrgLocation(value: string): { org: string; location: string } {
  const parts = value.split(/\s*[,|]\s*/);
  if (parts.length >= 2) return { org: parts.slice(0, -1).join(', '), location: parts[parts.length - 1]! };
  return { org: value, location: '' };
}

function languageLevel(text: string): LanguageLevel | null {
  const cefr = text.match(/\b([ABC][12])\b/i);
  if (cefr) return cefr[1]!.toUpperCase() as LanguageLevel;
  if (/mutter|native|erstsprache/i.test(text)) return 'native';
  if (/verhandlungssicher|fließend|fluent|business/i.test(text)) return 'C1';
  if (/sehr gut|very good|advanced/i.test(text)) return 'B2';
  if (/gut|good|intermediate/i.test(text)) return 'B1';
  if (/grund|basic|elementary|beginner/i.test(text)) return 'A2';
  return null;
}

export function parseResumeText(raw: string): ParsedResume {
  const content = createEmptyContent();
  const warnings: string[] = [];
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  /* --- Kontaktdaten aus dem gesamten Text -------------------------- */
  const all = lines.join('\n');
  const email = all.match(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i)?.[0];
  if (email && EMAIL_PATTERN.test(email)) content.personal.email = email;
  const phone = all.match(/(?:\+|00)\d[\d\s/().-]{6,20}\d|\b0\d{2,5}[\s/-]?\d[\d\s/-]{4,14}\d/)?.[0];
  if (phone) content.personal.phone = phone.trim();
  const linkedin = all.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s,;]+/i)?.[0];
  if (linkedin) content.personal.linkedin = linkedin;
  const github = all.match(/(?:https?:\/\/)?github\.com\/[^\s,;]+/i)?.[0];
  if (github) content.personal.github = github;
  const web = all.match(/(?:https?:\/\/|www\.)[^\s,;]+/i)?.[0];
  if (web && !/linkedin|github/i.test(web)) content.personal.website = web;
  const postal = all.match(/\b(\d{5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[ -][A-ZÄÖÜ]?[a-zäöüß]+)*)/);
  if (postal) {
    content.personal.postalCode = postal[1]!;
    content.personal.city = postal[2]!;
  }
  const street = all.match(/([A-ZÄÖÜ][a-zäöüß-]+(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm)\s*\d+[a-z]?)/);
  if (street) content.personal.street = street[1]!;
  const birth = all.match(/(?:geboren(?: am)?|geb\.|geburtsdatum|date of birth|born)[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i);
  if (birth) content.personal.birthDate = parseDateInput(birth[1]!) ?? '';

  /* --- Kopf: Name und Berufsbezeichnung ----------------------------- */
  let index = 0;
  const isContactLine = (l: string) => /@|\+?\d{3,}|www\.|https?:|linkedin|github|straße|strasse/i.test(l);
  for (; index < Math.min(lines.length, 6); index++) {
    const l = lines[index]!;
    if (/^(lebenslauf|curriculum vitae|cv|resume|résumé)$/i.test(l)) continue;
    if (detectHeading(l) || isContactLine(l)) continue;
    const words = l.split(' ');
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-ZÄÖÜ][\p{L}'.-]+$/u.test(w))) {
      content.personal.firstName = words.slice(0, -1).join(' ');
      content.personal.lastName = words[words.length - 1]!;
      const next = lines[index + 1];
      if (next && !detectHeading(next) && !isContactLine(next) && next.length < 80) {
        content.personal.jobTitle = next;
        index += 1;
      }
      index += 1;
      break;
    }
  }
  if (!content.personal.lastName) warnings.push('name_not_detected');

  /* --- Abschnitte ----------------------------------------------------- */
  const buckets = new Map<SectionKey, string[]>();
  let current: SectionKey | null = null;
  const preamble: string[] = [];
  for (const line of lines.slice(index)) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      if (!buckets.has(heading)) buckets.set(heading, []);
      continue;
    }
    if (current) buckets.get(current)!.push(line);
    else if (!isContactLine(line)) preamble.push(line);
  }

  if (!buckets.has('profile') && preamble.join(' ').length > 120) {
    buckets.set('profile', preamble);
  }

  for (const [key, sectionLines] of buckets) {
    switch (key) {
      case 'profile':
        content.profile.summary = sectionLines.filter((l) => !BULLET.test(l)).join(' ').slice(0, 5000);
        content.profile.strengths = sectionLines.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, '')).slice(0, 10);
        break;
      case 'experience':
      case 'internships':
      case 'volunteering':
      case 'projects':
        for (const e of splitEntries(sectionLines).slice(0, 50)) {
          const [first = '', second = ''] = e.head;
          const { org, location } = splitOrgLocation(second);
          const description = e.text.join(' ').slice(0, 5000);
          if (key === 'experience') {
            const item = createItem('experience');
            Object.assign(item, {
              jobTitle: first, employer: org, location, description,
              tasks: e.bullets.slice(0, 30),
              startDate: e.range?.start ?? '', endDate: e.range?.end ?? '', current: e.range?.current ?? false,
            });
            content.experience.push(item);
          } else if (key === 'internships') {
            const item = createItem('internships');
            Object.assign(item, {
              jobTitle: first, company: org, location, description: [description, ...e.bullets].filter(Boolean).join('\n'),
              startDate: e.range?.start ?? '', endDate: e.range?.end ?? '',
            });
            content.internships.push(item);
          } else if (key === 'volunteering') {
            const item = createItem('volunteering');
            Object.assign(item, {
              role: first, organization: org || first, location, description: [description, ...e.bullets].filter(Boolean).join('\n'),
              startDate: e.range?.start ?? '', endDate: e.range?.end ?? '', current: e.range?.current ?? false,
            });
            content.volunteering.push(item);
          } else {
            const item = createItem('projects');
            Object.assign(item, {
              name: first, role: second, description, results: e.bullets.slice(0, 30),
              startDate: e.range?.start ?? '', endDate: e.range?.end ?? '', current: e.range?.current ?? false,
            });
            content.projects.push(item);
          }
        }
        break;
      case 'education':
        for (const e of splitEntries(sectionLines).slice(0, 50)) {
          const [first = '', second = ''] = e.head;
          const { org, location } = splitOrgLocation(second);
          const item = createItem('education');
          const grade = [...e.text, ...e.bullets].join(' ').match(/(?:note|grade|abschlussnote)[:\s]+([0-9],[0-9]|[0-9]\.[0-9])/i)?.[1];
          Object.assign(item, {
            degree: first, institution: org, location, grade: grade ?? '',
            description: [...e.text, ...e.bullets].join('\n').slice(0, 5000),
            startDate: e.range?.start ?? '', endDate: e.range?.end ?? '', current: e.range?.current ?? false,
          });
          content.education.push(item);
        }
        break;
      case 'trainings':
      case 'certificates':
        for (const line of sectionLines.slice(0, 50)) {
          const text = line.replace(BULLET, '');
          const dateMatch = text.match(SINGLE_DATE_RE);
          const date = dateMatch ? parseDateToken(dateMatch[1]!) : '';
          const name = text.replace(dateMatch?.[0] ?? '', ' ').replace(/^[\s,|:–-]+|[\s,|:–-]+$/g, '').trim();
          if (!name) continue;
          if (key === 'trainings') {
            const item = createItem('trainings');
            const [title, provider = ''] = name.split(/\s*[,|]\s*/);
            Object.assign(item, { title: title ?? name, provider, date });
            content.trainings.push(item);
          } else {
            const item = createItem('certificates');
            Object.assign(item, {
              name, date,
              category: /führerschein|licen[cs]e/i.test(name) ? 'drivers_license' : /erste hilfe|first aid/i.test(name) ? 'first_aid' : 'professional',
            });
            content.certificates.push(item);
          }
        }
        break;
      case 'skills': {
        const groups = new Map<string, string[]>();
        for (const line of sectionLines) {
          const labeled = line.replace(BULLET, '').match(/^([^:]{2,40}):\s*(.+)$/);
          if (labeled) groups.set(labeled[1]!.trim(), [...(groups.get(labeled[1]!.trim()) ?? []), ...splitList(labeled[2]!)]);
          else groups.set('', [...(groups.get('') ?? []), ...splitList(line)]);
        }
        for (const [name, skills] of groups) {
          if (!skills.length) continue;
          content.skills.push({
            id: createId(),
            visible: true,
            name: name || 'Kenntnisse',
            items: [...new Set(skills)].slice(0, 60).map((s) => createSkill(s)),
          });
        }
        break;
      }
      case 'languages':
        for (const line of sectionLines.flatMap((l) => l.split(/\s*[,;]\s*/)).slice(0, 20)) {
          const text = line.replace(BULLET, '').trim();
          const name = text.split(/[\s:(–-]/)[0] ?? '';
          if (!name || name.length < 3) continue;
          const item = createItem('languages');
          item.name = name;
          item.level = languageLevel(text);
          const note = text.slice(name.length).replace(/^[\s:(–-]+|[)\s]+$/g, '').trim();
          if (note && !/^[ABC][12]$/i.test(note)) item.note = note.slice(0, 200);
          content.languages.push(item);
        }
        break;
      case 'interests':
        for (const name of sectionLines.flatMap(splitList).slice(0, 30)) {
          const item = createItem('interests');
          item.name = name;
          content.interests.push(item);
        }
        break;
      case 'references':
        if (sectionLines.some((l) => /auf anfrage|upon request|on request/i.test(l))) {
          content.sections = content.sections.map((s) => (s.key === 'references' ? { ...s, options: { ...s.options, onRequest: true } } : s));
        } else {
          for (const line of sectionLines.slice(0, 10)) {
            const [name = '', ...rest] = line.replace(BULLET, '').split(/\s*[,|]\s*/);
            const item = createItem('references');
            item.name = name;
            item.email = rest.find((r) => r.includes('@')) ?? '';
            item.company = rest.find((r) => !r.includes('@') && !/\d{4,}/.test(r)) ?? '';
            content.references.push(item);
          }
        }
        break;
    }
  }

  const detectedSections = [...buckets.keys()].filter((k) =>
    k === 'profile' ? Boolean(content.profile.summary || content.profile.strengths.length) : (content[k] as unknown[]).length > 0,
  );
  if (detectedSections.length === 0) warnings.push('no_sections_detected');
  if (content.experience.some((e) => !e.startDate)) warnings.push('experience_dates_incomplete');

  return { content, detectedSections, warnings };
}
