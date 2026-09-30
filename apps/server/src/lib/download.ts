import type { Response } from 'express';

/** Sendet eine Datei als Download mit korrekt kodiertem Dateinamen (RFC 6266). */
export function sendDownload(res: Response, file: { fileName: string; data: Buffer; contentType: string }, inline = false): void {
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', String(file.data.length));
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.end(file.data);
}
