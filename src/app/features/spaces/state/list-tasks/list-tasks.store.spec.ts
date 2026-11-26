import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import {
  type CreatedTask,
  TaskActionsApi,
  type TaskBulkOutcome,
  TaskCreate,
  TaskDetailOpener,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListTaskPage } from '../../models/list-rows/list-rows.interface';
import type { ListTaskItem, ListTasksRead } from '../../models/list-tasks/list-tasks.interface';
import type { ListTaskQuery } from '../../models/list-view-config/list-view-config.interface';
import type {
  TaskFieldWriteResult,
  ViewTaskOutcome,
} from '../../models/view-task-write/view-task-write.interface';
import { LIST_TASKS_CAP, LIST_TASKS_PAGE_SIZE, ListTasksStore } from './list-tasks.store';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {Partial<TaskSummary>} [changes] - Other members.
 * @returns {TaskSummary} The task.
 */
function task(key: string, changes: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: key,
    key,
    name: key,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
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
    spaceId: 'product',
    version: 3,
    ...changes,
  };
}

/**
 * Constant cad482
 *
 * @description
 * CAD-482, `Redesign the SSO sign-in screen`, to do, from 23 to 27 November.
 *
 * @type {TaskSummary}
 */
const cad482: TaskSummary = task('CAD-482', {
  name: 'Redesign the SSO sign-in screen',
  start: '2026-11-23',
  due: '2026-11-27',
});

/**
 * Constant query
 *
 * @description
 * The default query of the views.
 *
 * @type {ListTaskQuery}
 */
const query: ListTaskQuery = { level: 'roots', sort: 'manual' };

/**
 * Constant sprint
 *
 * @description
 * Every task of Sprint 14.
 *
 * @type {ListTasksRead}
 */
const sprint: ListTasksRead = { listId: 'sprint-14', query };

/**
 * Function pageOf
 *
 * @description
 * A page of tasks.
 *
 * @param {readonly TaskSummary[]} items - The tasks.
 * @param {string | null} [nextCursor] - The next cursor.
 * @param {number} [total] - Tasks the query matches.
 * @returns {ListTaskPage} The page.
 */
function pageOf(
  items: readonly TaskSummary[],
  nextCursor: string | null = null,
  total: number = items.length,
): ListTaskPage {
  return { items, nextCursor, total };
}

/**
 * Function done
 *
 * @description
 * A bulk answer that applied CAD-482 at a version.
 *
 * @param {number} version - The returned version.
 * @returns {TaskBulkOutcome} The answer.
 */
function done(version: number): TaskBulkOutcome {
  return {
    affected: 1,
    done: [{ taskKey: 'CAD-482', version, newTaskKey: null, trashEntryId: null }],
    failed: [],
    unknown: [],
    notSent: [],
  };
}

