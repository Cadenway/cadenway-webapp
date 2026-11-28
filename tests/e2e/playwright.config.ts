import { resolve } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const workspace = resolve(__dirname, '../..');
// The dev server serves one locale build: English from `pnpm start`, French from `pnpm serve:fr`.
const localOrigins = { en: 'http://localhost:4200', fr: 'http://localhost:4201' } as const;
// The origin of an application that serves both locales already (the image, the ops stack).
const externalOrigin = process.env['E2E_BASE_URL']?.replace(/\/+$/u, '');

/** The base address of a locale build: specs navigate to relative paths below it (`login`). */
function localeBase(locale: keyof typeof localOrigins): string {
  return `${externalOrigin ?? localOrigins[locale]}/${locale}/`;
}

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results',
  forbidOnly: process.env['CI'] !== undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Specs assert the English copy below /en/; `*.fr.spec.ts` assert the French build below /fr/.
  projects: [
    {
      name: 'en',
      testIgnore: '**/*.fr.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: localeBase('en') },
    },
    {
      name: 'fr',
      testMatch: '**/*.fr.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: localeBase('fr') },
    },
  ],
  // A running dev server is reused and left running: never stop a server you did not start.
  webServer:
    externalOrigin === undefined
      ? [
          {
            command: 'pnpm start',
            cwd: workspace,
            url: localeBase('en'),
            reuseExistingServer: true,
            timeout: 120_000,
          },
          {
            command: 'pnpm serve:fr',
            cwd: workspace,
            url: localeBase('fr'),
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ]
      : undefined,
});
