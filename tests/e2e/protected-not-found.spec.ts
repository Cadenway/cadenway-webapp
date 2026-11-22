import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin, realtimeUrl: origin } });
  });
});

test('an unknown workspace address shows a 404 with a way back home', async ({ page }) => {
  await page.route('**/v1/organization', async (route) => {
    await route.fulfill({
      json: {
        id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
        name: 'Atelier Nord',
        slug: 'atelier-nord',
        role: 'owner',
        memberCount: 5,
        plan: 'free',
        joinedAt: '2026-11-01T10:00:00Z',
      },
    });
  });

  await page.goto('/lien/introuvable');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page).toHaveURL(/\/lien\/introuvable$/);
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page).toHaveURL(/\/accueil$/);
  await expect(page.getByRole('heading', { name: 'Atelier Nord' })).toBeVisible();
});

test('unknown workspace addresses require a session', async ({ page }) => {
  await page.route('**/v1/organization', async (route) => {
    await route.fulfill({
      status: 401,
      json: {
        type: 'about:blank',
        title: 'Session expirée',
        status: 401,
        code: 'auth.session-expired',
      },
    });
  });

  await page.goto('/lien/introuvable');
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
});
