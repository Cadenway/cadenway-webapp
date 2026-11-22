import { expect, test } from '@playwright/test';

const entryId = '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01';
const childKey = 'CAD-453';
const rootKey = 'CAD-452';
const childName = 'Écran ancien sur mobile';

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin, realtimeUrl: origin } });
  });
  await page.route('**/v1/organization', async (route) => {
    await route.fulfill({
      json: {
        id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
        name: 'Atelier Nord',
        slug: 'atelier-nord',
        role: 'owner',
        memberCount: 5,
        plan: 'free',
        joinedAt: '2026-11-01T10:00:00Z',
      },
    });
  });
});

test('restoring a deleted subtask uses its entry and reopens the same task', async ({ page }) => {
  let restoreAttempts = 0;
  let finishRestore!: () => void;
  const restoreReady = new Promise<void>((resolve) => {
    finishRestore = resolve;
  });
  await page.route(`**/v1/tasks/${childKey}/detail`, async (route) => {
    if (restoreAttempts < 2) {
      await route.fulfill({
        status: 404,
        json: {
          type: 'about:blank',
          title: 'Cette tâche a été supprimée',
          status: 404,
          code: 'task.trashed',
          details: {
            key: childKey,
            name: childName,
            entryId,
            rootKey,
            trashedAt: '2026-11-06T16:20:00Z',
            trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
            purgeAt: '2026-12-06T16:20:00Z',
          },
        },
      });
      return;
    }

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
      ].map((status) => [status, { category: 'active', name: null, hidden: false }]),
    );
    await route.fulfill({
      json: {
        task: { key: childKey, name: childName, status: 'todo', version: 4, archivedAt: null },
        space: { id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31', name: 'Produit', statuses },
        list: { id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32', name: 'Sprint 14', callerRole: 'edit' },
        parent: { key: rootKey, name: 'Ancien écran de connexion' },
        subtasks: [],
        partial: [],
      },
    });
  });
  await page.route(/\/v1\/trash\/entries\/[^/]+\/restore(?:\?|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(url.pathname).toBe(`/v1/trash/entries/${entryId}/restore`);
    expect(url.searchParams.get('reportNotReady')).toBe('true');
    expect(request.method()).toBe('POST');
    expect(request.postDataJSON()).toEqual({});
    restoreAttempts += 1;
    if (restoreAttempts === 1) {
      await route.fulfill({
        status: 409,
        json: {
          type: 'about:blank',
          title: 'Restauration en attente.',
          status: 409,
          code: 'trash-entry.not-restorable-yet',
        },
      });
      return;
    }
    await restoreReady;
    await route.fulfill({ json: { task: { key: rootKey }, detached: false } });
  });

  await page.goto(`/taches/${childKey}`);
  await expect(page.getByRole('heading', { name: 'Cette tâche a été supprimée' })).toBeVisible();
  await expect(page.getByText(`${childKey} « ${childName} »`, { exact: false })).toBeVisible();
  const restore = page.getByRole('button', { name: 'Restaurer la tâche' });
  const announcement = page.getByRole('status');
  await page.keyboard.press('Tab');
  await expect(restore).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('La mise en corbeille est en cours. Réessayez dans un instant.'),
  ).toBeVisible();

  try {
    await restore.focus();
    await page.keyboard.press('Enter');
    await expect(announcement).toHaveText('Restauration en cours');
    await expect(restore).toBeDisabled();
  } finally {
    finishRestore();
  }

  await expect(page.getByRole('heading', { name: childName })).toBeVisible();
  await expect(announcement).toHaveText('Tâche restaurée');
  await expect(page).toHaveURL(new RegExp(`${childKey}$`));
  expect(restoreAttempts).toBe(2);
});

test('an ordinary missing task never exposes the trash action', async ({ page }) => {
  await page.route(`**/v1/tasks/${childKey}/detail`, async (route) => {
    await route.fulfill({
      status: 404,
      json: {
        type: 'about:blank',
        title: 'Tâche introuvable.',
        status: 404,
        code: 'task.not-found',
      },
    });
  });

  await page.goto(`/taches/${childKey}`);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurer la tâche' })).toHaveCount(0);
});
