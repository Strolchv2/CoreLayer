import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BackupDTO } from '@cv-studio/shared';
import { config } from '../config.js';
import { badRequest, notFound, unavailable } from '../lib/errors.js';

const NAME_PATTERN = /^cvstudio_\d{8}_\d{6}\.dump$/;

/**
 * Datenbank-Backup per pg_dump (Custom-Format, komprimiert).
 * Backups verbleiben auf dem Server-Volume und werden NICHT über die Weboberfläche
 * ausgeliefert – sie enthalten personenbezogene Daten aller Benutzer.
 */
export async function createBackup(): Promise<BackupDTO> {
  await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const name = `cvstudio_${stamp}.dump`;
  const file = path.join(config.backupDir, name);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(config.pgDumpPath, ['--format=custom', '--no-owner', '--file', file, '--dbname', config.databaseUrl], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', () => reject(unavailable('backup_tool_missing')));
    child.on('close', (code) => (code === 0 ? resolve() : reject(unavailable('backup_failed', stderr.split('\n')[0]))));
  });
  await fs.chmod(file, 0o600);
  const stat = await fs.stat(file);
  return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
}

export async function listBackups(): Promise<BackupDTO[]> {
  try {
    const files = (await fs.readdir(config.backupDir)).filter((f) => NAME_PATTERN.test(f));
    const result = await Promise.all(
      files.map(async (name) => {
        const stat = await fs.stat(path.join(config.backupDir, name));
        return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      }),
    );
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function deleteBackup(name: string): Promise<void> {
  if (!NAME_PATTERN.test(name)) throw badRequest('invalid_backup_name');
  try {
    await fs.unlink(path.join(config.backupDir, name));
  } catch {
    throw notFound();
  }
}
