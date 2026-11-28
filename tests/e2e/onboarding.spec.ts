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
  memberCount: 1,
  plan: 'free',
  joinedAt: '2026-11-08T09:00:00Z',
};
const organizationDetail = {
  ...atelierNord,
  description: null,
  website: null,
  defaultLanguage: 'en',
  createdAt: '2026-11-08T09:00:00Z',
  version: 1,
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
  id: '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f10',
  name: 'Product',
  prefix: 'PRO',
  description: null,
  icon: null,
  color: 'violet',
  visibility: 'organization',
  owner: { userId: user.id },
  statuses: Object.fromEntries(
    statusKeys.map(([key, category]) => [key, { category, name: null, hidden: false }]),
  ),
  nextKey: 'PRO-4',
  createdAt: '2026-11-08T09:05:00Z',
  version: 1,
};
/** The `dev` template's lists, in creation order (`finishOnboarding` in tasks.yaml). */
const lists = ['Backlog', 'Sprint 1', 'Bugs'].map((name: string, index: number) => ({
  id: `019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f2${String(index)}`,
  spaceId: product.id,
  name,
  icon: null,
  color: 'violet',
  sprint: null,
  createdAt: '2026-11-08T09:05:00Z',
  version: 1,
  callerRole: 'edit',
}));
const backlog = lists[0];

/** The person's onboarding as `GET /v1/me/onboarding` answers it. */
interface Onboarding {
  version: number;
  wizard: {
    status: 'in-progress' | 'finished' | 'dismissed';
    step: 'space' | 'preset' | 'team' | 'import';
    preset: 'dev' | 'mkt' | 'agency' | 'blank';
    name: string | null;
    prefix: string | null;
    color: string;
  };
  provisioning: { spaceId: string; firstListId: string } | null;
  checklist: {
    presentation: 'expanded' | 'collapsed' | 'dismissed';
    firstTaskCreated: boolean;
    invitationSent: boolean;
    boardTried: boolean;
  };
}

/** The state `getOnboarding` answers before the first write: in progress at version 1. */
function initialOnboarding(): Onboarding {
  return {
    version: 1,
    wizard: {
      status: 'in-progress',
      step: 'space',
      preset: 'dev',
      name: null,
      prefix: null,
      color: 'violet',
    },
    provisioning: null,
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: false,
      boardTried: false,
    },
  };
}

/** A finished assistant whose `dev` space is provisioned, with no checklist marker recorded. */
function finishedOnboarding(): Onboarding {
  const state: Onboarding = initialOnboarding();
  return {
    ...state,
    version: 6,
    wizard: { ...state.wizard, status: 'finished', step: 'import', name: 'Product', prefix: 'PRO' },
    provisioning: { spaceId: product.id, firstListId: backlog.id },
  };
}

interface GatewayOptions {
  /** The organization does not exist yet: the person creates it on `/organizations/new`. */
  readonly creating?: boolean;
  /** The onboarding state the gateway starts from; version 1 in progress by default. */
  readonly onboarding?: Onboarding;
  /** The first draft save waits until the returned `releaseFirstDraft` is called. */
  readonly holdFirstDraft?: boolean;
}

interface Gateway {
  /** Requests received, as `METHOD /path`. */
  readonly calls: string[];
  /** Bodies received, by `METHOD /path`. */
  readonly bodies: Map<string, unknown[]>;
  /** The `Idempotency-Key` of each invitation batch received, null when absent. */
  readonly invitationKeys: (string | null)[];
  /** The onboarding state the gateway holds now. */
  readonly onboarding: () => Onboarding;
  /** Answers the first draft save held by `holdFirstDraft`. */
  readonly releaseFirstDraft: () => void;
}

function problem(status: number, code: string) {
  return { status, json: { type: 'about:blank', title: 'Never shown', status, code } };
}

/**
 * Stubs `config.json` and the `/v1/**` routes a signed-in owner of Atelier Nord calls from the
 * organization creation to the getting-started checklist. The onboarding state is held here and
 * moves on with each write, as task-service does; the task creation sets `firstTaskCreated`.
 */
