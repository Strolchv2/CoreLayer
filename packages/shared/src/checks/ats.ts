import type { DateFormat, Locale } from '../constants.js';
import { getCvLabels } from '../labels.js';
import type { DesignSettings } from '../schemas/design.js';
import type { ResumeContent } from '../schemas/resume.js';
import { getTemplateMeta } from '../templates.js';
import { resumeToPlainText, sectionHasContent } from '../text.js';
import { analyzeKeywords, type KeywordAnalysis } from './keywords.js';
import { runQualityCheck } from './quality.js';
import { buildReport, type CheckItem, type CheckReport } from './types.js';

export type AtsRating = 'good' | 'fair' | 'needs_work';

export interface AtsReport extends CheckReport {
  /** Qualitative Einstufung auf Basis der gefundenen Warnungen – bewusst keine Prozentzahl. */
  rating: AtsRating;
  keywords: KeywordAnalysis | null;
}

export interface AtsInput {
  content: ResumeContent;
  templateKey: string;
  design: DesignSettings;
  language: Locale;
  dateFormat: DateFormat;
  jobDescription?: string;
}

/** Standardüberschriften, die Bewerbermanagementsysteme zuverlässig erkennen. */
const STANDARD_HEADINGS = [
  'profil', 'kurzprofil', 'über mich', 'berufserfahrung', 'berufliche erfahrung', 'berufspraxis', 'werdegang',
  'ausbildung', 'bildung', 'schulbildung', 'studium', 'weiterbildung', 'weiterbildungen', 'fortbildungen',
  'kenntnisse', 'fähigkeiten', 'fachkenntnisse', 'it-kenntnisse', 'sprachen', 'sprachkenntnisse', 'zertifikate',
  'qualifikationen', 'projekte', 'praktika', 'ehrenamt', 'interessen', 'hobbys', 'referenzen',
  'profile', 'summary', 'about me', 'experience', 'work experience', 'professional experience', 'employment',
  'education', 'training', 'further training', 'skills', 'languages', 'certifications', 'certificates',
  'projects', 'internships', 'volunteering', 'volunteer work', 'interests', 'hobbies', 'references',
];

/**
 * ATS-Kompatibilitätsprüfung. Alle Hinweise sind regelbasiert und technisch begründet:
 * Layout, Textausgabe, Überschriften, grafische Elemente, Struktur und Schlüsselbegriffe.
 */
