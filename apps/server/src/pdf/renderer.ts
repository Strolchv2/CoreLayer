/**
 * Serverseitige PDF-Erzeugung mit Headless Chromium.
 *
 * Prinzip "PDF = Vorschau": Chromium lädt dasselbe Render-Bundle (React-Vorlagen,
 * Seitenumbruch-Logik, eingebettete Schriften), das auch die Live-Vorschau im Browser nutzt.
 * Das Bundle wird aus dem lokalen Build ausgeliefert; alle anderen Netzwerkzugriffe sind blockiert.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { config } from '../config.js';
import { unavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** Virtueller Ursprung – Anfragen dorthin werden aus dem lokalen Build beantwortet. */
const RENDER_ORIGIN = 'http://cv-render.internal';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

export type RenderPayload =
  | { kind: 'resume'; data: unknown; title: string }
  | { kind: 'cover-letter'; data: unknown; title: string };

class Semaphore {
  private waiting: (() => void)[] = [];
  private active = 0;
  constructor(private readonly max: number) {}
  async acquire(): Promise<() => void> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
    return () => {
      this.active -= 1;
      this.waiting.shift()?.();
    };
  }
}

class PdfRenderer {
  private browser: Promise<Browser> | null = null;
  private readonly slots = new Semaphore(config.pdfConcurrency);

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const args = ['--disable-dev-shm-usage', '--font-render-hinting=none', '--disable-gpu'];
      // Chromium verweigert die Sandbox als root (z. B. in Entwicklungscontainern)
      if (typeof process.getuid === 'function' && process.getuid() === 0) args.push('--no-sandbox');
      this.browser = chromium
        .launch({ headless: true, executablePath: config.chromiumExecutablePath || undefined, args })
        .then((b) => {
          b.on('disconnected', () => {
            this.browser = null;
          });
          return b;
        })
        .catch((err) => {
          this.browser = null;
          throw err;
        });
    }
    return this.browser;
  }

  async bundleAvailable(): Promise<boolean> {
    try {
      await fs.access(path.join(config.renderBundleDir, 'render.html'));
      return true;
    } catch {
      return false;
    }
  }

  async render(payload: RenderPayload): Promise<Buffer> {
    if (!(await this.bundleAvailable())) throw unavailable('pdf_renderer_unavailable', 'Render bundle missing');
    const release = await this.slots.acquire();
    let browser: Browser;
    try {
      browser = await this.getBrowser();
    } catch (err) {
      release();
      logger.error({ errMessage: (err as Error).message }, 'Chromium konnte nicht gestartet werden');
      throw unavailable('pdf_renderer_unavailable');
    }
    const context = await browser.newContext({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1, locale: 'de-DE' });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(config.pdfTimeoutMs);
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== RENDER_ORIGIN) return route.abort('blockedbyclient');
        const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
        const file = path.join(config.renderBundleDir, rel);
        if (!file.startsWith(config.renderBundleDir + path.sep)) return route.abort('accessdenied');
        try {
          const body = await fs.readFile(file);
          return route.fulfill({ status: 200, body, headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' } });
        } catch {
          return route.fulfill({ status: 404, body: 'not found' });
        }
      });
      await page.addInitScript((p) => {
        (window as unknown as { __CV_PAYLOAD__: unknown }).__CV_PAYLOAD__ = p;
      }, payload);
      await page.emulateMedia({ media: 'screen' });
      await page.goto(`${RENDER_ORIGIN}/render.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const w = window as unknown as { __CV_READY__?: boolean; __CV_ERROR__?: string };
        return w.__CV_READY__ === true || typeof w.__CV_ERROR__ === 'string';
      });
      const renderError = await page.evaluate(() => (window as unknown as { __CV_ERROR__?: string }).__CV_ERROR__);
      if (renderError) throw new Error(`render failed: ${renderError}`);
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true,
        outline: false,
      });
      return Buffer.from(pdf);
    } catch (err) {
      if ((err as { status?: number }).status) throw err;
      logger.error({ errMessage: (err as Error).message.slice(0, 300) }, 'PDF-Erzeugung fehlgeschlagen');
      throw unavailable('pdf_export_failed');
    } finally {
      await context.close().catch(() => undefined);
      release();
    }
  }

  /** Statusprüfung für den Adminbereich */
  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    if (!(await this.bundleAvailable())) return { ok: false, message: 'render bundle missing' };
    try {
      const b = await this.getBrowser();
      return { ok: b.isConnected(), message: `Chromium ${b.version()}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message.split('\n')[0] ?? 'launch failed' };
    }
  }

  async close(): Promise<void> {
    const b = await this.browser?.catch(() => null);
    await b?.close().catch(() => undefined);
    this.browser = null;
  }
}

export const pdfRenderer = new PdfRenderer();
