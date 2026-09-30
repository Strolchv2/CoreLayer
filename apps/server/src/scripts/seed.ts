/**
 * Demo-Daten: legt (optional) ein Demo-Konto mit Beispiel-Lebenslauf und -Anschreiben an.
 * Nur fiktive Daten. Zugangsdaten über DEMO_EMAIL / DEMO_PASSWORD.
 */
import { createDemoContent } from '@cv-studio/shared';
import { closeDb, db } from '../db/index.js';
import { migrateToLatest } from '../db/migrator.js';
import { hashPassword } from '../lib/passwords.js';
import { createCoverLetter } from '../services/coverLetters.js';
import { createProfile } from '../services/profiles.js';
import { createResume } from '../services/resumes.js';
import { seedTemplates } from '../services/templates.js';

const email = (process.env.DEMO_EMAIL ?? 'demo@example.com').toLowerCase();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 10) {
  console.error('Bitte DEMO_PASSWORD (mind. 10 Zeichen) setzen.');
  process.exit(1);
}

await migrateToLatest();
await seedTemplates();
const existing = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
if (existing) {
  console.log('Demo-Konto existiert bereits.');
} else {
  const user = await db
    .insertInto('users')
    .values({ email, password_hash: await hashPassword(password), display_name: 'Max Mustermann', onboarding_completed: true })
    .returning('id')
    .executeTakeFirstOrThrow();
  const profile = await createProfile(user.id, { name: 'Elektrotechnik', description: 'Beispielprofil' });
  await import('../services/profiles.js').then((m) =>
    m.saveProfile(user.id, profile.id, { name: profile.name, description: profile.description, content: createDemoContent('de'), version: profile.version }),
  );
  const de = await createResume(user.id, { title: 'Bewerbung Projektleiter', language: 'de', templateKey: 'modern', source: { type: 'demo' } }, 'MM/YYYY');
  await createResume(user.id, { title: 'Bewerbung Elektroinstallateur', language: 'de', templateKey: 'classic', source: { type: 'demo' } }, 'MM/YYYY');
  await createResume(user.id, { title: 'International CV', language: 'en', templateKey: 'professional', source: { type: 'demo' } }, 'MM/YYYY');
  await createCoverLetter(user.id, { title: 'Anschreiben Projektleiter', resumeId: de.id, language: 'de', demo: true });
  console.log(`Demo-Konto angelegt: ${email}`);
}
await closeDb();
