import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { migrateToLatest } from './db/migrator.js';
import { logger } from './lib/logger.js';
import { pdfRenderer } from './pdf/renderer.js';
import { ensureAdmin } from './services/bootstrap.js';
import { purgeExpiredSessions } from './services/sessions.js';
import { ensureStorageDirs } from './services/storage.js';
import { seedTemplates } from './services/templates.js';

async function main(): Promise<void> {
  await ensureStorageDirs();
  const applied = await migrateToLatest();
  if (applied.length) logger.info({ applied }, 'Datenbank-Migrationen ausgeführt');
  await seedTemplates();
  if (config.bootstrapAdmin) {
    const result = await ensureAdmin(config.bootstrapAdmin.email, config.bootstrapAdmin.password);
    if (result !== 'unchanged') logger.info({ result }, 'Administrator eingerichtet');
  }
  if (!(await pdfRenderer.bundleAvailable())) {
    logger.warn(`Render-Bundle nicht gefunden (${config.renderBundleDir}) – PDF-Export erst nach "npm run build" im Web-Paket verfügbar.`);
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info(`CV Studio API läuft auf http://${config.host}:${config.port}`);
  });

  const cleanup = setInterval(() => {
    purgeExpiredSessions().catch((err) => logger.warn({ errMessage: (err as Error).message }, 'Session-Bereinigung fehlgeschlagen'));
  }, 60 * 60 * 1000);
  cleanup.unref();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} empfangen – fahre herunter`);
    server.close();
    await pdfRenderer.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ errMessage: (err as Error).message }, 'Serverstart fehlgeschlagen');
  process.exit(1);
});
