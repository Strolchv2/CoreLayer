import { describe, expect, it } from 'vitest';
import { makeJpeg, makePdf, makePng, registerUser } from './helpers.js';

describe('Dokumente & Uploads', () => {
  it('lädt PDF und Bilder hoch, listet, benennt um und löscht', async () => {
    const { client } = await registerUser('docs');
    const pdf = await client.upload('/api/documents', 'file', await makePdf(2), 'Arbeitszeugnis.pdf', 'application/pdf', {
      category: 'employment_reference',
      title: 'Arbeitszeugnis Montage Werk',
    });
    expect(pdf.status).toBe(201);
    expect(pdf.body.document).toMatchObject({ title: 'Arbeitszeugnis Montage Werk', pageCount: 2, mimeType: 'application/pdf' });

    const jpg = await client.upload('/api/documents', 'file', await makeJpeg(), 'fuehrerschein.jpeg', 'image/jpeg', { category: 'drivers_license' });
    expect(jpg.status).toBe(201);

    const photo = await client.upload('/api/documents', 'file', await makePng(), 'foto.png', 'image/png', { category: 'photo' });
    expect(photo.status).toBe(201);
    // Fotos werden neu kodiert (Metadaten entfernt) und als JPEG gespeichert
    expect(photo.body.document.mimeType).toBe('image/jpeg');

    const list = await client.get('/api/documents');
    expect(list.body.documents).toHaveLength(3);

    const file = await client.get(`/api/documents/${pdf.body.document.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toContain('sandbox');

    const renamed = await client.patch(`/api/documents/${jpg.body.document.id}`, { title: 'Führerschein Klasse B' });
    expect(renamed.body.document.title).toBe('Führerschein Klasse B');

    await client.delete(`/api/documents/${jpg.body.document.id}`).expect(200);
    expect((await client.get('/api/documents')).body.documents).toHaveLength(2);
  });

  it('blockiert gefährliche und gefälschte Dateien', async () => {
    const { client } = await registerUser('docs');
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect((await client.upload('/api/documents', 'file', html, 'zeugnis.pdf', 'application/pdf')).body.error.code).toBe('unsupported_file_type');
    expect((await client.upload('/api/documents', 'file', html, 'x.html', 'text/html')).status).toBe(415);
    const exe = Buffer.from('MZ\x90\x00\x03', 'latin1');
    expect((await client.upload('/api/documents', 'file', exe, 'setup.exe', 'application/octet-stream')).status).toBe(415);
    // PDF-Inhalt mit Bild-Endung
    expect((await client.upload('/api/documents', 'file', await makePdf(), 'bild.png', 'image/png')).body.error.code).toBe('file_extension_mismatch');
    // Falscher deklarierter MIME-Type
    expect((await client.upload('/api/documents', 'file', await makePng(), 'bild.png', 'application/pdf')).body.error.code).toBe('mime_type_mismatch');
    // Beschädigtes PDF
    const broken = Buffer.from('%PDF-1.7\nkaputt');
    expect((await client.upload('/api/documents', 'file', broken, 'kaputt.pdf', 'application/pdf')).body.error.code).toBe('pdf_invalid');
    // Foto muss ein Bild sein
    expect((await client.upload('/api/documents', 'file', await makePdf(), 'foto.pdf', 'application/pdf', { category: 'photo' })).body.error.code).toBe('image_required');
    // Zu groß
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(11 * 1024 * 1024)]);
    const tooBig = await client.upload('/api/documents', 'file', big, 'gross.pdf', 'application/pdf');
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('file_too_large');
  });

  it('bereinigt Dateinamen', async () => {
    const { client } = await registerUser('docs');
    const res = await client.upload('/api/documents', 'file', await makePdf(), '../../etc/<zeugnis>.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.document.originalName).toBe('zeugnis.pdf');
  });

  it('gibt fremde Dokumente nicht heraus', async () => {
    const a = await registerUser('alice');
    const b = await registerUser('bob');
    const doc = (await a.client.upload('/api/documents', 'file', await makePdf(), 'z.pdf', 'application/pdf')).body.document;
    expect((await b.client.get(`/api/documents/${doc.id}/file`)).status).toBe(404);
    expect((await b.client.get(`/api/documents/${doc.id}`)).status).toBe(404);
    expect((await b.client.patch(`/api/documents/${doc.id}`, { title: 'x' })).status).toBe(404);
    expect((await b.client.delete(`/api/documents/${doc.id}`)).status).toBe(404);
  });
});
