import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { TaskStatusChangesStore, type TaskSummary, TaskFieldChangesStore } from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type {
  GroupFilter,
  ListRow,
  ListRowsQuery,
  ListTaskPage,
  TaskGroupCount,
} from '../../models/list-rows/list-rows.interface';
import type { ListTaskQuery } from '../../models/list-view-config/list-view-config.interface';
import { LIST_PAGE_SIZE, ListRowsStore } from './list-rows.store';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the « Produit » space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {StatusKey} status - Saved status.
 * @param {Partial<TaskSummary>} [changes] - Other fields.
 * @returns {TaskSummary} The task.
 */
function task(key: string, status: StatusKey, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name: `Tâche ${key}`,
    status,
    cancelReason: null,
    priority: 'moyenne',
    assigneeIds: [],
    due: null,
    start: null,
    labels: [],
    subtasks: { closed: 0, total: 0 },
    checklist: { closed: 0, total: 0 },
    comments: null,
    parentKey: null,
    milestone: false,
    recurrence: 'none',
    listId: 'sprint-14',
    spaceId: 'produit',
    version: 3,
    ...changes,
  };
}

/**
 * Constant cad482
 *
 * @description
 * CAD-482, « Refondre l’écran de connexion SSO », to do.
 *
 * @type {TaskSummary}
 */
const cad482: TaskSummary = task('CAD-482', 'todo', {
  name: 'Refondre l’écran de connexion SSO',
  priority: 'haute',
});

/**
 * Constant query
 *
 * @description
 * The default query of the « Liste » view.
 *
 * @type {ListTaskQuery}
 */
const query: ListTaskQuery = { level: 'roots', sort: 'manual' };

/**
 * Constant byStatus
 *
 * @description
 * Sprint 14 grouped by status.
 *
 * @type {ListRowsQuery}
 */
const byStatus: ListRowsQuery = {
  listId: 'sprint-14',
  query,
  groupQuery: { groupBy: 'status', query },
};

/**
 * Constant flat
 *
 * @description
 * Sprint 14 without grouping.
 *
 * @type {ListRowsQuery}
 */
const flat: ListRowsQuery = { listId: 'sprint-14', query, groupQuery: null };

/**
 * Function pageOf
 *
 * @description
 * A page of tasks.
 *
 * @param {readonly TaskSummary[]} items - The tasks.
 * @param {string | null} [nextCursor] - The next cursor.
 * @returns {ListTaskPage} The page.
 */
function pageOf(items: readonly TaskSummary[], nextCursor: string | null = null): ListTaskPage {
  return { items, nextCursor, total: items.length };
}

/**
 * Type PageRead
 *
 * @description
 * Signature of `ListTasksApi.page`.
 *
 * @type {ListTasksApi['page']}
 */
type PageRead = ListTasksApi['page'];

