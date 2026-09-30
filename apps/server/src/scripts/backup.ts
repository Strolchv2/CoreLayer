/** Datenbank-Backup per Kommandozeile/Cron: `npm run backup` bzw. `node dist/scripts/backup.js` (siehe README) */
import { closeDb } from '../db/index.js';
import { createBackup } from '../services/backup.js';

try {
  const backup = await createBackup();
  console.log(`Backup erstellt: ${backup.name} (${Math.round(backup.sizeBytes / 1024)} KB)`);
} catch (err) {
  console.error('Backup fehlgeschlagen:', (err as Error).message);
  process.exitCode = 1;
}
await closeDb();