async function stubGateway(page: Page, options: GatewayOptions = {}): Promise<Gateway> {
  const calls: string[] = [];
  const bodies = new Map<string, unknown[]>();
  const invitationKeys: (string | null)[] = [];
  let onboarding: Onboarding = options.onboarding ?? initialOnboarding();
  let created: boolean = options.creating !== true;
  let release: () => void = (): void => undefined;
  const firstDraft: Promise<void> = new Promise<void>((resolve: () => void) => {
    release = resolve;
  });
  let draftsSaved = 0;
  const provisioned = (): boolean => onboarding.provisioning !== null;
  const write = (change: (state: Onboarding) => Onboarding) => {
    onboarding = { ...change(onboarding), version: onboarding.version + 1 };
    return { json: onboarding };
  };

  await page.route('**/config.json', async (route: Route) => {
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({ json: { apiUrl: origin } });
  });

  await page.route('**/v1/**', async (route: Route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push(key);
    const body: unknown = request.postData() === null ? undefined : request.postDataJSON();
    bodies.set(key, [...(bodies.get(key) ?? []), body]);
    switch (key) {
      case 'GET /v1/me':
        return route.fulfill({ json: user });
      case 'GET /v1/organizations':
        return route.fulfill({ json: { items: created ? [atelierNord] : [], nextCursor: null } });
      case 'GET /v1/me/invitations':
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case 'POST /v1/organizations':
        created = true;
        return route.fulfill({
          status: 201,
          json: { organization: organizationDetail, invitations: [] },
        });
      case 'PUT /v1/session/organization':
        return route.fulfill({ json: { organizationId: atelierNord.id, role: 'owner' } });
      case 'GET /v1/organization':
        return route.fulfill({ json: organizationDetail });
      case 'GET /v1/inbox/unread-count':
        return route.fulfill({ json: { unreadCount: 0 } });
      case 'GET /v1/reminders':
        return route.fulfill({ json: { items: [], nextCursor: null, pendingCount: 0 } });
      case 'GET /v1/billing/subscription':
        return route.fulfill({
          json: {
            plan: 'free',
            seats: { used: 1, limit: 5 },
            guestCount: 0,
            storage: { attachmentBytesUsed: 0, limitBytes: 2_000_000_000 },
          },
        });
      case 'GET /v1/me/favorites':
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case 'GET /v1/me/home':
        return route.fulfill({
          json: {
            stats: { assigned: 0, late: 0, dueToday: 0, done: 0 },
            priorities: [],
            sprints: [],
            lists: [],
          },
        });
      case 'GET /v1/me/tasks':
        return route.fulfill({
          json: { items: [], nextCursor: null, counts: { open: 0, closed: 0 } },
        });
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
                joinedAt: '2026-11-08T09:00:00Z',
                version: 1,
              },
            ],
            nextCursor: null,
            total: 1,
            counts: { owner: 1, admin: 0, member: 0, guest: 0 },
          },
        });
      case 'GET /v1/labels':
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case 'GET /v1/me/onboarding':
        return route.fulfill({ json: onboarding });
      case 'PATCH /v1/me/onboarding': {
        const change = body as Partial<Onboarding['wizard']> & { dismissed?: true };
        // A repeated dismissal keeps the version; any other write to a closed wizard is refused.
        if (change.dismissed === true && onboarding.wizard.status === 'dismissed') {
          return route.fulfill({ json: onboarding });
        }
        if (onboarding.wizard.status !== 'in-progress') {
          return route.fulfill(problem(409, 'onboarding.wizard-closed'));
        }
        draftsSaved += 1;
        if (options.holdFirstDraft === true && draftsSaved === 1) await firstDraft;
        if (change.dismissed === true) {
          return route.fulfill(
            write((state: Onboarding) => ({
              ...state,
              wizard: { ...state.wizard, status: 'dismissed' },
            })),
          );
        }
        return route.fulfill(
          write((state: Onboarding) => ({ ...state, wizard: { ...state.wizard, ...change } })),
        );
      }
      case 'PATCH /v1/me/onboarding/checklist': {
        const change = body as Partial<Onboarding['checklist']>;
        // The presentation and the Board marker need a provisioned space; an invitation does not.
        if (
          !provisioned() &&
          (change.presentation !== undefined || change.boardTried !== undefined)
        ) {
          return route.fulfill(problem(409, 'onboarding.checklist-unavailable'));
        }
        // A repeated, identical change keeps the version.
        if (
          Object.entries(change).every(
            ([name, value]: [string, unknown]) =>
              onboarding.checklist[name as keyof Onboarding['checklist']] === value,
          )
        ) {
          return route.fulfill({ json: onboarding });
        }
        return route.fulfill(
          write((state: Onboarding) => ({
            ...state,
            checklist: { ...state.checklist, ...change },
          })),
        );
      }
      case 'POST /v1/me/onboarding/finish': {
        const space = body as {
          name: string;
          prefix: string;
          preset: Onboarding['wizard']['preset'];
        };
        const answer = write((state: Onboarding) => ({
          ...state,
          wizard: { ...state.wizard, ...space, status: 'finished' },
          provisioning: { spaceId: product.id, firstListId: backlog.id },
        }));
        return route.fulfill({ status: 201, ...answer });
      }
      case 'POST /v1/invitations': {
        invitationKeys.push(request.headers()['idempotency-key'] ?? null);
        const { emails } = body as { emails: string[] };
        return route.fulfill({
          json: {
            invitations: emails.map((email: string, index: number) => ({
              email,
              outcome: 'invited',
              invitationId: `019a7002-0000-7000-8000-${String(index).padStart(12, '0')}`,
            })),
          },
        });
      }
      case 'GET /v1/spaces':
        return route.fulfill({ json: { items: provisioned() ? [product] : [], nextCursor: null } });
      case `GET /v1/spaces/${product.id}`:
        return route.fulfill({ json: product });
      case `GET /v1/spaces/${product.id}/lists`:
        return route.fulfill({ json: { items: lists, nextCursor: null } });
      case `GET /v1/spaces/${product.id}/task-templates`:
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `GET /v1/lists/${backlog.id}`:
        return route.fulfill({ json: backlog });
      case `GET /v1/lists/${backlog.id}/counts`:
        return route.fulfill({
          json: { list: backlog, counts: { total: 2, open: 2, done: 0, cancelled: 0, late: 0 } },
        });
      case `GET /v1/lists/${backlog.id}/grants`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `GET /v1/lists/${backlog.id}/saved-views`:
        return route.fulfill({ json: { items: [], nextCursor: null } });
      case `QUERY /v1/lists/${backlog.id}/tasks`:
        return route.fulfill({ json: { items: [], nextCursor: null, total: 0 } });
      case `POST /v1/lists/${backlog.id}/tasks`: {
        const task = body as { name: string; status?: string };
        // task-service records the first real task of the provisioned space.
        onboarding = {
          ...onboarding,
          version: onboarding.version + 1,
          checklist: { ...onboarding.checklist, firstTaskCreated: true },
        };
        return route.fulfill({
          status: 201,
          json: {
            key: 'PRO-4',
            name: task.name,
            description: null,
            status: task.status ?? 'todo',
            cancelReason: null,
            cancelNote: null,
            priority: 'moyenne',
            assignees: [{ userId: user.id }],
            dueDate: null,
            startDate: null,
            estimateMinutes: null,
            labels: [],
            parentKey: null,
            listId: backlog.id,
            spaceId: product.id,
            subtaskCounts: { total: 0, closed: 0 },
            checklist: [],
            checklistCounts: { total: 0, done: 0 },
            completedAt: null,
            createdAt: '2026-11-08T09:10:00Z',
            createdBy: { userId: user.id },
            updatedAt: '2026-11-08T09:10:00Z',
            version: 1,
          },
        });
      }
      default:
        return route.fulfill(problem(404, 'route.not-found'));
    }
  });

  return {
    calls,
    bodies,
    invitationKeys,
    onboarding: (): Onboarding => onboarding,
    releaseFirstDraft: (): void => {
      release();
    },
  };
}

