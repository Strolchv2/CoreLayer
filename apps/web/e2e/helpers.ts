import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'sicheres-Passwort-1';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}

/** Registriert ein neues Konto über die Oberfläche und überspringt das Onboarding. */
export async function register(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.locator('input[autocomplete=new-password]').nth(0).fill(PASSWORD);
  await page.locator('input[autocomplete=new-password]').nth(1).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.waitForURL('**/onboarding');
  return email;
}

export async function skipOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.waitForURL('**/dashboard');
}

/** Legt einen Lebenslauf mit Beispieldaten an und öffnet den Editor. */
export async function createDemoResume(page: Page, template = 'Modern'): Promise<string> {
  await page.goto('/lebenslaeufe/neu');
  await page.getByRole('button', { name: /Mit Beispieldaten/ }).click();
  await page.getByRole('radio', { name: new RegExp(`^${template}`) }).click();
  await page.getByRole('button', { name: 'Lebenslauf erstellen' }).click();
  await page.waitForURL('**/editor/**');
  await expect(page.getByTestId('save-state')).toBeVisible();
  return page.url().split('/editor/')[1]!.split('?')[0]!;
}

export async function waitSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
}
