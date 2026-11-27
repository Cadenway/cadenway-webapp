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
  MyTasksApi,
  MyTasksPartialReadError,
  type MyTasksReadOptions,
} from '../../data-access/services/my-tasks-api/my-tasks-api.service';
import type { MyTasksPage, MyTasksTab } from '../../models/my-tasks-read/my-tasks-read.interface';
import { FOCUS_REFRESH_MS, MyTasksStore, type MyTasksStoreInstance } from './my-tasks.store';

/**
 * Function myTask
 *
 * @description
 * A task of Camille Martin in Atelier Nord's `Sprint 14`, open and due on 12 November 2026 unless
 * the overrides say otherwise.
 *
 * @param {Partial<TaskSummary>} overrides - The fields that differ.
 * @returns {TaskSummary} The task.
 */
function myTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  const key: string = overrides.key ?? 'CAD-482';
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
    ...overrides,
  };
}

/**
 * Function pageOf
 *
 * @description
 * A complete read of one page holding the given tasks, the last one unless a next cursor is given.
 *
 * @param {readonly TaskSummary[]} tasks - The tasks.
 * @param {number} closed - The `Done` count.
 * @param {string | null} nextCursor - The page after it, if any.
 * @returns {MyTasksPage} The read.
 */
function pageOf(
  tasks: readonly TaskSummary[],
  closed: number = 0,
  nextCursor: string | null = null,
): MyTasksPage {
  return { tasks, counts: { open: tasks.length, closed }, complete: true, nextCursor, pages: 1 };
}

/**
 * Function partial
 *
 * @description
 * A read whose later page failed with `cause` after the given tasks.
 *
 * @param {readonly TaskSummary[]} tasks - The tasks read before the failure.
 * @param {unknown} cause - The failure of the later page.
 * @returns {MyTasksPartialReadError} The rejection of the read.
 */
