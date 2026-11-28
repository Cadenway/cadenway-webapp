import { expect, test } from '@playwright/test';
import type { Page, Request, Route } from '@playwright/test';

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
const atelierNord = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'team',
  joinedAt: '2026-11-01T10:00:00Z',
};
const lumen = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1c40',
  name: 'Lumen Cooperative',
  slug: 'lumen',
  role: 'member',
  memberCount: 42,
  plan: 'enterprise',
  joinedAt: '2026-10-01T10:00:00Z',
};
const mention = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e11',
  kind: 'mention',
  actor: { userId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02', name: 'Nora Robert' },
  task: { taskKey: 'CAD-482', name: 'SSO flow review' },
  excerpt: '@Camille can you review the SSO flow before the Thursday demo?',
  status: null,
  createdAt: '2026-11-08T08:48:00Z',
  archivedAt: null,
  version: 1,
};

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
}

function problem(status: number, code: string) {
  return { status, json: { type: 'about:blank', title: 'Never shown', status, code } };
}

/** Stubs `config.json` and every `/v1/**` route the workspace shell calls, for a signed-in owner. */
async function stubGateway(page: Page): Promise<Gateway> {
  const calls: string[] = [];
  let session = true;
  let current: typeof atelierNord | typeof lumen = atelierNord;
  let read = false;

  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push(key);
    if (key === 'POST /v1/auth/sign-out') {
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
      case 'GET /v1/organization':
        await route.fulfill({
          json: {
            ...current,
            description: null,
            website: null,
            defaultLanguage: 'en',
            createdAt: '2026-11-01T10:00:00Z',
            version: 1,
          },
        });
        return;
      case 'GET /v1/organizations':
        await route.fulfill({ json: { items: [atelierNord, lumen], nextCursor: null } });
        return;
      case 'PUT /v1/session/organization': {
        const { organizationId } = request.postDataJSON() as { organizationId: string };
        current = organizationId === lumen.id ? lumen : atelierNord;
        await route.fulfill({ json: { organizationId, role: current.role } });
        return;
      }
      case 'GET /v1/inbox/unread-count':
        await route.fulfill({ json: { unreadCount: read ? 0 : 1 } });
        return;
      case 'GET /v1/inbox/notifications':
        await route.fulfill({
          json: {
            items: [{ ...mention, readAt: read ? '2026-11-08T09:00:00Z' : null }],
            nextCursor: null,
            unreadCount: read ? 0 : 1,
          },
        });
        return;
      case 'POST /v1/inbox/notifications/read-all':
        read = true;
        await route.fulfill({ json: { markedRead: 1, unreadCount: 0 } });
        return;
      case 'GET /v1/reminders':
        await route.fulfill({ json: { items: [], nextCursor: null, pendingCount: 0 } });
        return;
      case 'GET /v1/billing/subscription':
        await route.fulfill({
          json: {
            plan: 'team',
            seats: { used: 18, limit: 25 },
            guestCount: 2,
            storage: { attachmentBytesUsed: 92_400_000_000, limitBytes: 100_000_000_000 },
          },
        });
        return;
      case 'GET /v1/search':
        await route.fulfill({
          json: {
            items:
              url.searchParams.get('q') === 'sso'
                ? [
                    {
                      kind: 'task',
                      taskKey: 'CAD-482',
                      name: 'SSO flow review',
                      status: 'review',
                    },
                  ]
                : [],
            nextCursor: null,
          },
        });
        return;
      default:
        await route.fulfill(workspaceRead(key) ?? problem(404, 'route.not-found'));
    }
  });

  return { calls };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
});

test('the shell renders its rail, sidebar and banner', async ({ page }) => {
  const gateway = await stubGateway(page);

  await page.goto('/atelier-nord');

  const rail = page.getByRole('navigation', { name: 'Applications' });
  await expect(rail.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await expect(rail.getByRole('button', { name: /Inbox/ })).toBeVisible();
  await expect(rail.getByRole('button', { name: /Search/ })).toBeVisible();
  await expect(
    rail.getByRole('button', { name: 'Account of Camille Martin', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team plan · 18 / 25 seats' })).toBeVisible();
  await expect(page.getByText('Storage nearly full')).toBeVisible();
  expect(gateway.calls.filter((call) => call === 'GET /v1/billing/subscription')).toHaveLength(1);
});

test('Ctrl K opens the palette and a search shows its results', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto('/atelier-nord');
  await expect(page.getByRole('heading', { name: 'Hello Camille' })).toBeVisible();

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByText('Enter', { exact: true })).toBeVisible();
  await palette.getByRole('combobox').fill('sso');

  await expect(palette.getByRole('option', { name: /SSO flow review/ })).toBeVisible();
  expect(gateway.calls).toContain('GET /v1/search');
  await palette.getByRole('combobox').fill('nowhere');
  await expect(palette.getByText('No results for “nowhere”.')).toBeVisible();
});

test('the inbox marks everything read and its badge clears', async ({ page }) => {
  await stubGateway(page);
  await page.goto('/atelier-nord');
  const inbox = page.getByTestId('inbox-rail-item');
  await expect(inbox).toContainText('1');

  await inbox.click();
  const popover = page.getByTestId('inbox-popover');
  await expect(popover.getByText('Nora Robert')).toBeVisible();
  await expect(inbox).toHaveAttribute('aria-expanded', 'true');
  const tint = (element: Element): string[] => {
    const style: CSSStyleDeclaration = getComputedStyle(element);
    return [style.backgroundColor, style.color];
  };
  const current: string[] = await page
    .getByRole('navigation')
    .locator('[aria-current="page"]')
    .first()
    .evaluate(tint);
  await expect.poll(() => inbox.evaluate(tint)).toEqual(current);
  await expect(popover.getByRole('img', { name: 'Unread' })).toBeVisible();
  await popover.getByRole('button', { name: 'Mark all as read' }).click();

  await expect(popover.getByRole('img', { name: 'Unread' })).toHaveCount(0);
  await expect(popover.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  await expect(inbox).not.toContainText('1');
});

test('the account menu signs out to the signed-out screen', async ({ page }) => {
  await stubGateway(page);
  await page.goto('/atelier-nord');

  await page.getByRole('button', { name: /Account of Camille Martin/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/logged-out\?reason=signed-out$/);
  await expect(page.getByRole('heading', { name: 'You are signed out' })).toBeVisible();
});

test('the question mark key opens the keyboard shortcuts', async ({ page }) => {
  await stubGateway(page);
  await page.goto('/atelier-nord');
  await expect(page.getByRole('heading', { name: 'Hello Camille' })).toBeVisible();

  await page.keyboard.press('?');

  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Everywhere' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Editing' })).toBeVisible();
});

test('the organizations menu switches to another organization', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto('/atelier-nord');

  await page.getByRole('button', { name: 'Switch organization: Atelier Nord' }).click();
  await expect(page.getByRole('menuitemradio', { name: /Atelier Nord/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: /Lumen Cooperative/ }).click();

  await expect(page).toHaveURL(/\/lumen$/);
  await expect(
    page.getByRole('button', { name: 'Switch organization: Lumen Cooperative' }),
  ).toBeVisible();
  expect(gateway.calls).toContain('PUT /v1/session/organization');
});
