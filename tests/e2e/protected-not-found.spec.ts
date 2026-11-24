import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
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
  defaultLanguage: 'fr',
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
    title: 'Session expirée',
    status: 401,
    code: 'auth.session-expired',
  },
};

/** Stubs the runtime configuration and the two reads of the workspace guards. */
async function stubGateway(page: Page, { signedIn }: { signedIn: boolean }): Promise<void> {
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

  await page.goto('/atelier-nord/lien/introuvable');

  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page).toHaveURL(/\/atelier-nord\/lien\/introuvable$/u);
  await expect(
    page.getByRole('link', { name: 'Changer d’organisation : Atelier Nord' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page).toHaveURL(/\/atelier-nord$/u);
  await expect(page.getByRole('heading', { name: 'Bonjour Camille' })).toBeVisible();
});

test('unknown workspace addresses require a session', async ({ page }) => {
  await stubGateway(page, { signedIn: false });

  await page.goto('/atelier-nord/lien/introuvable');

  await expect(page).toHaveURL(/\/login\?next=%2Fatelier-nord%2Flien%2Fintrouvable$/u);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
});