export function runAtsCheck(input: AtsInput, uiLocale: Locale = 'de'): AtsReport {
  const t = (de: string, en: string) => (uiLocale === 'en' ? en : de);
  const { content, design } = input;
  const template = getTemplateMeta(input.templateKey);
  const labels = getCvLabels(input.language);
  const items: CheckItem[] = [];

  // 1. Echter Text: Der PDF-Export erzeugt immer durchsuchbaren Text (kein Rasterbild).
  items.push({
    id: 'real-text',
    status: 'ok',
    title: t('Alle Inhalte werden als echter, durchsuchbarer Text exportiert', 'All content is exported as real, searchable text'),
  });

  // 2. Wichtige Informationen nicht nur als Bild
  const hasNameText = Boolean(content.personal.firstName.trim() || content.personal.lastName.trim());
  items.push(
    hasNameText
      ? { id: 'no-image-only', status: 'ok', title: t('Name und Kontaktdaten stehen als Text, nicht nur im Bild', 'Name and contact details are text, not only images') }
      : {
          id: 'no-image-only',
          status: 'warning',
          title: t('Name fehlt im Text', 'Name missing in text'),
          suggestion: t('Ohne Namen als Text kann ein ATS den Lebenslauf nicht zuordnen.', 'Without your name as text, an ATS cannot assign the CV.'),
          section: 'personal',
        },
  );

  // 3. Layout
  if (template.layout === 'single') {
    items.push({ id: 'layout', status: 'ok', title: t('Einspaltiges Layout – klare Lesereihenfolge', 'Single-column layout – clear reading order'), section: 'design' });
  } else {
    items.push({
      id: 'layout',
      status: 'warning',
      title: t('Zweispaltiges Layout', 'Two-column layout'),
      suggestion: t(
        'Manche Bewerbermanagementsysteme lesen Spalten in falscher Reihenfolge. Für Online-Portale die Vorlage „ATS“ oder „Classic“ verwenden.',
        'Some applicant tracking systems read columns in the wrong order. Use the "ATS" or "Classic" template for online portals.',
      ),
      section: 'design',
    });
  }

  // 4. Keine Tabellen
  items.push({
    id: 'tables',
    status: 'ok',
    title: t('Keine problematischen Tabellenstrukturen', 'No problematic table structures'),
  });

  // 5. Überschriften
  const customHeadings = content.sections.filter(
    (s) => s.visible && s.title.trim() && !STANDARD_HEADINGS.includes(s.title.trim().toLowerCase()) && sectionHasContent(content, s),
  );
  if (customHeadings.length === 0) {
    items.push({ id: 'headings', status: 'ok', title: t('Sinnvolle Standardüberschriften', 'Meaningful standard headings') });
  } else {
    items.push({
      id: 'headings',
      status: 'warning',
      title: t('Eigene Abschnittsüberschriften', 'Custom section headings'),
      suggestion: t(
        `„${customHeadings.map((s) => s.title).join('“, „')}“ – ATS erkennen Standardbegriffe wie „${labels.sections.experience}“ zuverlässiger.`,
        `"${customHeadings.map((s) => s.title).join('", "')}" – ATS recognise standard terms like "${labels.sections.experience}" more reliably.`,
      ),
      section: customHeadings[0]!.key,
    });
  }

  // 6. Struktur: Kernabschnitte
  const has = (key: 'experience' | 'education' | 'skills') => {
    const s = content.sections.find((x) => x.key === key);
    return Boolean(s && s.visible && sectionHasContent(content, s));
  };
  const missingCore = (['experience', 'education', 'skills'] as const).filter((k) => !has(k));
  if (missingCore.length === 0) {
    items.push({ id: 'structure', status: 'ok', title: t('Klare Struktur mit Erfahrung, Ausbildung und Kenntnissen', 'Clear structure with experience, education and skills') });
  } else {
    items.push({
      id: 'structure',
      status: 'warning',
      title: t('Kernabschnitte fehlen', 'Core sections missing'),
      suggestion: t(
        `Ergänze: ${missingCore.map((k) => labels.sections[k]).join(', ')}.`,
        `Add: ${missingCore.map((k) => labels.sections[k]).join(', ')}.`,
      ),
      section: missingCore[0],
    });
  }

  // 7. Grafische Kenntnisdarstellung
  const skillSection = content.sections.find((s) => s.key === 'skills');
  const skillDisplay = skillSection?.options.display ?? 'tags';
  if (skillSection?.visible && (skillDisplay === 'bars' || skillDisplay === 'stars') && has('skills')) {
    items.push({
      id: 'skill-graphics',
      status: 'warning',
      title: t('Kenntnisstufen nur grafisch (Balken/Sterne)', 'Skill levels only shown graphically (bars/stars)'),
      suggestion: t('ATS können Balken und Sterne nicht auswerten. Stelle Kenntnisse als Text oder Tags dar.', 'ATS cannot interpret bars and stars. Show skills as text or tags.'),
      section: 'skills',
    });
  } else {
    items.push({ id: 'skill-graphics', status: 'ok', title: t('Kenntnisse als Text lesbar', 'Skills readable as text'), section: 'skills' });
  }

  // 8. Unnötige grafische Elemente
  const decorative: string[] = [];
  if (design.iconStyle !== 'none') decorative.push(t('Icons', 'icons'));
  if (design.background !== 'white') decorative.push(t('farbiger Hintergrund', 'coloured background'));
  if (decorative.length) {
    items.push({
      id: 'decoration',
      status: 'info',
      title: t(`Dekorative Elemente: ${decorative.join(', ')}`, `Decorative elements: ${decorative.join(', ')}`),
      suggestion: t('Sie stören ATS meist nicht, da alle Angaben zusätzlich als Text vorliegen. Für maximale Kompatibilität deaktivieren.', 'They usually do not disturb ATS since all data is also text. Disable them for maximum compatibility.'),
      section: 'design',
    });
  } else {
    items.push({ id: 'decoration', status: 'ok', title: t('Keine unnötigen grafischen Elemente', 'No unnecessary graphic elements'), section: 'design' });
  }

  // 9. Foto bei internationalen Bewerbungen
  const photoShown = design.showPhoto && Boolean(content.personal.photoId) && !content.personal.hidden.includes('photo');
  if (photoShown && input.language === 'en') {
    items.push({
      id: 'photo',
      status: 'info',
      title: t('Profilbild bei englischsprachigem Lebenslauf', 'Photo on an English CV'),
      suggestion: t('In UK/USA sind Fotos unüblich und werden von ATS ignoriert.', 'In the UK/US photos are uncommon and ignored by ATS.'),
      section: 'personal',
    });
  }

  // 10. Datumsformate (aus dem Qualitätscheck)
  const quality = runQualityCheck(content, uiLocale);
  const dates = quality.items.find((i) => i.id === 'date-consistency');
  if (dates) items.push({ ...dates, id: 'ats-dates' });

  // 11. Kontaktdaten
  const contactOk = ['email', 'phone'].every((id) => quality.items.find((i) => i.id === id)?.status === 'ok');
  items.push(
    contactOk
      ? { id: 'contact', status: 'ok', title: t('Kontaktdaten vollständig und maschinenlesbar', 'Contact details complete and machine-readable'), section: 'personal' }
      : {
          id: 'contact',
          status: 'warning',
          title: t('Kontaktdaten unvollständig', 'Contact details incomplete'),
          suggestion: t('E-Mail-Adresse und Telefonnummer sollten als Text vorhanden sein.', 'Email address and phone number should be present as text.'),
          section: 'personal',
        },
  );

  // 12. Schlüsselbegriffe aus Stellenanzeige
  let keywords: KeywordAnalysis | null = null;
  if (input.jobDescription && input.jobDescription.trim().length > 40) {
    const text = resumeToPlainText(content, labels, input.dateFormat);
    keywords = analyzeKeywords(input.jobDescription, text);
    const ratio = keywords.keywords.length ? keywords.found.length / keywords.keywords.length : 1;
    items.push({
      id: 'keywords',
      status: ratio >= 0.6 ? 'ok' : ratio >= 0.35 ? 'info' : 'warning',
      title: t(
        `${keywords.found.length} von ${keywords.keywords.length} Schlüsselbegriffen der Stellenanzeige gefunden`,
        `${keywords.found.length} of ${keywords.keywords.length} keywords from the job ad found`,
      ),
      suggestion: keywords.missing.length
        ? t(
            `Prüfe, ob diese Begriffe auf dich zutreffen und ergänze sie ehrlich: ${keywords.missing.slice(0, 10).join(', ')}`,
            `Check whether these terms apply to you and add them honestly: ${keywords.missing.slice(0, 10).join(', ')}`,
          )
        : undefined,
    });
  } else {
    items.push({
      id: 'keywords',
      status: 'info',
      title: t('Schlüsselbegriffe nicht geprüft', 'Keywords not checked'),
      suggestion: t('Füge eine Stellenanzeige ein, um relevante Schlüsselbegriffe abzugleichen.', 'Paste a job ad to compare relevant keywords.'),
    });
  }

  const report = buildReport(items);
  const warnings = report.counts.warning;
  const rating: AtsRating = warnings === 0 ? 'good' : warnings <= 2 ? 'fair' : 'needs_work';
  return { ...report, rating, keywords };
}
