import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { type CreatedTask, TaskCreate, TaskDetailOpener } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';
import { UnavailableRouteError } from '@shared/route-errors';

import { ListActivityApi } from '../../data-access/services/list-activity-api/list-activity-api.service';
import type {
  ListActivityEntry,
  ListActivityFilter,
  ListActivityPage,
} from '../../models/list-activity/list-activity.interface';
import { ListPageStore } from '../list-page/list-page.store';
import { ActivityViewStore, type ActivityViewStoreInstance } from './activity-view.store';

/**
 * Type PageRead
 *
 * @description
 * Signature of the faked page read.
 *
 * @type {ListActivityApi['page']}
 */
type PageRead = ListActivityApi['page'];

/**
 * Function entry
 *
 * @description
 * A status change of `Sprint 14` by Camille Martin.
 *
 * @param {string} id - Identifier of the entry.
 * @returns {ListActivityEntry} The entry.
 */
function entry(id: string): ListActivityEntry {
  return {
    id,
    at: '2026-11-08T07:40:00Z',
    actor: { type: 'user', id: 'u-camille', provider: null },
    task: { key: 'CAD-479', name: 'Fix the redirect after sign-in', status: 'progress' },
    change: { kind: 'status', from: 'todo', to: 'progress' },
  };
}

/**
 * Function pageOf
 *
 * @description
 * A page of entries.
 *
 * @param {readonly string[]} ids - Its entries.
 * @param {string | null} nextCursor - Cursor of the next page.
 * @param {number} total - Entries matching on every page.
 * @returns {ListActivityPage} The page.
 */
function pageOf(
  ids: readonly string[],
  nextCursor: string | null,
  total: number,
): ListActivityPage {
  return { items: ids.map(entry), nextCursor, total };
}

/**
 * Function ids
 *
 * @description
 * The identifiers of the entries shown.
 *
 * @param {ActivityViewStoreInstance} store - The store.
 * @returns {readonly string[]} The identifiers.
 */
function ids(store: ActivityViewStoreInstance): readonly string[] {
  return store.entries().map((item: ListActivityEntry): string => item.id);
}

/**
 * Function range
 *
 * @description
 * The identifiers `e<from>` to `e<to - 1>`, newest first as the gateway answers them.
 *
 * @param {number} from - First index.
 * @param {number} to - Index after the last one.
 * @returns {readonly string[]} The identifiers.
 */
function range(from: number, to: number): readonly string[] {
  return Array.from(
    { length: to - from },
    (_value: unknown, index: number) => `e${String(from + index)}`,
  );
}

