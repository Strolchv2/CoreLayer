import { expect, test } from '@playwright/test';
import { PASSWORD, register, skipOnboarding, uniqueEmail } from './helpers';

test('Registrierung, Abmeldung und Anmeldung', async ({ page }) => {
  const email = await register(page);
  await skipOnboarding(page);
  await expect(page.getByRole('heading', { name: /Willkommen zurück/ })).toBeVisible();

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await page.waitForURL('**/anmelden');

  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.locator('input[autocomplete=current-password]').fill('falsches-Passwort-1');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('alert')).toContainText('E-Mail-Adresse oder Passwort ist falsch');

  await page.locator('input[autocomplete=current-password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForURL('**/dashboard');
});

test('Validierung bei der Registrierung', async ({ page }) => {
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill('keine-mail');
  await page.locator('input[autocomplete=new-password]').nth(0).fill('kurz');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible();
  await expect(page.getByText('mindestens 10 Zeichen')).toBeVisible();
  await expect(page.getByText('Bitte akzeptiere die Nutzungsbedingungen.')).toBeVisible();
});

test('geschützte Seiten leiten zur Anmeldung um', async ({ page }) => {
  await page.goto('/lebenslaeufe');
  await page.waitForURL('**/anmelden?next=%2Flebenslaeufe');
  await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible();
  expect(uniqueEmail()).toContain('@example.com');
});
