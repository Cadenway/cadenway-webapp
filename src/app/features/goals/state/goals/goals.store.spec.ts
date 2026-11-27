import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { firstValueFrom, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { type Person, TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
  type WorkspaceOrganization,
  type WorkspaceRole,
} from '@features/workspace/ports/workspace-context';

import {
  GoalsApi,
  type KeyResultWrite,
} from '../../data-access/services/goals-api/goals-api.service';
import type {
  Goal,
  GoalDraft,
  GoalList,
  GoalView,
  KeyResult,
  NumberKeyResult,
} from '../../models/goal/goal.interface';
import { GOAL_EDIT_BURST_MS, GOAL_SETTLE_BACKOFF_MS } from './goals-timing.token';
import { CREATE_ATTEMPTS, GoalsStore, RETRY_DELAY_MS } from './goals.store';

/**
 * Constant ATELIER_NORD
 *
 * @description
 * The organization the workspace shows first.
 *
 * @type {WorkspaceOrganization}
 */
const ATELIER_NORD: WorkspaceOrganization = {
  id: 'o1',
  slug: 'atelier-nord',
  name: 'Atelier Nord',
  initials: 'AN',
  role: 'owner',
  plan: 'team',
};

/**
 * Constant STUDIO_SUD
 *
 * @description
 * The organization a switch makes the workspace show.
 *
 * @type {WorkspaceOrganization}
 */
const STUDIO_SUD: WorkspaceOrganization = { ...ATELIER_NORD, id: 'o2', slug: 'studio-sud' };

/**
 * Constant organization
 *
 * @description
 * The organization the workspace shows, switched by some specs.
 *
 * @type {WritableSignal<WorkspaceOrganization>}
 */
const organization: WritableSignal<WorkspaceOrganization> = signal(ATELIER_NORD);

/**
 * Constant role
 *
 * @description
 * The caller's role, lowered by some specs.
 *
 * @type {WritableSignal<WorkspaceRole>}
 */
const role: WritableSignal<WorkspaceRole> = signal<WorkspaceRole>('owner');

/**
 * Constant ORDER
 *
 * @description
 * The roles from the least to the most.
 *
 * @type {readonly WorkspaceRole[]}
 */
const ORDER: readonly WorkspaceRole[] = ['guest', 'member', 'admin', 'owner'];

/**
 * Constant workspace
 *
 * @description
 * Atelier Nord, where Camille Martin is signed in.
 *
 * @type {WorkspaceContextPort}
 */
const workspace: WorkspaceContextPort = {
  user: signal({
    id: 'u-cm',
    name: 'Camille Martin',
    firstName: 'Camille',
    displayName: null,
    email: 'camille.martin@ateliernord.fr',
    initials: 'CM',
  }),
  organization,
  role,
  can: (least: WorkspaceRole): boolean => ORDER.indexOf(role()) >= ORDER.indexOf(least),
};

/**
 * Constant spaces
 *
 * @description
 * The spaces of the sidebar: Camille edits Product, only views Marketing.
 *
 * @type {WritableSignal<readonly SpaceDirectoryEntry[]>}
 */
const spaces: WritableSignal<readonly SpaceDirectoryEntry[]> = signal([
  { id: 'product', name: 'Product', icon: null, tone: '', callerRole: 'edit' },
  { id: 'marketing', name: 'Marketing', icon: null, tone: '', callerRole: 'view' },
]);

/**
 * Function signups
 *
 * @description
 * The monthly sign-ups key result of the mockup (`k6`, 120 towards 300, step 9).
 *
 * @param {number} current - Its current value.
 * @returns {NumberKeyResult} The key result.
 */
function signups(current: number): NumberKeyResult {
  return {
    id: 'k6',
    kind: 'number',
    label: 'Sign-ups per month',
    startValue: 120,
    currentValue: current,
    targetValue: 300,
    progressPercent: ((current - 120) / 180) * 100,
  };
}

/**
 * Function goal
 *
 * @description
 * A goal of the mockup's quarter.
 *
 * @param {Partial<Goal>} patch - What differs from the SSO goal.
 * @returns {Goal} The goal.
 */
function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    name: 'Launch SSO for enterprises',
    ownerUserId: 'u-cm',
    dueDate: '2026-12-31',
    spaceId: 'product',
    version: 3,
    progressPercent: 40,
    health: 'at-risk',
    results: [signups(168)],
    ...patch,
  };
}

