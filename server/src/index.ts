import { buildApp } from './app.js';
import { startCleanup, sweepExpired } from './cleanup.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);
await migrate(db);
await sweepExpired(db);
const stopCleanup = startCleanup(db);
const app = await buildApp({ config, db });
await app.listen({ host: config.host, port: config.port });
console.log(`relay listening on ${config.host}:${config.port}`);

const shutdown = async () => {
  stopCleanup();
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
