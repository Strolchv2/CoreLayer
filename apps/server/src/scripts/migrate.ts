import { closeDb } from '../db/index.js';
import { migrateToLatest } from '../db/migrator.js';
import { seedTemplates } from '../services/templates.js';
import { logger } from '../lib/logger.js';

const applied = await migrateToLatest();
await seedTemplates();
logger.info({ applied }, applied.length ? 'Migrationen ausgeführt' : 'Datenbank ist aktuell');
await closeDb();