/**
 * Function list
 *
 * @description
 * A read of the fourth quarter of 2026.
 *
 * @param {readonly Goal[]} goals - The goals.
 * @returns {GoalList} The read.
 */
function list(goals: readonly Goal[]): GoalList {
  return {
    quarter: { key: '2026-Q4', year: 2026, number: 4, end: '2026-12-31' },
    goals,
    expectedProgressPercent: 41.3,
  };
}

/**
 * Constant SUPPORT
 *
 * @description
 * The goal the form of the mockup suggests, owned by Hugo Dubois.
 *
 * @type {GoalDraft}
 */
const SUPPORT: GoalDraft = {
  name: 'Cut the support response time',
  ownerUserId: 'u-hd',
  spaceId: null,
  firstResult: null,
};

/**
 * Function problem
 *
 * @description
 * A refusal of the gateway.
 *
 * @param {number} status - Its status.
 * @param {string} code - Its problem code.
 * @returns {HttpErrorResponse} The refusal.
 */
function problem(status: number, code: string = ''): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code } });
}

/**
 * Interface Deferred
 *
 * @description
 * A promise the spec settles by hand.
 */
interface Deferred<T> {
  // #region Properties
  /**
   * Property promise
   *
   * @description
   * The promise.
   *
   * @type {Promise<T>}
   * @readonly
   */
  readonly promise: Promise<T>;

  /**
   * Property resolve
   *
   * @description
   * Fulfils it.
   *
   * @type {(value: T) => void}
   * @readonly
   */
  readonly resolve: (value: T) => void;

  /**
   * Property reject
   *
   * @description
   * Rejects it.
   *
   * @type {(error: unknown) => void}
   * @readonly
   */
  readonly reject: (error: unknown) => void;
  // #endregion
}

