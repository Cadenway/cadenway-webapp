import { expect, test } from '@playwright/test';

// Pipeline check of the bootstrap, not a mockup flow: the first real scenario replaces it.
test('the application starts and loads its runtime configuration', async ({ page }) => {
  const config = page.waitForResponse((response) => response.url().endsWith('/config.json'));

  await page.goto('/');

  expect((await config).ok()).toBe(true);
  await expect(page).toHaveTitle('Cadenway');
  await expect(page.locator('cw-root')).toBeAttached();
});
