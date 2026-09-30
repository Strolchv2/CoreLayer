import { expect, test } from '@playwright/test';
import { createDemoResume, register, skipOnboarding } from './helpers';

test('Editor auf dem Smartphone: Bereiche untereinander mit Tab-Leiste', async ({ page }) => {
  await register(page);
  await skipOnboarding(page);
  await createDemoResume(page);
  const nav = page.getByRole('navigation', { name: 'Editor-Bereiche' });
  await expect(nav).toBeVisible();
  await expect(page.getByLabel('Vorname')).toBeVisible();
  await nav.getByRole('button', { name: 'Vorschau' }).click();
  await expect(page.getByTestId('preview')).toContainText('Mustermann');
  // Seiten passen in die Breite (kein horizontales Scrollen der Seite)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await nav.getByRole('button', { name: 'Design' }).click();
  await expect(page.getByRole('radio', { name: /^Classic/ })).toBeVisible();
});

test('Startseite und Navigation mobil bedienbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Erstelle deinen professionellen Lebenslauf.' })).toBeVisible();
  await page.getByRole('button', { name: 'Menü' }).click();
  await expect(page.getByRole('link', { name: 'Registrieren' })).toBeVisible();
});
