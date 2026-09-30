import { Migrator, type Migration, type MigrationProvider } from 'kysely';
import { db } from './index.js';
import * as m001 from './migrations/001_initial.js';

/** Migrationen werden statisch registriert (funktioniert auch im gebündelten Build). */
const migrations: Record<string, Migration> = {
  '001_initial': m001,
};

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export async function migrateToLatest(): Promise<string[]> {
  const migrator = new Migrator({ db, provider: new StaticMigrationProvider() });
  const { error, results } = await migrator.migrateToLatest();
  if (error) throw error instanceof Error ? error : new Error(String(error));
  return (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName);
}
