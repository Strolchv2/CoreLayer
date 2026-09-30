import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../src/import/parser.js';

const SAMPLE = `Lebenslauf
Erika Beispiel
Projektmanagerin
Beispielweg 5, 54321 Beispielstadt
Tel.: +49 170 0000000 | erika.beispiel@example.com
www.erika.example

Profil
Erfahrene Projektmanagerin mit Schwerpunkt auf agilen Methoden und Kommunikation im Team. Seit über 8 Jahren verantwortlich für Projekte im Anlagenbau.

Berufserfahrung
01/2020 – heute
Senior Projektmanagerin
Beispiel AG, Hamburg
- Leitung von Projekten mit bis zu 2 Mio. € Budget
- Einführung von Scrum

03/2015 - 12/2019
Projektassistentin
Muster GmbH, Bremen

Ausbildung
10/2010 – 09/2014
Bachelor of Science Wirtschaftsingenieurwesen
Hochschule Musterstadt, Musterstadt

Kenntnisse
Software: MS Project, Jira, Confluence
Methoden: Scrum, Kanban

Sprachen
Deutsch – Muttersprache
Englisch (C1)

Hobbys
Segeln, Lesen, Kochen
`;

describe('parseResumeText', () => {
  const result = parseResumeText(SAMPLE);
  const c = result.content;

  it('detects personal data', () => {
    expect(c.personal.firstName).toBe('Erika');
    expect(c.personal.lastName).toBe('Beispiel');
    expect(c.personal.jobTitle).toBe('Projektmanagerin');
    expect(c.personal.email).toBe('erika.beispiel@example.com');
    expect(c.personal.phone).toContain('+49 170');
    expect(c.personal.postalCode).toBe('54321');
    expect(c.personal.city).toBe('Beispielstadt');
  });

  it('detects experience entries with dates and bullets', () => {
    expect(c.experience).toHaveLength(2);
    expect(c.experience[0]).toMatchObject({
      jobTitle: 'Senior Projektmanagerin',
      employer: 'Beispiel AG',
      location: 'Hamburg',
      startDate: '2020-01',
      current: true,
    });
    expect(c.experience[0]!.tasks).toHaveLength(2);
    expect(c.experience[1]).toMatchObject({ startDate: '2015-03', endDate: '2019-12', current: false });
  });

  it('detects education, skills, languages and interests', () => {
    expect(c.education[0]?.degree).toContain('Bachelor');
    expect(c.skills.map((g) => g.name)).toEqual(['Software', 'Methoden']);
    expect(c.skills[0]!.items.map((s) => s.name)).toEqual(['MS Project', 'Jira', 'Confluence']);
    expect(c.languages.map((l) => [l.name, l.level])).toEqual([
      ['Deutsch', 'native'],
      ['Englisch', 'C1'],
    ]);
    expect(c.interests.map((i) => i.name)).toEqual(['Segeln', 'Lesen', 'Kochen']);
    expect(result.detectedSections).toEqual(
      expect.arrayContaining(['profile', 'experience', 'education', 'skills', 'languages', 'interests']),
    );
  });
});
