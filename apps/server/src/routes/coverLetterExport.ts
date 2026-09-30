import { Router } from 'express';
import { sendDownload } from '../lib/download.js';
import { parseUuidParam } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { exportLimiter } from '../middleware/rateLimit.js';
import { exportCoverLetterPdf } from '../pdf/exports.js';
import { recordExport } from '../services/resumes.js';

export const coverLetterExportRouter = Router({ mergeParams: true });

coverLetterExportRouter.get('/preview', exportLimiter, async (req, res) => {
  const file = await exportCoverLetterPdf(currentUser(req).id, parseUuidParam(req.params.id));
  sendDownload(res, file, true);
});

coverLetterExportRouter.post('/export/pdf', exportLimiter, async (req, res) => {
  const user = currentUser(req);
  const file = await exportCoverLetterPdf(user.id, parseUuidParam(req.params.id));
  await recordExport(user.id, null, 'cover_letter_pdf');
  sendDownload(res, file);
});
