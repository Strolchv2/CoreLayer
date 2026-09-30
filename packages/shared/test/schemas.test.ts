import { describe, expect, it } from 'vitest';
import { createDemoContent } from '../src/demo.js';
import { cloneContentWithNewIds, createEmptyContent, normalizeContent } from '../src/factory.js';
import { registerSchema } from '../src/schemas/auth.js';
import { resumeContentSchema } from '../src/schemas/resume.js';
import { BASE_DESIGN, normalizeDesign } from '../src/schemas/design.js';
import { buildExportFileName, sanitizeUploadName } from '../src/fileNames.js';
import { isSafeHttpUrl, safeHref } from '../src/urls.js';
import { SECTION_KEYS } from '../src/constants.js';

describe('schemas', () => {
  it('accepts demo content', () => {
    expect(resumeContentSchema.safeParse(createDemoContent('de')).success).toBe(true);
    expect(resumeContentSchema.safeParse(createDemoContent('en')).success).toBe(true);
  });

  it('rejects invalid dates and oversize data', () => {
    const c = createEmptyContent() as unknown as { experience: unknown[] };
    c.experience.push({ id: crypto.randomUUID(), startDate: '31.02.2020' });
    expect(resumeContentSchema.safeParse(c).success).toBe(false);
  });

  it('normalizes sections to contain every key once', () => {
    const c = normalizeContent({ sections: [{ key: 'skills' }, { key: 'skills' }] });
    expect(c.sections.map((s) => s.key).sort()).toEqual([...SECTION_KEYS].sort());
    expect(c.sections[0]!.key).toBe('skills');
  });

  it('clones content with new ids', () => {
    const c = createDemoContent('de');
    const clone = cloneContentWithNewIds(c);
    expect(clone.experience[0]!.id).not.toBe(c.experience[0]!.id);
    expect(clone.experience[0]!.employer).toBe(c.experience[0]!.employer);
  });

  it('validates registration input', () => {
    expect(registerSchema.safeParse({ email: 'A@Example.com', password: 'kurz', acceptTerms: true }).success).toBe(false);
    const ok = registerSchema.safeParse({ email: ' A@Example.com ', password: 'sicheres-Passwort1', acceptTerms: true });
    expect(ok.success && ok.data.email).toBe('a@example.com');
    expect(registerSchema.safeParse({ email: 'a@example.com', password: 'sicheres-Passwort1', acceptTerms: false }).success).toBe(false);
  });

  it('merges partial designs with defaults', () => {
    const d = normalizeDesign({ primaryColor: '#ff0000', fontSize: 99 }, BASE_DESIGN);
    expect(d.primaryColor).toBe('#ff0000');
    expect(d.fontSize).toBe(BASE_DESIGN.fontSize);
  });
});

describe('helpers', () => {
  it('builds export file names', () => {
    expect(buildExportFileName(['Max', 'Müller', 'Lebenslauf'], 'pdf')).toBe('Max_Mueller_Lebenslauf.pdf');
    expect(buildExportFileName(['', ''], 'pdf')).toBe('Dokument.pdf');
  });
  it('sanitizes upload names', () => {
    expect(sanitizeUploadName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeUploadName('Zeugnis <script>.pdf')).toBe('Zeugnis script.pdf');
  });
  it('allows only http(s) links', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('www.example.com')).toBe('https://www.example.com/');
    expect(isSafeHttpUrl('localhost')).toBe(false);
  });
});
