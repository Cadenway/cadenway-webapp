import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StatusKey } from '@cadenway/contracts';
import { CwToastService } from '@cadenway/ui/components/toast';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  type CreatedTask,
  TaskActionsApi,
  type TaskBulkOutcome,
  TaskCreate,
  TaskDetailOpener,
  type TaskSummary,
} from '@features/task';
import { TaskApi } from '@features/task/data-access/services/task-api/task-api.service';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { CalendarRead } from '../../models/calendar-view/calendar-view.interface';
import type { ListTaskPage } from '../../models/list-rows/list-rows.interface';
import type { DueWindow, ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { ListTaskQuery } from '../../models/list-view-config/list-view-config.interface';
import type {
  TaskFieldChanges,
  TaskFieldWriteResult,
} from '../../models/view-task-write/view-task-write.interface';
import { CALENDAR_VIEW_PROVIDERS } from './calendar-view.providers';
import { CalendarViewStore, type CalendarViewStoreInstance } from './calendar-view.store';

/**
 * Function task
 *
 * @description
 * A task of Sprint 14 in the `Product` space of Atelier Nord.
 *
 * @param {string} key - Task key.
 * @param {string} name - Task name.
 * @param {string | null} due - Due date.
 * @returns {TaskSummary} The task.
 */
function task(key: string, name: string, due: string | null): TaskSummary {
  return {
    id: key,
    key,
    name,
    status: 'todo',
    cancelReason: null,
    priority: 'haute',
    assigneeIds: [],
    due,
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
  };
}

/**
 * Constant sprintTasks
 *
 * @description
 * Sprint 14: CAD-482 due in November, CAD-488 due in December after the grid, CAD-490 undated.
 *
 * @type {readonly TaskSummary[]}
 */
const sprintTasks: readonly TaskSummary[] = [
  task('CAD-482', 'Redesign the SSO sign-in screen', '2026-11-27'),
  task('CAD-488', 'Audit the billing exports', '2026-12-18'),
  task('CAD-490', 'Write the onboarding checklist', null),
];

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
 * Function keysOf
 *
 * @description
 * The keys of shown tasks.
 *
 * @param {readonly ListTaskItem[]} items - The tasks.
 * @returns {string[]} Their keys.
 */
function keysOf(items: readonly ListTaskItem[]): string[] {
  return items.map((item: ListTaskItem): string => item.task.key);
}

describe('CalendarViewStore', () => {
  let page: Mock<ListTasksApi['page']>;
  let update: Mock<ListTasksApi['update']>;
  let bulk: Mock<TaskActionsApi['bulk']>;
  let server: TaskSummary[];

  /**
   * Function setup
   *
   * @description
   * Provides the calendar's route providers with the faked data access, without realtime (the
   * connection is optional), and loads Sprint 14.
   *
   * @returns {CalendarViewStoreInstance} The store, loading.
   */
  function setup(): CalendarViewStoreInstance {
    TestBed.configureTestingModule({
      providers: [
        ...CALENDAR_VIEW_PROVIDERS,
        {
          provide: ListTasksApi,
          useValue: { page, update, groups: vi.fn(), subtasks: vi.fn() },
        },
        {
          provide: TaskApi,
          useValue: {
            changeStatus: (key: string, version: number, status: StatusKey) =>
              of({ ...sprintTasks[0], status, version: version + 1 }),
            read: vi.fn(),
          },
        },
        { provide: TaskActionsApi, useValue: { bulk, remind: vi.fn(), restore: vi.fn() } },
        {
          provide: CwToastService,
          useValue: { show: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
        },
        {
          provide: TaskDetailOpener,
          useValue: { closed: new Subject<string>(), changed: new Subject<string>() },
        },
        { provide: TaskCreate, useValue: { created: new Subject<CreatedTask>() } },
        {
          provide: WORKSPACE_CONTEXT,
          useValue: {
            organization: signal({ id: 'org-atelier-nord', slug: 'atelier-nord' }),
            user: () => ({ id: 'u-camille' }),
          },
        },
      ],
    });
    const store: CalendarViewStoreInstance = TestBed.inject(CalendarViewStore);
    const read: WritableSignal<CalendarRead> = signal<CalendarRead>({
      listId: 'sprint-14',
      query,
    });
    TestBed.runInInjectionContext((): void => {
      store.load(read);
    });
    return store;
  }

  /**
   * Function settle
   *
   * @description
   * Runs the effects and the promises until the store is still.
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
   * Function windows
   *
   * @description
   * The due windows the reads asked for, in order.
   *
   * @returns {(DueWindow | null)[]} The windows.
   */
  function windows(): (DueWindow | null)[] {
    return page.mock.calls.map((call: Parameters<ListTasksApi['page']>) => call[6] ?? null);
  }

  /**
   * Function serverRead
   *
   * @description
   * The gateway's read of the tasks it holds now: those due in the window, or every task.
   *
   * @returns {ListTasksApi['page']} The fake read.
   */
  function serverRead(): ListTasksApi['page'] {
    return (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> => {
      const items: readonly TaskSummary[] = due
        ? server.filter(
            (item: TaskSummary): boolean =>
              item.due !== null && item.due >= due.from && item.due <= due.to,
          )
        : [...server];
      return Promise.resolve({ items, nextCursor: null, total: items.length });
    };
  }

  /**
   * Function readsSince
   *
   * @description
   * The due windows of the reads asked for after a number of reads.
   *
   * @param {number} count - Reads asked for before.
   * @returns {(DueWindow | null)[]} The windows asked for since.
   */
  function readsSince(count: number): (DueWindow | null)[] {
    return windows().slice(count);
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 26, 10) });
    server = [...sprintTasks];
    page = vi.fn<ListTasksApi['page']>(serverRead());
    update = vi.fn<ListTasksApi['update']>(
      (
        taskKey: string,
        version: number,
        changes: TaskFieldChanges,
      ): Promise<TaskFieldWriteResult> => {
        server = server.map((item: TaskSummary): TaskSummary =>
          item.key === taskKey
            ? { ...item, due: changes.dueDate ?? item.due, version: version + 1 }
            : item,
        );
        return Promise.resolve({ kind: 'done', version: version + 1 });
      },
    );
    bulk = vi.fn<TaskActionsApi['bulk']>((selection): Promise<TaskBulkOutcome> => {
      const keys: readonly string[] = selection.map((entry) => entry.taskKey);
      server = server.filter((item: TaskSummary): boolean => !keys.includes(item.key));
      return Promise.resolve({
        affected: keys.length,
        done: keys.map((taskKey: string) => ({
          taskKey,
          version: 4,
          newTaskKey: null,
          trashEntryId: `trash-${taskKey}`,
        })),
        failed: [],
        unknown: [],
        notSent: [],
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the six weeks of the shown month for the grid and every task for the panel', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();

    expect(store.window()).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(windows()).toEqual(
      expect.arrayContaining([{ from: '2026-10-26', to: '2026-12-06' }, null]),
    );
    expect(keysOf(store.gridItems())).toEqual(['CAD-482']);
    expect(keysOf(store.undatedItems())).toEqual(['CAD-490']);
    expect(store.summary()).toEqual({ visibleCount: 3, hasSubtasks: false });
    expect(store.gridLoading()).toBe(false);
    expect(store.undatedReady()).toBe(true);
  });

  it('reads the new window when another month or the week shows', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();

    store.showDay(new Date(2026, 11, 10));
    await settle();
    expect(store.window()).toEqual({ from: '2026-11-30', to: '2027-01-10' });
    store.showMode('week');
    await settle();
    expect(store.window()).toEqual({ from: '2026-12-07', to: '2026-12-13' });
    store.showDay(null);
    await settle();
    expect(store.window()).toEqual({ from: '2026-11-23', to: '2026-11-29' });

    expect(windows()).toEqual(
      expect.arrayContaining([
        { from: '2026-11-30', to: '2027-01-10' },
        { from: '2026-12-07', to: '2026-12-13' },
        { from: '2026-11-23', to: '2026-11-29' },
      ]),
    );
  });

  it('schedules a panel task onto its day at once, then reads both again', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();
    const reads: number = page.mock.calls.length;

    const written: Promise<unknown> = store.update(sprintTasks[2], { dueDate: '2026-11-30' });
    expect(keysOf(store.undatedItems())).toEqual([]);
    expect(
      store.gridItems().find((item: ListTaskItem) => item.task.key === 'CAD-490')?.task.due,
    ).toBe('2026-11-30');
    await written;
    await settle();

    expect(update).toHaveBeenCalledWith('CAD-490', 3, { dueDate: '2026-11-30' });
    expect(readsSince(reads)).toEqual(
      expect.arrayContaining([{ from: '2026-10-26', to: '2026-12-06' }, null]),
    );
    expect(keysOf(store.gridItems())).toEqual(['CAD-482', 'CAD-490']);
    expect(keysOf(store.undatedItems())).toEqual([]);
  });

  it('does not bring back a task deleted from the grid once the grid read drops it', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();
    const reads: number = page.mock.calls.length;

    await store.act([sprintTasks[0]], { type: 'trash' });
    await settle();

    expect(readsSince(reads)).toEqual(
      expect.arrayContaining([{ from: '2026-10-26', to: '2026-12-06' }, null]),
    );
    expect(keysOf(store.gridItems())).toEqual([]);
    expect(store.itemOf('CAD-482')).toBeUndefined();
  });

  it('does not show a task moved out of the window at its old day', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();

    await store.update(sprintTasks[0], { dueDate: '2026-12-20' });
    await settle();

    expect(keysOf(store.gridItems())).toEqual([]);
    expect(
      store.gridItems().some((item: ListTaskItem): boolean => item.task.due === '2026-11-27'),
    ).toBe(false);
  });

  it('puts a refused schedule back in the panel', async () => {
    update.mockImplementationOnce((): Promise<TaskFieldWriteResult> =>
      Promise.resolve({ kind: 'refused', stale: false }),
    );
    const store: CalendarViewStoreInstance = setup();
    await settle();

    await store.update(sprintTasks[2], { dueDate: '2026-11-30' });
    await settle();

    expect(keysOf(store.undatedItems())).toEqual(['CAD-490']);
    expect(store.itemOf('CAD-490')?.task.due).toBeNull();
  });

  it('moves a task of the grid through the grid read', async () => {
    const store: CalendarViewStoreInstance = setup();
    await settle();

    const written: Promise<unknown> = store.update(sprintTasks[0], { dueDate: '2026-12-02' });
    expect(
      store.gridItems().find((item: ListTaskItem) => item.task.key === 'CAD-482')?.task.due,
    ).toBe('2026-12-02');
    await written;
    expect(update).toHaveBeenCalledWith('CAD-482', 3, { dueDate: '2026-12-02' });
  });

  it('shows a failed panel read as its own error and reads it again on retry', async () => {
    page.mockImplementation(
      (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> =>
        due
          ? Promise.resolve({ items: [sprintTasks[0]], nextCursor: null, total: 1 })
          : Promise.reject(new Error('unavailable')),
    );
    const store: CalendarViewStoreInstance = setup();
    await settle();

    expect(store.undatedFailed()).toBe(true);
    expect(store.undatedLoading()).toBe(false);
    expect(store.undatedReady()).toBe(false);
    expect(keysOf(store.gridItems())).toEqual(['CAD-482']);

    page.mockImplementation(
      (_listId, _query, _group, _cursor, _limit, _signal, due): Promise<ListTaskPage> =>
        Promise.resolve({
          items: due ? [sprintTasks[0]] : sprintTasks,
          nextCursor: null,
          total: due ? 1 : 3,
        }),
    );
    store.retryUndated();
    await settle();

    expect(store.undatedFailed()).toBe(false);
    expect(keysOf(store.undatedItems())).toEqual(['CAD-490']);
  });

  it('reports an empty list once the panel read answers without a task', async () => {
    page.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    const store: CalendarViewStoreInstance = setup();
    await settle();

    expect(store.empty()).toBe(true);
    expect(store.undatedItems()).toEqual([]);
    expect(store.gridItems()).toEqual([]);
  });
});
