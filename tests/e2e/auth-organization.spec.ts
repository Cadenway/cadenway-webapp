import { expect, test } from '@playwright/test';
import type { Page, Request, Route } from '@playwright/test';

const email = 'camille.martin@ateliernord.fr';
const password = 'atelier-nord-test-password';
const challengeToken = 'ExampleOnlyChallengeToken00000000000000000';
const user = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email,
  language: 'en',
  displayName: null,
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 2,
};
const signedIn = {
  user,
  session: { id: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60', expiresAt: '2099-12-08T13:07:00Z' },
};
const organization = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'team',
  joinedAt: '2026-11-01T10:00:00Z',
};
const providerUrl = 'https://oauth.provider.example/authorize?state=synthetic';

interface GatewayOptions {
  /** The password sign-in answers with a two-step challenge. */
  readonly requireChallenge?: boolean;
  /** The first organization list answers 503. */
  readonly unavailableOrganizations?: boolean;
  /** The browser already has a session. */
  readonly signedIn?: boolean;
}

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
  /** Bodies received, by `METHOD /path`. */
  readonly bodies: Map<string, unknown[]>;
}

function problem(status: number, code: string, details?: Record<string, unknown>) {
  return { status, json: { type: 'about:blank', title: 'Never shown', status, code, details } };
}

/** Stubs `config.json` and every `/v1/**` gateway route the auth screens call. */
async function stubGateway(page: Page, options: GatewayOptions = {}): Promise<Gateway> {
  const calls: string[] = [];
  const bodies = new Map<string, unknown[]>();
  let session = options.signedIn ?? false;
  let selected = false;
  let organizationLists = 0;

  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request: Request = route.request();
    const path = new URL(request.url()).pathname;
    const key = `${request.method()} ${path}`;
    calls.push(key);
    const body: unknown = request.postData() === null ? undefined : request.postDataJSON();
    bodies.set(key, [...(bodies.get(key) ?? []), body]);
    const open = async (): Promise<void> => {
      session = true;
      await route.fulfill({ status: 200, json: signedIn });
    };

    switch (key) {
      case 'POST /v1/auth/sign-in': {
        const credentials = body as { email?: string; password?: string };
        if (credentials.email !== email || credentials.password !== password) {
          await route.fulfill(problem(422, 'auth.invalid-credentials', { remainingAttempts: 3 }));
          return;
        }
        if (options.requireChallenge === true) {
          await route.fulfill({
            status: 202,
            json: {
              token: challengeToken,
              expiresAt: '2099-12-08T13:07:00Z',
              email,
              name: user.name,
              primaryMethod: 'authenticator-app',
              methods: ['authenticator-app', 'backup-code'],
              securityKeys: [],
              backupCodesRemaining: 7,
              lockedUntil: null,
            },
          });
          return;
        }
        await open();
        return;
      }
      case 'POST /v1/auth/sign-in/challenge/authenticator-app':
      case 'POST /v1/auth/sign-in/federated/finish':
      case 'POST /v1/auth/sign-up/verification':
        await open();
        return;
      case 'POST /v1/auth/sign-in/federated/start':
        await route.fulfill({ json: { authorizationUrl: providerUrl } });
        return;
      case 'POST /v1/auth/sign-up':
      case 'POST /v1/auth/sign-in/code':
      case 'POST /v1/auth/password-reset':
        await route.fulfill({
          status: 202,
          json: {
            email,
            expiresAt: '2099-12-08T13:07:00Z',
            resendAvailableAt: '2099-12-08T13:07:00Z',
          },
        });
        return;
      case 'POST /v1/auth/password-reset/inspection':
        await route.fulfill({
          json: { email, expiresAt: '2099-12-08T13:07:00Z', sessionCount: 3 },
        });
        return;
      case 'POST /v1/auth/password-reset/confirmation':
        await route.fulfill({ json: { email, closedSessionCount: 3 } });
        return;
      case 'POST /v1/auth/sign-out':
        session = false;
        await route.fulfill({ status: 204 });
        return;
    }

    if (!session) {
      await route.fulfill(problem(401, 'auth.session-expired'));
      return;
    }
    switch (key) {
      case 'GET /v1/me':
        await route.fulfill({ json: user });
        return;
      case 'GET /v1/organizations':
        organizationLists += 1;
        if (options.unavailableOrganizations === true && organizationLists === 1) {
          await route.fulfill(problem(503, 'upstream.unavailable'));
          return;
        }
        await route.fulfill({ json: { items: [organization], nextCursor: null } });
        return;
      case 'GET /v1/me/invitations':
        await route.fulfill({ json: { items: [], nextCursor: null } });
        return;
      case 'PUT /v1/session/organization':
        selected = true;
        await route.fulfill({ json: { organizationId: organization.id, role: 'owner' } });
        return;
      case 'GET /v1/organization':
        if (!selected) {
          await route.fulfill(problem(403, 'organization.not-selected'));
          return;
        }
        await route.fulfill({
          json: {
            ...organization,
            description: null,
            website: null,
            defaultLanguage: 'en',
            createdAt: '2026-11-01T10:00:00Z',
            version: 1,
          },
        });
        return;
      default:
        await route.fulfill(problem(404, 'route.not-found'));
    }
  });

  return { calls, bodies };
}

/** Types a six-digit code into the code field and waits for the submit button. */
async function typeCode(page: Page, label: string | RegExp, code: string): Promise<void> {
  await page.getByLabel(label).first().click();
  await page.keyboard.type(code);
}

