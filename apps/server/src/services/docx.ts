/**
 * DOCX-Export: strukturierter, gut editierbarer Word-Lebenslauf, der sich an Farben,
 * Schriftart, Reihenfolge und Inhalten der PDF-Darstellung orientiert.
 */
import {
  buildExportFileName,
  displayUrl,
  formatDateRange,
  formatPartialDate,
  fullName,
  getCvLabels,
  nonEmpty,
  safeHref,
  sectionHasContent,
  sectionTitle,
  splitParagraphs,
  type FontKey,
  type ResumeDTO,
  type SectionConfig,
} from '@cv-studio/shared';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from 'docx';
import { db } from '../db/index.js';
import { readStoredFile } from './storage.js';

const FONT_MAP: Record<FontKey, string> = {
  inter: 'Calibri',
  roboto: 'Calibri',
  lato: 'Calibri',
  'open-sans': 'Calibri',
  'source-sans': 'Calibri',
  'ibm-plex-sans': 'Calibri',
  arimo: 'Arial',
  merriweather: 'Cambria',
  'eb-garamond': 'Garamond',
  playfair: 'Georgia',
  'jetbrains-mono': 'Consolas',
};

const MM = 56.7; // Twips pro Millimeter
const A4 = { width: 11906, height: 16838 };

