import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const spaceId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b31';
const listId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32';
const taskName = 'Refondre l’écran de connexion SSO';
const boardLink = `/espaces/${spaceId}/listes/${listId}`;
const labels = {
  triage: 'À trier',
  backlog: 'À planifier',
  todo: 'À faire',
  progress: 'En cours',
  review: 'En revue',
  testing: 'En validation',
  waiting: 'En attente',
  blocked: 'Bloqué',
  done: 'Terminé',
  cancelled: 'Annulé',
};

/** Runs the browser against a stateful replacement for just the public Gateway. */
async function stubBoard(
  page: Page,
  { viewOnly = false, rejectMove = false, rejectOrganizationAtWrite = false } = {},
) {
  let activeOrganization = organizationId;
  const task = {
    key: 'CAD-482',
    name: taskName,
    status: 'progress',
    version: 12,
    priority: 'haute',
    dueDate: '2026-11-12',
    labels: ['Auth', 'Front'],
    assignees: [],
    subtaskCounts: { total: 3, closed: 1 },
  };
  const writes: {
    status: string;
    version: string | undefined;
    expectedOrganization: string | undefined;
  }[] = [];
  const pages: { status: string | null; limit: string | null }[] = [];

  await page.route('**/config.json', async (route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin, realtimeUrl: origin } });
  });
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    if (request.method() === 'PATCH' && pathname === '/v1/tasks/CAD-482') {
      const { status } = request.postDataJSON() as { status: string };
      const version = request.headers()['if-match'];
      const expectedOrganization = request.headers()['if-organization-match'];
      writes.push({ status, version, expectedOrganization });
      if (rejectOrganizationAtWrite || expectedOrganization !== activeOrganization) {
        await route.fulfill({ status: 412, json: { code: 'organization.context-changed' } });
        return;
      }
      if (rejectMove || version !== `"${task.version.toString()}"`) {
        await route.fulfill({
          status: 412,
          json: { code: 'request.version-mismatch', details: { version: task.version } },
        });
        return;
      }
      task.status = status;
      task.version += 1;
      await route.fulfill({ json: task });
      return;
    }
    switch (pathname) {
      case '/v1/organization':
        await route.fulfill({
          json: { id: activeOrganization, name: 'Atelier Nord', role: 'owner' },
        });
        return;
      case `/v1/lists/${listId}`:
        await route.fulfill({
          json: {
            id: listId,
            name: 'Sprint 14',
            spaceId,
            archivedAt: null,
            sprint: { startDate: '2026-11-03', endDate: '2026-11-17', goal: null },
            callerRole: viewOnly ? 'view' : 'edit',
          },
        });
        return;
      case `/v1/spaces/${spaceId}`:
        await route.fulfill({
          json: {
            statuses: Object.fromEntries(
              Object.entries(labels).map(([status, name]) => [
                status,
                { name, hidden: status === 'testing' },
              ]),
            ),
          },
        });
        return;
      case `/v1/lists/${listId}/task-groups`:
        await route.fulfill({
          json: {
            groupBy: 'status',
            items: Object.keys(labels).map((value) => ({
              value,
              count: Number(value === task.status),
            })),
            nextCursor: null,
            total: 1,
          },
        });
        return;
      case `/v1/lists/${listId}/tasks`: {
        const status = searchParams.get('status');
        pages.push({ status, limit: searchParams.get('limit') });
        const items = !status || status === task.status ? [task] : [];
        await route.fulfill({ json: { items, nextCursor: null, total: items.length } });
        return;
      }
      default:
        await route.fulfill({ status: 404, json: {} });
    }
  });
  return {
    writes,
    pages,
    changeOrganization: () => {
      activeOrganization = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b40';
    },
  };
}

/** Selects the next ordinary status without a mouse. */
async function chooseReviewByKeyboard(page: Page) {
  const selector = page.getByRole('combobox', { name: 'Statut de CAD-482' });
  await selector.press('Enter');
  await expect(page.getByRole('option', { name: 'En revue' })).toBeVisible();
  await selector.press('ArrowDown');
  await selector.press('Enter');
}

