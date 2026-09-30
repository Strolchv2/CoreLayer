import { buildExportFileName, toFileNamePart } from '@cv-studio/shared';
import archiver from 'archiver';
import type { Response } from 'express';
import { db } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { getCoverLetter } from './coverLetters.js';
import { toDocumentDTO } from './documents.js';
import { getProfile } from './profiles.js';
import { getResume } from './resumes.js';
import { deleteStoredFile, readStoredFile } from './storage.js';

/**
 * DSGVO Art. 15/20: Export aller gespeicherten Daten eines Benutzers als ZIP
 * (maschinenlesbares JSON + hochgeladene Originaldateien).
 */
export async function streamUserDataExport(userId: string, res: Response): Promise<void> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'display_name', 'role', 'locale', 'theme', 'default_date_format', 'created_at', 'last_login_at'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  const [resumeRows, profileRows, letterRows, documentRows, exportCount] = await Promise.all([
    db.selectFrom('resumes').select('id').where('user_id', '=', userId).execute(),
    db.selectFrom('profiles').select('id').where('user_id', '=', userId).execute(),
    db.selectFrom('cover_letters').select('id').where('user_id', '=', userId).execute(),
    db.selectFrom('documents').selectAll().where('user_id', '=', userId).execute(),
    db.selectFrom('export_events').select((eb) => eb.fn.countAll<string>().as('c')).where('user_id', '=', userId).executeTakeFirst(),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="CV_Studio_Datenexport_${date}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    logger.error({ errMessage: err.message }, 'Datenexport fehlgeschlagen');
    res.destroy(err);
  });
  archive.pipe(res);

  const json = (value: unknown) => JSON.stringify(value, null, 2);
  archive.append(
    'CV Studio – Export deiner Daten\n\n' +
      'account.json        Kontodaten (ohne Passwort)\n' +
      'resumes/            Lebensläufe inkl. Inhalt und Design (JSON, wieder importierbar)\n' +
      'profiles/           Profile\n' +
      'cover-letters/      Anschreiben\n' +
      'documents/          Hochgeladene Dateien\n',
    { name: 'README.txt' },
  );
  archive.append(json({ ...user, exportCount: Number(exportCount?.c ?? 0), exportedAt: new Date().toISOString() }), { name: 'account.json' });

  const used = new Set<string>();
  const unique = (base: string, ext: string) => {
    let name = `${base || 'Dokument'}.${ext}`;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}.${ext}`;
    used.add(name);
    return name;
  };

  for (const { id } of resumeRows) {
    const resume = await getResume(userId, id);
    archive.append(json({ format: 'cv-studio/resume@1', resume }), { name: `resumes/${unique(toFileNamePart(resume.title), 'json')}` });
  }
  for (const { id } of profileRows) {
    const profile = await getProfile(userId, id);
    archive.append(json({ format: 'cv-studio/profile@1', profile }), { name: `profiles/${unique(toFileNamePart(profile.name), 'json')}` });
  }
  for (const { id } of letterRows) {
    const letter = await getCoverLetter(userId, id);
    archive.append(json({ format: 'cv-studio/cover-letter@1', coverLetter: letter }), {
      name: `cover-letters/${unique(toFileNamePart(letter.title), 'json')}`,
    });
  }
  archive.append(json(documentRows.map(toDocumentDTO)), { name: 'documents/documents.json' });
  for (const doc of documentRows) {
    try {
      const data = await readStoredFile(doc.storage_key);
      const ext = doc.mime_type === 'application/pdf' ? 'pdf' : doc.mime_type === 'image/png' ? 'png' : 'jpg';
      archive.append(data, { name: `documents/${unique(buildExportFileName([doc.title], ext).replace(/\.[a-z]+$/, ''), ext)}` });
    } catch {
      logger.warn('Dokument für Datenexport nicht lesbar');
    }
  }
  await archive.finalize();
}

/** Löscht das Konto samt aller Daten (DB-Kaskade) und aller Dateien. */
export async function deleteUserAccount(userId: string): Promise<void> {
  const docs = await db.selectFrom('documents').select('storage_key').where('user_id', '=', userId).execute();
  await db.deleteFrom('users').where('id', '=', userId).execute();
  for (const d of docs) {
    try {
      await deleteStoredFile(d.storage_key);
    } catch {
      logger.warn('Datei konnte bei Kontolöschung nicht entfernt werden');
    }
  }
}
