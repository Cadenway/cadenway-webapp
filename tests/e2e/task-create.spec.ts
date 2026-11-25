import { expect, test } from '@playwright/test';
import type { Page, Request, Route } from '@playwright/test';

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
const statusKeys = [
  ['triage', 'open'],
  ['backlog', 'open'],
  ['todo', 'open'],
  ['progress', 'active'],
  ['review', 'active'],
  ['testing', 'active'],
  ['waiting', 'active'],
  ['blocked', 'active'],
  ['done', 'closed'],
  ['cancelled', 'closed'],
] as const;
const product = {
  id: 'product',
  name: 'Product',
  prefix: 'CAD',
  description: null,
  icon: null,
  color: 'violet',
  visibility: 'organization',
  owner: { userId: user.id },
  statuses: Object.fromEntries(
    statusKeys.map(([key, category]) => [key, { category, name: null, hidden: false }]),
  ),
  nextKey: 'CAD-495',
  createdAt: '2026-11-01T10:00:00Z',
  version: 1,
};
const sprint14 = {
  id: 'sprint-14',
  spaceId: 'product',
  name: 'Sprint 14',
  icon: null,
  color: 'violet',
  sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: null },
  createdAt: '2026-11-03T10:00:00Z',
  version: 1,
};

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
  /** Bodies and idempotency keys of the creations. */
  readonly creations: { body: unknown; key: string | null }[];
}

function problem(status: number, code: string) {
  return { status, json: { type: 'about:blank', title: 'Never shown', status, code } };
}

/** Stubs `config.json` and the `/v1/**` routes of the shell and of the create dialog. */
async function stubGateway(page: Page): Promise<Gateway> {
  const calls: string[] = [];
  const creations: { body: unknown; key: string | null }[] = [];

  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push(key);
    switch (key) {
      case 'GET /v1/me':
        await route.fulfill({ json: user });
        return;
      case 'GET /v1/organization':
        await route.fulfill({
          json: {
            ...atelierNord,
            description: null,
            website: null,
            defaultLanguage: 'en',
            createdAt: '2026-11-01T10:00:00Z',
            version: 1,
          },
        });
        return;
      case 'GET /v1/organizations':
        await route.fulfill({ json: { items: [atelierNord], nextCursor: null } });
        return;
      case 'GET /v1/inbox/unread-count':
        await route.fulfill({ json: { unreadCount: 0 } });
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
            storage: { attachmentBytesUsed: 1_000_000, limitBytes: 100_000_000_000 },
          },
        });
        return;
      case 'GET /v1/spaces':
        await route.fulfill({ json: { items: [product], nextCursor: null } });
        return;
      case 'GET /v1/spaces/product':
        await route.fulfill({ json: product });
        return;
      case 'GET /v1/spaces/product/lists':
        await route.fulfill({ json: { items: [sprint14], nextCursor: null } });
        return;
      case 'GET /v1/spaces/product/task-templates':
        await route.fulfill({ json: { items: [], nextCursor: null } });
        return;
      case 'GET /v1/members':
        await route.fulfill({
          json: {
            items: [
              {
                id: 'm1',
                userId: user.id,
                name: user.name,
                email: user.email,
                role: 'owner',
                joinedAt: '2026-11-01T10:00:00Z',
                version: 1,
              },
            ],
            nextCursor: null,
            total: 1,
            counts: { owner: 1, admin: 0, member: 0, guest: 0 },
          },
        });
        return;
      case 'GET /v1/labels':
        await route.fulfill({ json: { items: [{ name: 'Front' }], nextCursor: null } });
        return;
      case 'POST /v1/lists/sprint-14/tasks': {
        const body = request.postDataJSON() as { name: string; status?: string };
        creations.push({ body, key: request.headers()['idempotency-key'] ?? null });
        await route.fulfill({
          status: 201,
          json: {
            key: 'CAD-495',
            name: body.name,
            description: null,
            status: body.status ?? 'todo',
            cancelReason: null,
            cancelNote: null,
            priority: 'moyenne',
            assignees: [{ userId: user.id }],
            dueDate: null,
            startDate: null,
            estimateMinutes: null,
            labels: [],
            parentKey: null,
            listId: 'sprint-14',
            spaceId: 'product',
            subtaskCounts: { total: 0, closed: 0 },
            checklist: [],
            checklistCounts: { total: 0, done: 0 },
            completedAt: null,
            createdAt: '2026-11-08T09:00:00Z',
            createdBy: { userId: user.id },
            updatedAt: '2026-11-08T09:00:00Z',
            version: 1,
          },
        });
        return;
      }
      default:
        await route.fulfill(problem(404, 'route.not-found'));
    }
  });

  return { calls, creations };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
});

test('N opens the create dialog, a task is created and the toast offers Open', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto('/atelier-nord');
  await expect(page.getByRole('heading', { name: 'Hello Camille' })).toBeVisible();

  await page.keyboard.press('n');

  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('task-create-destination')).toContainText('Sprint 14');
  await expect(dialog.getByTestId('task-create-next-key')).toHaveText('CAD-495');
  await expect(dialog.getByRole('button', { name: /Create the task/ })).toBeDisabled();

  await dialog.getByPlaceholder('Task name').fill('Prepare the sprint demo');
  await dialog.getByRole('button', { name: /Create the task/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Task CAD-495 created')).toBeVisible();
  await expect(page.getByText('Sprint 14 · To do.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open' })).toBeVisible();
  expect(gateway.calls).toContain('POST /v1/lists/sprint-14/tasks');
  expect(gateway.creations[0].body).toMatchObject({
    name: 'Prepare the sprint demo',
    status: 'todo',
    priority: 'moyenne',
    assigneeIds: [user.id],
  });
  expect(gateway.creations[0].key).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/atelier-nord\/t\/CAD-495$/);
});

test('Escape closes an open menu first, then the dialog', async ({ page }) => {
  await stubGateway(page);
  await page.goto('/atelier-nord');
  await expect(page.getByRole('heading', { name: 'Hello Camille' })).toBeVisible();
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: /Priority: Medium/ }).click();
  await expect(page.getByRole('menu', { name: 'Priority' })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu', { name: 'Priority' })).toBeHidden();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
