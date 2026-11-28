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
  nextKey: 'CAD-500',
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
const bugs = {
  ...sprint14,
  id: '019a6000-0000-7000-8000-000000000102',
  name: 'Bugs',
  icon: 'bug',
  color: 'rouge',
  sprint: null,
};
const counts = { total: 12, open: 9, done: 3, cancelled: 0, late: 1 };

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
}

function problem(status: number, code: string) {
  return { status, json: { type: 'about:blank', title: 'Never shown', status, code } };
}

/**
 * Stubs `config.json` and the gateway for a signed-in owner of Atelier Nord with one space;
 * `slowGrants` answers the list's grants after the member directory.
 */
async function stubGateway(page: Page, failListOnce = false, slowGrants = false): Promise<Gateway> {
  const calls: string[] = [];
  const savedViews: Record<string, unknown>[] = [];

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
      case `GET /v1/spaces/${product.id}/overview`:
        return route.fulfill({
          json: {
            spaceId: product.id,
            listCount: 2,
            taskCount: 15,
            items: [
              { list: sprint14, counts },
              { list: bugs, counts: { total: 3, open: 3, done: 0, cancelled: 0, late: 0 } },
            ],
            nextCursor: null,
          },
        });
      case `GET /v1/spaces/${product.id}/milestones`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `GET /v1/lists/${sprint14.id}`:
        if (failListOnce) {
          failListOnce = false;
          return route.fulfill(problem(503, 'service.unavailable'));
        }
        return route.fulfill({ json: sprint14 });
      case `DELETE /v1/lists/${sprint14.id}`:
        return route.fulfill({ status: 204 });
      case `GET /v1/lists/${sprint14.id}/counts`:
        return route.fulfill({ json: { list: sprint14, counts } });
      case `GET /v1/lists/${sprint14.id}/grants`:
        if (slowGrants) await new Promise((resolve) => setTimeout(resolve, 400));
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `GET /v1/lists/${sprint14.id}/task-groups`:
        return route.fulfill({
          json: {
            groupBy: url.searchParams.get('groupBy') ?? 'status',
            items: [],
            nextCursor: null,
            total: 0,
          },
        });
      case `QUERY /v1/lists/${sprint14.id}/tasks`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 1 } });
      case 'GET /v1/members':
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case 'GET /v1/labels':
        return route.fulfill({
          json: { items: [{ name: 'Auth' }, { name: 'Front' }], nextCursor: null },
        });
      case `GET /v1/lists/${sprint14.id}/saved-views`:
        return route.fulfill({ json: { items: savedViews, nextCursor: null } });
      case `POST /v1/lists/${sprint14.id}/saved-views`: {
        const body = request.postDataJSON() as Record<string, unknown>;
        const view = {
          id: '019a6000-0000-7000-8000-000000000201',
          listId: sprint14.id,
          createdAt: '2026-11-08T09:00:00Z',
          updatedAt: '2026-11-08T09:00:00Z',
          version: 1,
          ...body,
        };
        savedViews.push(view);
        return route.fulfill({ status: 201, json: view });
      }
      default:
        return route.fulfill(workspaceRead(key) ?? problem(404, 'route.not-found'));
    }
  });

  return { calls };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
});

test('the sidebar lists the spaces with their lists', async ({ page }) => {
  await stubGateway(page);
  await page.goto('atelier-nord');

  const spaces = page.getByTestId('sidebar-spaces');
  const space = spaces.getByRole('button', { name: /^Product/ });
  await expect(space).toHaveAttribute('aria-expanded', 'false');
  await space.click();
  await expect(space).toHaveAttribute('aria-expanded', 'true');
  await expect(spaces.getByRole('link', { name: /Sprint 14/ })).toBeVisible();
  await expect(spaces.getByRole('link', { name: /Bugs/ })).toBeVisible();
});

test('the space overview opens with its list cards', async ({ page }) => {
  await stubGateway(page);
  await page.goto(`atelier-nord/spaces/${product.id}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Product' })).toBeVisible();
  await expect(page.getByTestId('space-meta')).toContainText('2 lists');
  const card = page.getByRole('link', { name: /Sprint 14/ }).last();
  await expect(card).toContainText('12 tasks');
  await expect(card).toContainText('3 / 12 done');
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/atelier-nord/l/${sprint14.id}/list$`));
});