describe('ListRowsStore', () => {
  let groups: Mock<ListTasksApi['groups']>;
  let page: Mock<PageRead>;
  let subtasks: Mock<ListTasksApi['subtasks']>;
  let changeStatus: Mock<TaskApi['changeStatus']>;
  let notices: Subject<RealtimeChange>;
  let organization: WritableSignal<{ id: string; slug: string }>;

  /**
   * Function setup
   *
   * @description
   * Provides the rows store with the task stores, the faked data access, toasts and realtime.
   *
   * @param {ListRowsQuery} rowsQuery - What the rows read.
   * @returns {InstanceType<typeof ListRowsStore>} The store, loading.
   */
  function setup(rowsQuery: ListRowsQuery): InstanceType<typeof ListRowsStore> {
    TestBed.configureTestingModule({
      providers: [
        TaskStatusChangesStore,
        TaskFieldChangesStore,
        ListRowsStore,
        { provide: ListTasksApi, useValue: { groups, page, subtasks } },
        { provide: TaskApi, useValue: { changeStatus, read: vi.fn() } },
        {
          provide: CwToastService,
          useValue: { show: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
        },
        { provide: RealtimeConnection, useValue: { watch: () => notices.asObservable() } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization, user: () => ({ id: 'u-camille' }) },
        },
      ],
    });
    const store: InstanceType<typeof ListRowsStore> = TestBed.inject(ListRowsStore);
    store.load(rowsQuery);
    return store;
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
   * Function rowOf
   *
   * @description
   * The row of a task.
   *
   * @param {InstanceType<typeof ListRowsStore>} store - The store.
   * @param {string} key - Task key.
   * @returns {ListRow | undefined} The row.
   */
  function rowOf(store: InstanceType<typeof ListRowsStore>, key: string): ListRow | undefined {
    return store.rows().find((row: ListRow): boolean => row.task.key === key);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject<RealtimeChange>();
    organization = signal({ id: 'org-atelier-nord', slug: 'atelier-nord' });
    groups = vi.fn<ListTasksApi['groups']>(() =>
      Promise.resolve<readonly TaskGroupCount[]>([
        { value: 'todo', count: 1 },
        { value: 'progress', count: 0 },
        { value: 'cancelled', count: 0 },
      ]),
    );
    page = vi.fn<PageRead>(() => Promise.resolve(pageOf([cad482])));
    subtasks = vi.fn<ListTasksApi['subtasks']>(() => Promise.resolve([]));
    changeStatus = vi.fn<TaskApi['changeStatus']>(
      (key: string, version: number, status: StatusKey): Observable<TaskSummary> =>
        of({ ...cad482, status, version: version + 1 }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the first page, then the next one by cursor as the table scrolls', async () => {
    const first: TaskSummary[] = Array.from(
      { length: LIST_PAGE_SIZE },
      (_: unknown, index: number) => task(`CAD-${String(400 + index)}`, 'todo'),
    );
    page
      .mockResolvedValueOnce(pageOf(first, 'cursor-2'))
      .mockResolvedValueOnce(pageOf([task('CAD-499', 'todo')]));
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    expect(store.initialLoading()).toBe(true);
    await settle();

    expect(store.initialLoading()).toBe(false);
    expect(store.rows()).toHaveLength(LIST_PAGE_SIZE);
    expect(store.rows()[0].group).toBe('all');
    expect(groups).not.toHaveBeenCalled();

    store.loadMore();
    await settle();

    expect(page).toHaveBeenLastCalledWith(
      'sprint-14',
      query,
      null,
      'cursor-2',
      LIST_PAGE_SIZE,
      expect.any(AbortSignal),
    );
    expect(store.rows()).toHaveLength(LIST_PAGE_SIZE + 1);
    store.loadMore();
    await settle();
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('reads each group with its value as a filter and folds « Annulé » by default', async () => {
    groups.mockResolvedValue([
      { value: 'todo', count: 1 },
      { value: 'progress', count: 1 },
      { value: 'done', count: 0 },
      { value: 'cancelled', count: 2 },
    ]);
    page.mockImplementation((_listId: string, _query: ListTaskQuery, group: GroupFilter | null) =>
      Promise.resolve(
        pageOf(
          group?.value === 'todo'
            ? [cad482]
            : group?.value === 'progress'
              ? [task('CAD-483', 'progress')]
              : [task('CAD-470', 'cancelled'), task('CAD-471', 'cancelled')],
        ),
      ),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();

    expect(page.mock.calls.map((call: Parameters<PageRead>) => call[2]?.value)).toEqual([
      'todo',
      'progress',
      'cancelled',
    ]);
    expect(store.groupOrder()).toEqual(['todo', 'progress', 'done', 'cancelled']);
    expect(store.groupCount('cancelled')).toBe(2);
    expect(store.collapsed()).toEqual(['cancelled']);
    expect(store.rows().map((row: ListRow) => [row.task.key, row.group])).toEqual([
      ['CAD-482', 'todo'],
      ['CAD-483', 'progress'],
      ['CAD-470', 'cancelled'],
      ['CAD-471', 'cancelled'],
    ]);
  });

  it('shows a status at once and files the row under it 460 ms after the click', async () => {
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    const status: InstanceType<typeof TaskStatusChangesStore> =
      TestBed.inject(TaskStatusChangesStore);

    status.request(cad482, 'progress');
    TestBed.tick();
    expect(rowOf(store, 'CAD-482')).toMatchObject({ status: 'progress', group: 'todo' });

    await vi.advanceTimersByTimeAsync(459);
    TestBed.tick();
    expect(rowOf(store, 'CAD-482')?.group).toBe('todo');

    await vi.advanceTimersByTimeAsync(1);
    TestBed.tick();
    expect(rowOf(store, 'CAD-482')).toMatchObject({
      status: 'progress',
      group: 'progress',
      entering: true,
    });
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('CAD-482', 3, 'progress', null);

    await vi.advanceTimersByTimeAsync(520);
    TestBed.tick();
    expect(rowOf(store, 'CAD-482')?.entering).toBe(false);
  });

  it('brings the confirmed status back when the gateway refuses the change', async () => {
    changeStatus.mockReturnValue(throwError(() => new Error('503')));
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    const status: InstanceType<typeof TaskStatusChangesStore> =
      TestBed.inject(TaskStatusChangesStore);

    status.request(cad482, 'progress');
    TestBed.tick();
    expect(rowOf(store, 'CAD-482')?.status).toBe('progress');

    await vi.advanceTimersByTimeAsync(460);
    await settle();

    expect(rowOf(store, 'CAD-482')).toMatchObject({ status: 'todo', group: 'todo' });
    const toasts: { error: Mock } = TestBed.inject(CwToastService) as unknown as { error: Mock };
    expect(toasts.error).toHaveBeenCalledWith(
      'Impossible de modifier le statut',
      expect.anything(),
    );
  });

  it('reads again on a realtime notice without overwriting a pending status change', async () => {
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    const status: InstanceType<typeof TaskStatusChangesStore> =
      TestBed.inject(TaskStatusChangesStore);

    status.request(cad482, 'review');
    notices.next({
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'sprint-14', taskKey: 'CAD-482' },
    });
    notices.next({
      id: 'n2',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'backlog' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await settle();

    expect(groups).toHaveBeenCalledTimes(2);
    expect(page).toHaveBeenCalledTimes(2);
    expect(rowOf(store, 'CAD-482')).toMatchObject({ status: 'review', group: 'todo' });
  });

  it('empties the rows at once when the organization switches and drops the late answer', async () => {
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    expect(store.rows()).toHaveLength(1);

    let finish: (value: ListTaskPage) => void = () => undefined;
    page.mockImplementationOnce(
      () =>
        new Promise<ListTaskPage>((resolve: (value: ListTaskPage) => void) => {
          finish = resolve;
        }),
    );
    organization.set({ id: 'org-studio', slug: 'studio' });
    await settle();

    expect(store.rows()).toEqual([]);
    expect(store.initialLoading()).toBe(true);
    finish(pageOf([task('STU-12', 'todo', { listId: 'sprint-14' })]));
    await settle();

    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['STU-12']);
  });

  it('keeps the rows and offers Retry when a next page fails', async () => {
    const first: TaskSummary[] = Array.from(
      { length: LIST_PAGE_SIZE },
      (_: unknown, index: number) => task(`CAD-${String(400 + index)}`, 'todo'),
    );
    page
      .mockResolvedValueOnce(pageOf(first, 'cursor-2'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(pageOf([task('CAD-499', 'todo')]));
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();

    store.loadMore();
    await settle();
    expect(store.moreFailed()).toBe(true);
    expect(store.rows()).toHaveLength(LIST_PAGE_SIZE);
    store.loadMore();
    await settle();
    expect(page).toHaveBeenCalledTimes(2);

    store.retryMore();
    await settle();
    expect(store.moreFailed()).toBe(false);
    expect(page).toHaveBeenLastCalledWith(
      'sprint-14',
      query,
      null,
      'cursor-2',
      LIST_PAGE_SIZE,
      expect.any(AbortSignal),
    );
    expect(store.rows()).toHaveLength(LIST_PAGE_SIZE + 1);
  });

  it('fails the primary read so the route error boundary renders it, and reads again', async () => {
    page.mockRejectedValueOnce(new Error('503'));
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();

    expect(store.primary.error()).toBeDefined();
    expect(() => store.primary.value()).toThrow();

    store.primary.reload();
    await settle();
    expect(store.primary.error()).toBeUndefined();
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482']);
  });

  it('shows the subtasks of an opened task under it', async () => {
    page.mockResolvedValue(pageOf([{ ...cad482, subtasks: { closed: 1, total: 2 } }]));
    subtasks.mockResolvedValue([
      task('CAD-484', 'done', { parentKey: 'CAD-482' }),
      task('CAD-485', 'todo', { parentKey: 'CAD-482' }),
    ]);
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    expect(rowOf(store, 'CAD-482')).toMatchObject({ expandable: true, expanded: false });

    store.toggleSubtasks('CAD-482');
    await settle();

    expect(subtasks).toHaveBeenCalledExactlyOnceWith('CAD-482');
    expect(store.rows().map((row: ListRow) => [row.task.key, row.depth, row.group])).toEqual([
      ['CAD-482', 0, 'todo'],
      ['CAD-484', 1, 'todo'],
      ['CAD-485', 1, 'todo'],
    ]);
  });
});
