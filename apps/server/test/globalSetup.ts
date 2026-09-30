import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

/** Setzt die Testdatenbank vor dem Testlauf vollständig zurück. */
export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://cvstudio:cvstudio_dev@localhost:5432/cvstudio_test';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  await fs.rm(path.join(os.tmpdir(), 'cvstudio-test-storage'), { recursive: true, force: true });
}