test('drags CAD-482 to En revue and undoes with the confirmed version', async ({ page }) => {
  const gateway = await stubBoard(page);
  await page.goto(boardLink);
  await page.getByRole('link', { name: 'Tableau' }).click();
  await expect(page).toHaveURL(/vue=tableau/u);
  await expect(page.getByRole('heading', { name: 'Sprint 14' })).toBeVisible();

  const active = page.getByRole('region', { name: 'En cours' });
  const review = page.getByRole('region', { name: 'En revue' });
  const card = page.getByTestId('board-drag-CAD-482');
  await expect(active.getByRole('link', { name: taskName })).toBeVisible();
  expect(gateway.pages).toContainEqual({ status: 'progress', limit: '12' });
  expect(gateway.pages).not.toContainEqual({ status: 'todo', limit: '12' });
  await expect(page.getByRole('region', { name: 'En validation' })).toHaveCount(0);

  await review.scrollIntoViewIfNeeded();
  await card.hover({ position: { x: 12, y: 9 } });
  const target = await review.boundingBox();
  if (!target) throw new Error('The destination column has no bounding box.');
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + 90, { steps: 18 });
  await page.mouse.up();
  await expect(review.getByRole('link', { name: taskName })).toBeVisible();
  await expect(page.getByText('CAD-482 déplacée')).toBeVisible();
  expect(gateway.writes).toEqual([
    { status: 'review', version: '"12"', expectedOrganization: organizationId },
  ]);

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(active.getByRole('link', { name: taskName })).toBeVisible();
  await expect
    .poll(() => gateway.writes)
    .toEqual([
      { status: 'review', version: '"12"', expectedOrganization: organizationId },
      { status: 'progress', version: '"13"', expectedOrganization: organizationId },
    ]);
});

test('restores the card after a keyboard move conflicts with another change', async ({ page }) => {
  const gateway = await stubBoard(page, { rejectMove: true });
  await page.goto(`${boardLink}?vue=tableau`);

  const active = page.getByRole('region', { name: 'En cours' });
  const review = page.getByRole('region', { name: 'En revue' });
  await chooseReviewByKeyboard(page);

  await expect(page.getByText('Impossible de modifier le statut')).toBeVisible();
  await expect(active.getByRole('link', { name: taskName })).toBeVisible();
  await expect(review.getByRole('link', { name: taskName })).toHaveCount(0);
  await expect(page.getByText('L’organisation active a changé.')).toHaveCount(0);
  expect(gateway.writes).toEqual([
    { status: 'review', version: '"12"', expectedOrganization: organizationId },
  ]);
});

test('shows board cards without mutation controls for a reader', async ({ page }) => {
  const gateway = await stubBoard(page, { viewOnly: true });
  await page.goto(`${boardLink}?vue=tableau`);

  await expect(
    page.getByRole('region', { name: 'En cours' }).getByRole('link', { name: taskName }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Statut de CAD-482' })).toHaveCount(0);
  expect(gateway.writes).toEqual([]);
});

test('refuses a card write when another tab has selected a different organization', async ({
  page,
}) => {
  const gateway = await stubBoard(page);
  await page.goto(`${boardLink}?vue=tableau`);

  const selector = page.getByRole('combobox', { name: 'Statut de CAD-482' });
  await expect(selector).toBeVisible();
  gateway.changeOrganization();
  await chooseReviewByKeyboard(page);

  await expect(
    page.getByRole('alert').filter({ hasText: 'L’organisation active a changé.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: taskName })).toHaveCount(0);
  expect(gateway.writes).toEqual([]);
});

test('discards the previous board when Gateway rejects the organization after preflight', async ({
  page,
}) => {
  const gateway = await stubBoard(page, { rejectOrganizationAtWrite: true });
  await page.goto(`${boardLink}?vue=tableau`);

  await expect(page.getByRole('link', { name: taskName })).toBeVisible();
  const initialPages = gateway.pages.length;
  await chooseReviewByKeyboard(page);

  await expect(page.getByRole('alert')).toContainText('L’organisation active a changé.');
  await expect(page.getByRole('link', { name: 'Choisir une organisation' })).toHaveAttribute(
    'href',
    '/organisations',
  );
  await expect(page.getByRole('heading', { name: 'Sprint 14' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: taskName })).toHaveCount(0);
  await expect(page.getByText('Impossible de modifier le statut')).toHaveCount(0);
  expect(gateway.writes).toEqual([
    { status: 'review', version: '"12"', expectedOrganization: organizationId },
  ]);
  expect(gateway.pages).toHaveLength(initialPages);
});
