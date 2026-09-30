import { describe, expect, it } from 'vitest';
import { createDemoContent } from '../src/demo.js';
import { createEmptyContent, createItem } from '../src/factory.js';
import { runQualityCheck } from '../src/checks/quality.js';
import { runAtsCheck } from '../src/checks/ats.js';
import { analyzeKeywords, extractKeywords } from '../src/checks/keywords.js';
import { TEMPLATES } from '../src/templates.js';

describe('quality check', () => {
  it('confirms a complete demo CV', () => {
    const report = runQualityCheck(createDemoContent('de'), 'de');
    const ids = report.items.filter((i) => i.status === 'ok').map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'profile', 'experience', 'education', 'skills']));
    expect(report.items.find((i) => i.id === 'large-text')).toBeUndefined();
  });

  it('warns about missing contact data and empty descriptions', () => {
    const c = createEmptyContent();
    const exp = createItem('experience');
    exp.jobTitle = 'Monteur';
    exp.employer = 'Firma';
    exp.startDate = '2020-01';
    c.experience.push(exp);
    const report = runQualityCheck(c, 'de');
    const warn = (id: string) => report.items.find((i) => i.id === id)?.status;
    expect(warn('phone')).toBe('warning');
    expect(warn('email')).toBe('warning');
    expect(warn(`exp-desc-${exp.id}`)).toBe('warning');
    expect(report.counts.warning).toBeGreaterThan(3);
  });

  it('detects inconsistent date precision and large text blocks', () => {
    const c = createDemoContent('de');
    c.experience[0]!.startDate = '2022';
    c.profile.summary = 'Wort '.repeat(200);
    const report = runQualityCheck(c, 'de');
    expect(report.items.find((i) => i.id === 'date-consistency')?.status).toBe('warning');
    expect(report.items.find((i) => i.id === 'large-text')?.status).toBe('warning');
  });

  it('flags invalid email and phone formats', () => {
    const c = createDemoContent('de');
    c.personal.email = 'max@';
    c.personal.phone = 'abc123';
    const report = runQualityCheck(c, 'en');
    expect(report.items.find((i) => i.id === 'email')?.title).toMatch(/invalid/);
    expect(report.items.find((i) => i.id === 'phone')?.status).toBe('warning');
  });
});

describe('ATS check', () => {
  it('rates the ATS template with text skills as good', () => {
    const c = createDemoContent('de');
    c.sections = c.sections.map((s) => (s.key === 'skills' ? { ...s, options: { display: 'text' } } : s));
    const report = runAtsCheck({
      content: c,
      templateKey: 'ats',
      design: TEMPLATES.ats.defaultDesign,
      language: 'de',
      dateFormat: 'MM/YYYY',
    });
    expect(report.rating).toBe('good');
    expect(report.items.find((i) => i.id === 'layout')?.status).toBe('ok');
  });

  it('warns about two-column layouts and graphical skill levels', () => {
    const report = runAtsCheck({
      content: createDemoContent('de'),
      templateKey: 'modern',
      design: TEMPLATES.modern.defaultDesign,
      language: 'de',
      dateFormat: 'MM/YYYY',
    });
    expect(report.items.find((i) => i.id === 'layout')?.status).toBe('warning');
    expect(report.items.find((i) => i.id === 'skill-graphics')?.status).toBe('warning');
    expect(report.rating).not.toBe('good');
  });

  it('compares keywords from a job description', () => {
    const report = runAtsCheck({
      content: createDemoContent('de'),
      templateKey: 'ats',
      design: TEMPLATES.ats.defaultDesign,
      language: 'de',
      dateFormat: 'MM/YYYY',
      jobDescription:
        'Wir suchen einen Projektleiter Elektrotechnik (m/w/d) mit Erfahrung in KNX, Photovoltaik und SAP. Projektleitung und Mitarbeiterführung sind Voraussetzung. SAP Kenntnisse wünschenswert.',
    });
    expect(report.keywords?.found).toEqual(expect.arrayContaining(['knx', 'photovoltaik']));
    expect(report.keywords?.missing).toContain('sap');
  });
});

describe('keywords', () => {
  it('ignores stopwords', () => {
    const k = extractKeywords('Wir bieten Ihnen eine spannende Aufgabe und suchen Java Java Entwickler');
    expect(k[0]).toBe('java');
    expect(k).not.toContain('und');
  });
  it('matches word stems', () => {
    const a = analyzeKeywords('Projektleitung Projektleitung', 'Erfahrener Projektleiter');
    expect(a.found).toContain('projektleitung');
  });
});
