import { SECTION_KEYS, type SectionKey } from './constants.js';
import { createId } from './ids.js';
import {
  resumeContentSchema,
  type CertificateItem,
  type EducationItem,
  type ExperienceItem,
  type InterestItem,
  type InternshipItem,
  type LanguageItem,
  type ListSectionItemMap,
  type ListSectionKey,
  type PersonalLink,
  type ProjectItem,
  type ReferenceItem,
  type ResumeContent,
  type SectionConfig,
  type Skill,
  type SkillGroup,
  type TrainingItem,
  type VolunteeringItem,
} from './schemas/resume.js';

/** Standardreihenfolge (deutscher Lebenslauf). Optionale Bereiche sind zunächst sichtbar, aber leer. */
export function defaultSections(): SectionConfig[] {
  return SECTION_KEYS.map((key) => ({ key, visible: true, title: '', options: {} }));
}

/**
 * Stellt sicher, dass jeder Abschnitt genau einmal in der Konfiguration vorkommt
 * (z. B. nach Updates mit neuen Abschnitten oder bei importierten Daten).
 */
export function normalizeSections(sections: SectionConfig[]): SectionConfig[] {
  const seen = new Set<SectionKey>();
  const result: SectionConfig[] = [];
  for (const s of sections) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    result.push(s);
  }
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) result.push({ key, visible: true, title: '', options: {} });
  }
  return result;
}

export function createEmptyContent(): ResumeContent {
  const content = resumeContentSchema.parse({});
  content.sections = defaultSections();
  content.personal.hidden = ['maritalStatus'];
  return content;
}

/** Parst beliebige (z. B. gespeicherte) Daten robust in einen vollständigen Inhalt. */
export function normalizeContent(input: unknown): ResumeContent {
  const parsed = resumeContentSchema.parse(input ?? {});
  parsed.sections = normalizeSections(parsed.sections);
  return parsed;
}

export const itemFactories: { [K in ListSectionKey]: () => ListSectionItemMap[K] } = {
  experience: (): ExperienceItem => ({
    id: createId(),
    visible: true,
    employer: '',
    jobTitle: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
    tasks: [],
    achievements: [],
    projects: [],
  }),
  education: (): EducationItem => ({
    id: createId(),
    visible: true,
    institution: '',
    degree: '',
    fieldOfStudy: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    grade: '',
    description: '',
  }),
  trainings: (): TrainingItem => ({
    id: createId(),
    visible: true,
    kind: 'training',
    title: '',
    provider: '',
    date: '',
    duration: '',
    certificate: '',
    description: '',
  }),
  skills: (): SkillGroup => ({ id: createId(), visible: true, name: '', items: [] }),
  languages: (): LanguageItem => ({ id: createId(), visible: true, name: '', level: null, note: '' }),
  certificates: (): CertificateItem => ({
    id: createId(),
    visible: true,
    category: 'professional',
    name: '',
    issuer: '',
    date: '',
    validUntil: '',
    credentialId: '',
    description: '',
  }),
  projects: (): ProjectItem => ({
    id: createId(),
    visible: true,
    name: '',
    role: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
    technologies: [],
    results: [],
    link: '',
  }),
  internships: (): InternshipItem => ({
    id: createId(),
    visible: true,
    company: '',
    jobTitle: '',
    location: '',
    startDate: '',
    endDate: '',
    description: '',
  }),
  volunteering: (): VolunteeringItem => ({
    id: createId(),
    visible: true,
    organization: '',
    role: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  }),
  interests: (): InterestItem => ({
    id: createId(),
    visible: true,
    category: 'interest',
    name: '',
    description: '',
  }),
  references: (): ReferenceItem => ({
    id: createId(),
    visible: true,
    name: '',
    jobTitle: '',
    company: '',
    phone: '',
    email: '',
  }),
};

export function createItem<K extends ListSectionKey>(key: K): ListSectionItemMap[K] {
  return itemFactories[key]();
}

export function createSkill(name = '', level: number | null = null): Skill {
  return { id: createId(), name, level };
}

export function createLink(label = '', url = ''): PersonalLink {
  return { id: createId(), label, url, visible: true };
}

/** Tiefe Kopie mit neuen IDs (z. B. beim Erstellen eines Lebenslaufs aus einem Profil). */
export function cloneContentWithNewIds(content: ResumeContent): ResumeContent {
  const c = structuredClone(content);
  c.personal.links = c.personal.links.map((l) => ({ ...l, id: createId() }));
  const lists: ListSectionKey[] = [
    'experience',
    'education',
    'trainings',
    'languages',
    'certificates',
    'projects',
    'internships',
    'volunteering',
    'interests',
    'references',
  ];
  for (const key of lists) {
    (c[key] as { id: string }[]) = (c[key] as { id: string }[]).map((i) => ({ ...i, id: createId() }));
  }
  c.skills = c.skills.map((g) => ({
    ...g,
    id: createId(),
    items: g.items.map((s) => ({ ...s, id: createId() })),
  }));
  return c;
}

/** Vollständiger Name aus den persönlichen Daten. */
export function fullName(content: Pick<ResumeContent, 'personal'>): string {
  return [content.personal.firstName, content.personal.lastName].filter(Boolean).join(' ').trim();
}
