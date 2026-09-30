import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createDemoResume, register, skipOnboarding } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));

test('Dark Mode: Oberfläche dunkel, Lebenslauf bleibt druckfähig hell', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await register(page);
  await skipOnboarding(page);
  await createDemoResume(page);
  await expect(page.locator('html')).toHaveClass(/dark/);
  const bg = await page.locator('[data-testid=preview] .cv-page').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');
});

test('Benutzertrennung: fremde Lebensläufe sind nicht erreichbar', async ({ page, browser }) => {
  await register(page);
  await skipOnboarding(page);
  const id = await createDemoResume(page);
  const other = await browser.newContext({ locale: 'de-DE' });
  const otherPage = await other.newPage();
  await register(otherPage);
  await skipOnboarding(otherPage);
  await otherPage.goto(`/editor/${id}`);
  await expect(otherPage.getByText('existiert nicht oder gehört nicht zu deinem Konto')).toBeVisible();
  await other.close();
});

test('Dokumente hochladen und ungültige Dateien ablehnen', async ({ page }) => {
  await register(page);
  await skipOnboarding(page);
  await page.goto('/dokumente');
  await expect(page.getByRole('heading', { name: 'Noch keine Dokumente' })).toBeVisible();
  // Dateien als Buffer übergeben: Pfade mit Umlauten (Testausgabeordner) setzt Playwright nicht zuverlässig.
  const pdf = fs.readFileSync(path.join(here, 'fixtures', 'sample.pdf'));
  await page.getByTestId('document-input').setInputFiles({ name: 'Arbeitszeugnis.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByText('Arbeitszeugnis.pdf hochgeladen')).toBeVisible();
  // Kategorie wird aus dem Dateinamen erkannt → eigene Gruppe „Arbeitszeugnis“
  await expect(page.getByRole('heading', { name: 'Arbeitszeugnis', level: 2 })).toBeVisible();
  await expect(page.getByRole('main').locator('p.font-medium', { hasText: 'Arbeitszeugnis' })).toBeVisible();

  await page
    .getByTestId('document-input')
    .setInputFiles({ name: 'zeugnis.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>kein pdf</html>') });
  await expect(page.getByText(/Dieser Dateityp wird nicht unterstützt/)).toBeVisible();
});

test('Anschreiben erstellen, bearbeiten und als PDF exportieren', async ({ page }) => {
  await register(page);
  await skipOnboarding(page);
  await createDemoResume(page);
  await page.goto('/anschreiben');
  await page.getByRole('button', { name: 'Neues Anschreiben' }).first().click();
  await page.getByLabel('Lebenslauf verknüpfen').selectOption({ index: 1 });
  await page.getByRole('checkbox', { name: 'Mit Beispieltext starten' }).check();
  await page.getByRole('button', { name: 'Erstellen' }).click();
  await page.waitForURL('**/anschreiben/**');
  await expect(page.getByTestId('preview')).toContainText('Bewerbung als Projektleiter');
  await page.getByLabel('Betreff').fill('Bewerbung als Bauleiter');
  await expect(page.getByTestId('preview')).toContainText('Bewerbung als Bauleiter');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Als PDF exportieren/ }).click()]);
  expect(download.suggestedFilename()).toBe('Max_Mustermann_Anschreiben.pdf');
});

test('Onboarding führt Schritt für Schritt zum fertigen Lebenslauf', async ({ page }) => {
  await register(page);
  await expect(page.getByRole('heading', { name: 'Wie möchtest du deinen Lebenslauf erstellen?' })).toBeVisible();
  await page.getByRole('button', { name: /Von Grund auf/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: /IT & Software/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByLabel('Vorname').fill('Erika');
  await page.getByLabel('Nachname').fill('Beispiel');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: /Position hinzufügen/ }).click();
  await page.getByLabel('Position').fill('Softwareentwicklerin');
  await page.getByLabel('Arbeitgeber').fill('Beispiel AG');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByRole('radio', { name: /^Technical/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Fertigstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Lebenslauf ist bereit.' })).toBeVisible();
  await page.getByRole('button', { name: /Zum Editor/ }).click();
  await expect(page.getByTestId('preview')).toContainText('Softwareentwicklerin');
});
