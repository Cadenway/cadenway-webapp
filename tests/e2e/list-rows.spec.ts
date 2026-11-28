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
const status = (name: string | null = null, hidden = false) => ({
  category: 'open',
  name,
  hidden,
});
const product = {
  id: '019a6000-0000-7000-8000-000000000001',
  name: 'Product',
  prefix: 'CAD',
  description: 'The Cadenway product.',
  icon: 'rocket',
  color: 'violet',
  visibility: 'organization',
  owner: { userId: user.id },
  statuses: {
    triage: status(null, true),
    backlog: status(),
    todo: status(),
    progress: status(),
    review: status(),
    testing: status(),
    waiting: status(),
    blocked: status(),
    done: status(),
    cancelled: status(),
  },
  nextKey: 'CAD-495',
  createdAt: '2026-01-05T10:00:00Z',
  version: 3,
};
const sprint14 = {
  id: '019a6000-0000-7000-8000-000000000101',
  spaceId: product.id,
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: {
    startDate: '2026-11-03',
    endDate: '2026-11-17',
    goal: 'Ship the SSO sign-in and the organization quotas page.',
  },
  createdAt: '2026-11-01T10:00:00Z',
  version: 4,
  callerRole: 'edit',
};
const counts = { total: 2, open: 2, done: 0, cancelled: 0, late: 0 };
const statusOrder = [
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
];

interface StubTask {
  key: string;
  name: string;
  status: string;
  version: number;
}

/** A task of Sprint 14 as the gateway answers it. */
function toTask(task: StubTask) {
  return {
    key: task.key,
    name: task.name,
    description: null,
    status: task.status,
    cancelReason: null,
    cancelNote: null,
    priority: 'haute',
    assignees: [{ userId: user.id }],
    dueDate: null,
    startDate: null,
    estimateMinutes: null,
    labels: ['Auth'],
    parentKey: null,
    listId: sprint14.id,
    spaceId: product.id,
    subtaskCounts: { total: 0, closed: 0 },
    checklist: [],
    checklistCounts: { total: 0, done: 0 },
    completedAt: null,
    createdAt: '2026-11-03T09:00:00Z',
    createdBy: { userId: user.id },
    updatedAt: '2026-11-08T09:00:00Z',
    version: task.version,
  };
}

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
  /** Bodies of the writes, in order. */
  readonly writes: { key: string; body: unknown }[];
}

function problem(statusCode: number, code: string) {
  return {
    status: statusCode,
    json: { type: 'about:blank', title: 'Never shown', status: statusCode, code },
  };
}

/** Stubs `config.json` and a gateway that keeps the tasks of Sprint 14 for a signed-in owner. */
async function stubGateway(page: Page): Promise<Gateway> {
  const calls: string[] = [];
  const writes: { key: string; body: unknown }[] = [];
  const tasks: StubTask[] = [
    { key: 'CAD-482', name: 'Redesign the SSO sign-in screen', status: 'todo', version: 3 },
    { key: 'CAD-483', name: 'Organization quotas page', status: 'todo', version: 2 },
  ];

  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push(key);
    const taskPatch = /^PATCH \/v1\/tasks\/(CAD-\d+)$/u.exec(key);
    if (taskPatch) {
      const body = request.postDataJSON() as { status: string };
      writes.push({ key, body });
      const task = tasks.find((item: StubTask) => item.key === taskPatch[1]);
      if (!task) return route.fulfill(problem(404, 'task.not-found'));
      task.status = body.status;
      task.version += 1;
      return route.fulfill({ json: toTask(task) });
    }
    switch (key) {
      case 'GET /v1/me':
        return route.fulfill({ json: user });
      case 'GET /v1/organization':
        return route.fulfill({
          json: {
            ...atelierNord,
            description: null,
            website: null,
            defaultLanguage: 'en',
            createdAt: '2026-11-01T10:00:00Z',
            version: 1,
          },
        });
      case 'GET /v1/organizations':
        return route.fulfill({ json: { items: [atelierNord], nextCursor: null } });
      case 'GET /v1/inbox/unread-count':
        return route.fulfill({ json: { unreadCount: 0 } });
      case 'GET /v1/reminders':
        return route.fulfill({ json: { items: [], nextCursor: null, pendingCount: 0 } });
      case 'GET /v1/billing/subscription':
        return route.fulfill({
          json: {
            plan: 'team',
            seats: { used: 18, limit: 25 },
            guestCount: 2,
            storage: { attachmentBytesUsed: 1_000_000, limitBytes: 100_000_000_000 },
          },
        });
      case 'GET /v1/spaces':
        return route.fulfill({ json: { items: [product], nextCursor: null } });
      case `GET /v1/spaces/${product.id}`:
        return route.fulfill({ json: product });
      case `GET /v1/spaces/${product.id}/lists`:
        return route.fulfill({ json: { items: [sprint14], nextCursor: null } });
      case `GET /v1/spaces/${product.id}/task-templates`:
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `GET /v1/spaces/${product.id}/overview`:
        return route.fulfill({
          json: {
            spaceId: product.id,
            listCount: 1,
            taskCount: tasks.length,
            items: [{ list: sprint14, counts }],
            nextCursor: null,
          },
        });
      case `GET /v1/spaces/${product.id}/milestones`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case 'GET /v1/me/favorites':
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `GET /v1/lists/${sprint14.id}`:
        return route.fulfill({ json: sprint14 });
      case `GET /v1/lists/${sprint14.id}/counts`:
        return route.fulfill({ json: { list: sprint14, counts } });
      case `GET /v1/lists/${sprint14.id}/grants`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `GET /v1/lists/${sprint14.id}/saved-views`:
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `GET /v1/lists/${sprint14.id}/task-groups`:
        return route.fulfill({
          json: {
            groupBy: 'status',
            items: statusOrder.map((value: string) => ({
              value,
              count: tasks.filter((task: StubTask) => task.status === value).length,
            })),
            nextCursor: null,
            total: tasks.length,
          },
        });
      case `QUERY /v1/lists/${sprint14.id}/tasks`: {
        const body = request.postDataJSON() as { status?: string[]; milestone?: boolean };
        if (body.milestone)
          return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
        const items = tasks
          .filter((task: StubTask) => !body.status || body.status.includes(task.status))
          .map(toTask);
        return route.fulfill({ json: { items, nextCursor: null, total: items.length } });
      }
      case `POST /v1/lists/${sprint14.id}/tasks`: {
        const body = request.postDataJSON() as { name: string; status?: string };
        writes.push({ key, body });
        const created: StubTask = {
          key: 'CAD-495',
          name: body.name,
          status: body.status ?? 'todo',
          version: 1,
        };
        tasks.push(created);
        return route.fulfill({ status: 201, json: toTask(created) });
      }
      case 'POST /v1/tasks/bulk-actions': {
        const body = request.postDataJSON() as {
          selection: { taskKey: string }[];
          action: { type: string; status?: string };
        };
        writes.push({ key, body });
        for (const item of body.selection) {
          const task = tasks.find((entry: StubTask) => entry.key === item.taskKey);
          if (task && body.action.status) {
            task.status = body.action.status;
            task.version += 1;
          }
        }
        return route.fulfill({
          json: {
            results: body.selection.map((item: { taskKey: string }) => ({ taskKey: item.taskKey })),
            affectedCount: body.selection.length,
          },
        });
      }
      case 'GET /v1/members':
        return route.fulfill({
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
      case 'GET /v1/labels':
        return route.fulfill({ json: { items: [{ name: 'Auth' }], nextCursor: null } });
      default:
        return route.fulfill(problem(404, 'route.not-found'));
    }
  });

  return { calls, writes };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
});

