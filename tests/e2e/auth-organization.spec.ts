import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = 'camille.martin@ateliernord.fr';
const password = 'atelier-nord-test-password';
const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const spaceId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const listId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32';
const taskName = 'Refondre l’écran de connexion SSO';
const sessionCookie = '__Host-cw_session';
const receiptCookie = '__Host-cw_federated_receipt';
const receipt = 'synthetic-federated-receipt';
const challengeToken = 'ExampleOnlyChallengeToken00000000000000000';
const user = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email,
  language: 'fr',
  displayName: null,
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 2,
};
const session = {
  id: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
  expiresAt: '2099-12-08T13:07:00Z',
};
const organization = {
  id: organizationId,
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 5,
  plan: 'free',
  joinedAt: '2026-11-01T10:00:00Z',
};

/** Stubs only the public Gateway and returns the requests received by the fixture. */
async function stubGateway(
  page: Page,
  { unavailableOrganizations = false, requireChallenge = false } = {},
) {
  let authenticated = false;
  let selected = false;
  let organizationRequests = 0;
  let federatedFinishes = 0;
  const selections: unknown[] = [];
  const taskDetailOrganizations: (string | undefined)[] = [];
  const statusChanges: {
    body: unknown;
    ifMatch: string | undefined;
    ifOrganizationMatch: string | undefined;
  }[] = [];

  await page.route('**/config.json', async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin, realtimeUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const federated = path === '/v1/auth/sign-in/federated/finish';
    if ((path === '/v1/auth/sign-in' || federated) && request.method() === 'POST') {
      const body: unknown = request.postDataJSON();
      if (federated) {
        federatedFinishes += 1;
        expect(body).toEqual({});
        const cookies = (await request.headerValue('cookie'))?.split('; ');
        if (!cookies?.includes(`${receiptCookie}=${receipt}`)) {
          await route.fulfill({
            status: 422,
            json: {
              type: 'about:blank',
              status: 422,
              code: 'auth.federated-sign-in-refused',
              title: 'Synthetic claim detail never displayed',
            },
          });
          return;
        }
      } else if (
        typeof body !== 'object' ||
        body === null ||
        !('email' in body) ||
        !('password' in body) ||
        body.email !== email ||
        body.password !== password
      ) {
        await route.fulfill({
          status: 422,
          json: {
            type: 'about:blank',
            title: 'Adresse e-mail ou mot de passe incorrect.',
            status: 422,
            code: 'auth.invalid-credentials',
            details: { remainingAttempts: 4 },
          },
        });
        return;
      }
      if (requireChallenge) {
        await route.fulfill({
          status: 202,
          ...(federated
            ? {
                headers: {
                  'Set-Cookie': `${receiptCookie}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,
                },
              }
            : {}),
          json: {
            token: challengeToken,
            expiresAt: '2099-12-08T13:07:00Z',
            email,
            name: user.name,
            primaryMethod: 'authenticator-app',
            methods: ['authenticator-app'],
            securityKeys: [],
            backupCodesRemaining: 0,
            lockedUntil: null,
          },
        });
        return;
      }
      authenticated = true;
      await route.fulfill({
        status: 200,
        headers: {
          'Set-Cookie': `${sessionCookie}=synthetic-session; Path=/; Secure; HttpOnly; SameSite=Strict`,
        },
        json: { user, session },
      });
      return;
    }
    if (path === '/v1/auth/sign-in/challenge/authenticator-app' && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({ token: challengeToken, code: '123456' });
      authenticated = true;
      await route.fulfill({
        status: 200,
        headers: {
          'Set-Cookie': `${sessionCookie}=synthetic-session; Path=/; Secure; HttpOnly; SameSite=Strict`,
        },
        json: { user, session },
      });
      return;
    }
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        json: {
          type: 'about:blank',
          title: 'Session expirée',
          status: 401,
          code: 'auth.session-expired',
        },
      });
      return;
    }
    if (path === '/v1/organizations' && request.method() === 'GET') {
      organizationRequests += 1;
      if (unavailableOrganizations && organizationRequests === 1) {
        await route.fulfill({
          status: 503,
          json: {
            type: 'about:blank',
            title: 'Service indisponible',
            status: 503,
            code: 'upstream.unavailable',
          },
        });
        return;
      }
      await route.fulfill({ json: { items: [organization], nextCursor: null } });
      return;
    }
    if (path === '/v1/session/organization' && request.method() === 'PUT') {
      selections.push(request.postDataJSON() as unknown);
      selected = true;
      await route.fulfill({ json: { organizationId, role: 'owner' } });
      return;
    }
    if (path === '/v1/organization' && request.method() === 'GET') {
      if (!selected) {
        await route.fulfill({
          status: 403,
          json: {
            type: 'about:blank',
            title: 'Choisissez une organisation',
            status: 403,
            code: 'organization.not-selected',
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          ...organization,
          description: null,
          website: null,
          defaultLanguage: 'fr',
          createdAt: '2026-11-01T10:00:00Z',
          version: 1,
        },
      });
      return;
    }
    if (path === '/v1/me' && request.method() === 'GET') {
      await route.fulfill({ json: user });
      return;
    }
    if (path === '/v1/spaces' && request.method() === 'GET') {
      await route.fulfill({
        json: { items: [{ id: spaceId, name: 'Produit' }], nextCursor: null },
      });
      return;
    }
    if (path === `/v1/spaces/${spaceId}/lists` && request.method() === 'GET') {
      await route.fulfill({
        json: { items: [{ id: listId, name: 'Sprint 14' }], nextCursor: null },
      });
      return;
    }
    if (path === `/v1/lists/${listId}` && request.method() === 'GET') {
      await route.fulfill({
        json: { id: listId, spaceId, name: 'Sprint 14', sprint: null, archivedAt: null },
      });
      return;
    }
    if (path === `/v1/lists/${listId}/tasks` && request.method() === 'GET') {
      await route.fulfill({
        json: {
          items: [
            { key: 'CAD-482', name: taskName, status: 'progress', assignees: [], dueDate: null },
          ],
          nextCursor: null,
          total: 1,
        },
      });
      return;
    }
    if (path === '/v1/tasks/CAD-482/detail' && request.method() === 'GET') {
      taskDetailOrganizations.push(request.headers()['if-organization-match']);
      const statuses = Object.fromEntries(
        [
          'triage',
          'backlog',
          'todo',
          'progress',
          'review',
          'testing',
          'waiting',
          'blocked',
          'done',
          'cancelled',
        ].map((key) => [key, { category: 'active', name: null, hidden: false }]),
      );
      await route.fulfill({
        json: {
          task: {
            key: 'CAD-482',
            name: taskName,
            status: 'progress',
            version: 3,
            description: null,
            milestone: false,
            archivedAt: null,
          },
          space: { id: spaceId, name: 'Produit', statuses },
          list: { id: listId, name: 'Sprint 14', callerRole: 'edit' },
          parent: null,
          subtasks: [],
          partial: [],
          comments: { items: [] },
        },
      });
      return;
    }
    if (path === '/v1/tasks/CAD-482' && request.method() === 'PATCH') {
      statusChanges.push({
        body: request.postDataJSON() as unknown,
        ifMatch: request.headers()['if-match'],
        ifOrganizationMatch: request.headers()['if-organization-match'],
      });
      await route.fulfill({ json: { key: 'CAD-482', status: 'review', version: 4 } });
      return;
    }
    await route.abort();
  });
  return {
    selections,
    taskDetailOrganizations,
    statusChanges,
    organizationRequests: () => organizationRequests,
    federatedFinishes: () => federatedFinishes,
  };
}

async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('protects the application and opens the chosen organization after sign-in', async ({
  page,
  context,
}) => {
  const gateway = await stubGateway(page);

  await page.goto('/accueil');
  await expect(page).toHaveURL(/\/connexion\/?$/u);
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible();
  await signIn(page);

  await expect(page).toHaveURL(/\/organisations\/?$/u);
  await expect(page.getByRole('heading', { name: 'Choisir une organisation' })).toBeVisible();
  await page.getByRole('button', { name: /Atelier Nord/u }).click();

  await expect(page).toHaveURL(/\/accueil\/?$/u);
  await expect(page.getByText('Atelier Nord')).toBeVisible();
  expect(gateway.selections).toEqual([{ organizationId }]);

  const stored = await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage }));
  expect(stored).not.toContain(password);
  expect(stored).not.toContain('synthetic-session');
  const cookie = (await context.cookies()).find(({ name }) => name === sessionCookie);
  expect(cookie?.httpOnly).toBe(true);
});

test('lets the user retry an unavailable organization list', async ({ page }) => {
  const gateway = await stubGateway(page, { unavailableOrganizations: true });

  await page.goto('/connexion');
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('button', { name: /Atelier Nord/u })).toBeVisible();
  expect(gateway.organizationRequests()).toBe(2);
});

test('keeps the user on sign-in after invalid credentials', async ({ page }) => {
  await stubGateway(page);

  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/connexion\/?$/u);
  await expect(page.getByRole('alert')).toContainText('E-mail ou mot de passe incorrect.');
});

test('waits for the second factor before opening the session', async ({ page, context }) => {
  await stubGateway(page, { requireChallenge: true });

  await page.goto('/connexion');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Vérification en deux étapes' })).toBeVisible();
  expect((await context.cookies()).some(({ name }) => name === sessionCookie)).toBe(false);
  expect(page.url()).not.toContain(challengeToken);
  const stored = await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage }));
  expect(stored).not.toContain(challengeToken);

  await page.getByLabel("Code de l'application").fill('123456');
  await page.getByRole('button', { name: 'Vérifier le code' }).click();
  await expect(page).toHaveURL(/\/organisations\/?$/u);
  expect((await context.cookies()).find(({ name }) => name === sessionCookie)?.httpOnly).toBe(true);
});

test('starts OAuth, redeems the federated cookie once and completes the ordinary MFA flow', async ({
  page,
  context,
}) => {
  const gateway = await stubGateway(page, { requireChallenge: true });
  const authorizationUrl = 'https://oidc.example.test/authorize?state=fixture';

  await page.goto('/connexion');
  const callback = new URL(
    '/v1/auth/sign-in/federated/providers/google/callback?state=fixture&code=fixture',
    page.url(),
  );
  await page.route('**/v1/auth/sign-in/federated/start', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ provider: 'google', rememberMe: false });
    await route.fulfill({ json: { authorizationUrl } });
  });
  await page.route(authorizationUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(callback.href)})</script>`,
    });
  });
  await page.route('**/v1/auth/sign-in/federated/providers/google/callback?*', async (route) => {
    await route.fulfill({
      status: 303,
      headers: {
        Location: '/auth/federated/continue',
        'Set-Cookie': `${receiptCookie}=${receipt}; Path=/; Secure; HttpOnly; SameSite=Lax`,
      },
    });
  });
  await page.getByRole('button', { name: 'Google', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Vérification en deux étapes' })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/federated\/continue$/u);
  expect(gateway.federatedFinishes()).toBe(1);
  expect((await context.cookies()).map(({ name }) => name)).not.toContain(receiptCookie);
  expect((await context.cookies()).map(({ name }) => name)).not.toContain(sessionCookie);

  await page.getByLabel("Code de l'application").fill('123456');
  await page.getByRole('button', { name: 'Vérifier le code' }).click();
  await expect(page).toHaveURL(/\/organisations$/u);
  await expect(page.getByRole('heading', { name: 'Choisir une organisation' })).toBeVisible();
  expect((await context.cookies()).find(({ name }) => name === sessionCookie)?.httpOnly).toBe(true);
  expect(gateway.federatedFinishes()).toBe(1);
});

test('offers other sign-in methods when the provider continuation was refused', async ({
  page,
}) => {
  const gateway = await stubGateway(page);
  await page.goto('/auth/federated/continue');
  await expect(page.getByRole('alert')).toHaveText(
    'Cette méthode de connexion ne peut pas être utilisée.',
  );
  await page.getByRole('link', { name: 'Autres méthodes de connexion' }).click();
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible();
  expect(gateway.federatedFinishes()).toBe(1);
});

test('opens Sprint 14 and changes the status of CAD-482', async ({ page }) => {
  const gateway = await stubGateway(page);

  await page.goto('/connexion');
  await signIn(page);
  await page.getByRole('button', { name: /Atelier Nord/u }).click();
  await page.getByRole('link', { name: 'Espaces' }).click();
  await expect(page.getByRole('heading', { name: 'Espaces' })).toBeVisible();
  await page.getByRole('link', { name: 'Produit' }).click();
  await expect(page.getByRole('heading', { name: 'Listes' })).toBeVisible();
  await page.getByRole('link', { name: 'Sprint 14' }).click();
  await expect(page.getByRole('heading', { name: 'Sprint 14' })).toBeVisible();
  await page.getByRole('link', { name: /CAD-482.*Refondre/u }).click();
  await expect(page.getByRole('heading', { name: taskName })).toBeVisible();
  await page.getByRole('combobox', { name: 'Statut' }).click();
  await page.getByRole('option', { name: 'En revue' }).click();
  await expect(page.getByText('Statut modifié.')).toBeVisible();
  expect(gateway.taskDetailOrganizations).toEqual([organizationId]);
  expect(gateway.statusChanges).toEqual([
    { body: { status: 'review' }, ifMatch: '"3"', ifOrganizationMatch: organizationId },
  ]);
});
