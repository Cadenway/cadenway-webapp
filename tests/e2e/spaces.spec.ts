import { expect, test } from '@playwright/test';
import type { Page, Request, Route } from '@playwright/test';

const user = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
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
const produit = {
  id: '019a6000-0000-7000-8000-000000000001',
  name: 'Produit',
  prefix: 'CAD',
  description: 'Le produit Cadenway.',
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
  spaceId: produit.id,
  name: 'Sprint 14',
  icon: 'lightning',
  color: 'violet',
  sprint: {
    startDate: '2026-11-03',
    endDate: '2026-11-17',
    goal: 'Livrer la connexion SSO et la page des quotas d’organisation.',
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

/** Stubs `config.json` and the gateway for a signed-in owner of Atelier Nord with one space. */
async function stubGateway(page: Page): Promise<Gateway> {
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
            defaultLanguage: 'fr',
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
        return route.fulfill({ json: { items: [produit], nextCursor: null } });
      case `GET /v1/spaces/${produit.id}`:
        return route.fulfill({ json: produit });
      case `GET /v1/spaces/${produit.id}/overview`:
        return route.fulfill({
          json: {
            spaceId: produit.id,
            listCount: 2,
            taskCount: 15,
            items: [
              { list: sprint14, counts },
              { list: bugs, counts: { total: 3, open: 3, done: 0, cancelled: 0, late: 0 } },
            ],
            nextCursor: null,
          },
        });
      case `GET /v1/spaces/${produit.id}/milestones`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case 'GET /v1/me/favorites':
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `GET /v1/lists/${sprint14.id}`:
        return route.fulfill({ json: sprint14 });
      case `DELETE /v1/lists/${sprint14.id}`:
        return route.fulfill({ status: 204 });
      case `GET /v1/lists/${sprint14.id}/counts`:
        return route.fulfill({ json: { list: sprint14, counts } });
      case `GET /v1/lists/${sprint14.id}/grants`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `QUERY /v1/lists/${sprint14.id}/tasks`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 1 } });
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
        return route.fulfill(problem(404, 'route.not-found'));
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
  await page.goto('/atelier-nord');

  const spaces = page.getByTestId('sidebar-spaces');
  await expect(spaces.getByRole('button', { name: /Produit/ })).toBeVisible();
  await spaces.getByRole('button', { name: /Produit/ }).click();
  await expect(spaces.getByRole('link', { name: /Sprint 14/ })).toBeVisible();
  await expect(spaces.getByRole('link', { name: /Bugs/ })).toBeVisible();
});

test('the space overview opens with its list cards', async ({ page }) => {
  await stubGateway(page);
  await page.goto(`/atelier-nord/spaces/${produit.id}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Produit' })).toBeVisible();
  await expect(page.getByTestId('space-meta')).toContainText('2 listes');
  const card = page.getByTestId('list-card').filter({ hasText: 'Sprint 14' });
  await expect(card).toContainText('12 tâches');
  await expect(card).toContainText('3 / 12 terminées');
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/atelier-nord/l/${sprint14.id}/list$`));
});

test('a list page shows its header, its filters and its group menu', async ({ page }) => {
  await stubGateway(page);
  await page.goto(`/atelier-nord/l/${sprint14.id}`);

  await expect(page).toHaveURL(new RegExp(`/l/${sprint14.id}/list$`));
  await expect(page.getByTestId('list-description')).toContainText('Sprint du 3 – 17 nov.');
  await expect(page.getByTestId('list-description')).toContainText('12 tâches');
  await expect(page.getByTestId('list-description')).toContainText('25 % terminé');
  await expect(page.getByTestId('list-goal')).toContainText('Livrer la connexion SSO');

  await page.getByTestId('view-filter').click();
  const filters = page.getByRole('dialog', { name: 'Filtres' });
  await expect(filters.getByText('À faire')).toBeVisible();
  await expect(filters.getByText('Moi')).toBeVisible();
  await expect(filters.getByText('Non assigné')).toBeVisible();
  await filters.getByText('Urgente').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('view-chip')).toContainText('Priorité');

  await page.getByTestId('view-group').click();
  const group = page.getByRole('menu', { name: 'Grouper' });
  await expect(group.getByRole('menuitemradio', { name: 'Statut' })).toBeVisible();
  await group.getByRole('menuitemradio', { name: 'Priorité' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('view-group')).toContainText('Grouper : priorité');
});

test('a saved view saves and reopens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  const gateway = await stubGateway(page);
  await page.goto(`/atelier-nord/l/${sprint14.id}`);
  await expect(page.getByTestId('list-description')).toBeVisible();

  await page.getByTestId('view-group').click();
  await page
    .getByRole('menu', { name: 'Grouper' })
    .getByRole('menuitemradio', { name: 'Assigné' })
    .click();
  await page.keyboard.press('Escape');
  await page.getByTestId('view-save').click();
  const dialog = page.getByRole('dialog', { name: 'Enregistrer la vue' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('save-view-name').fill('Par personne');
  await page.getByTestId('save-view-submit').click();

  await expect(page.getByTestId('saved-view-tab')).toContainText('Par personne');
  await expect(page).toHaveURL(/savedView=/);
  await expect(dialog).toHaveCount(0);
  expect(gateway.calls).toContain(`POST /v1/lists/${sprint14.id}/saved-views`);

  await page.getByRole('tab', { name: 'Liste' }).click();
  await expect(page).not.toHaveURL(/savedView=/);
  await expect(page.getByTestId('view-group')).toContainText('Grouper : statut');

  await page.getByTestId('saved-view-tab').click();
  await expect(page).toHaveURL(/savedView=/);
  await page.reload();
  await expect(page.getByTestId('view-group')).toContainText('Grouper : assigné');
  await expect(page.getByTestId('saved-view-tab')).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('deleting a list needs its typed name', async ({ page }) => {
  const gateway = await stubGateway(page);
  await page.goto(`/atelier-nord/l/${sprint14.id}`);
  await expect(page.getByTestId('list-description')).toBeVisible();

  await page.getByTestId('list-more').click();
  await page.getByTestId('list-delete').click();
  const dialog = page.getByRole('alertdialog', { name: 'Supprimer la liste « Sprint 14 » ?' });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByTestId('list-delete-confirm');
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');

  await dialog.getByRole('textbox').fill('Sprint');
  await expect(confirm).toHaveAttribute('aria-disabled', 'true');
  await dialog.getByRole('textbox').fill('Sprint 14');
  await confirm.click();

  await expect(page).toHaveURL(/\/atelier-nord$/);
  expect(gateway.calls).toContain(`DELETE /v1/lists/${sprint14.id}`);
});