describe('ListTasksStore', () => {
  let page: Mock<ListTasksApi['page']>;
  let update: Mock<ListTasksApi['update']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let notices: Subject<RealtimeChange>;
  let detailClosings: Subject<string>;
  let created: Subject<CreatedTask>;
  let organization: WritableSignal<{ id: string; slug: string }>;

  /**
   * Function setup
   *
   * @description
   * Provides the store with the task stores, the faked data access, toasts and realtime.
   *
   * @param {ListTasksRead} read - What it reads.
   * @returns {InstanceType<typeof ListTasksStore>} The store, loading.
   */
  function setup(read: ListTasksRead): InstanceType<typeof ListTasksStore> {
    TestBed.configureTestingModule({
      providers: [
        TaskStatusChangesStore,
        ListTasksStore,
        {
          provide: ListTasksApi,
          useValue: { page, update, groups: vi.fn(), subtasks: vi.fn() },
        },
        {
          provide: TaskApi,
          useValue: {
            changeStatus: (key: string, version: number, status: StatusKey) =>
              of({ ...cad482, status, version: version + 1 }),
            read: vi.fn(),
          },
        },
        { provide: TaskActionsApi, useValue: { bulk, remind: vi.fn(), restore: vi.fn() } },
        {
          provide: CwToastService,
          useValue: { show: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
        },
        { provide: RealtimeConnection, useValue: { watch: () => notices.asObservable() } },
        {
          provide: TaskDetailOpener,
          useValue: { closed: detailClosings.asObservable(), changed: new Subject<string>() },
        },
        { provide: TaskCreate, useValue: { created: created.asObservable() } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: { organization, user: () => ({ id: 'u-camille' }) },
        },
      ],
    });
    const store: InstanceType<typeof ListTasksStore> = TestBed.inject(ListTasksStore);
    store.load(read);
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
   * Function itemOf
   *
   * @description
   * The item of a task.
   *
   * @param {InstanceType<typeof ListTasksStore>} store - The store.
   * @param {string} key - Task key.
   * @returns {ListTaskItem | undefined} The item.
   */
  function itemOf(
    store: InstanceType<typeof ListTasksStore>,
    key: string,
  ): ListTaskItem | undefined {
    return store.items().find((item: ListTaskItem): boolean => item.task.key === key);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    notices = new Subject<RealtimeChange>();
    detailClosings = new Subject<string>();
    created = new Subject<CreatedTask>();
    organization = signal({ id: 'org-atelier-nord', slug: 'atelier-nord' });
    page = vi.fn<ListTasksApi['page']>(() => Promise.resolve(pageOf([cad482])));
    update = vi.fn<ListTasksApi['update']>(() =>
      Promise.resolve<TaskFieldWriteResult>({ kind: 'done', version: 4 }),
    );
    bulk = vi.fn<TaskActionsApi['bulk']>(() => Promise.resolve(done(4)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads every page with the view query and the due window, and sums them up', async () => {
    page
      .mockResolvedValueOnce(pageOf([cad482], 'p2', 2))
      .mockResolvedValueOnce(pageOf([task('CAD-483', { parentKey: 'CAD-482' })], null, 2));
    const store: InstanceType<typeof ListTasksStore> = setup({
      ...sprint,
      due: { from: '2026-10-26', to: '2026-12-06' },
    });
    expect(store.summary()).toEqual({ visibleCount: null, hasSubtasks: null });
    await settle();

    expect(page.mock.calls.map((call) => [call[3], call[4], call[6]])).toEqual([
      [null, LIST_TASKS_PAGE_SIZE, { from: '2026-10-26', to: '2026-12-06' }],
      ['p2', LIST_TASKS_PAGE_SIZE, { from: '2026-10-26', to: '2026-12-06' }],
    ]);
    expect(store.items().map((item: ListTaskItem) => item.task.key)).toEqual([
      'CAD-482',
      'CAD-483',
    ]);
    expect(store.summary()).toEqual({ visibleCount: 2, hasSubtasks: true });
    expect(store.truncated()).toBe(false);
  });

  it('stops at the cap and says tasks were left out', async () => {
    let read: number = 0;
    page.mockImplementation(() => {
      read++;
      return Promise.resolve(
        pageOf(
          Array.from({ length: LIST_TASKS_PAGE_SIZE }, (_: unknown, index: number) =>
            task(`CAD-${(read * 1000 + index).toString()}`),
          ),
          'more',
          5000,
        ),
      );
    });
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();

    expect(page).toHaveBeenCalledTimes(LIST_TASKS_CAP / LIST_TASKS_PAGE_SIZE);
    expect(store.items()).toHaveLength(LIST_TASKS_CAP);
    expect(store.truncated()).toBe(true);
  });

  it('tells a successful empty read from a failed one, and reads again', async () => {
    page.mockResolvedValueOnce(pageOf([]));
    const empty: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();
    expect(empty.empty()).toBe(true);
    expect(empty.primary.error()).toBeUndefined();

    TestBed.resetTestingModule();
    page.mockRejectedValueOnce(new Error('unavailable'));
    const failed: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();
    expect(failed.primary.error()).toBeDefined();
    expect(failed.empty()).toBe(false);

    failed.reload();
    await settle();
    expect(failed.primary.error()).toBeUndefined();
    expect(failed.items()).toHaveLength(1);
  });

  it('reads again 1 s after the first notice of the list, and ignores another list', async () => {
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();
    notices.next({ id: 'n1', type: 'list.tasks-changed.v1', at: '', data: { listId: 'backlog' } });
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);

    notices.next({
      id: 'n2',
      type: 'list.tasks-changed.v1',
      at: '',
      data: { listId: 'sprint-14' },
    });
    notices.next({ id: 'n3', type: 'task.updated.v1', at: '', data: { taskId: 't-1' } });
    await vi.advanceTimersByTimeAsync(999);
    await settle();
    expect(page).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(page).toHaveBeenCalledTimes(2);
    expect(store.items()).toHaveLength(1);
  });

  it('reads again once a detail closes over the view and when a task is created in the list', async () => {
    setup(sprint);
    await settle();

    detailClosings.next('CAD-482');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(page).toHaveBeenCalledTimes(2);

    created.next({ key: 'CAD-490', listId: 'sprint-14' } as CreatedTask);
    await settle();
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('empties the tasks at once when the organization switches and drops the late answer', async () => {
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();
    let finish: (value: ListTaskPage) => void = () => undefined;
    page.mockImplementationOnce(
      () =>
        new Promise<ListTaskPage>((resolve: (value: ListTaskPage) => void) => {
          finish = resolve;
        }),
    );

    organization.set({ id: 'org-studio', slug: 'studio' });
    await settle();
    expect(store.items()).toEqual([]);
    expect(store.initialLoading()).toBe(true);

    finish(pageOf([task('STU-12')]));
    await settle();
    expect(store.items().map((item: ListTaskItem) => item.task.key)).toEqual(['STU-12']);
  });

  it('shows a status at once and restores the confirmed one when the gateway refuses it', async () => {
    bulk.mockResolvedValueOnce({
      affected: 0,
      done: [],
      failed: [{ taskKey: 'CAD-482', version: 3 }],
      unknown: [],
      notSent: [],
    });
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();

    const refused: Promise<ViewTaskOutcome> = store.act([cad482], {
      type: 'status',
      status: 'done',
    });
    expect(itemOf(store, 'CAD-482')?.status).toBe('done');
    expect(store.shownStatus(cad482)).toBe('done');
    await refused;
    await settle();

    expect(itemOf(store, 'CAD-482')?.status).toBe('todo');
  });

  it('reschedules at once, moving the start with the due date, and puts the dates back on refusal', async () => {
    let answer: (result: TaskFieldWriteResult) => void = () => undefined;
    update.mockImplementationOnce(
      () =>
        new Promise<TaskFieldWriteResult>((resolve: (result: TaskFieldWriteResult) => void) => {
          answer = resolve;
        }),
    );
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();

    const pending: Promise<ViewTaskOutcome> = store.update(cad482, { dueDate: '2026-12-01' });
    await settle();
    expect(itemOf(store, 'CAD-482')?.task).toMatchObject({
      due: '2026-12-01',
      start: '2026-11-27',
    });
    expect(update).toHaveBeenCalledWith('CAD-482', 3, { dueDate: '2026-12-01' });

    answer({ kind: 'refused' });
    const outcome: ViewTaskOutcome = await pending;
    expect(outcome.failed).toEqual([{ taskKey: 'CAD-482', version: 3 }]);
    expect(itemOf(store, 'CAD-482')?.task).toMatchObject({
      due: '2026-11-27',
      start: '2026-11-23',
    });
  });

  it('sends a field write after an earlier action of the task, at the version it returned', async () => {
    let answer: (outcome: TaskBulkOutcome) => void = () => undefined;
    bulk.mockImplementationOnce(
      () =>
        new Promise<TaskBulkOutcome>((resolve: (outcome: TaskBulkOutcome) => void) => {
          answer = resolve;
        }),
    );
    update.mockResolvedValueOnce({ kind: 'done', version: 8 });
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();

    const first: Promise<ViewTaskOutcome> = store.act([cad482], {
      type: 'priority',
      priority: 'urgente',
    });
    const second: Promise<ViewTaskOutcome> = store.update(cad482, { name: 'Sign-in screen' });
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(itemOf(store, 'CAD-482')?.task).toMatchObject({
      priority: 'urgente',
      name: 'Sign-in screen',
    });

    answer(done(7));
    await first;
    const outcome: ViewTaskOutcome = await second;
    expect(update).toHaveBeenCalledWith('CAD-482', 7, { name: 'Sign-in screen' });
    expect(outcome.after).toEqual({ 'CAD-482': 8 });
  });

  it('does not send an Undo of a write the task changed since', async () => {
    update
      .mockResolvedValueOnce({ kind: 'done', version: 4 })
      .mockResolvedValueOnce({ kind: 'done', version: 5 });
    const store: InstanceType<typeof ListTasksStore> = setup(sprint);
    await settle();
    const moved: ViewTaskOutcome = await store.update(cad482, { dueDate: '2026-12-01' });
    await store.update(cad482, { dueDate: '2026-12-04' });

    const undo: ViewTaskOutcome = await store.update(
      cad482,
      { dueDate: '2026-11-27' },
      moved.after,
    );

    expect(update).toHaveBeenCalledTimes(2);
    expect(undo.changed.map((item) => item.taskKey)).toEqual(['CAD-482']);
  });
});
