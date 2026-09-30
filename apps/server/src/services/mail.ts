import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { randomToken } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
}

/**
 * Versendet E-Mails per SMTP. Im Modus "outbox" (Entwicklung/Tests) werden Nachrichten
 * als Dateien in STORAGE_DIR/mail-outbox abgelegt – niemals in Logs geschrieben.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (config.mail.transport === 'smtp') {
    await getTransporter().sendMail({ from: config.mail.from, ...message });
    logger.info('E-Mail versendet');
    return;
  }
  await fs.mkdir(config.outboxDir, { recursive: true, mode: 0o700 });
  const file = path.join(config.outboxDir, `${Date.now()}-${randomToken(6)}.json`);
  await fs.writeFile(file, JSON.stringify({ from: config.mail.from, ...message, createdAt: new Date().toISOString() }, null, 2), {
    mode: 0o600,
  });
  logger.info('E-Mail im Entwicklungs-Postausgang abgelegt');
}

/** Letzte Nachricht aus dem Postausgang (nur für Tests/Entwicklung). */
export async function readLatestOutboxMail(): Promise<(MailMessage & { createdAt: string }) | null> {
  try {
    const files = (await fs.readdir(config.outboxDir)).filter((f) => f.endsWith('.json')).sort();
    const last = files.at(-1);
    if (!last) return null;
    return JSON.parse(await fs.readFile(path.join(config.outboxDir, last), 'utf8'));
  } catch {
    return null;
  }
}
