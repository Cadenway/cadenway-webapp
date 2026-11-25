import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { OrganizationPin } from '@core/api';
import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { parseChange } from '@core/realtime/realtime-protocol.util';
import { TaskStatusChangesStore, type TaskSummary } from '@features/task';
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
    expect(store.groupCount('all')).toBe(LIST_PAGE_SIZE);
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

  it('continues after a page containing only already loaded tasks', async () => {
    const first: TaskSummary[] = Array.from({ length: LIST_PAGE_SIZE }, (_, index) =>
      task(`CAD-${String(index)}`, 'todo'),
    );
    page
      .mockResolvedValueOnce(pageOf(first, 'next'))
      .mockResolvedValueOnce(pageOf([first[0]], 'last'))
      .mockResolvedValueOnce(pageOf([task('CAD-new', 'todo')]));
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    store.loadMore();
    await settle();
    expect(page).toHaveBeenCalledTimes(3);
    expect(store.rows()).toHaveLength(LIST_PAGE_SIZE + 1);
  });

  it('includes unread group lines in the near-end threshold', async () => {
    groups.mockResolvedValue([
      { value: 'todo', count: 50 },
      { value: 'progress', count: 1 },
      { value: 'cancelled', count: 1 },
    ]);
    page.mockResolvedValue(
      pageOf(
        Array.from({ length: LIST_PAGE_SIZE }, (_, index) => task(`CAD-${String(index)}`, 'todo')),
        'next',
      ),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    expect(store.nearEndThreshold()).toBe(13);
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

  it('skips a full hidden status group and reads the following visible group', async () => {
    groups.mockResolvedValue([
      { value: 'triage', count: LIST_PAGE_SIZE },
      { value: 'todo', count: 1 },
    ]);
    page.mockImplementation((_listId, _query, group) =>
      Promise.resolve(
        group?.value === 'triage'
          ? pageOf(
              Array.from({ length: LIST_PAGE_SIZE }, (_, index: number) =>
                task(`CAD-hidden-${String(index)}`, 'triage'),
              ),
            )
          : pageOf([cad482]),
      ),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    store.hideStatuses(['triage']);
    await settle();

    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482']);
    expect(page.mock.calls.map((call: Parameters<PageRead>) => call[2]?.value)).toEqual(['todo']);
    expect(store.empty()).toBe(false);
  });

  it('continues loading when a status becomes hidden during the first read', async () => {
    groups.mockResolvedValue([
      { value: 'triage', count: LIST_PAGE_SIZE },
      { value: 'todo', count: 1 },
    ]);
    let finishHidden: (page: ListTaskPage) => void = () => undefined;
    let finishVisible: (page: ListTaskPage) => void = () => undefined;
    page.mockImplementation(
      (_listId, _query, group) =>
        new Promise<ListTaskPage>((resolve) => {
          if (group?.value === 'triage') finishHidden = resolve;
          else finishVisible = resolve;
        }),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);
    store.hideStatuses(['triage']);
    await settle();
    finishHidden(
      pageOf(
        Array.from({ length: LIST_PAGE_SIZE }, (_, index: number) =>
          task(`CAD-hidden-${String(index)}`, 'triage'),
        ),
      ),
    );
    await settle();

    expect(page).toHaveBeenCalledTimes(2);
    expect(store.rows()).toEqual([]);
    expect(store.seekingRows()).toBe(true);
    expect(store.empty()).toBe(false);
    finishVisible(pageOf([cad482]));
    await settle();
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482']);
    expect(store.seekingRows()).toBe(false);
  });

  it('shows an empty result when every visible group has been read', async () => {
    groups.mockResolvedValue([
      { value: 'triage', count: LIST_PAGE_SIZE },
      { value: 'todo', count: 0 },
    ]);
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    store.hideStatuses(['triage']);
    await settle();

    expect(store.rows()).toEqual([]);
    expect(store.seekingRows()).toBe(false);
    expect(store.empty()).toBe(true);
    expect(page).not.toHaveBeenCalled();
  });

  it('does not show an empty result while a visible folded group has unread pages', async () => {
    groups.mockResolvedValue([{ value: 'cancelled', count: 1 }]);
    page
      .mockResolvedValueOnce(pageOf([], 'next'))
      .mockResolvedValueOnce(pageOf([task('CAD-483', 'cancelled')]));
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();

    expect(page).toHaveBeenCalledTimes(2);
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-483']);
    expect(store.empty()).toBe(false);
  });

  it('keeps a failed visible continuation distinct from an empty result and retries it', async () => {
    groups.mockResolvedValue([
      { value: 'triage', count: 50 },
      { value: 'todo', count: 1 },
    ]);
    let finishHidden: (page: ListTaskPage) => void = () => undefined;
    page
      .mockReturnValueOnce(new Promise<ListTaskPage>((resolve) => (finishHidden = resolve)))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(pageOf([cad482]));
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    store.hideStatuses(['triage']);
    await settle();
    finishHidden(
      pageOf(
        Array.from({ length: 50 }, (_, index: number) =>
          task(`CAD-hidden-${String(index)}`, 'triage'),
        ),
      ),
    );
    await settle();

    expect(store.moreFailed()).toBe(true);
    expect(store.empty()).toBe(false);
    expect(store.seekingRows()).toBe(false);
    store.retryMore();
    await settle();
    expect(store.moreFailed()).toBe(false);
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482']);
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

  it('refreshes filtered rows and group counts after a status write without realtime', async () => {
    notices.complete();
    const response: Subject<TaskSummary> = new Subject<TaskSummary>();
    changeStatus.mockReturnValue(response);
    let matchesFilter: boolean = true;
    groups.mockImplementation(() =>
      Promise.resolve([{ value: 'todo', count: matchesFilter ? 1 : 0 }]),
    );
    page.mockImplementation(() => Promise.resolve(pageOf(matchesFilter ? [cad482] : [])));
    const filteredQuery: ListTaskQuery = { ...query, status: ['todo'] };
    const store: InstanceType<typeof ListRowsStore> = setup({
      listId: 'sprint-14',
      query: filteredQuery,
      groupQuery: { groupBy: 'status', query: filteredQuery },
    });
    TestBed.inject(OrganizationPin).set(organization().id);
    await settle();
    expect(store.rows()).toHaveLength(1);
    expect(store.groupCount('todo')).toBe(1);

    TestBed.inject(TaskStatusChangesStore).request(cad482, 'progress');
    await vi.advanceTimersByTimeAsync(800);
    await settle();
    expect(groups).toHaveBeenCalledTimes(1);

    matchesFilter = false;
    response.next({ ...cad482, status: 'progress', version: 4 });
    response.complete();
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(store.rows()).toHaveLength(0);
    expect(store.groupCount('todo')).toBe(0);
    expect(groups).toHaveBeenCalledTimes(2);
  });

  it('moves the row immediately when reduced motion is requested', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    try {
      const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
      await settle();
      TestBed.inject(TaskStatusChangesStore).request(cad482, 'progress');
      TestBed.tick();
      expect(rowOf(store, 'CAD-482')).toMatchObject({ status: 'progress', group: 'progress' });
      expect(store.groupCount('todo')).toBe(0);
      expect(store.groupCount('progress')).toBe(1);
      expect(changeStatus).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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
    const notice: RealtimeChange | null = parseChange({
      id: '019a6000-0000-7000-8000-000000000001',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      version: 1,
      data: { taskId: '019a6000-0000-7000-8000-000000000002', changed: ['name'] },
    });
    expect(notice).not.toBeNull();
    if (notice) notices.next(notice);
    notices.next({
      id: 'n2',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'backlog', taskId: 'CAD-482' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await settle();

    expect(groups).toHaveBeenCalledTimes(2);
    expect(page).toHaveBeenCalledTimes(2);
    expect(rowOf(store, 'CAD-482')).toMatchObject({ status: 'review', group: 'todo' });
  });

  it.each([
    ['task.updated.v1', { taskId: '019a6000-0000-7000-8000-000000000002', changed: ['name'] }],
    [
      'task.status-changed.v1',
      { taskId: '019a6000-0000-7000-8000-000000000002', changed: ['status'] },
    ],
    [
      'comment.created.v1',
      {
        taskId: '019a6000-0000-7000-8000-000000000002',
        commentId: '019a6000-0000-7000-8000-000000000003',
      },
    ],
    ['git.links-changed.v1', { taskId: '019a6000-0000-7000-8000-000000000002' }],
  ])('reloads for a parsed %s notice without a list id', async (type, data) => {
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    const notice: RealtimeChange | null = parseChange({
      id: '019a6000-0000-7000-8000-000000000001',
      type,
      at: '2026-11-08T09:00:00Z',
      version: 1,
      data,
    });
    expect(notice).not.toBeNull();
    if (notice) notices.next(notice);
    await vi.advanceTimersByTimeAsync(299);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(page).toHaveBeenCalledTimes(2);
    expect(store.rows()).toHaveLength(1);
  });

  it('ignores a notice that names a different list', async () => {
    setup(flat);
    await settle();
    notices.next({
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'backlog', taskId: 'CAD-482' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('reloads for parsed notices about a loaded task and its subtask', async () => {
    const parentId: string = '019a6000-0000-7000-8000-000000000002';
    const childId: string = '019a6000-0000-7000-8000-000000000003';
    page.mockResolvedValue(
      pageOf([{ ...cad482, id: parentId, subtasks: { closed: 0, total: 1 } }]),
    );
    subtasks.mockResolvedValue([task('CAD-483', 'todo', { id: childId, parentKey: 'CAD-482' })]);
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    store.toggleSubtasks('CAD-482');
    await settle();

    for (const taskId of [parentId, childId]) {
      const notice: RealtimeChange | null = parseChange({
        id: '019a6000-0000-7000-8000-000000000001',
        type: 'task.updated.v1',
        at: '2026-11-08T09:00:00Z',
        version: 1,
        data: { taskId, changed: ['name'] },
      });
      expect(notice).not.toBeNull();
      if (notice) notices.next(notice);
      await vi.advanceTimersByTimeAsync(300);
      await settle();
    }
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('reloads for a notice that names the current list', async () => {
    setup(flat);
    await settle();
    notices.next({
      id: 'n1',
      type: 'task.updated.v1',
      at: '2026-11-08T09:00:00Z',
      data: { listId: 'sprint-14' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(page).toHaveBeenCalledTimes(2);
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

  it('keeps the snapshot when a background reload fails and retries it', async () => {
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    page.mockRejectedValueOnce(new Error('503'));

    store.reload();
    await settle();
    expect(store.hasCurrentSnapshot()).toBe(true);
    expect(store.primary.error()).toBeDefined();
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482']);

    store.reload();
    await settle();
    expect(store.primary.error()).toBeUndefined();
    expect(store.rows()).toHaveLength(1);
  });

  it('does not count loaded folded rows toward the reload depth', async () => {
    const open: TaskSummary[] = Array.from({ length: LIST_PAGE_SIZE }, (_, index: number) =>
      task(`CAD-${String(index)}`, 'todo'),
    );
    groups.mockResolvedValue([
      { value: 'cancelled', count: 1 },
      { value: 'todo', count: 100 },
    ]);
    page.mockImplementation((_listId, _query, group, cursor) =>
      Promise.resolve(
        group?.value === 'cancelled'
          ? pageOf([task('CAD-closed', 'cancelled')])
          : pageOf(cursor ? [task('CAD-next', 'todo')] : open, cursor ? null : 'next'),
      ),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    page.mockClear();

    store.reload();
    await settle();

    expect(page.mock.calls.map((call: Parameters<PageRead>) => call[3])).toEqual([null, null]);
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

  it('prunes folded parents and reloads only parents that remain visible', async () => {
    groups.mockResolvedValue([
      { value: 'todo', count: 1 },
      { value: 'progress', count: 1 },
    ]);
    page.mockImplementation((_listId, _query, group) =>
      Promise.resolve(
        pageOf([
          task(group?.value === 'todo' ? 'CAD-482' : 'CAD-483', group?.value as StatusKey, {
            subtasks: { closed: 0, total: 1 },
          }),
        ]),
      ),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(byStatus);
    await settle();
    store.toggleSubtasks('CAD-482');
    store.toggleSubtasks('CAD-483');
    await settle();
    expect(subtasks).toHaveBeenCalledTimes(2);
    store.setCollapsed(['todo']);
    await settle();
    subtasks.mockClear();
    store.reload();
    await settle();
    expect(subtasks).toHaveBeenCalledExactlyOnceWith('CAD-483');
    store.setCollapsed([]);
    await settle();
    expect(subtasks).toHaveBeenCalledWith('CAD-482');
  });

  it('discards a late child response after closing and reopening a parent', async () => {
    let resolveFirst: (tasks: readonly TaskSummary[]) => void = () => undefined;
    page.mockResolvedValue(pageOf([{ ...cad482, subtasks: { closed: 0, total: 1 } }]));
    subtasks
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce([task('CAD-new', 'todo', { parentKey: 'CAD-482' })]);
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    await settle();
    store.toggleSubtasks('CAD-482');
    await settle();
    store.toggleSubtasks('CAD-482');
    await settle();
    store.toggleSubtasks('CAD-482');
    await settle();
    resolveFirst([task('CAD-old', 'todo', { parentKey: 'CAD-482' })]);
    await settle();
    expect(store.rows().map((row: ListRow) => row.task.key)).toEqual(['CAD-482', 'CAD-new']);
    expect(subtasks).toHaveBeenCalledTimes(2);
  });

  it('uses each assignee group page order for tasks with multiple assignees', async () => {
    const shared: TaskSummary = task('CAD-shared', 'todo', { assigneeIds: ['a', 'b'] });
    const other: TaskSummary = task('CAD-other', 'todo', { assigneeIds: ['b'] });
    groups.mockResolvedValue([
      { value: 'a', count: 1 },
      { value: 'b', count: 2 },
    ]);
    page.mockImplementation((_list, _query, group) =>
      Promise.resolve(pageOf(group?.value === 'a' ? [shared] : [other, shared])),
    );
    const store: InstanceType<typeof ListRowsStore> = setup({
      ...flat,
      groupQuery: { groupBy: 'assignee', query },
    });
    await settle();
    expect(store.rows().map((row: ListRow) => row.id)).toEqual([
      'a/CAD-shared',
      'b/CAD-other',
      'b/CAD-shared',
    ]);
  });

  it('only offers subtask creation within the known depth in separate mode', async () => {
    page.mockResolvedValue(
      pageOf([
        task('CAD-root', 'todo'),
        task('CAD-child', 'todo', { parentKey: 'CAD-root' }),
        task('CAD-grandchild', 'todo', { parentKey: 'CAD-child' }),
        task('CAD-unknown', 'todo', { parentKey: 'CAD-missing' }),
        task('CAD-full', 'todo', { subtasks: { closed: 0, total: 25 } }),
      ]),
    );
    const store: InstanceType<typeof ListRowsStore> = setup(flat);
    store.useSubtasks('separate');
    await settle();
    expect(store.rows().map((row: ListRow) => [row.task.key, row.canAddSubtask])).toEqual([
      ['CAD-root', true],
      ['CAD-child', true],
      ['CAD-grandchild', false],
      ['CAD-unknown', false],
      ['CAD-full', false],
    ]);
  });
});
