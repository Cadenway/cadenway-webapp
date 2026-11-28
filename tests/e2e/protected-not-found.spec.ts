import { expect, test, type Page } from '@playwright/test';

import { workspaceRead } from './workspace-reads';

const user = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'en',
  displayName: null,
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 2,
};
const organization = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  description: null,
  website: null,
  defaultLanguage: 'en',
  plan: 'team',
  memberCount: 18,
  role: 'owner',
  createdAt: '2026-01-12T09:00:00Z',
  version: 3,
};
const sessionExpired = {
  status: 401,
  json: {
    type: 'about:blank',
    title: 'Session expired',
    status: 401,
    code: 'auth.session-expired',
  },
};

/**
 * Stubs the runtime configuration and the two reads of the workspace guards; the shell's other
 * reads get their empty answers, and any other route a 404.
 */
async function stubGateway(page: Page, { signedIn }: { signedIn: boolean }): Promise<void> {
  await page.route('**/v1/**', async (route) => {
    const key = `${route.request().method()} ${new URL(route.request().url()).pathname}`;
    const notFound = {
      status: 404,
      json: { type: 'about:blank', title: 'Never shown', status: 404, code: 'route.not-found' },
    };
    await route.fulfill(signedIn ? (workspaceRead(key) ?? notFound) : sessionExpired);
  });
  await page.route('**/config.json', async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin, realtimeUrl: origin } });
  });
  await page.route('**/v1/me', async (route) => {
    await route.fulfill(signedIn ? { json: user } : sessionExpired);
  });
  await page.route('**/v1/organization', async (route) => {
    await route.fulfill(signedIn ? { json: organization } : sessionExpired);
  });
}

test('an unknown workspace address shows a 404 in the shell with a way back home', async ({
  page,
}) => {
  await stubGateway(page, { signedIn: true });

  await page.goto('/atelier-nord/missing/page');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveURL(/\/atelier-nord\/missing\/page$/u);
  await expect(
    page.getByRole('button', { name: 'Switch organization: Atelier Nord' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/\/atelier-nord$/u);
  await expect(page.getByRole('heading', { name: 'Hello Camille' })).toBeVisible();
});

test('the workspace 404 opens the command palette from its Search', async ({ page }) => {
  await stubGateway(page, { signedIn: true });

  await page.goto('/atelier-nord/missing/page');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await expect(page).toHaveURL(/\/atelier-nord\/missing\/page$/u);
});

test('unknown workspace addresses require a session', async ({ page }) => {
  await stubGateway(page, { signedIn: false });

  await page.goto('/atelier-nord/missing/page');

  await expect(page).toHaveURL(/\/login\?next=%2Fatelier-nord%2Fmissing%2Fpage$/u);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
});
