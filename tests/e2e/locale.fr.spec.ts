import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

/** The French catalog the `fr` build is compiled with, so this spec holds no French text. */
const french = JSON.parse(
  readFileSync(resolve(__dirname, '../../src/locale/messages.fr.json'), 'utf8'),
) as { readonly translations: Readonly<Record<string, string>> };

test('the French build serves the sign-in page in French below /fr/', async ({ page }) => {
  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });
  await page.route('**/v1/**', async (route: Route) => {
    await route.fulfill({
      status: 401,
      json: {
        type: 'about:blank',
        title: 'Never shown',
        status: 401,
        code: 'auth.session-expired',
      },
    });
  });

  await page.goto('login');

  await expect(page).toHaveURL(/\/fr\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(
    page.getByRole('heading', { name: french.translations['auth.login.heading'] }),
  ).toBeVisible();
});
