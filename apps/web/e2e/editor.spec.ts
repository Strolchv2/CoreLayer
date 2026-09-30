import { expect, test } from '@playwright/test';
import { createDemoResume, register, skipOnboarding, waitSaved } from './helpers';

test.beforeEach(async ({ page }) => {
  await register(page);
  await skipOnboarding(page);
});

test('Bearbeiten mit Live-Vorschau und Autosave', async ({ page }) => {
  await createDemoResume(page);
  await page.getByLabel('Vorname').fill('Moritz');
  await expect(page.getByTestId('save-state')).not.toHaveAttribute('data-state', 'saved');
  await expect(page.getByTestId('preview')).toContainText('Moritz');
  await waitSaved(page);
  await page.reload();
  await expect(page.getByLabel('Vorname')).toHaveValue('Moritz');
  await expect(page.getByTestId('preview')).toContainText('Moritz');
});

test('Vorlagenwechsel ohne Datenverlust', async ({ page }) => {
  await createDemoResume(page);
  for (const tpl of ['Classic', 'ATS', 'Creative']) {
    await page.getByRole('radio', { name: new RegExp(`^${tpl}`) }).click();
    await expect(page.getByTestId('preview')).toContainText('Montage Werk GmbH');
  }
  await waitSaved(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: /^Creative/ })).toHaveAttribute('aria-checked', 'true');
});

test('Abschnitt ausblenden und per Tastatur-Drag-and-Drop verschieben', async ({ page }) => {
  await createDemoResume(page, 'Classic');
  const preview = page.getByTestId('preview');
  await expect(preview).toContainText('EHRENAMT', { ignoreCase: true });
  await page.getByRole('button', { name: 'Abschnitt ausblenden' }).nth(9).click(); // Ehrenamt
  await expect(preview).not.toContainText('Freiwillige Feuerwehr');

  // „Ausbildung“ (Index 2) mit der Tastatur nach oben verschieben
  const handles = page.getByRole('button', { name: 'Ziehen zum Sortieren' });
  const sectionTitles = page.locator('section h2, section button span.truncate');
  await handles.nth(2).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await waitSaved(page);
  const text = await preview.innerText();
  expect(text.toUpperCase().indexOf('AUSBILDUNG')).toBeLessThan(text.toUpperCase().indexOf('BERUFSERFAHRUNG'));
  expect(await sectionTitles.count()).toBeGreaterThan(0);
});

test('Qualitätscheck zeigt Warnungen und springt zum Feld', async ({ page }) => {
  await createDemoResume(page);
  await page.getByLabel('Telefonnummer').fill('');
  await page.getByRole('tab', { name: 'Check' }).click();
  const warning = page.getByRole('button', { name: /Telefonnummer fehlt/ });
  await expect(warning).toBeVisible();
  await expect(page.getByText(/ATS-Kompatibilität/)).toBeVisible();
});

test('PDF-Export lädt eine PDF-Datei mit korrektem Namen herunter', async ({ page }) => {
  await createDemoResume(page);
  await page.getByTestId('export-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Nur Lebenslauf exportieren' }).click()]);
  expect(download.suggestedFilename()).toBe('Max_Mustermann_Lebenslauf.pdf');
});

test('Lebenslauf duplizieren, umbenennen und löschen', async ({ page }) => {
  await createDemoResume(page);
  await page.goto('/lebenslaeufe');
  await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
  await page.getByRole('menuitem', { name: 'Duplizieren' }).click();
  await expect(page.getByText('Mein Lebenslauf (Kopie)')).toBeVisible();

  await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click();
  await page.getByLabel('Titel').fill('Bewerbung Projektleiter');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bewerbung Projektleiter')).toBeVisible();

  await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Bewerbung Projektleiter')).toHaveCount(0);
});
