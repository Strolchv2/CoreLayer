import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { makeJpeg, makePdf, registerUser, type TestClient } from './helpers.js';

const bundleAvailable = fs.existsSync(path.join(config.renderBundleDir, 'render.html'));

/** Binäre Antworten als Buffer einlesen */
/** supertest-Parser für Binärantworten (zur Laufzeit ist `res` der Node-Antwortstream) */
function binary(res: unknown, cb: (err: Error | null, body: Buffer) => void) {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
}

async function pdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

async function demoResume(client: TestClient, templateKey = 'modern') {
  const res = await client.post('/api/resumes', { title: 'Export-Test', templateKey, source: { type: 'demo' } });
  expect(res.status).toBe(201);
  return res.body.resume as { id: string; version: number };
}

describe.skipIf(!bundleAvailable)('PDF-Export (Chromium)', () => {
  it('exportiert einen Lebenslauf als A4-PDF mit Text, Links und Dateinamen', async () => {
    const { client } = await registerUser('pdf');
    const resume = await demoResume(client);
    const res = await client.post(`/api/resumes/${resume.id}/export/pdf`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('Max_Mustermann_Lebenslauf.pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(body);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toContain('Max Mustermann');
    const text = await pdfText(body);
    expect(text).toContain('Max');
    expect(text).toContain('Montage Werk GmbH');
    // Export wird gezählt
    const dash = await client.get('/api/dashboard');
    expect(dash.body.exportCount).toBe(1);
  });

  it('liefert die exakte Druckvorschau inline und verweigert fremde Exporte', async () => {
    const a = await registerUser('pdf');
    const b = await registerUser('pdf');
    const resume = await demoResume(a.client, 'classic');
    const preview = await a.client.get(`/api/resumes/${resume.id}/preview`).buffer(true).parse(binary);
    expect(preview.status).toBe(200);
    expect(preview.headers['content-disposition']).toMatch(/^inline/);
    expect((await b.client.post(`/api/resumes/${resume.id}/export/pdf`)).status).toBe(404);
  });

  it('erstellt Anschreiben-PDF und Bewerbungspaket (zusammengeführt und ZIP)', async () => {
    const { client } = await registerUser('pkg');
    const resume = await demoResume(client);
    const letter = (await client.post('/api/cover-letters', { title: 'Anschreiben', resumeId: resume.id, demo: true })).body.coverLetter;
    const letterPdf = await client.post(`/api/cover-letters/${letter.id}/export/pdf`).buffer(true).parse(binary);
    expect(letterPdf.status).toBe(200);
    expect(await pdfText(letterPdf.body as Buffer)).toContain('Bewerbung als Projektleiter');

    const zeugnis = (await client.upload('/api/documents', 'file', await makePdf(2, 'Arbeitszeugnis'), 'zeugnis.pdf', 'application/pdf', { category: 'employment_reference' })).body.document;
    const zert = (await client.upload('/api/documents', 'file', await makeJpeg(400), 'zertifikat.jpg', 'image/jpeg', { category: 'certificate' })).body.document;

    const cvPages = (await PDFDocument.load((await client.post(`/api/resumes/${resume.id}/export/pdf`).buffer(true).parse(binary)).body as Buffer)).getPageCount();
    const letterPages = (await PDFDocument.load(letterPdf.body as Buffer)).getPageCount();

    const merged = await client
      .post(`/api/resumes/${resume.id}/export/package`, { includeResume: true, coverLetterId: letter.id, documentIds: [zeugnis.id, zert.id], mode: 'merged' })
      .buffer(true)
      .parse(binary);
    expect(merged.status).toBe(200);
    expect(merged.headers['content-disposition']).toContain('Bewerbung_Max_Mustermann.pdf');
    expect((await PDFDocument.load(merged.body as Buffer)).getPageCount()).toBe(cvPages + letterPages + 2 + 1);

    const zip = await client
      .post(`/api/resumes/${resume.id}/export/package`, { includeResume: true, coverLetterId: letter.id, documentIds: [zeugnis.id, zert.id], mode: 'zip' })
      .buffer(true)
      .parse(binary);
    expect(zip.headers['content-type']).toBe('application/zip');
    const names = (zip.body as Buffer).toString('latin1');
    for (const n of ['01_Lebenslauf.pdf', '02_Anschreiben.pdf', '03_Zeugnisse.pdf', '04_Zertifikate.pdf']) expect(names).toContain(n);
    expect(names).not.toContain('05_Anlagen.pdf');
  });

  it('importiert ein exportiertes PDF wieder (Rundlauf) und erkennt Inhalte', async () => {
    const { client } = await registerUser('imp');
    const resume = await demoResume(client, 'ats');
    const pdf = (await client.post(`/api/resumes/${resume.id}/export/pdf`).buffer(true).parse(binary)).body as Buffer;
    const res = await client.upload('/api/import', 'file', pdf, 'Max_Mustermann_Lebenslauf.pdf', 'application/pdf');
    expect(res.status).toBe(200);
    expect(res.body.sourceType).toBe('pdf');
    expect(res.body.content.personal.lastName).toBe('Mustermann');
    expect(res.body.content.personal.email).toBe('max.mustermann@example.com');
    expect(res.body.detected.sections).toEqual(expect.arrayContaining(['experience', 'education']));
    expect(res.body.content.experience.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DOCX, JSON & Import', () => {
  it('exportiert DOCX mit allen wichtigen Inhalten', async () => {
    const { client } = await registerUser('docx');
    const resume = await demoResume(client);
    const res = await client.post(`/api/resumes/${resume.id}/export/docx`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('Max_Mustermann_Lebenslauf.docx');
    const text = (await mammoth.extractRawText({ buffer: res.body as Buffer })).value;
    expect(text).toContain('Max Mustermann');
    expect(text).toContain('BERUFSERFAHRUNG');
    expect(text).toContain('Planung elektrischer Anlagen nach DIN VDE');
  });

  it('sichert als JSON und stellt die Sicherung per Import wieder her', async () => {
    const { client } = await registerUser('json');
    const resume = await demoResume(client, 'technical');
    const json = await client.get(`/api/resumes/${resume.id}/export/json`).buffer(true).parse(binary);
    expect(json.status).toBe(200);
    const imported = await client.upload('/api/import', 'file', json.body as Buffer, 'sicherung.json', 'application/json');
    expect(imported.status).toBe(200);
    expect(imported.body.sourceType).toBe('json');
    expect(imported.body.meta.templateKey).toBe('technical');
    const original = (await client.get(`/api/resumes/${resume.id}`)).body.resume;
    expect(imported.body.content).toEqual(original.content);
  });

  it('importiert TXT und lehnt ungültige Dateien ab', async () => {
    const { client } = await registerUser('txt');
    const txt = Buffer.from('Erika Beispiel\nProjektmanagerin\nerika@example.com\n\nBerufserfahrung\n01/2020 - heute\nProjektmanagerin\nBeispiel AG, Hamburg\n- Leitung von Projekten\n\nSprachen\nDeutsch - Muttersprache\n');
    const res = await client.upload('/api/import', 'file', txt, 'lebenslauf.txt', 'text/plain');
    expect(res.status).toBe(200);
    expect(res.body.content.experience[0].employer).toBe('Beispiel AG');
    expect((await client.upload('/api/import', 'file', Buffer.from('x'), 'virus.exe', 'application/octet-stream')).status).toBe(415);
    expect((await client.upload('/api/import', 'file', Buffer.from('{"format":"falsch"}'), 'x.json', 'application/json')).body.error.code).toBe('import_invalid_backup');
  });
});

describe('Datenschutz: Datenexport & Kontolöschung', () => {
  it('exportiert alle Daten als ZIP und löscht das Konto vollständig', async () => {
    const { client, password, email } = await registerUser('gdpr');
    await demoResume(client);
    await client.upload('/api/documents', 'file', await makePdf(1), 'zeugnis.pdf', 'application/pdf', { category: 'school_report' });
    const zip = await client.get('/api/account/export').buffer(true).parse(binary);
    expect(zip.status).toBe(200);
    const raw = (zip.body as Buffer).toString('latin1');
    expect(raw).toContain('account.json');
    expect(raw).toContain('resumes/');
    expect(raw).toContain('documents/');

    expect((await client.delete('/api/account', { password: 'falsch-falsch-1' })).status).toBe(400);
    expect((await client.delete('/api/account', { password })).status).toBe(200);
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
    const again = await client.post('/api/auth/login', { email, password });
    expect(again.status).toBe(401);
  });
});