function partial(tasks: readonly TaskSummary[], cause: unknown): MyTasksPartialReadError {
  return new MyTasksPartialReadError(
    { tasks, counts: { open: 9, closed: 0 }, complete: false, nextCursor: 'c2', pages: 1 },
    cause,
  );
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

describe('MyTasksStore', () => {
  let read: Mock<(tab: MyTasksTab, options: MyTasksReadOptions) => Promise<MyTasksPage>>;
  let people: Mock<(signal?: AbortSignal) => Promise<readonly Person[]>>;
  let current: WritableSignal<WorkspaceOrganization>;
  let lists: WritableSignal<readonly ListDirectoryEntry[]>;
  let reconnects: Subject<void>;
  let detailClosed: Subject<string>;
  let detailChanged: Subject<string>;
  let created: Subject<CreatedTask>;
  let verified: Subject<void>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 9, 30));
    read = vi.fn(() => Promise.resolve(pageOf([myTask()], 4)));
    people = vi.fn(() => Promise.resolve([personOf('u-camille', 'Camille Martin')]));
    current = signal(organization('atelier-nord'));
    lists = signal([sprint]);
    reconnects = new Subject<void>();
    detailClosed = new Subject<string>();
    detailChanged = new Subject<string>();
    created = new Subject<CreatedTask>();
    verified = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        MyTasksStore,
        { provide: MyTasksApi, useValue: { read, people } },
        { provide: WORKSPACE_CONTEXT, useValue: { organization: current } },
        { provide: LIST_DIRECTORY, useValue: { lists } },
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
   * @returns {Promise<MyTasksStoreInstance>} The store.
   */
  async function loaded(): Promise<MyTasksStoreInstance> {
    const store: MyTasksStoreInstance = TestBed.inject(MyTasksStore);
    await settle();
    return store;
  }

  it('reads the open tab actively and shows its tasks, the counts and the local day', async () => {
    const store: MyTasksStoreInstance = TestBed.inject(MyTasksStore);
    TestBed.tick();
    expect(store.read()).toBeUndefined();
    expect(store.counts()).toBeNull();

    await settle();

    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe('open');
    expect(read.mock.calls[0][1].passive).toBe(false);
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-482']);
    expect(store.counts()).toEqual({ open: 1, closed: 4 });
    expect(store.read()).toMatchObject({ tab: 'open', today: '2026-11-12', refreshFailed: false });
  });

  it('hands a failed first read to the error boundary instead of an empty tab', async () => {
    read.mockRejectedValueOnce(new Error('unavailable'));
    const store: MyTasksStoreInstance = await loaded();

    expect(() => store.read()).toThrow();
    expect(store.tasks()).toEqual([]);
  });

  it('reads another tab as a first read and keeps the counts meanwhile', async () => {
    const store: MyTasksStoreInstance = await loaded();
    const closed: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(closed.promise);

    store.show('closed');
    await settle();

    expect(read.mock.calls[1][0]).toBe('closed');
    expect(read.mock.calls[1][1].passive).toBe(false);
    expect(store.read()).toBeUndefined();
    expect(store.counts()).toEqual({ open: 1, closed: 4 });

    closed.resolve(pageOf([myTask({ key: 'CAD-470', status: 'done' })], 1));
    await settle();

    expect(store.read()?.tab).toBe('closed');
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-470']);
  });

  it('refreshes in the background keeping the rows, and a failed refresh keeps them flagged', async () => {
    const store: MyTasksStoreInstance = await loaded();
    const refresh: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(refresh.promise);

    store.refresh();
    await settle();

    expect(read.mock.calls[1][1].passive).toBe(true);
    expect(store.reloading()).toBe(true);
    expect(store.tasks()).toHaveLength(1);

    refresh.reject(new Error('unavailable'));
    await settle();

    expect(store.read()).toMatchObject({ refreshFailed: true, complete: true });
    expect(store.tasks()).toHaveLength(1);

    read.mockResolvedValueOnce(pageOf([myTask(), myTask({ key: 'CAD-475' })]));
    store.retry();
    await settle();

    expect(read.mock.calls[2][1].passive).toBe(false);
    expect(store.read()?.refreshFailed).toBe(false);
    expect(store.tasks()).toHaveLength(2);
  });

  it('keeps the rows silently when a refresh is refused during an organization change', async () => {
    const store: MyTasksStoreInstance = await loaded();
    read.mockRejectedValueOnce(new OrganizationSwitchPendingError());

    store.refresh();
    await settle();

    expect(store.read()?.refreshFailed).toBe(false);
    expect(store.tasks()).toHaveLength(1);
  });

  it('sends one more read when refreshes are asked for while a read runs', async () => {
    const store: MyTasksStoreInstance = await loaded();
    const running: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(running.promise);

    store.refresh();
    await settle();
    store.refresh();
    store.refresh();
    await settle();
    expect(read).toHaveBeenCalledTimes(2);

    running.resolve(pageOf([myTask()]));
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reads again on a reconnection, a closed or changed detail and a creation', async () => {
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
    expect(
      read.mock.calls
        .slice(1)
        .every(([, options]: [MyTasksTab, MyTasksReadOptions]) => options.passive),
    ).toBe(true);
  });

  it('reads again on the window focus only when no read settled in the last 30 s', async () => {
    await loaded();

    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(read).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + FOCUS_REFRESH_MS - 1);
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(read).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1);
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1].passive).toBe(true);
  });

  it('never shows a read of the previous organization after a switch', async () => {
    const store: MyTasksStoreInstance = await loaded();
    const late: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    const next: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(late.promise).mockReturnValueOnce(next.promise);

    store.refresh();
    await settle();
    current.set(organization('studio-sud'));
    await settle();

    expect(store.read()).toBeUndefined();
    expect(store.tasks()).toEqual([]);
    expect(store.counts()).toBeNull();
    expect(read.mock.calls[1][1].signal?.aborted).toBe(true);

    late.resolve(pageOf([myTask({ key: 'CAD-999' })]));
    await settle();
    expect(store.tasks()).toEqual([]);

    next.resolve(pageOf([myTask({ key: 'SUD-12' })]));
    await settle();
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['SUD-12']);
  });

  it('fails the page when the first read of the new organization fails', async () => {
    const store: MyTasksStoreInstance = await loaded();
    read.mockRejectedValueOnce(new Error('unavailable'));

    current.set(organization('studio-sud'));
    await settle();

    expect(() => store.read()).toThrow();
  });

  it('reads the members on the first menu opening, and again after their read failed', async () => {
    people.mockRejectedValueOnce(new Error('unavailable'));
    const store: MyTasksStoreInstance = await loaded();
    expect(people).not.toHaveBeenCalled();

    store.loadPeople();
    await settle();
    expect(people).toHaveBeenCalledTimes(1);
    expect(store.people()).toEqual([]);

    store.loadPeople();
    await settle();

    expect(people).toHaveBeenCalledTimes(2);
    expect(store.people().map((person: Person) => person.name)).toEqual(['Camille Martin']);
    store.loadPeople();
    await settle();
    expect(people).toHaveBeenCalledTimes(2);
  });

  it('names the lists of the sidebar and offers them to Move to', async () => {
    const store: MyTasksStoreInstance = await loaded();

    expect(store.listNames().get('l-sprint-14')).toBe('Sprint 14');
    expect([...store.listedSpaces()]).toEqual(['sp-product']);
    expect(store.moveTargets()).toEqual([
      {
        listId: 'l-sprint-14',
        name: 'Sprint 14',
        spaceName: 'Product',
        icon: 'phosphorRocketBold',
        tone: 'text-violet-text',
      },
    ]);

    lists.set([]);
    expect(store.listedSpaces().size).toBe(0);
  });

  it('shows the pages read before a later page failed on a first read', async () => {
    read.mockRejectedValueOnce(partial([myTask()], new Error('unavailable')));
    const store: MyTasksStoreInstance = await loaded();

    expect(store.read()).toMatchObject({ complete: false, refreshFailed: false });
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-482']);
    expect(store.counts()).toEqual({ open: 9, closed: 0 });
  });

  it('keeps every row of the previous read when a later page of a refresh fails', async () => {
    read.mockResolvedValueOnce(
      pageOf([myTask(), myTask({ key: 'CAD-475' }), myTask({ key: 'CAD-470' })], 4),
    );
    const store: MyTasksStoreInstance = await loaded();

    read.mockRejectedValueOnce(partial([myTask()], new Error('unavailable')));
    store.refresh();
    await settle();

    expect(store.read()).toMatchObject({ complete: true, refreshFailed: true });
    expect(store.tasks()).toHaveLength(3);
    expect(store.counts()).toEqual({ open: 3, closed: 4 });

    read.mockRejectedValueOnce(new Error('unavailable'));
    store.refresh();
    await settle();

    expect(store.tasks()).toHaveLength(3);
    expect(store.read()?.complete).toBe(true);
  });

  it('sends a refresh refused on a later page again once the organization is verified', async () => {
    const store: MyTasksStoreInstance = await loaded();
    read.mockRejectedValueOnce(partial([], new OrganizationSwitchPendingError()));

    store.refresh();
    await settle();

    expect(store.read()?.refreshFailed).toBe(false);
    expect(store.tasks()).toHaveLength(1);

    read.mockResolvedValueOnce(pageOf([myTask(), myTask({ key: 'CAD-475' })]));
    verified.next();
    await settle();

    expect(read).toHaveBeenCalledTimes(3);
    expect(read.mock.calls[2][1].passive).toBe(true);
    expect(store.tasks()).toHaveLength(2);

    verified.next();
    await settle();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reads Done one page at a time, adds the next page and refreshes to the depth shown', async () => {
    const store: MyTasksStoreInstance = await loaded();
    read.mockResolvedValueOnce(pageOf([myTask({ key: 'CAD-460', status: 'done' })], 2, 'c2'));
    store.show('closed');
    await settle();

    expect(read.mock.calls[1][1]).toMatchObject({ passive: false, pages: 1 });
    expect(store.canShowMore()).toBe(true);

    read.mockResolvedValueOnce(pageOf([myTask({ key: 'CAD-455', status: 'cancelled' })], 2));
    await store.showMore();
    await settle();

    expect(read.mock.calls[2]).toEqual(['closed', { passive: false, cursor: 'c2', pages: 1 }]);
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-460', 'CAD-455']);
    expect(store.canShowMore()).toBe(false);

    read.mockResolvedValueOnce({
      ...pageOf([myTask({ key: 'CAD-460', status: 'done' })], 2),
      pages: 2,
    });
    store.refresh();
    await settle();

    expect(read.mock.calls[3][1]).toMatchObject({ passive: true, pages: 2 });
  });

  it('keeps the Done rows when Show more fails, and drops a page answered after a tab change', async () => {
    const store: MyTasksStoreInstance = await loaded();
    read.mockResolvedValueOnce(pageOf([myTask({ key: 'CAD-460', status: 'done' })], 2, 'c2'));
    store.show('closed');
    await settle();

    read.mockRejectedValueOnce(new Error('unavailable'));
    await store.showMore();

    expect(store.moreFailed()).toBe(true);
    expect(store.tasks()).toHaveLength(1);
    expect(store.canShowMore()).toBe(true);

    const late: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(late.promise);
    const more: Promise<void> = store.showMore();
    expect(store.loadingMore()).toBe(true);
    expect(store.moreFailed()).toBe(false);
    store.show('open');
    await settle();
    late.resolve(pageOf([myTask({ key: 'CAD-455', status: 'done' })], 2));
    await more;
    await settle();

    expect(store.read()?.tab).toBe('open');
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-482']);
  });

  it('drops a refresh still running when the tab changes and shows the new tab only', async () => {
    const store: MyTasksStoreInstance = await loaded();
    const refresh: ReturnType<typeof deferred<MyTasksPage>> = deferred<MyTasksPage>();
    read.mockReturnValueOnce(refresh.promise);
    store.refresh();
    await settle();

    read.mockResolvedValueOnce(pageOf([myTask({ key: 'CAD-460', status: 'done' })], 2));
    store.show('closed');
    await settle();

    expect(read.mock.calls[1][1].signal?.aborted).toBe(true);
    expect(read.mock.calls[2][0]).toBe('closed');
    refresh.resolve(pageOf([myTask({ key: 'CAD-999' })]));
    await settle();

    expect(store.read()?.tab).toBe('closed');
    expect(store.tasks().map((task: TaskSummary) => task.key)).toEqual(['CAD-460']);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