test('a protected screen sends a signed-out visitor to the sign-in page', async ({ page }) => {
  await stubGateway(page);

  await page.goto('/organizations');

  await expect(page).toHaveURL(/\/login\?next=%2Forganizations$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

// The only French in the specs: `?lang=fr` loads the French catalog at runtime.
test('?lang=fr serves the sign-in page in French', async ({ page }) => {
  await stubGateway(page);

  await page.goto('/login?lang=fr');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible();
});

test('sign-in with two-step verification, then the organization choice opens its workspace', async ({
  page,
}) => {
  const gateway = await stubGateway(page, { requireChallenge: true });

  await page.goto('/login');
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });
  // An empty form stays submittable: it shows its errors and focuses the first field.
  await submit.click();
  await expect(page.getByLabel('Email address')).toBeFocused();
  await expect(
    page.getByText(
      'Enter the email address of your account, for example camille.martin@ateliernord.fr.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  expect(gateway.calls).not.toContain('POST /v1/auth/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await submit.click();

  await expect(page).toHaveURL(/\/login\/two-step$/);
  await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  await typeCode(page, 'App code', '123456');
  await page.getByRole('button', { name: 'Verify (6 / 6)' }).click();

  await expect(page).toHaveURL(/\/organizations$/);
  await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible();
  await page.getByRole('button', { name: /Atelier Nord/ }).click();

  await expect(page).toHaveURL(/\/atelier-nord$/);
  expect(gateway.bodies.get('POST /v1/auth/sign-in/challenge/authenticator-app')).toEqual([
    { token: challengeToken, code: '123456', trustDevice: false },
  ]);
  expect(gateway.bodies.get('PUT /v1/session/organization')).toEqual([
    { organizationId: organization.id },
  ]);
});

test('a wrong password shows the attempts left before the lockout', async ({ page }) => {
  await stubGateway(page);

  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Wrong email or password.')).toBeVisible();
  await expect(
    page.getByText('You have 3 attempts left before the temporary lockout.'),
  ).toBeVisible();
  await expect(page.getByText('Wrong password: check the capital letters.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('an unavailable organization list offers Retry', async ({ page }) => {
  const gateway = await stubGateway(page, { signedIn: true, unavailableOrganizations: true });

  await page.goto('/organizations');

  await expect(page.getByText('This page could not be loaded')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: /Atelier Nord/ })).toBeVisible();
  expect(gateway.calls.filter((call: string) => call === 'GET /v1/organizations')).toHaveLength(2);
});

test('a provider sign-in starts at the gateway and continues once on return', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.route('https://oauth.provider.example/**', async (route: Route) => {
    const origin = new URL(page.url()).origin;
    await route.fulfill({
      status: 302,
      headers: { location: `${origin}/auth/federated/continue` },
    });
  });

  await page.goto('/login');
  await page.getByRole('button', { name: 'GitHub' }).click();

  await expect(page).toHaveURL(/\/organizations$/);
  expect(gateway.bodies.get('POST /v1/auth/sign-in/federated/start')).toEqual([
    { provider: 'github', rememberMe: true },
  ]);
  expect(gateway.bodies.get('POST /v1/auth/sign-in/federated/finish')).toEqual([{}]);
});

test('sign-up verifies the address with its code', async ({ page }) => {
  const gateway = await stubGateway(page);

  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Camille Martin');
  await page.getByLabel('Work email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('atelier-nord-2026');
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Create my account' }).click();

  await expect(page).toHaveURL(/\/signup\/verify$/);
  await expect(page.getByRole('heading', { name: 'Confirm your email address' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Resend the code in 0:/ })).toBeDisabled();
  await typeCode(page, 'Verification code', '654321');
  await page.getByRole('button', { name: 'Confirm my address' }).click();

  await expect(page).toHaveURL(/\/organizations$/);
  expect(gateway.bodies.get('POST /v1/auth/sign-up/verification')).toEqual([
    { email, code: '654321', password: 'atelier-nord-2026' },
  ]);
});

test('a forgotten password is reset from the e-mail link', async ({ page }) => {
  const gateway = await stubGateway(page);

  await page.goto('/forgot');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send the reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Resend the email in 0:4/ })).toBeDisabled();

  await page.goto('/reset#token=synthetic-reset-token');
  await expect(page.getByText(`For the account ${email}.`)).toBeVisible();
  await expect(page).toHaveURL(/\/reset$/);
  await page.getByLabel('New password').fill('Atelier-nord-2027');
  await page.getByLabel('Confirm the password').fill('Atelier-nord-2027');
  await page.getByRole('button', { name: 'Save the password' }).click();

  await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();
  await expect(page.getByText('Your 3 other sessions were closed.')).toBeVisible();
  expect(gateway.bodies.get('POST /v1/auth/password-reset/confirmation')).toEqual([
    { token: 'synthetic-reset-token', newPassword: 'Atelier-nord-2027', closeOtherSessions: true },
  ]);
});

test('the signed-out screen signs in again with a remembered account', async ({ page }) => {
  await stubGateway(page);
  await page.addInitScript((address: string) => {
    window.localStorage.setItem(
      'cadenway-remembered-accounts',
      JSON.stringify([{ name: 'Camille Martin', email: address }]),
    );
  }, email);

  await page.goto('/logged-out?reason=signed-out');
  await expect(page.getByRole('heading', { name: 'You are signed out' })).toBeVisible();
  await expect(page.getByText('See you soon, Camille.')).toBeVisible();
  await page.getByRole('button', { name: `Sign in with ${email}` }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  await expect(
    page.getByText('Account remembered on this device: enter its password.'),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
});

test('a protected workspace link opened signed out comes back after sign-in with its query', async ({
  page,
}) => {
  await stubGateway(page);

  await page.goto('/atelier-nord/missing/page?x=1');
  await expect(page).toHaveURL(/\/login\?next=%2Fatelier-nord%2Fmissing%2Fpage%3Fx%3D1$/u);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/atelier-nord\/missing\/page\?x=1$/u);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
