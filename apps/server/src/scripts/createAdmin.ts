/**
 * Legt einen Administrator an:
 *   npm run create-admin -- admin@example.com
 * Das Passwort wird aus ADMIN_PASSWORD gelesen oder interaktiv abgefragt (nicht als Argument,
 * damit es nicht in der Shell-Historie landet).
 */
import readline from 'node:readline/promises';
import { closeDb } from '../db/index.js';
import { migrateToLatest } from '../db/migrator.js';
import { ensureAdmin } from '../services/bootstrap.js';

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email) {
  console.error('Aufruf: npm run create-admin -- <email>');
  process.exit(1);
}
let password = process.env.ADMIN_PASSWORD ?? '';
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Passwort für den Administrator: ');
  rl.close();
}
await migrateToLatest();
try {
  const result = await ensureAdmin(email, password);
  console.log(result === 'created' ? 'Administrator angelegt.' : result === 'promoted' ? 'Bestehendes Konto zum Administrator ernannt.' : 'Konto ist bereits Administrator.');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
}
await closeDb();
