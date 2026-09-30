import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Sichere Dateiablage:
 *  - zufällige Dateinamen ohne Endung (nie der Originalname, nie ausführbar)
 *  - Verzeichnis außerhalb des Web-Roots, Rechte 0700/0600
 *  - Zugriff ausschließlich über authentifizierte API-Endpunkte
 */
const KEY_PATTERN = /^[a-f0-9]{40}$/;

export function newStorageKey(): string {
  return randomBytes(20).toString('hex');
}

function resolveKey(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error('invalid storage key');
  const file = path.join(config.uploadDir, key.slice(0, 2), key);
  // Zusätzliche Absicherung gegen Pfadmanipulation
  if (!file.startsWith(config.uploadDir + path.sep)) throw new Error('invalid storage path');
  return file;
}

export async function ensureStorageDirs(): Promise<void> {
  for (const dir of [config.storageDir, config.uploadDir, config.backupDir]) {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }
}

export async function writeStoredFile(key: string, data: Buffer): Promise<void> {
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, data, { mode: 0o600, flag: 'wx' });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export async function directorySize(dir: string): Promise<number> {
  let total = 0;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += await directorySize(full);
      else if (entry.isFile()) total += (await fs.stat(full)).size;
    }
  } catch {
    /* Verzeichnis existiert (noch) nicht */
  }
  return total;
}
