import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { config } from '../config.js';
import type { Database } from './types.js';

// DATE/TIMESTAMP-Werte als Date-Objekte, int8 (bigserial, count) als String belassen.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolMax,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  idleTimeoutMillis: 30_000,
  // Schutz vor hängenden Abfragen
  statement_timeout: 30_000,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export type DB = Kysely<Database>;

export async function closeDb(): Promise<void> {
  await db.destroy();
}