/**
 * Function deferred
 *
 * @description
 * Creates a promise the spec settles by hand.
 *
 * @template T
 * @returns {Deferred<T>} The promise and its settlers.
 */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: unknown) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>((done, fail): void => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/**
 * Function pause
 *
 * @description
 * Waits in real time, so the short bursts and back-offs the spec configures elapse.
 *
 * @param {number} ms - The wait, in milliseconds.
 * @returns {Promise<void>} Resolves once elapsed.
 */
function pause(ms: number): Promise<void> {
  return new Promise<void>((done: () => void): void => {
    setTimeout(done, ms);
  });
}

/**
 * Function burst
 *
 * @description
 * Lets a burst of clicks end and its value enter the write queue.
 *
 * @returns {Promise<void>} Resolves once sent.
 */
async function burst(): Promise<void> {
  await pause(10);
  await flush();
}

/**
 * Function flush
 *
 * @description
 * Lets the pending promises run, without waiting for the reads in flight.
 *
 * @returns {Promise<void>} Resolves once they ran.
 */
async function flush(): Promise<void> {
  for (let turn: number = 0; turn < 40; turn += 1) await Promise.resolve();
}

/**
 * Function settle
 *
 * @description
 * Lets the pending promises run, then waits until the application is stable.
 *
 * @returns {Promise<void>} Resolves once stable.
 */
async function settle(): Promise<void> {
  await pause(10);
  for (let turn: number = 0; turn < 20; turn += 1) await Promise.resolve();
  await TestBed.inject(ApplicationRef).whenStable();
  for (let turn: number = 0; turn < 20; turn += 1) await Promise.resolve();
}

/**
 * Function shownValue
 *
 * @description
 * The value the sign-ups key result shows.
 *
 * @param {InstanceType<typeof GoalsStore>} store - The store.
 * @returns {number | undefined} The value.
 */
function shownValue(store: InstanceType<typeof GoalsStore>): number | undefined {
  const result: KeyResult | undefined = store
    .list()
    ?.find((view: GoalView) => view.goal.id === 'g1')
    ?.goal.results.find((item: KeyResult) => item.id === 'k6');
  return result?.kind === 'number' ? result.currentValue : undefined;
}

describe('GoalsStore', () => {
  let api: Record<
    | 'list'
    | 'get'
    | 'create'
    | 'delete'
    | 'createResult'
    | 'updateResult'
    | 'deleteResult'
    | 'owners',
    Mock
  >;
  let toasts: { success: Mock; error: Mock; warning: Mock };
  let pin: OrganizationPin;

  beforeEach(() => {
    organization.set(ATELIER_NORD);
    role.set('owner');
    api = {
      list: vi.fn(() => Promise.resolve(list([goal()]))),
      get: vi.fn(() => Promise.resolve(goal({ version: 9, progressPercent: 50 }))),
      create: vi.fn((draft: GoalDraft) =>
        Promise.resolve(goal({ id: 'g9', name: draft.name, version: 1, results: [] })),
      ),
      delete: vi.fn(() => Promise.resolve()),
      createResult: vi.fn(() =>
        Promise.resolve({
          result: { ...signups(0), id: 'k10', label: 'Customer demos held' },
          version: 4,
        }),
      ),
      updateResult: vi.fn(
        (_goalId: string, _resultId: string, version: number, patch: { currentValue: number }) =>
          Promise.resolve<KeyResultWrite>({
            result: signups(patch.currentValue),
            version: version + 1,
          }),
      ),
      deleteResult: vi.fn(() => Promise.resolve()),
      owners: vi.fn(() =>
        Promise.resolve([
          { id: 'u-cm', name: 'Camille Martin', initials: 'CM', avatar: null },
          { id: 'u-hd', name: 'Hugo Dubois', initials: 'HD', avatar: null },
        ]),
      ),
    };
    toasts = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GoalsStore,
        { provide: GoalsApi, useValue: api },
        { provide: GOAL_EDIT_BURST_MS, useValue: 1 },
        { provide: GOAL_SETTLE_BACKOFF_MS, useValue: [1, 1, 1] },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        { provide: SPACE_DIRECTORY, useValue: { spaces } },
        {
          provide: TaskDetailOpener,
          useValue: { closed: new Subject<string>(), changed: new Subject<string>() },
        },
      ],
    });
  });

  /**
   * Function loaded
   *
   * @description
   * Creates the store and waits for its first read.
   *
   * @returns {Promise<InstanceType<typeof GoalsStore>>} The store.
   */
  async function loaded(): Promise<InstanceType<typeof GoalsStore>> {
    const store: InstanceType<typeof GoalsStore> = started();
    await settle();
    return store;
  }

  /**
   * Function started
   *
   * @description
   * Pins the workspace's organization, as the resolver does, then creates the store. It injects
   * nothing earlier, so a spec may still override a provider before calling it.
   *
   * @returns {InstanceType<typeof GoalsStore>} The store.
   */
  function started(): InstanceType<typeof GoalsStore> {
    pin = TestBed.inject(OrganizationPin);
    pin.set(organization().id);
    return TestBed.inject(GoalsStore);
  }

  /**
   * Function commit
   *
   * @description
   * Commits another organization in the workspace and the pin, synchronously, as the resolver
   * does, without letting the store react.
   *
   * @param {WorkspaceOrganization} next - The organization committed.
   */
  function commit(next: WorkspaceOrganization): void {
    organization.set(next);
    pin.set(next.id);
  }

  it('reads the goals of the quarter with their owners and figures', async () => {
    api.list.mockResolvedValue(
      list([
        goal(),
        goal({ id: 'g2', ownerUserId: 'u-hd', health: 'on-track', progressPercent: 60 }),
        goal({ id: 'g3', ownerUserId: 'u-gone', health: 'achieved', progressPercent: 100 }),
      ]),
    );
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(store.list()?.map((view: GoalView) => view.ownerName)).toEqual([
      'Camille Martin',
      'Hugo Dubois',
      'Former member',
    ]);
    expect(store.stats()).toEqual({
      count: 3,
      averagePercent: 67,
      expectedPercent: 41,
      onTrack: 2,
      achieved: 1,
      atRisk: 1,
    });
    expect(store.quarter()?.key).toBe('2026-Q4');
    expect(store.isEmpty()).toBe(false);
  });

  it('tells a quarter without goals from a failed read', async () => {
    api.list.mockResolvedValue(list([]));
    const empty: InstanceType<typeof GoalsStore> = await loaded();
    expect(empty.isEmpty()).toBe(true);
    expect(empty.list()).toEqual([]);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        GoalsStore,
        {
          provide: GoalsApi,
          useValue: { ...api, list: vi.fn().mockRejectedValue(problem(503)) },
        },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: workspace },
        {
          provide: TaskDetailOpener,
          useValue: { closed: new Subject<string>(), changed: new Subject<string>() },
        },
      ],
    });
    const failed: InstanceType<typeof GoalsStore> = await loaded();
    expect(failed.isEmpty()).toBe(false);
    expect(() => failed.list()).toThrow();
  });

  it('decides who may create and in which spaces', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    expect(store.canCreate()).toBe(true);
    expect(store.spaceOptions()).toBeNull();
    expect(store.list()?.[0].canWrite).toBe(true);

    role.set('member');
    expect(store.spaceOptions()).toEqual([{ id: 'product', name: 'Product' }]);
    expect(store.canCreate()).toBe(true);
    spaces.update((all: readonly SpaceDirectoryEntry[]) =>
      all.map((space: SpaceDirectoryEntry) => ({ ...space, callerRole: 'view' as const })),
    );
    expect(store.canCreate()).toBe(false);
    expect(store.list()?.[0].canWrite).toBe(false);
    spaces.update((all: readonly SpaceDirectoryEntry[]) =>
      all.map((space: SpaceDirectoryEntry) =>
        space.id === 'product' ? { ...space, callerRole: 'edit' as const } : space,
      ),
    );
  });

  it('sends only the last value of a burst of clicks, each from the version returned', async () => {
    const first: Deferred<KeyResultWrite> = deferred<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(first.promise);
    api.get.mockResolvedValueOnce(
      goal({ version: 9, progressPercent: 50, results: [signups(195)] }),
    );
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    expect(shownValue(store)).toBe(177);
    await settle();
    store.step('g1', 'k6', 1);
    store.step('g1', 'k6', 1);
    expect(shownValue(store)).toBe(195);
    first.resolve({ result: signups(177), version: 4 });
    await settle();

    expect(api.updateResult.mock.calls).toEqual([
      ['g1', 'k6', 3, { currentValue: 177 }],
      ['g1', 'k6', 4, { currentValue: 195 }],
    ]);
    expect(shownValue(store)).toBe(195);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(store.list()?.[0].goal.progressPercent).toBe(50);
  });

  it('restores the confirmed value and toasts a refused change', async () => {
    api.updateResult.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', -1);
    expect(shownValue(store)).toBe(159);
    await settle();

    expect(shownValue(store)).toBe(168);
    expect(toasts.error).toHaveBeenCalledWith('The key result could not be updated', {
      description: 'Try again in a moment.',
    });
  });

  it('settles a change of unknown outcome by reading the goal, without reporting a failure', async () => {
    api.updateResult.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    api.get.mockResolvedValueOnce(goal({ version: 4, results: [signups(177)] }));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await settle();

    expect(toasts.error).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalled();
    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(shownValue(store)).toBe(177);
  });

  it('sends a stale change once more from the current version', async () => {
    api.updateResult.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await settle();

    expect(api.updateResult.mock.calls.map((call: unknown[]) => call[2])).toEqual([3, 9]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('keeps a confirmed change over an older read in flight', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const older: Deferred<GoalList> = deferred<GoalList>();
    api.list.mockReturnValueOnce(older.promise);
    const reread: Deferred<Goal> = deferred<Goal>();
    api.get.mockReturnValueOnce(reread.promise);

    store.refresh();
    TestBed.tick();
    store.step('g1', 'k6', 1);
    await burst();
    older.resolve(list([goal()]));
    await settle();

    expect(shownValue(store)).toBe(177);
  });

  it('keeps the goals shown when a background read fails', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.list.mockRejectedValueOnce(problem(503));

    store.refresh();
    await settle();

    expect(store.list()?.map((view: GoalView) => view.goal.id)).toEqual(['g1']);
  });

  it('drops a change that settles after an organization switch', async () => {
    const pending: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(pending));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await settle();
    commit(STUDIO_SUD);
    await settle();
    pending.error(problem(403, 'access.role-insufficient'));
    await settle();

    expect(toasts.error).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('creates a goal and toasts it', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();

    const id: string | null = await store.create({
      name: 'Cut the support response time',
      ownerUserId: 'u-hd',
      spaceId: null,
      firstResult: { label: 'Answer within 4 h', target: 90 },
    });

    expect(id).toBe('g9');
    expect(api.create.mock.calls[0][1]).toEqual(list([]).quarter);
    expect(store.list()?.map((view: GoalView) => view.goal.id)).toEqual(['g9', 'g1']);
    expect(toasts.success).toHaveBeenCalledWith('Goal created', {
      description: 'Cut the support response time',
    });
  });

  it('sends a creation of unknown outcome again with the same idempotency key', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    vi.useFakeTimers();
    try {
      api.create
        .mockRejectedValueOnce(problem(504))
        .mockRejectedValueOnce(problem(409, 'idempotency.request-in-progress'));

      const pending: Promise<string | null> = store.create(SUPPORT);
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2);

      expect(await pending).toBe('g9');
      expect(api.create).toHaveBeenCalledTimes(3);
      const keys: unknown[] = api.create.mock.calls.map((call: unknown[]) => call[3]);
      expect(new Set(keys).size).toBe(1);
      expect(toasts.warning).not.toHaveBeenCalled();
      expect(toasts.success).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a creation that stays unknown and reuses its key when sent again', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    vi.useFakeTimers();
    try {
      api.create.mockRejectedValue(new HttpErrorResponse({ status: 0 }));

      const pending: Promise<string | null> = store.create(SUPPORT);
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * CREATE_ATTEMPTS);

      expect(await pending).toBeNull();
      expect(api.create).toHaveBeenCalledTimes(CREATE_ATTEMPTS);
      expect(toasts.warning).toHaveBeenCalledWith('The goal could not be confirmed', {
        description: 'Create it again: it will not be created twice.',
      });
      expect(toasts.error).not.toHaveBeenCalled();

      api.create.mockResolvedValueOnce(goal({ id: 'g9', name: SUPPORT.name, results: [] }));
      expect(await store.create(SUPPORT)).toBe('g9');
      expect(new Set(api.create.mock.calls.map((call: unknown[]) => call[3])).size).toBe(1);

      api.create.mockResolvedValueOnce(goal({ id: 'g10', name: SUPPORT.name, results: [] }));
      await store.create(SUPPORT);
      expect(new Set(api.create.mock.calls.map((call: unknown[]) => call[3])).size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends a key result of unknown outcome again with the same idempotency key', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    vi.useFakeTimers();
    try {
      api.createResult.mockRejectedValueOnce(problem(503));

      const pending: Promise<boolean> = store.addResult('g1', {
        label: 'Customer demos held',
        target: 12,
      });
      await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);

      expect(await pending).toBe(true);
      expect(api.createResult).toHaveBeenCalledTimes(2);
      expect(api.createResult.mock.calls[0][3]).toBe(api.createResult.mock.calls[1][3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('warns when a deletion of unknown outcome leaves the goal in place', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.delete.mockRejectedValueOnce(problem(502));
    api.get.mockResolvedValueOnce(goal());

    expect(await store.remove('g1', 3)).toBe(false);

    expect(store.list()).toHaveLength(1);
    expect(toasts.warning).toHaveBeenCalledWith('The deletion could not be confirmed', {
      description: 'The goal is still shown. Try again in a moment.',
    });
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('deletes a goal from the version shown and counts a missing goal as deleted', async () => {
    api.list.mockResolvedValue(list([goal(), goal({ id: 'g2', name: 'Halve the open bugs' })]));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(await store.remove('g1', 3)).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('g1', 3);
    api.delete.mockRejectedValueOnce(problem(404, 'goal.not-found'));
    expect(await store.remove('g2', 3)).toBe(true);

    expect(store.isEmpty()).toBe(true);
    expect(toasts.success).toHaveBeenLastCalledWith('Goal deleted', {
      description: 'Halve the open bugs',
    });
  });

  it('keeps a goal whose deletion is refused and toasts the failure', async () => {
    api.delete.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(await store.remove('g1', 3)).toBe(false);
    expect(store.list()).toHaveLength(1);
    expect(toasts.error).toHaveBeenCalledWith('The goal could not be deleted', {
      description: 'Try again in a moment.',
    });
  });

  it('adds and removes key results', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(await store.addResult('g1', { label: 'Customer demos held', target: 12 })).toBe(true);
    expect(api.createResult.mock.calls[0].slice(0, 3)).toEqual([
      'g1',
      3,
      { label: 'Customer demos held', target: 12 },
    ]);

    api.deleteResult.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    store.removeResult('g1', 'k6');
    expect(shownValue(store)).toBeUndefined();
    await settle();
    expect(shownValue(store)).toBe(168);
    expect(toasts.error).toHaveBeenCalledWith('The key result could not be removed', {
      description: 'Try again in a moment.',
    });
  });

  it('keeps a later edit when an earlier send of it fails, then sends it', async () => {
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(first));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await burst();
    store.step('g1', 'k6', 1);
    first.error(problem(403, 'access.role-insufficient'));
    await settle();

    expect(api.updateResult.mock.calls.map((call: unknown[]) => call[3])).toEqual([
      { currentValue: 177 },
      { currentValue: 186 },
    ]);
    expect(toasts.error).toHaveBeenCalledTimes(1);
  });

  it('still sends the last value of a burst once the page is gone, without reading it again', async () => {
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(first));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await burst();
    store.step('g1', 'k6', 1);
    store.step('g1', 'k6', 1);
    TestBed.resetTestingModule();
    first.next({ result: signups(177), version: 4 });
    first.complete();
    await flush();

    expect(api.updateResult.mock.calls).toEqual([
      ['g1', 'k6', 3, { currentValue: 177 }],
      ['g1', 'k6', 4, { currentValue: 195 }],
    ]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('moves a number by the same steps from a newer value after a stale version', async () => {
    api.updateResult.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(goal({ version: 7, results: [signups(200)] }));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await settle();

    expect(api.updateResult.mock.calls[1]).toEqual(['g1', 'k6', 7, { currentValue: 209 }]);
  });

  it('drops a checkbox changed elsewhere after a stale version, with a warning', async () => {
    const guide: KeyResult = {
      id: 'k3',
      kind: 'checkbox',
      label: 'SSO guide published',
      checked: false,
      progressPercent: 0,
    };
    api.list.mockResolvedValue(list([goal({ results: [guide] })]));
    api.updateResult.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(
      goal({ version: 7, results: [{ ...guide, checked: true, progressPercent: 100 }] }),
    );
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.toggle('g1', 'k3');
    await settle();

    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(toasts.warning).toHaveBeenCalledWith('This key result changed elsewhere', {
      description: 'It now shows its latest state.',
    });
    const shown: KeyResult | undefined = store.list()?.[0].goal.results[0];
    expect(shown?.kind === 'checkbox' && shown.checked).toBe(true);
  });

  it('sends nothing more after switching to another organization and back', async () => {
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(first));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await burst();
    store.step('g1', 'k6', 1);
    commit(STUDIO_SUD);
    await settle();
    commit(ATELIER_NORD);
    await settle();
    first.next({ result: signups(177), version: 4 });
    first.complete();
    await settle();

    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    expect(shownValue(store)).toBe(168);
  });

  it('does not keep a goal snapshot sent before a newer read landed', async () => {
    const snapshot: Subject<Goal> = new Subject<Goal>();
    api.get.mockReturnValueOnce(firstValueFrom(snapshot));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await burst();
    expect(api.get).toHaveBeenCalledTimes(1);
    api.list.mockResolvedValueOnce(list([goal({ version: 6, results: [signups(300)] })]));
    store.refresh();
    await settle();
    snapshot.next(goal({ version: 4, results: [signups(177)] }));
    snapshot.complete();
    await settle();

    expect(shownValue(store)).toBe(300);
  });

  it('names a former member only once a read of the members confirms it', async () => {
    const second: Subject<readonly Person[]> = new Subject<readonly Person[]>();
    api.owners
      .mockResolvedValueOnce([{ id: 'u-cm', name: 'Camille Martin', initials: 'CM', avatar: null }])
      .mockReturnValueOnce(firstValueFrom(second));
    api.list.mockResolvedValue(list([goal({ ownerUserId: 'u-lp' })]));
    const store: InstanceType<typeof GoalsStore> = started();
    await expect
      .poll(async () => {
        TestBed.tick();
        await flush();
        return api.owners.mock.calls.length;
      })
      .toBe(2);
    expect(store.list()?.[0].ownerName).toBeNull();
    second.next([{ id: 'u-cm', name: 'Camille Martin', initials: 'CM', avatar: null }]);
    second.complete();
    await settle();

    expect(store.list()?.[0].ownerName).toBe('Former member');
    expect(api.owners).toHaveBeenCalledTimes(2);
  });

  it('reads the members again after a failure', async () => {
    api.owners.mockRejectedValueOnce(problem(503));
    const store: InstanceType<typeof GoalsStore> = await loaded();
    expect(store.owners().map((person: Person) => person.id)).toEqual(['u-cm']);

    store.refresh();
    await settle();

    expect(store.owners().map((person: Person) => person.id)).toEqual(['u-cm', 'u-hd']);
  });

  /**
   * Function queued
   *
   * @description
   * Clicks `+` twice on the sign-ups: the first send waits on the returned subject, so the second
   * click is queued behind it.
   *
   * @param {InstanceType<typeof GoalsStore>} store - The store.
   * @returns {Promise<Subject<KeyResultWrite>>} The first send.
   */
  async function queued(store: InstanceType<typeof GoalsStore>): Promise<Subject<KeyResultWrite>> {
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(first));
    store.step('g1', 'k6', 1);
    await burst();
    store.step('g1', 'k6', 1);
    return first;
  }

  it('rebases a queued change on the confirmed one after a stale version', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.updateResult.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(goal({ version: 7, results: [signups(177)] }));

    first.next({ result: signups(177), version: 4 });
    first.complete();
    await settle();

    expect(api.updateResult.mock.calls.slice(1)).toEqual([
      ['g1', 'k6', 4, { currentValue: 186 }],
      ['g1', 'k6', 7, { currentValue: 186 }],
    ]);
  });

  it('moves only the unsent steps of a queued change from a value set elsewhere', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.updateResult.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(goal({ version: 7, results: [signups(200)] }));

    first.next({ result: signups(177), version: 4 });
    first.complete();
    await settle();

    expect(api.updateResult.mock.calls[2]).toEqual(['g1', 'k6', 7, { currentValue: 209 }]);
  });

  it('sends a queued checkbox change again after a stale version of its own write', async () => {
    const guide: KeyResult = {
      id: 'k3',
      kind: 'checkbox',
      label: 'SSO guide published',
      checked: false,
      progressPercent: 0,
    };
    api.list.mockResolvedValue(list([goal({ results: [guide] })]));
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult
      .mockReturnValueOnce(firstValueFrom(first))
      .mockRejectedValueOnce(problem(412, 'request.version-mismatch'))
      .mockResolvedValue({ result: guide, version: 9 });
    api.get.mockResolvedValueOnce(
      goal({ version: 7, results: [{ ...guide, checked: true, progressPercent: 100 }] }),
    );
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.toggle('g1', 'k3');
    await burst();
    store.toggle('g1', 'k3');
    first.next({ result: { ...guide, checked: true, progressPercent: 100 }, version: 4 });
    first.complete();
    await settle();

    expect(api.updateResult.mock.calls.map((call: unknown[]) => call[3])).toEqual([
      { checked: true },
      { checked: false },
      { checked: false },
    ]);
    expect(toasts.warning).not.toHaveBeenCalled();
  });

  it('settles a timed-out change before a queued one when it was recorded', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.get.mockResolvedValueOnce(goal({ version: 4, results: [signups(177)] }));

    first.error(new HttpErrorResponse({ status: 504 }));
    await settle();

    expect(api.updateResult.mock.calls[1]).toEqual(['g1', 'k6', 4, { currentValue: 186 }]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('rebases a queued change when a timed-out one was not recorded', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.get.mockResolvedValueOnce(goal({ version: 3, results: [signups(168)] }));

    first.error(new HttpErrorResponse({ status: 0 }));
    await settle();

    expect(api.updateResult.mock.calls[1]).toEqual(['g1', 'k6', 3, { currentValue: 177 }]);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('warns and reads again when a deletion of unknown outcome cannot be checked', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.delete.mockRejectedValueOnce(problem(502));
    api.get.mockRejectedValueOnce(problem(503));

    expect(await store.remove('g1', 3)).toBe(false);
    await settle();

    expect(toasts.warning).toHaveBeenCalledWith('The deletion could not be confirmed', {
      description: 'The goal is still shown. Try again in a moment.',
    });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.list()).toHaveLength(1);
  });

  it('sends one value for clicks within a burst', async () => {
    TestBed.overrideProvider(GOAL_EDIT_BURST_MS, { useValue: 60 });
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await pause(20);
    store.step('g1', 'k6', 1);
    await pause(20);
    expect(api.updateResult).not.toHaveBeenCalled();
    await pause(80);
    await settle();

    expect(api.updateResult.mock.calls).toEqual([['g1', 'k6', 3, { currentValue: 186 }]]);
  });

  it('sends the value of a burst still waiting when the page is left', async () => {
    TestBed.overrideProvider(GOAL_EDIT_BURST_MS, { useValue: 10_000 });
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    TestBed.resetTestingModule();
    await flush();

    expect(api.updateResult.mock.calls).toEqual([['g1', 'k6', 3, { currentValue: 177 }]]);
  });

  it('holds the queue until a change of unknown outcome is settled, then sends the next one', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.get
      .mockRejectedValueOnce(problem(503))
      .mockResolvedValueOnce(goal({ version: 4, results: [signups(177)] }));

    first.error(new HttpErrorResponse({ status: 0 }));
    await expect
      .poll(async () => {
        await flush();
        return api.updateResult.mock.calls.length;
      })
      .toBe(2);

    expect(api.updateResult.mock.calls[1]).toEqual(['g1', 'k6', 4, { currentValue: 186 }]);
    expect(toasts.warning).not.toHaveBeenCalled();
  });

  it('drops the queued edits when a change of unknown outcome cannot be settled', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    api.get.mockRejectedValue(problem(503));

    first.error(new HttpErrorResponse({ status: 0 }));
    await expect
      .poll(async () => {
        await flush();
        return toasts.warning.mock.calls.length;
      })
      .toBe(1);
    await settle();

    expect(api.get).toHaveBeenCalledTimes(4);
    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(toasts.warning).toHaveBeenCalledWith('The key result change could not be confirmed', {
      description: 'Its current value shows once the goals are read again.',
    });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(shownValue(store)).toBe(168);
  });

  it('keeps a goal changed since its deletion was confirmed and asks to confirm again', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.delete.mockRejectedValueOnce(problem(412, 'request.version-mismatch'));
    api.get.mockResolvedValueOnce(goal({ version: 5, name: 'Launch SSO for all customers' }));

    expect(await store.remove('g1', 3)).toBe(false);

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(store.list()?.[0].goal).toMatchObject({
      version: 5,
      name: 'Launch SSO for all customers',
    });
    expect(toasts.warning).toHaveBeenCalledWith('This goal changed since you confirmed', {
      description: 'It was not deleted. Check it, then delete it again.',
    });
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('does not send a queued write once another organization is committed, before the store reacts', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const first: Subject<KeyResultWrite> = await queued(store);
    await burst();

    commit(STUDIO_SUD);
    first.next({ result: signups(177), version: 4 });
    first.complete();
    await flush();

    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    TestBed.tick();
    await settle();
    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('does not apply an answer that lands once another organization is committed, before the store reacts', async () => {
    const answer: Deferred<Goal> = deferred<Goal>();
    api.create.mockReturnValueOnce(answer.promise);
    const store: InstanceType<typeof GoalsStore> = await loaded();
    const creating: Promise<string | null> = store.create(SUPPORT);
    await flush();

    commit(STUDIO_SUD);
    answer.resolve(goal({ id: 'g9', name: SUPPORT.name, version: 1, results: [] }));

    await expect(creating).resolves.toBeNull();
    TestBed.tick();
    await settle();
    expect(store.list()?.map((view: GoalView) => view.goal.id)).toEqual(['g1']);
    expect(store.creating()).toBe(false);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('refuses a write while the pin names another organization than the store', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();

    pin.set(STUDIO_SUD.id);
    store.step('g1', 'k6', 1);
    await burst();

    await expect(store.create(SUPPORT)).resolves.toBeNull();
    expect(organization().id).toBe(ATELIER_NORD.id);
    expect(api.updateResult).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    expect(store.creating()).toBe(false);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('never sends a queued write once the page is gone and another organization is committed', async () => {
    const first: Subject<KeyResultWrite> = new Subject<KeyResultWrite>();
    api.updateResult.mockReturnValueOnce(firstValueFrom(first));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    store.step('g1', 'k6', 1);
    await burst();
    store.step('g1', 'k6', 1);
    TestBed.resetTestingModule();
    commit(STUDIO_SUD);
    first.next({ result: signups(177), version: 4 });
    first.complete();
    await flush();

    expect(api.updateResult).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
  });
});