describe('ActivityViewStore', () => {
  let page: Mock<PageRead>;
  let notices: Subject<RealtimeChange>;
  let created: Subject<CreatedTask>;
  let detailClosings: Subject<string>;
  let organization: WritableSignal<{ id: string; slug: string }>;
  let listId: WritableSignal<string | null>;

  /**
   * Function setup
   *
   * @description
   * Provides the store with the faked reads, the open list, realtime and Task's services.
   *
   * @returns {ActivityViewStoreInstance} The store, reading.
   */
  function setup(): ActivityViewStoreInstance {
    TestBed.configureTestingModule({
      providers: [
        ActivityViewStore,
        { provide: ListActivityApi, useValue: { page } },
        { provide: ListPageStore, useValue: { listId } },
        { provide: RealtimeConnection, useValue: { watch: () => notices.asObservable() } },
        { provide: TaskCreate, useValue: { created: created.asObservable() } },
        {
          provide: TaskDetailOpener,
          useValue: { closed: detailClosings.asObservable(), changed: new Subject<string>() },
        },
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
      ],
    });
    return TestBed.inject(ActivityViewStore);
  }

  /**
   * Function settle
   *
   * @description
   * Runs the effects, the pending timers and the promises until the store is still.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(): Promise<void> {
    for (let round: number = 0; round < 4; round++) {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  /**
   * Function deferPage
   *
   * @description
   * Makes the next page read wait for the test's answer.
   *
   * @returns {Deferred} The answer's handles.
   */
  function deferPage(): Deferred {
    let handles: Deferred = { resolve: () => undefined, reject: () => undefined };
    page.mockImplementationOnce(
      () =>
        new Promise<ListActivityPage>(
          (resolve: (value: ListActivityPage) => void, reject: (error: Error) => void) => {
            handles = { resolve, reject };
          },
        ),
    );
    return {
      resolve: (value: ListActivityPage): void => {
        handles.resolve(value);
      },
      reject: (error: Error): void => {
        handles.reject(error);
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject<RealtimeChange>();
    created = new Subject<CreatedTask>();
    detailClosings = new Subject<string>();
    organization = signal({ id: 'org-atelier-nord', slug: 'atelier-nord' });
    listId = signal<string | null>('sprint-14');
    page = vi.fn<PageRead>(() => Promise.resolve(pageOf(['e1', 'e2'], 'p2', 3)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the first page of every kind and everyone, with the skeleton meanwhile', async () => {
    const store: ActivityViewStoreInstance = setup();
    TestBed.tick();
    expect(store.loading()).toBe(true);
    expect(store.firstRead()).toBe(true);

    await settle();

    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      { kinds: [], actorId: null },
      null,
      50,
      expect.any(AbortSignal),
    );
    expect(ids(store)).toEqual(['e1', 'e2']);
    expect(store.total()).toBe(3);
    expect(store.loading()).toBe(false);
    expect(store.firstRead()).toBe(false);
    expect(store.empty()).toBe(false);
    expect(store.hasMore()).toBe(true);
    expect(store.filtered()).toBe(false);
  });

  it('tells a successful empty answer from a failed first read, and Retry reads again', async () => {
    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-1'));
    const store: ActivityViewStoreInstance = setup();
    await settle();

    expect(store.primary.error()).toBeInstanceOf(UnavailableRouteError);
    expect(store.firstRead()).toBe(true);
    expect(store.failed()).toBe(false);
    expect(store.empty()).toBe(false);

    page.mockResolvedValueOnce(pageOf([], null, 0));
    store.reload();
    await settle();

    expect(page).toHaveBeenCalledTimes(2);
    expect(store.empty()).toBe(true);
    expect(store.total()).toBe(0);
    expect(store.primary.error()).toBeUndefined();
  });

  it('reads the server-filtered kinds and person, in the chips order, then clears them', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();

    page.mockResolvedValueOnce(pageOf(['e3'], null, 1));
    store.filterKinds(['due', 'status', 'due']);
    store.filterPerson('u-ines');
    TestBed.tick();
    expect(store.entries()).toEqual([]);
    expect(store.loading()).toBe(true);
    await settle();

    const filter: ListActivityFilter = { kinds: ['status', 'due'], actorId: 'u-ines' };
    expect(store.filter()).toEqual(filter);
    expect(store.filtered()).toBe(true);
    expect(page).toHaveBeenLastCalledWith('sprint-14', filter, null, 50, expect.any(AbortSignal));
    expect(ids(store)).toEqual(['e3']);

    store.clearFilters();
    await settle();
    expect(store.filtered()).toBe(false);
    expect(page).toHaveBeenLastCalledWith(
      'sprint-14',
      { kinds: [], actorId: null },
      null,
      50,
      expect.any(AbortSignal),
    );
  });

  it('offers Retry in place when a read fails after the list was shown', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();

    page.mockRejectedValueOnce(new UnavailableRouteError(503, 'req-2'));
    store.filterKinds(['comment']);
    await settle();

    expect(store.failed()).toBe(true);
    expect(store.firstRead()).toBe(false);
    expect(store.current()).toBe(false);

    page.mockResolvedValueOnce(pageOf(['e9'], null, 1));
    store.reload();
    await settle();

    expect(store.failed()).toBe(false);
    expect(ids(store)).toEqual(['e9']);
  });

  it('appends older pages once each, and retries a failed one', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();

    page.mockRejectedValueOnce(new Error('offline'));
    await store.loadMore();
    expect(store.moreFailed()).toBe(true);
    expect(ids(store)).toEqual(['e1', 'e2']);

    page.mockResolvedValueOnce(pageOf(['e2', 'e3'], null, 3));
    await store.loadMore();

    expect(page).toHaveBeenLastCalledWith('sprint-14', { kinds: [], actorId: null }, 'p2', 50);
    expect(ids(store)).toEqual(['e1', 'e2', 'e3']);
    expect(store.moreFailed()).toBe(false);
    expect(store.hasMore()).toBe(false);
  });

  it('reads the first page again once per window of activity notices, as many as shown', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();
    page.mockResolvedValueOnce(pageOf(['e2', 'e3'], null, 3));
    await store.loadMore();
    page.mockClear();
    page.mockResolvedValueOnce(pageOf(['e1', 'e2', 'e3'], null, 3));

    notices.next({
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { taskId: 't1', changed: ['priority'] },
    });
    notices.next({
      id: 'n2',
      type: 'task.status-changed.v1',
      at: '2026-11-08T09:00:00Z',
      data: { taskId: 't1', changed: ['status'] },
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(page).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith(
      'sprint-14',
      { kinds: [], actorId: null },
      null,
      50,
      expect.any(AbortSignal),
    );
  });

  it('ignores a comment notice and a notice naming another list', async () => {
    setup();
    await settle();
    page.mockClear();

    notices.next({
      id: 'n1',
      type: 'comment.created.v1',
      at: '2026-11-08T09:00:00Z',
      data: { taskId: 't1', commentId: 'c1' },
    });
    notices.next({
      id: 'n2',
      type: 'list.tasks-changed.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'backlog' },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await settle();

    expect(page).not.toHaveBeenCalled();
  });

  it('reads again after a task created in the list or a closed task detail', async () => {
    setup();
    await settle();
    page.mockClear();

    created.next({ key: 'CAD-500', listId: 'backlog' } as CreatedTask);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(page).not.toHaveBeenCalled();

    created.next({ key: 'CAD-501', listId: 'sprint-14' } as CreatedTask);
    detailClosings.next('CAD-479');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('hides the entries at once in another organization and starts over', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();

    let answer: (value: ListActivityPage) => void = () => undefined;
    page.mockImplementationOnce(
      () =>
        new Promise<ListActivityPage>((resolve: (value: ListActivityPage) => void) => {
          answer = resolve;
        }),
    );
    organization.set({ id: 'org-other', slug: 'other' });
    TestBed.tick();

    expect(store.entries()).toEqual([]);
    expect(store.total()).toBeNull();
    expect(store.firstRead()).toBe(true);
    expect(store.loading()).toBe(true);

    answer(pageOf(['x1'], null, 1));
    await settle();
    expect(ids(store)).toEqual(['x1']);
  });

  it('keeps the range loaded past 100 entries when it reads it again', async () => {
    page.mockResolvedValueOnce(pageOf(range(0, 50), 'p2', 151));
    const store: ActivityViewStoreInstance = setup();
    await settle();
    page.mockResolvedValueOnce(pageOf(range(50, 100), 'p3', 151));
    await store.loadMore();
    page.mockResolvedValueOnce(pageOf(range(100, 150), 'p4', 151));
    await store.loadMore();
    expect(ids(store)).toHaveLength(150);
    page.mockClear();

    page.mockResolvedValueOnce(pageOf(['n0', ...range(0, 99)], 'r2', 152));
    page.mockResolvedValueOnce(pageOf(range(99, 149), 'r3', 152));
    store.reload();
    await settle();

    expect(page.mock.calls.map((call) => [call[2], call[3]])).toEqual([
      [null, 100],
      ['r2', 50],
    ]);
    expect(ids(store)).toEqual(['n0', ...range(0, 150)]);
    expect(store.total()).toBe(152);

    page.mockResolvedValueOnce(pageOf(['e150'], null, 152));
    await store.loadMore();
    expect(page).toHaveBeenLastCalledWith('sprint-14', { kinds: [], actorId: null }, 'p4', 50);
  });

  it('lets a page request superseded by a refresh change nothing when it settles', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();
    const stale: Deferred = deferPage();
    const first: Promise<void> = store.loadMore();
    expect(store.loadingMore()).toBe(true);

    page.mockResolvedValueOnce(pageOf(['e0', 'e1', 'e2'], 'q2', 4));
    store.reload();
    await settle();
    expect(store.loadingMore()).toBe(false);

    const active: Deferred = deferPage();
    const second: Promise<void> = store.loadMore();
    stale.reject(new Error('offline'));
    await first;
    expect(store.loadingMore()).toBe(true);
    expect(store.moreFailed()).toBe(false);
    expect(ids(store)).toEqual(['e0', 'e1', 'e2']);

    active.resolve(pageOf(['e3'], null, 4));
    await second;
    expect(store.loadingMore()).toBe(false);
    expect(ids(store)).toEqual(['e0', 'e1', 'e2', 'e3']);
    expect(page.mock.calls.at(-1)?.[2]).toBe('q2');
  });

  it('lets a page request of another filter change nothing when it settles', async () => {
    const store: ActivityViewStoreInstance = setup();
    await settle();
    const stale: Deferred = deferPage();
    const first: Promise<void> = store.loadMore();

    page.mockResolvedValueOnce(pageOf(['c1'], 'c2', 2));
    store.filterKinds(['comment']);
    await settle();
    expect(store.loadingMore()).toBe(false);

    const active: Deferred = deferPage();
    const second: Promise<void> = store.loadMore();
    stale.resolve(pageOf(['e3'], 'p3', 3));
    await first;
    expect(store.loadingMore()).toBe(true);
    expect(ids(store)).toEqual(['c1']);

    active.reject(new Error('offline'));
    await second;
    expect(store.loadingMore()).toBe(false);
    expect(store.moreFailed()).toBe(true);
    expect(ids(store)).toEqual(['c1']);

    store.clearFilters();
    await settle();
    expect(store.moreFailed()).toBe(false);
  });
});

/**
 * Interface Deferred
 *
 * @description
 * A page read whose answer the test gives.
 */
interface Deferred {
  // #region Properties
  /**
   * Property resolve
   *
   * @description
   * Answers the read with a page.
   *
   * @type {(page: ListActivityPage) => void}
   * @readonly
   */
  readonly resolve: (page: ListActivityPage) => void;

  /**
   * Property reject
   *
   * @description
   * Fails the read.
   *
   * @type {(error: Error) => void}
   * @readonly
   */
  readonly reject: (error: Error) => void;
  // #endregion
}
