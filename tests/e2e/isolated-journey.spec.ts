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
  if (!apiUrl || !email || !password) return;
  const apiOrigin = new URL(apiUrl).origin;

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
  const [detailRequest] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.method() === 'GET' && request.url() === `${apiOrigin}/v1/tasks/CAD-482/detail`,
    ),
    page.getByRole('link', { name: /CAD-482.*Refondre/u }).click(),
  ]);
  const expectedOrganization = await detailRequest.headerValue('If-Organization-Match');
  expect(expectedOrganization).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
  );
  await expect(
    page.getByRole('heading', { name: 'Refondre l’écran de connexion SSO' }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Statut' }).click();
  const [statusRequest] = await Promise.all([
    page.waitForRequest(
      (request) =>
        request.method() === 'PATCH' && request.url() === `${apiOrigin}/v1/tasks/CAD-482`,
    ),
    page.getByRole('option', { name: 'En revue' }).click(),
  ]);
  expect(await statusRequest.headerValue('If-Organization-Match')).toBe(expectedOrganization);
  expect(await statusRequest.headerValue('If-Match')).toMatch(/^"[1-9][0-9]*"$/u);
  await expect(page.getByText('Statut modifié.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Statut' })).toContainText('En revue');

  if (process.env['P8_WEBAPP_FULL_JOURNEY'] !== '1') return;

  await page.getByRole('link', { name: /Produit \/ Sprint 14/u }).click();
  await page.getByRole('link', { name: 'Tableau' }).click();
  const review = page.getByRole('region', { name: 'En revue' });
  const active = page.getByRole('region', { name: 'En cours' });
  const taskName = 'Refondre l’écran de connexion SSO';
  await expect(review.getByRole('link', { name: taskName })).toBeVisible();

  const card = page.getByTestId('board-drag-CAD-482');
  await active.scrollIntoViewIfNeeded();
  await card.hover({ position: { x: 12, y: 9 } });
  const destination = await active.boundingBox();
  if (!destination) throw new Error('The target board column has no bounding box.');
  const moved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url() === `${apiOrigin}/v1/tasks/CAD-482`,
  );
  await page.mouse.down();
  await page.mouse.move(destination.x + 40, destination.y + 90, { steps: 18 });
  await page.mouse.up();
  expect((await moved).status()).toBe(200);
  await expect(active.getByRole('link', { name: taskName })).toBeVisible();
  await expect(page.getByText('CAD-482 déplacée')).toBeVisible();

  const undone = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url() === `${apiOrigin}/v1/tasks/CAD-482`,
  );
  await page.getByRole('button', { name: 'Annuler' }).click();
  expect((await undone).status()).toBe(200);
  await expect(review.getByRole('link', { name: taskName })).toBeVisible();
  await page.reload();
  await expect(review.getByRole('link', { name: taskName })).toBeVisible();

  const beforeTrash = await page.request.get(`${apiOrigin}/v1/tasks/CAD-482`);
  expect(beforeTrash.status()).toBe(200);
  const version = beforeTrash.headers()['etag'];
  expect(version).toMatch(/^"[1-9][0-9]*"$/u);
  if (!version) throw new Error('The task response did not include an ETag.');
  const trashed = await page.request.post(`${apiOrigin}/v1/tasks/CAD-482/trash`, {
    headers: { 'If-Match': version },
    data: {},
  });
  expect(trashed.status()).toBe(200);
  await page.goto('/taches/CAD-482');
  await expect(page.getByRole('heading', { name: 'Cette tâche a été supprimée' })).toBeVisible();
  await expect(page.getByText(`CAD-482 « ${taskName} »`, { exact: false })).toBeVisible();
  const restore = page.getByRole('button', { name: 'Restaurer la tâche' });
  await restore.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Tâche restaurée');
  await expect(page.getByRole('heading', { name: taskName })).toBeVisible();
  await expect(page).toHaveURL(/\/taches\/CAD-482$/u);
  await page.reload();
  await expect(page.getByRole('heading', { name: taskName })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Statut' })).toContainText('En revue');
  const restored = await page.request.get(`${apiOrigin}/v1/tasks/CAD-482`);
  expect(restored.status()).toBe(200);
  const restoredTask: unknown = await restored.json();
  expect(restoredTask).toMatchObject({ key: 'CAD-482', status: 'review' });
});