test('the list view shows the rows of Sprint 14 under their status', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}/list`);

  const grid = page.getByRole('grid', { name: 'Tasks of the list Sprint 14' });
  await expect(grid).toBeVisible();
  await expect(grid.getByText('Redesign the SSO sign-in screen')).toBeVisible();
  await expect(grid.getByText('Organization quotas page')).toBeVisible();
  await expect(grid.getByRole('button', { name: /Redesign the SSO sign-in screen/ })).toBeVisible();
  expect(gateway.calls).toContain(`GET /v1/lists/${sprint14.id}/task-groups`);
  expect(gateway.calls).toContain(`QUERY /v1/lists/${sprint14.id}/tasks`);
});

test('the row status icon opens the task without changing its status', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}/list`);
  const grid = page.getByRole('grid', { name: 'Tasks of the list Sprint 14' });
  await grid
    .getByRole('button', { name: /Redesign the SSO sign-in screen/ })
    .locator('cw-status-icon')
    .click();
  await expect(page).toHaveURL(/task=CAD-482/);
  expect(gateway.writes).toEqual([]);
});

test('Create a task creates in the list and the row shows', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}/list`);
  const grid = page.getByRole('grid', { name: 'Tasks of the list Sprint 14' });
  await expect(grid.getByText('Redesign the SSO sign-in screen')).toBeVisible();

  await page.getByTestId('view-create-task').click();
  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await expect(dialog.getByTestId('task-create-destination')).toContainText('Sprint 14');
  await dialog.getByPlaceholder('Task name').fill('Prepare the sprint demo');
  await dialog.getByRole('button', { name: /Create the task/ }).click();

  await expect(dialog).toBeHidden();
  await expect(grid.getByText('Prepare the sprint demo')).toBeVisible();
  expect(gateway.calls).toContain(`POST /v1/lists/${sprint14.id}/tasks`);
});

test('the selection marks its tasks done through the bulk action', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}/list`);
  const grid = page.getByRole('grid', { name: 'Tasks of the list Sprint 14' });
  await expect(grid.getByText('Redesign the SSO sign-in screen')).toBeVisible();

  await grid.getByRole('checkbox', { name: 'Select CAD-482' }).click();
  await grid.getByRole('checkbox', { name: 'Select CAD-483' }).click();
  const bar = page.getByTestId('bulk-bar');
  await expect(bar).toContainText('2 selected');
  await bar.getByRole('button', { name: 'Mark done' }).click();

  await expect(
    page.getByRole('region', { name: 'Notifications (F8)' }).getByText('2 tasks done'),
  ).toBeVisible();
  await expect(bar).toBeHidden();
  expect(gateway.writes).toContainEqual({
    key: 'POST /v1/tasks/bulk-actions',
    body: {
      selection: [
        { taskKey: 'CAD-482', version: 3 },
        { taskKey: 'CAD-483', version: 2 },
      ],
      action: { type: 'status', status: 'done' },
    },
  });
});
