import { exportOptionsSchema, runAtsCheck, runQualityCheck, type Locale } from '@cv-studio/shared';
import archiver from 'archiver';
import { Router } from 'express';
import { z } from 'zod';
import { sendDownload } from '../lib/download.js';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { exportLimiter } from '../middleware/rateLimit.js';
import { buildApplicationPackage, exportResumePdf } from '../pdf/exports.js';
import { exportResumeDocx } from '../services/docx.js';
import { getResume, recordExport } from '../services/resumes.js';

/** Export-Endpunkte unter /api/resumes/:id/… (mergeParams für :id) */
export const resumeExportRouter = Router({ mergeParams: true });

function resumeId(params: Record<string, string | string[] | undefined>): string {
  return parseUuidParam(params.id);
}

/** Exakte Druckvorschau: dieselbe PDF wie beim Export, inline angezeigt. */
resumeExportRouter.get('/preview', exportLimiter, async (req, res) => {
  const file = await exportResumePdf(currentUser(req).id, resumeId(req.params));
  sendDownload(res, file, true);
});

resumeExportRouter.post('/export/pdf', exportLimiter, async (req, res) => {
  const user = currentUser(req);
  const id = resumeId(req.params);
  const file = await exportResumePdf(user.id, id);
  await recordExport(user.id, id, 'pdf');
  sendDownload(res, file);
});

resumeExportRouter.post('/export/docx', exportLimiter, async (req, res) => {
  const user = currentUser(req);
  const id = resumeId(req.params);
  const resume = await getResume(user.id, id);
  const file = await exportResumeDocx(user.id, resume);
  await recordExport(user.id, id, 'docx');
  sendDownload(res, {
    ...file,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
});

/** Datensicherung eines einzelnen Lebenslaufs (wieder importierbar). */
resumeExportRouter.get('/export/json', async (req, res) => {
  const user = currentUser(req);
  const resume = await getResume(user.id, resumeId(req.params));
  const body = Buffer.from(JSON.stringify({ format: 'cv-studio/resume@1', exportedAt: new Date().toISOString(), resume }, null, 2));
  await recordExport(user.id, resume.id, 'json');
  sendDownload(res, { fileName: `${resume.title.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.json`, data: body, contentType: 'application/json' });
});

/** Bewerbungspaket: eine zusammengeführte PDF oder einzelne Dateien als ZIP. */
resumeExportRouter.post('/export/package', exportLimiter, async (req, res) => {
  const user = currentUser(req);
  const id = resumeId(req.params);
  const options = parse(exportOptionsSchema, req.body);
  const result = await buildApplicationPackage(user.id, id, options);
  await recordExport(user.id, id, result.mode === 'merged' ? 'package_merged' : 'package_zip');
  if (result.mode === 'merged') return sendDownload(res, result.file);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${result.zipName}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => res.destroy(err));
  archive.pipe(res);
  for (const f of result.files) archive.append(f.data, { name: f.fileName });
  await archive.finalize();
});

/** Serverseitiger Qualitäts- und ATS-Check (identische Logik wie im Editor). */
resumeExportRouter.post('/check', async (req, res) => {
  const user = currentUser(req);
  const { jobDescription, locale } = parse(
    z.object({ jobDescription: z.string().max(20000).default(''), locale: z.enum(['de', 'en']).default(user.locale) }),
    req.body ?? {},
  );
  const resume = await getResume(user.id, resumeId(req.params));
  res.json({
    quality: runQualityCheck(resume.content, locale as Locale),
    ats: runAtsCheck(
      { content: resume.content, templateKey: resume.templateKey, design: resume.design, language: resume.language, dateFormat: resume.dateFormat, jobDescription },
      locale as Locale,
    ),
  });
});