/**
 * Waits for the next `GET /v1/me/onboarding` answer; register it before the navigation.
 */
function onboardingRead(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/v1/me/onboarding',
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
});

test('a new organization opens the assistant, which provisions the space and shows the checklist', async ({
  page,
}) => {
  const gateway = await stubGateway(page, { creating: true, holdFirstDraft: true });

  await page.goto('organizations/new');
  await page.getByLabel('Organization name').fill('Atelier Nord');
  await page.getByRole('button', { name: 'Create the organization' }).click();

  await expect(page).toHaveURL(/\/atelier-nord\?onboarding=start$/);
  const wizard = page.getByTestId('onboarding-wizard');
  await expect(wizard.getByRole('heading', { name: 'Welcome to Atelier Nord' })).toBeVisible();
  // The launch is durable only once the first draft is saved: the parameter stays until then.
  await expect.poll(() => gateway.calls.includes('PATCH /v1/me/onboarding')).toBe(true);
  await expect(page).toHaveURL(/\?onboarding=start$/);
  gateway.releaseFirstDraft();
  await expect(page).toHaveURL(/\/atelier-nord$/);
  await expect(wizard).toBeVisible();

  await expect(wizard.getByLabel('Space name')).toHaveValue('Product');
  await wizard.getByRole('button', { name: 'Continue' }).click();

  await expect(wizard.getByRole('heading', { name: 'Choose a starting point' })).toBeVisible();
  await wizard.getByRole('button', { name: 'Continue' }).click();

  await expect(wizard.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await wizard.getByLabel('Email address').fill('ines.robert@ateliernord.fr');
  await wizard.getByRole('button', { name: 'Add' }).click();
  await expect(wizard.getByTestId('onboarding-invite-pill')).toContainText(
    'ines.robert@ateliernord.fr',
  );
  expect(gateway.calls).not.toContain('POST /v1/invitations');
  await wizard.getByRole('button', { name: 'Continue' }).click();

  await expect(
    wizard.getByRole('heading', { name: 'Import your existing projects' }),
  ).toBeVisible();
  expect(gateway.bodies.get('POST /v1/invitations')).toEqual([
    { emails: ['ines.robert@ateliernord.fr'], role: 'member' },
  ]);
  expect(gateway.invitationKeys).toEqual([expect.stringMatching(/^.{1,255}$/u)]);
  await expect(wizard.getByRole('radio', { name: /Later/ })).toBeChecked();
  await wizard.getByRole('button', { name: 'Create the space' }).click();

  await expect(page).toHaveURL(new RegExp(`/atelier-nord/l/${backlog.id}(/list)?$`));
  await expect(wizard).toBeHidden();
  await expect(page.getByText('Space “Product” created')).toBeVisible();
  await expect(page.getByText('3 lists · 1 invitation sent')).toBeVisible();
  expect(gateway.bodies.get('POST /v1/me/onboarding/finish')).toEqual([
    { name: 'Product', prefix: 'PRO', preset: 'dev', color: 'violet' },
  ]);

  const checklist = page.getByRole('region', { name: 'Getting started' });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByTestId('getting-started-counter')).toHaveText('1 of 3');
  await expect(
    checklist.getByRole('button', { name: 'Invite a team member (done)' }),
  ).toBeVisible();
  expect(gateway.onboarding().checklist.invitationSent).toBe(true);
});

