import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { firstValueFrom, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { SPACE_DIRECTORY, type SpaceDirectoryEntry } from '@features/spaces/ports/space-directory';
import { TaskDetailOpener } from '@features/task';
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
import { GoalsStore } from './goals.store';

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
  let toasts: { success: Mock; error: Mock };

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
    toasts = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GoalsStore,
        { provide: GoalsApi, useValue: api },
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
    const store: InstanceType<typeof GoalsStore> = TestBed.inject(GoalsStore);
    await settle();
    return store;
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

  it('reads the goals again after an unknown outcome instead of reporting a failure', async () => {
    api.updateResult.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 }));
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.list.mockResolvedValue(list([goal({ results: [signups(177)] })]));

    store.step('g1', 'k6', 1);
    await settle();

    expect(toasts.error).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list.mock.calls[1][2]).toBe(true);
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
    await flush();
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
    organization.set(STUDIO_SUD);
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

  it('settles a creation of unknown outcome by reading the goals again', async () => {
    const store: InstanceType<typeof GoalsStore> = await loaded();
    api.create.mockRejectedValueOnce(problem(504));
    api.list.mockResolvedValueOnce(
      list([goal({ id: 'g9', name: 'Cut the support response time' }), goal()]),
    );

    const id: string | null = await store.create({
      name: 'Cut the support response time',
      ownerUserId: 'u-cm',
      spaceId: null,
      firstResult: null,
    });

    expect(id).toBe('g9');
    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledTimes(1);
  });

  it('deletes a goal from the version shown and counts a missing goal as deleted', async () => {
    api.list.mockResolvedValue(list([goal(), goal({ id: 'g2', name: 'Halve the open bugs' })]));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(await store.remove('g1')).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('g1', 3);
    api.delete.mockRejectedValueOnce(problem(404, 'goal.not-found'));
    expect(await store.remove('g2')).toBe(true);

    expect(store.isEmpty()).toBe(true);
    expect(toasts.success).toHaveBeenLastCalledWith('Goal deleted', {
      description: 'Halve the open bugs',
    });
  });

  it('keeps a goal whose deletion is refused and toasts the failure', async () => {
    api.delete.mockRejectedValueOnce(problem(403, 'access.role-insufficient'));
    const store: InstanceType<typeof GoalsStore> = await loaded();

    expect(await store.remove('g1')).toBe(false);
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
});
