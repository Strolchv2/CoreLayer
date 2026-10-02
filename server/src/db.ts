import pg from 'pg';
import { SCHEMA_SQL } from './schema.js';

export type Db = pg.Pool;

export function createPool(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

export async function migrate(db: Db): Promise<void> {
  await db.query(SCHEMA_SQL);
}
