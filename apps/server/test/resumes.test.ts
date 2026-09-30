import { createDemoContent, createItem, TEMPLATES, type ResumeDTO } from '@cv-studio/shared';
import { describe, expect, it } from 'vitest';
import { makePng, registerUser, type TestClient } from './helpers.js';

function saveBody(resume: ResumeDTO, patch: Partial<ResumeDTO> = {}) {
  const r = { ...resume, ...patch };
  return {
    title: r.title,
    language: r.language,
    templateKey: r.templateKey,
    design: r.design,
    dateFormat: r.dateFormat,
    content: r.content,
    attachmentIds: r.attachmentIds,
    version: r.version,
  };
}

async function create(client: TestClient, body: object = {}): Promise<ResumeDTO> {
  const res = await client.post('/api/resumes', { title: 'Bewerbung Projektleiter', templateKey: 'modern', ...body });
  expect(res.status).toBe(201);
  return res.body.resume;
}

describe('Lebensläufe', () => {
  it('erstellt leer, mit Demo-Daten und listet sie', async () => {
    const { client } = await registerUser('cv');
    const empty = await create(client);
    expect(empty.content.personal.firstName).toBe('');
    expect(empty.content.sections).toHaveLength(12);
    expect(empty.design).toEqual(TEMPLATES.modern.defaultDesign);
    const demo = await create(client, { source: { type: 'demo' }, title: 'Demo' });
    expect(demo.content.experience.length).toBeGreaterThan(0);
    const list = await client.get('/api/resumes');
    expect(list.body.resumes.map((r: { title: string }) => r.title)).toEqual(['Demo', 'Bewerbung Projektleiter']);
    expect(list.body.resumes[0].fullName).toBe('Max Mustermann');
  });

  it('speichert den vollständigen Inhalt relational und liest ihn identisch zurück', async () => {
    const { client } = await registerUser('cv');
    const resume = await create(client);
    const content = createDemoContent('de');
    content.personal.links.push({ id: crypto.randomUUID(), label: 'Portfolio', url: 'https://example.com', visible: false });
    const save = await client.put(`/api/resumes/${resume.id}`, saveBody(resume, { content, templateKey: 'classic', dateFormat: 'MM.YYYY' }));
    expect(save.status).toBe(200);
    expect(save.body.version).toBe(2);
    const loaded: ResumeDTO = (await client.get(`/api/resumes/${resume.id}`)).body.resume;
    expect(loaded.content).toEqual(content);
    expect(loaded.templateKey).toBe('classic');
    expect(loaded.dateFormat).toBe('MM.YYYY');
    expect(loaded.version).toBe(2);
  });

  it('erkennt parallele Änderungen (optimistische Sperre)', async () => {
    const { client } = await registerUser('cv');
    const resume = await create(client);
    await client.put(`/api/resumes/${resume.id}`, saveBody(resume)).expect(200);
    const stale = await client.put(`/api/resumes/${resume.id}`, saveBody(resume));
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('version_conflict');
  });

  it('validiert Datumsangaben und Längen', async () => {
    const { client } = await registerUser('cv');
    const resume = await create(client);
    const content = createDemoContent('de');
    content.experience[0]!.startDate = '2022-13';
    const res = await client.put(`/api/resumes/${resume.id}`, saveBody(resume, { content }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('dupliziert, benennt um, archiviert und löscht', async () => {
    const { client } = await registerUser('cv');
    const resume = await create(client, { source: { type: 'demo' } });
    const copy = (await client.post(`/api/resumes/${resume.id}/duplicate`)).body.resume as ResumeDTO;
    expect(copy.title).toBe('Bewerbung Projektleiter (Kopie)');
    expect(copy.content.experience[0]!.employer).toBe(resume.content.experience[0]!.employer);
    expect(copy.content.experience[0]!.id).not.toBe(resume.content.experience[0]!.id);

    const renamed = await client.patch(`/api/resumes/${copy.id}`, { title: 'International CV' });
    expect(renamed.body.resume.title).toBe('International CV');
    await client.patch(`/api/resumes/${copy.id}`, { archived: true }).expect(200);
    expect((await client.get('/api/resumes')).body.resumes).toHaveLength(1);
    expect((await client.get('/api/resumes?filter=archived')).body.resumes).toHaveLength(1);

    await client.delete(`/api/resumes/${copy.id}`).expect(200);
    expect((await client.get(`/api/resumes/${copy.id}`)).status).toBe(404);
    expect((await client.get('/api/resumes?filter=all')).body.resumes).toHaveLength(1);
  });

  it('trennt Benutzer strikt (IDOR-Schutz)', async () => {
    const a = await registerUser('alice');
    const b = await registerUser('bob');
    const resume = await create(a.client, { source: { type: 'demo' } });
    expect((await b.client.get(`/api/resumes/${resume.id}`)).status).toBe(404);
    expect((await b.client.put(`/api/resumes/${resume.id}`, saveBody(resume))).status).toBe(404);
    expect((await b.client.patch(`/api/resumes/${resume.id}`, { title: 'hacked' })).status).toBe(404);
    expect((await b.client.post(`/api/resumes/${resume.id}/duplicate`)).status).toBe(404);
    expect((await b.client.delete(`/api/resumes/${resume.id}`)).status).toBe(404);
    expect((await b.client.get('/api/resumes')).body.resumes).toHaveLength(0);
    expect((await b.client.get('/api/resumes/not-a-uuid')).status).toBe(404);
    // Unverändert beim Eigentümer
    expect((await a.client.get(`/api/resumes/${resume.id}`)).body.resume.title).toBe('Bewerbung Projektleiter');
  });

  it('ignoriert fremde Dokument-IDs als Foto oder Anhang', async () => {
    const a = await registerUser('alice');
    const b = await registerUser('bob');
    const png = await makePng();
    const doc = (await a.client.upload('/api/documents', 'file', png, 'foto.png', 'image/png', { category: 'photo' })).body.document;
    const resume = await create(b.client);
    const content = { ...resume.content, personal: { ...resume.content.personal, photoId: doc.id } };
    await b.client.put(`/api/resumes/${resume.id}`, { ...saveBody(resume, { content }), attachmentIds: [doc.id] }).expect(200);
    const loaded = (await b.client.get(`/api/resumes/${resume.id}`)).body.resume;
    expect(loaded.content.personal.photoId).toBeNull();
    expect(loaded.attachmentIds).toEqual([]);
  });

  it('liefert Dashboard-Kennzahlen', async () => {
    const { client } = await registerUser('dash');
    await create(client, { source: { type: 'demo' } });
    const dash = await client.get('/api/dashboard');
    expect(dash.body).toMatchObject({ resumeCount: 1, draftCount: 1, exportCount: 0 });
    expect(dash.body.lastEdited.fullName).toBe('Max Mustermann');
  });

  it('prüft Qualität und ATS serverseitig', async () => {
    const { client } = await registerUser('check');
    const resume = await create(client, { source: { type: 'demo' } });
    const res = await client.post(`/api/resumes/${resume.id}/check`, { jobDescription: 'Projektleiter Elektrotechnik mit KNX und Photovoltaik Erfahrung gesucht, SAP von Vorteil.' });
    expect(res.body.quality.counts.ok).toBeGreaterThan(3);
    expect(res.body.ats.rating).toBeDefined();
    expect(res.body.ats.keywords.found.length).toBeGreaterThan(0);
  });
});

describe('Profile', () => {
  it('verwaltet Profile und erzeugt Lebensläufe daraus', async () => {
    const { client } = await registerUser('profile');
    const profile = (await client.post('/api/profiles', { name: 'Elektrotechnik' })).body.profile;
    const content = createDemoContent('de');
    content.experience.push({ ...createItem('experience'), employer: 'Zusatz GmbH' });
    await client.put(`/api/profiles/${profile.id}`, { name: 'Elektrotechnik', description: 'Master', content, version: profile.version }).expect(200);
    const resume = await create(client, { source: { type: 'profile', profileId: profile.id } });
    expect(resume.profileId).toBe(profile.id);
    expect(resume.content.experience.map((e) => e.employer)).toContain('Zusatz GmbH');
    const list = (await client.get('/api/profiles')).body.profiles;
    expect(list[0]).toMatchObject({ name: 'Elektrotechnik', resumeCount: 1, fullName: 'Max Mustermann' });
    const other = await registerUser('profile2');
    expect((await other.client.post('/api/resumes', { title: 'x', source: { type: 'profile', profileId: profile.id } })).status).toBe(404);
    await client.delete(`/api/profiles/${profile.id}`).expect(200);
    // Lebenslauf bleibt erhalten, Verknüpfung wird gelöst
    expect((await client.get(`/api/resumes/${resume.id}`)).body.resume.profileId).toBeNull();
  });
});
