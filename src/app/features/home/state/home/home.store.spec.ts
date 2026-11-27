import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin, OrganizationSwitchPendingError } from '@core/api';
import { RealtimeConnection } from '@core/realtime';
import { LIST_DIRECTORY, type ListDirectoryEntry } from '@features/spaces/ports/list-directory';
import {
  type CreatedTask,
  type Person,
  personOf,
  TaskCreate,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceOrganization,
} from '@features/workspace/ports/workspace-context';

import {
  HomeApi,
  type HomeReadOptions,
} from '../../data-access/services/home-api/home-api.service';
import type { HomeSnapshot } from '../../models/home-read/home-read.interface';
import { FOCUS_REFRESH_MS, HomeStore, type HomeStoreInstance } from './home.store';

/**
 * Function myTask
 *
 * @description
 * A task of Camille Martin in Atelier Nord's `Sprint 14`, open and due on 12 November 2026.
 *
 * @param {string} key - Its key.
 * @returns {TaskSummary} The task.
 */
function myTask(key: string): TaskSummary {
  return {
    id: key,
    key,
    name: 'Review of the SSO flow',
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: ['u-camille'],
    due: '2026-11-12',
    start: null,
    labels: [],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'l-sprint-14',
    spaceId: 'sp-product',
    version: 3,
  };
}

/**
 * Function snapshotOf
 *
 * @description
 * A home screen whose priorities hold the given keys, with `Sprint 14` current.
 *
 * @param {readonly string[]} keys - The keys of the priorities.
 * @param {number} assigned - The `Assigned to me` count.
 * @returns {HomeSnapshot} The read.
 */
function snapshotOf(keys: readonly string[], assigned: number = 9): HomeSnapshot {
  return {
    stats: { assigned, late: 2, dueToday: 1, done: 31 },
    priorities: keys.map(myTask),
    sprint: {
      listId: 'l-sprint-14',
      name: 'Sprint 14',
      startDate: '2026-11-03',
      endDate: '2026-11-17',
      done: 12,
      live: 32,
    },
    lists: [{ id: 'l-sprint-14', name: 'Sprint 14', spaceId: 'sp-product', open: 14 }],
  };
}

/**
 * Function organization
 *
 * @description
 * A workspace organization.
 *
 * @param {string} id - Its id, also its slug.
 * @returns {WorkspaceOrganization} The organization.
 */
function organization(id: string): WorkspaceOrganization {
  return { id, slug: id, name: id, initials: 'AN', role: 'owner', plan: 'team' };
}

/**
 * Function deferred
 *
 * @description
 * A promise settled by the test.
 *
 * @returns {{ promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void }}
 * The promise and its settlers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (error: Error) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>(
    (done: (value: T) => void, fail: (error: Error) => void) => {
      resolve = done;
      reject = fail;
    },
  );
  return { promise, resolve, reject };
}

/**
 * Constant sprint
 *
 * @description
 * The `Sprint 14` list of the `Product` space, as the sidebar knows it.
 *
 * @type {ListDirectoryEntry}
 */
const sprint: ListDirectoryEntry = {
  id: 'l-sprint-14',
  name: 'Sprint 14',
  spaceId: 'sp-product',
  spaceName: 'Product',
  icon: 'phosphorRocketBold',
  tone: 'text-violet-text',
};