test('the checklist ticks the first task and the Board view as the person tries them', async ({
  page,
}) => {
  const gateway = await stubGateway(page, { onboarding: finishedOnboarding() });

  await page.goto(`atelier-nord/l/${backlog.id}`);
  const checklist = page.getByRole('region', { name: 'Getting started' });
  await expect(checklist.getByTestId('getting-started-counter')).toHaveText('0 of 3');

  await checklist.getByRole('button', { name: 'Create your first task' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('task-create-destination')).toContainText('Backlog');
  await dialog.getByPlaceholder('Task name').fill('Write the release notes');
  await dialog.getByRole('button', { name: /Create the task/ }).click();

  await expect(dialog).toBeHidden();
  await expect(
    checklist.getByRole('button', { name: 'Create your first task (done)' }),
  ).toBeVisible();
  await expect(checklist.getByTestId('getting-started-counter')).toHaveText('1 of 3');
  // The creation toast covers the corner of the checklist until it goes.
  await expect(page.getByText('Task PRO-4 created')).toBeHidden({ timeout: 15_000 });

  await checklist.getByRole('button', { name: 'Try the Board view' }).click();
  await expect(page).toHaveURL(new RegExp(`/atelier-nord/l/${backlog.id}/board$`));
  await expect(checklist.getByRole('button', { name: 'Try the Board view (done)' })).toBeVisible();
  await expect(checklist.getByTestId('getting-started-counter')).toHaveText('2 of 3');
  expect(gateway.bodies.get('PATCH /v1/me/onboarding/checklist')).toEqual([{ boardTried: true }]);
});

test('Set up later closes the assistant for good, with no checklist', async ({ page }) => {
  // A first space already exists (an earlier finish whose answer was lost): only the dismissal
  // keeps its checklist away, and Set up later opens its first list.
  const gateway = await stubGateway(page, {
    onboarding: {
      ...initialOnboarding(),
      provisioning: { spaceId: product.id, firstListId: backlog.id },
    },
  });

  await page.goto('atelier-nord?onboarding=start');
  const wizard = page.getByTestId('onboarding-wizard');
  await expect(wizard.getByRole('heading', { name: 'Welcome to Atelier Nord' })).toBeVisible();
  await wizard.getByRole('button', { name: 'Set up later' }).click();

  await expect(wizard).toBeHidden();
  await expect.poll(() => gateway.onboarding().wizard.status).toBe('dismissed');
  await expect(page).toHaveURL(new RegExp(`/atelier-nord/l/${backlog.id}/list$`));
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);

  const read: Promise<unknown> = onboardingRead(page);
  await page.reload();
  await read;
  await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('onboarding-wizard')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
});

test('a saved draft reopens the assistant on the workspace root, never over a deep link', async ({
  page,
}) => {
  const saved: Onboarding = initialOnboarding();
  await stubGateway(page, {
    onboarding: {
      ...saved,
      version: 3,
      wizard: { ...saved.wizard, step: 'team', name: 'Product', prefix: 'PRO' },
    },
  });

  // The checklist's host reads the progress on every page; the assistant opens only on the root.
  const read: Promise<unknown> = onboardingRead(page);
  await page.goto('atelier-nord/my-tasks');
  await read;
  await expect(page.getByRole('heading', { level: 1, name: 'My tasks' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('onboarding-wizard')).toHaveCount(0);

  await page.goto('atelier-nord');
  const wizard = page.getByTestId('onboarding-wizard');
  await expect(wizard.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
  await expect(wizard.getByTestId('onboarding-position')).toHaveText('Step 3 of 4');
});