test('a list page shows its header, its filters and its group menu', async ({ page }) => {
  await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}`);

  await expect(page).toHaveURL(new RegExp(`/l/${sprint14.id}/list$`));
  await expect(page.getByTestId('list-description')).toContainText(/Sprint of .*3 – .*17/u);
  await expect(page.getByTestId('list-description')).toContainText('12 tasks');
  await expect(page.getByTestId('list-description')).toContainText('25% done');
  await expect(page.getByTestId('list-goal')).toContainText('Ship the SSO sign-in');

  await page
    .getByRole('toolbar', { name: 'View tools' })
    .getByRole('button', { name: 'Filter' })
    .click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await expect(
    filters.getByRole('group', { name: 'Status' }).getByRole('checkbox', { name: 'To do' }),
  ).toBeVisible();
  const assignee = filters.getByRole('group', { name: 'Assignee' });
  await expect(assignee.getByRole('checkbox', { name: 'Me' })).toBeVisible();
  await expect(assignee.getByRole('checkbox', { name: 'Unassigned' })).toBeVisible();
  await filters
    .getByRole('group', { name: 'Priority' })
    .getByRole('checkbox', { name: 'Urgent' })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('view-chip')).toContainText('Priority');

  await page.getByRole('button', { name: /Group:/ }).click();
  const group = page.getByRole('menu', { name: 'Group' });
  await expect(group.getByRole('menuitemradio', { name: 'Status' })).toBeVisible();
  await group.getByRole('menuitemradio', { name: 'Priority' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Group:/ })).toContainText('Group: priority');
});

test('a saved view saves and reopens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}`);
  await expect(page.getByTestId('list-description')).toBeVisible();

  await page.getByRole('button', { name: /Group:/ }).click();
  await page
    .getByRole('menu', { name: 'Group' })
    .getByRole('menuitemradio', { name: 'Assignee' })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save the view' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save the view' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Name' }).fill('By person');
  await dialog.getByRole('button', { name: 'Save the view' }).click();

  await expect(page.getByRole('tab', { name: 'By person' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page).toHaveURL(/savedView=/);
  await expect(dialog).toHaveCount(0);
  expect(gateway.calls).toContain(`POST /v1/lists/${sprint14.id}/saved-views`);

  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page).not.toHaveURL(/savedView=/);
  await expect(page.getByRole('button', { name: /Group:/ })).toContainText('Group: status');

  await page.getByRole('tab', { name: 'By person' }).click();
  await expect(page).toHaveURL(/savedView=/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Group:/ })).toContainText('Group: assignee');
  await expect(page.getByRole('tab', { name: 'By person' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(errors).toEqual([]);
});

test('a failed list read can be retried', async ({ page }) => {
  const gateway = await stubGateway(page, true);
  await page.goto(`atelier-nord/l/${sprint14.id}`);
  await expect(page.getByRole('heading', { name: 'Could not load this page' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Sprint 14' })).toBeVisible();
  expect(gateway.calls.filter((call) => call === `GET /v1/lists/${sprint14.id}`)).toHaveLength(2);
});

test('deleting a list needs its typed name', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/l/${sprint14.id}`);
  await expect(page.getByTestId('list-description')).toBeVisible();

  await page.getByRole('button', { name: 'More actions on the list' }).click();
  await page.getByRole('menuitem', { name: 'Delete the list' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete the list “Sprint 14”?' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Delete the list' });
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');

  await dialog.getByRole('textbox').fill('Sprint');
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');
  await dialog.getByRole('textbox').fill('Sprint 14');
  await confirm.click();

  await expect(page).toHaveURL(/\/atelier-nord$/);
  expect(gateway.calls).toContain(`DELETE /v1/lists/${sprint14.id}`);
});

/** How many times the gateway received a request, as `METHOD /path`. */
function count(gateway: Gateway, key: string): number {
  return gateway.calls.filter((call) => call === key).length;
}

test('the settings shell reads neither the overviews nor the counts of the absent sidebar', async ({
  page,
}) => {
  const gateway = await stubGateway(page);
  await page.goto('atelier-nord/account/profile');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(count(gateway, 'GET /v1/spaces')).toBe(1);
  expect(count(gateway, 'GET /v1/me/favorites')).toBe(1);
  expect(count(gateway, `GET /v1/spaces/${product.id}/overview`)).toBe(0);
  expect(count(gateway, 'GET /v1/trash/entries')).toBe(0);
  expect(count(gateway, 'GET /v1/archives/lists')).toBe(0);
  expect(count(gateway, 'GET /v1/archives/tasks')).toBe(0);
});

test('a full load of the space overview reads its overview once', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`atelier-nord/spaces/${product.id}`);
  await expect(page.getByTestId('space-meta')).toContainText('2 lists');
  await page.waitForLoadState('networkidle');

  expect(count(gateway, `GET /v1/spaces/${product.id}/overview`)).toBe(1);
});

test('a list page reads the member directory once when the grants answer last', async ({
  page,
}) => {
  const gateway = await stubGateway(page, false, true);
  await page.goto(`atelier-nord/l/${sprint14.id}/list`);
  await expect(page.getByTestId('list-description')).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(count(gateway, `GET /v1/lists/${sprint14.id}/grants`)).toBe(1);
  expect(count(gateway, 'GET /v1/members')).toBe(1);
});
