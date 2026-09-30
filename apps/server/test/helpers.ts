import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { migrateToLatest } from '../src/db/migrator.js';
import { ensureStorageDirs } from '../src/services/storage.js';
import { seedTemplates } from '../src/services/templates.js';

let appPromise: Promise<Express> | null = null;

export function getApp(): Promise<Express> {
  appPromise ??= (async () => {
    await ensureStorageDirs();
    await migrateToLatest();
    await seedTemplates();
    return createApp();
  })();
  return appPromise;
}

/** HTTP-Client mit Cookie-Jar und automatischem CSRF-Header. */
export async function createClient() {
  const app = await getApp();
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/csrf');
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const csrf = cookies.map((c) => c.match(/^cvs_csrf=([^;]+)/)?.[1]).find(Boolean) ?? '';
  const withCsrf = <T extends request.Test>(t: T) => t.set('X-CSRF-Token', csrf).set('Origin', 'http://localhost:5173');
  return {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => withCsrf(agent.post(url)).send(body ?? {}),
    put: (url: string, body?: object) => withCsrf(agent.put(url)).send(body ?? {}),
    patch: (url: string, body?: object) => withCsrf(agent.patch(url)).send(body ?? {}),
    delete: (url: string, body?: object) => withCsrf(agent.delete(url)).send(body ?? {}),
    upload: (url: string, field: string, data: Buffer, filename: string, contentType: string, fields: Record<string, string> = {}) => {
      let t = withCsrf(agent.post(url)).attach(field, data, { filename, contentType });
      for (const [k, v] of Object.entries(fields)) t = t.field(k, v);
      return t;
    },
  };
}

export type TestClient = Awaited<ReturnType<typeof createClient>>;

let counter = 0;
export async function registerUser(prefix = 'user'): Promise<{ client: TestClient; email: string; password: string; id: string }> {
  const client = await createClient();
  const email = `${prefix}${Date.now()}${counter++}@example.com`;
  const password = 'sicheres-Passwort-1';
  const res = await client.post('/api/auth/register', { email, password, acceptTerms: true, displayName: 'Test' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client, email, password, id: res.body.user.id };
}

export async function makePng(size = 64): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width: size, height: size, channels: 3, background: '#336699' } }).png().toBuffer();
}

export async function makeJpeg(size = 64): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width: size, height: size, channels: 3, background: '#996633' } }).jpeg().toBuffer();
}

export async function makePdf(pages = 1, text = 'Zeugnis'): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]).drawText(`${text} ${i + 1}`, { x: 50, y: 780, size: 14, font });
  return Buffer.from(await doc.save());
}