export async function exportResumeDocx(userId: string, resume: ResumeDTO): Promise<{ fileName: string; data: Buffer }> {
  const { content, design } = resume;
  const labels = getCvLabels(resume.language);
  const p = content.personal;
  const hidden = new Set(p.hidden);
  const color = design.primaryColor.replace('#', '');
  const muted = design.secondaryColor.replace('#', '');
  const bodyFont = FONT_MAP[design.fontFamily];
  const headingFont = FONT_MAP[design.headingFontFamily];
  const size = Math.round(design.fontSize * 2); // Halbpunkte
  const margin = Math.round(design.pageMargin * MM);
  const contentWidth = A4.width - 2 * margin;
  const fmt = resume.dateFormat;
  const range = (s: string, e: string, cur: boolean) => formatDateRange(s, e, cur, fmt, { present: labels.present });

  const children: Paragraph[] = [];

  // Kopf: Name, Berufsbezeichnung, Kontakt, optional Foto
  let photo: ImageRun | null = null;
  if (design.showPhoto && p.photoId && !hidden.has('photo')) {
    const doc = await db.selectFrom('documents').selectAll().where('id', '=', p.photoId).where('user_id', '=', userId).executeTakeFirst();
    if (doc && doc.mime_type.startsWith('image/')) {
      const px = Math.round(design.photoSize * 3.78);
      photo = new ImageRun({
        type: doc.mime_type === 'image/png' ? 'png' : 'jpg',
        data: await readStoredFile(doc.storage_key),
        transformation: { width: px, height: px },
      });
    }
  }
  if (photo) children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [photo], spacing: { after: 0 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: fullName(content), bold: true, size: Math.round(size * 2.2), color, font: headingFont })],
      spacing: { after: 60 },
    }),
  );
  if (p.jobTitle && !hidden.has('jobTitle')) {
    children.push(new Paragraph({ children: [new TextRun({ text: p.jobTitle, size: Math.round(size * 1.25), color: muted })], spacing: { after: 120 } }));
  }
  const contact: ParagraphChild[] = [];
  const addContact = (text: string, href?: string) => {
    if (!text) return;
    if (contact.length) contact.push(new TextRun({ text: '  |  ', color: muted }));
    contact.push(href ? new ExternalHyperlink({ link: href, children: [new TextRun({ text, style: 'Hyperlink' })] }) : new TextRun(text));
  };
  if (!hidden.has('address')) addContact([p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', '));
  if (!hidden.has('phone')) addContact(p.phone);
  if (!hidden.has('email')) addContact(p.email, p.email ? `mailto:${p.email}` : undefined);
  if (!hidden.has('website') && p.website) addContact(displayUrl(p.website), safeHref(p.website));
  if (!hidden.has('linkedin') && p.linkedin) addContact(displayUrl(p.linkedin), safeHref(p.linkedin));
  if (!hidden.has('github') && p.github) addContact(displayUrl(p.github), safeHref(p.github));
  for (const l of p.links) if (l.visible && l.url) addContact(l.label || displayUrl(l.url), safeHref(l.url));
  if (contact.length) children.push(new Paragraph({ children: contact, spacing: { after: 80 } }));
  const facts: string[] = [];
  if (!hidden.has('birthDate') && p.birthDate) facts.push(`${labels.birthDate}: ${formatPartialDate(p.birthDate, 'DD.MM.YYYY')}`);
  if (!hidden.has('birthPlace') && p.birthPlace) facts.push(`${labels.birthPlace}: ${p.birthPlace}`);
  if (!hidden.has('nationality') && p.nationality) facts.push(`${labels.nationality}: ${p.nationality}`);
  if (!hidden.has('maritalStatus') && p.maritalStatus) facts.push(`${labels.maritalStatus}: ${p.maritalStatus}`);
  if (facts.length) children.push(new Paragraph({ children: [new TextRun({ text: facts.join('  |  '), color: muted })], spacing: { after: 120 } }));

  const heading = (section: SectionConfig) =>
    new Paragraph({
      children: [new TextRun({ text: sectionTitle(section, labels).toUpperCase(), bold: true, color, font: headingFont, size: Math.round(size * design.headingScale) })],
      spacing: { before: Math.round(design.sectionSpacing * MM), after: 100 },
      border: design.lines !== 'none' ? { bottom: { style: BorderStyle.SINGLE, size: design.lines === 'thick' ? 12 : 4, color, space: 2 } } : undefined,
      keepNext: true,
    });

  /** Titelzeile mit rechtsbündigem Zeitraum */
  const titleLine = (title: string, date: string) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      children: [new TextRun({ text: title, bold: true }), ...(date ? [new TextRun({ children: [new Tab(), date], color: muted })] : [])],
      spacing: { before: Math.round(design.itemSpacing * MM), after: 20 },
      keepNext: true,
    });
  const subLine = (text: string) => (text ? new Paragraph({ children: [new TextRun({ text, color: muted, italics: true })], spacing: { after: 40 }, keepNext: true }) : null);
  const para = (text: string) => splitParagraphs(text).map((t) => new Paragraph({ text: t, spacing: { after: 60 } }));
  const bullets = (items: string[], label?: string) => {
    const list = nonEmpty(items);
    if (!list.length) return [];
    const out: Paragraph[] = [];
    if (label) out.push(new Paragraph({ children: [new TextRun({ text: `${label}:`, bold: true, color: muted })], spacing: { before: 40, after: 20 }, keepNext: true }));
    list.forEach((b) => out.push(new Paragraph({ text: b, bullet: { level: 0 }, spacing: { after: 20 } })));
    return out;
  };
  const push = (...ps: (Paragraph | null)[]) => ps.forEach((x) => x && children.push(x));

  for (const section of content.sections) {
    if (!section.visible || !sectionHasContent(content, section)) continue;
    push(heading(section));
    switch (section.key) {
      case 'profile': {
        const pr = content.profile;
        if (pr.headline) push(new Paragraph({ children: [new TextRun({ text: pr.headline, bold: true })], spacing: { after: 60 } }));
        children.push(...para(pr.summary));
        const kf = [pr.experience && `${labels.experienceYears}: ${pr.experience}`, pr.expertise && `${labels.expertise}: ${pr.expertise}`].filter(Boolean) as string[];
        if (kf.length) push(new Paragraph({ children: [new TextRun({ text: kf.join('  |  '), color: muted })], spacing: { after: 60 } }));
        children.push(...bullets(pr.strengths, labels.strengths));
        break;
      }
      case 'experience':
        for (const e of content.experience.filter((x) => x.visible)) {
          push(titleLine(e.jobTitle, range(e.startDate, e.endDate, e.current)), subLine([e.employer, e.location].filter(Boolean).join(', ')));
          children.push(...para(e.description), ...bullets(e.tasks, labels.tasks), ...bullets(e.achievements, labels.achievements), ...bullets(e.projects, labels.projects));
        }
        break;
      case 'education':
        for (const e of content.education.filter((x) => x.visible)) {
          push(
            titleLine([e.degree, e.fieldOfStudy].filter(Boolean).join(' – '), range(e.startDate, e.endDate, e.current)),
            subLine([e.institution, e.location].filter(Boolean).join(', ')),
          );
          if (e.grade) push(new Paragraph({ text: `${labels.grade}: ${e.grade}` }));
          children.push(...para(e.description));
        }
        break;
      case 'internships':
        for (const e of content.internships.filter((x) => x.visible)) {
          push(titleLine(e.jobTitle, range(e.startDate, e.endDate, false)), subLine([e.company, e.location].filter(Boolean).join(', ')));
          children.push(...para(e.description));
        }
        break;
      case 'trainings':
        for (const t of content.trainings.filter((x) => x.visible)) {
          push(titleLine(t.title, formatPartialDate(t.date, fmt)), subLine([labels.trainingKinds[t.kind], t.provider, t.duration, t.certificate].filter(Boolean).join(' · ')));
          children.push(...para(t.description));
        }
        break;
      case 'certificates':
        for (const c of content.certificates.filter((x) => x.visible)) {
          const valid = c.validUntil ? ` (${labels.validUntil} ${formatPartialDate(c.validUntil, fmt)})` : '';
          push(titleLine(c.name, formatPartialDate(c.date, fmt)), subLine([c.issuer, c.credentialId && `${labels.credentialId} ${c.credentialId}`].filter(Boolean).join(' · ') + valid));
          children.push(...para(c.description));
        }
        break;
      case 'skills':
        for (const g of content.skills.filter((x) => x.visible)) {
          const names = g.items.map((s) => s.name.trim()).filter(Boolean).join(', ');
          if (!names) continue;
          push(new Paragraph({ children: [...(g.name ? [new TextRun({ text: `${g.name}: `, bold: true })] : []), new TextRun(names)], spacing: { after: 60 } }));
        }
        break;
      case 'languages':
        for (const l of content.languages.filter((x) => x.visible)) {
          push(
            new Paragraph({
              children: [new TextRun({ text: l.name, bold: true }), new TextRun({ text: [l.level ? ` – ${labels.languageLevels[l.level]}` : '', l.note ? ` (${l.note})` : ''].join('') })],
              spacing: { after: 40 },
            }),
          );
        }
        break;
      case 'projects':
        for (const pj of content.projects.filter((x) => x.visible)) {
          push(titleLine(pj.name, range(pj.startDate, pj.endDate, pj.current)), subLine(pj.role));
          children.push(...para(pj.description));
          if (nonEmpty(pj.technologies).length) push(new Paragraph({ children: [new TextRun({ text: `${labels.technologies}: `, bold: true }), new TextRun(nonEmpty(pj.technologies).join(', '))] }));
          children.push(...bullets(pj.results, labels.results));
          const href = safeHref(pj.link);
          if (href) push(new Paragraph({ children: [new ExternalHyperlink({ link: href, children: [new TextRun({ text: displayUrl(pj.link), style: 'Hyperlink' })] })] }));
        }
        break;
      case 'volunteering':
        for (const v of content.volunteering.filter((x) => x.visible)) {
          push(titleLine(v.role || v.organization, range(v.startDate, v.endDate, v.current)), subLine([v.role ? v.organization : '', v.location].filter(Boolean).join(', ')));
          children.push(...para(v.description));
        }
        break;
      case 'interests':
        push(new Paragraph({ text: content.interests.filter((x) => x.visible && x.name).map((i) => (i.description ? `${i.name} (${i.description})` : i.name)).join(', ') }));
        break;
      case 'references':
        if (section.options.onRequest) push(new Paragraph({ text: labels.referencesOnRequest }));
        else
          for (const r of content.references.filter((x) => x.visible)) {
            push(new Paragraph({ children: [new TextRun({ text: r.name, bold: true })], spacing: { before: 60 } }));
            push(subLine([r.jobTitle, r.company].filter(Boolean).join(', ')));
            const line = [r.phone, r.email].filter(Boolean).join('  |  ');
            if (line) push(new Paragraph({ text: line }));
          }
        break;
    }
  }

  const doc = new Document({
    creator: 'CV Studio',
    title: `${fullName(content)} – ${labels.resumeWord}`,
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size, color: design.textColor.replace('#', '') },
          paragraph: { spacing: { line: Math.round(design.lineHeight * 240) } },
        },
      },
    },
    sections: [
      {
        properties: { page: { size: A4, margin: { top: margin, bottom: margin, left: margin, right: margin } } },
        children,
      },
    ],
  });
  const data = await Packer.toBuffer(doc);
  return {
    fileName: buildExportFileName([p.firstName, p.lastName, resume.language === 'en' ? 'CV' : 'Lebenslauf'], 'docx'),
    data: Buffer.from(data),
  };
}
