import { expect, test } from '@playwright/test';

const applicationUrl = process.env['E2E_BASE_URL'];
const apiUrl = process.env['P8_REAL_API_BASE'];
const email = process.env['P8_REAL_LOGIN_EMAIL'];
const password = process.env['P8_REAL_LOGIN_PASSWORD'];
const enabled = apiUrl !== undefined;

/** Restricts this fixture to the two HTTP hosts supplied by the local isolated stack. */
function isFixtureUrl(value: string | undefined, host: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      url.hostname === host &&
      url.port !== '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('signs in and persists the status change through the isolated stack', async ({ page }) => {
  test.skip(!enabled, 'Set P8_REAL_API_BASE for the isolated stack fixture.');
  expect(isFixtureUrl(applicationUrl, 'app.cadenway.localhost')).toBe(true);
  expect(isFixtureUrl(apiUrl, 'api.cadenway.localhost')).toBe(true);
  expect(email).toBeTruthy();
  expect(password).toBeTruthy();
  if (!email || !password) return;

  await page.goto('/connexion');
  const runtimeApiUrl: unknown = await page.evaluate(async () => {
    const response = await fetch('/config.json');
    const config: unknown = await response.json();
    return typeof config === 'object' && config !== null && 'apiUrl' in config
      ? config.apiUrl
      : undefined;
  });
  expect(runtimeApiUrl).toBe(apiUrl);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('button', { name: /Atelier Nord/u }).click();
  await expect(page).toHaveURL(/\/accueil\/?$/u);
  await page.getByRole('link', { name: 'Espaces' }).click();
  await page.getByRole('link', { name: 'Produit' }).click();
  await page.getByRole('link', { name: 'Sprint 14' }).click();
  await page.getByRole('link', { name: /CAD-482.*Refondre/u }).click();
  await expect(
    page.getByRole('heading', { name: 'Refondre l’écran de connexion SSO' }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Statut' }).click();
  await page.getByRole('option', { name: 'En revue' }).click();
  await expect(page.getByText('Statut modifié.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Statut' })).toContainText('En revue');
});