describe('HomeStore', () => {
  let read: Mock<(today: string, options: HomeReadOptions) => Promise<HomeSnapshot>>;
  let people: Mock<(signal?: AbortSignal) => Promise<readonly Person[]>>;
  let current: WritableSignal<WorkspaceOrganization>;
  let reconnects: Subject<void>;
  let detailClosed: Subject<string>;
  let detailChanged: Subject<string>;
  let created: Subject<CreatedTask>;
  let verified: Subject<void>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    read = vi.fn(() => Promise.resolve(snapshotOf(['CAD-482'])));
    people = vi.fn(() => Promise.resolve([personOf('u-camille', 'Camille Martin')]));
    current = signal(organization('atelier-nord'));
    reconnects = new Subject<void>();
    detailClosed = new Subject<string>();
    detailChanged = new Subject<string>();
    created = new Subject<CreatedTask>();
    verified = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        HomeStore,
        { provide: HomeApi, useValue: { read, people } },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: current } },
        { provide: LIST_DIRECTORY, useValue: { lists: signal([sprint]) } },
        { provide: RealtimeConnection, useValue: { reconnected: reconnects } },
        { provide: TaskDetailOpener, useValue: { closed: detailClosed, changed: detailChanged } },
        { provide: TaskCreate, useValue: { created } },
        { provide: OrganizationPin, useValue: { organizationVerified: verified } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Function settle
   *
   * @description
   * Lets the resources start and settle their reads.
   *
   * @returns {Promise<void>} Resolves once the microtasks ran.
   */
  async function settle(): Promise<void> {
    for (let round: number = 0; round < 6; round += 1) {
      TestBed.tick();
      await Promise.resolve();
      await new Promise<void>((done: () => void): void => {
        queueMicrotask(done);
      });
    }
    TestBed.tick();
  }

  /**
   * Function loaded
   *
   * @description
   * The store once its first read settled.
   *
   * @returns {Promise<HomeStoreInstance>} The store.
   */
  async function loaded(): Promise<HomeStoreInstance> {
    const store: HomeStoreInstance = TestBed.inject(HomeStore);
    await settle();
    return store;
  }

  /**
   * Function keys
   *
   * @description
   * The keys of the priorities shown.
   *
   * @param {HomeStoreInstance} store - The store.
   * @returns {readonly string[]} The keys.
   */
  function keys(store: HomeStoreInstance): readonly string[] {
    return store.tasks().map((task: TaskSummary) => task.key);
  }

  it('reads the home screen actively against the local day', async () => {
    const store: HomeStoreInstance = TestBed.inject(HomeStore);
    TestBed.tick();
    expect(store.read()).toBeUndefined();

    await settle();

    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe('2026-11-12');
    expect(read.mock.calls[0][1].passive).toBe(false);
    expect(keys(store)).toEqual(['CAD-482']);
    expect(store.read()).toMatchObject({ today: '2026-11-12', refreshFailed: false });
    expect(store.listNames().get('l-sprint-14')).toBe('Sprint 14');
    expect(store.spaceNames().get('sp-product')).toBe('Product');
    expect(store.moveTargets()).toEqual([
      {
        listId: 'l-sprint-14',
        name: 'Sprint 14',
        spaceName: 'Product',
        icon: 'phosphorRocketBold',
        tone: 'text-violet-text',
      },
    ]);
  });

  it('hands a failed first read to the error boundary instead of an empty page', async () => {
    read.mockRejectedValueOnce(new Error('unavailable'));
    const store: HomeStoreInstance = await loaded();

    expect(() => store.read()).toThrow();
    expect(store.tasks()).toEqual([]);
  });

  it('refreshes in the background keeping the values, and a failed refresh keeps them flagged', async () => {
    const store: HomeStoreInstance = await loaded();
    const refresh: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    read.mockReturnValueOnce(refresh.promise);

    store.refresh();
    await settle();

    expect(read.mock.calls[1][1].passive).toBe(true);
    expect(store.reloading()).toBe(true);
    expect(keys(store)).toEqual(['CAD-482']);

    refresh.reject(new Error('unavailable'));
    await settle();

    expect(store.read()).toMatchObject({ refreshFailed: true, stats: { assigned: 9 } });
    expect(keys(store)).toEqual(['CAD-482']);

    read.mockResolvedValueOnce(snapshotOf(['CAD-482', 'CAD-475'], 10));
    store.retry();
    await settle();

    expect(read.mock.calls[2][1].passive).toBe(false);
    expect(store.read()).toMatchObject({ refreshFailed: false, stats: { assigned: 10 } });
    expect(keys(store)).toEqual(['CAD-482', 'CAD-475']);
  });

  it('keeps the values silently when a refresh is refused during an organization change', async () => {
    const store: HomeStoreInstance = await loaded();
    read.mockRejectedValueOnce(new OrganizationSwitchPendingError());

    store.refresh();
    await settle();

    expect(store.read()?.refreshFailed).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);

    verified.next();
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
    expect(read.mock.calls[2][1].passive).toBe(true);
  });

  it('keeps the error of a failed refresh when a later refresh is refused by the context', async () => {
    const store: HomeStoreInstance = await loaded();
    read.mockRejectedValueOnce(new Error('unavailable'));
    store.refresh();
    await settle();
    expect(store.read()?.refreshFailed).toBe(true);

    read.mockRejectedValueOnce(new OrganizationSwitchPendingError());
    store.refresh();
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
    expect(store.read()?.refreshFailed).toBe(true);

    verified.next();
    await settle();

    expect(read).toHaveBeenCalledTimes(4);
    expect(store.read()?.refreshFailed).toBe(false);
  });

  it('sends one more read when refreshes are asked for while a read runs', async () => {
    const store: HomeStoreInstance = await loaded();
    const running: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    read.mockReturnValueOnce(running.promise);

    store.refresh();
    await settle();
    store.refresh();
    store.refresh();
    await settle();
    expect(read).toHaveBeenCalledTimes(2);

    running.resolve(snapshotOf(['CAD-482']));
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reads again after a reconnection, a closed or changed detail and a creation', async () => {
    await loaded();

    reconnects.next();
    await settle();
    detailClosed.next('CAD-482');
    await settle();
    detailChanged.next('CAD-482');
    await settle();
    created.next({ key: 'CAD-490' } as CreatedTask);
    await settle();

    expect(read).toHaveBeenCalledTimes(5);
    expect(read.mock.calls.slice(1).every((call) => call[1].passive)).toBe(true);
  });

  it('reads again on focus only when no read settled in the last 30 seconds', async () => {
    await loaded();

    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(read).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + FOCUS_REFRESH_MS);
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1].passive).toBe(true);
  });

  it('ignores a focus while the first read runs and once it settled within 30 seconds', async () => {
    const first: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    read.mockReturnValueOnce(first.promise);
    const store: HomeStoreInstance = TestBed.inject(HomeStore);
    await settle();

    window.dispatchEvent(new Event('focus'));
    await settle();
    first.resolve(snapshotOf(['CAD-482']));
    await settle();
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(read).toHaveBeenCalledTimes(1);
    expect(keys(store)).toEqual(['CAD-482']);
  });

  it('ignores a focus while the first read of a new organization runs', async () => {
    await loaded();
    vi.setSystemTime(Date.now() + FOCUS_REFRESH_MS);
    const lumen: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    read.mockReturnValueOnce(lumen.promise);
    current.set(organization('lumen'));
    await settle();

    window.dispatchEvent(new Event('focus'));
    await settle();
    lumen.resolve(snapshotOf(['LUM-1']));
    await settle();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('counts a refresh against the new local day after midnight', async () => {
    const store: HomeStoreInstance = await loaded();
    vi.setSystemTime(new Date(2026, 10, 13, 0, 5));

    store.refresh();
    await settle();

    expect(read.mock.calls[1][0]).toBe('2026-11-13');
    expect(store.read()?.today).toBe('2026-11-13');
  });

  it('never shows a read of the previous organization after a switch', async () => {
    const store: HomeStoreInstance = await loaded();
    const late: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    const lumen: ReturnType<typeof deferred<HomeSnapshot>> = deferred<HomeSnapshot>();
    read.mockReturnValueOnce(late.promise).mockReturnValueOnce(lumen.promise);

    store.refresh();
    await settle();
    current.set(organization('lumen'));
    await settle();

    expect(store.read()).toBeUndefined();
    expect(read.mock.calls[2][1].passive).toBe(false);
    expect(read.mock.calls[1][1].signal?.aborted).toBe(true);

    late.resolve(snapshotOf(['CAD-999']));
    await settle();
    expect(store.read()).toBeUndefined();

    lumen.resolve(snapshotOf(['LUM-1']));
    await settle();
    expect(keys(store)).toEqual(['LUM-1']);
  });

  it('fails a first read of the new organization rather than showing the previous one', async () => {
    const store: HomeStoreInstance = await loaded();
    read.mockRejectedValueOnce(new Error('unavailable'));

    current.set(organization('lumen'));
    await settle();

    expect(() => store.read()).toThrow();
  });

  it('reads the members once the menu opens, and again after their failure', async () => {
    const store: HomeStoreInstance = await loaded();
    expect(people).not.toHaveBeenCalled();
    people.mockRejectedValueOnce(new Error('unavailable'));

    store.loadPeople();
    expect(store.peopleState()).toBe('loading');
    await settle();
    expect(store.people()).toEqual([]);
    expect(store.peopleState()).toBe('failed');

    store.loadPeople();
    await settle();

    expect(people).toHaveBeenCalledTimes(2);
    expect(store.people().map((person: Person) => person.name)).toEqual(['Camille Martin']);
    expect(store.peopleState()).toBe('ready');
  });
});
