import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CwToastService } from '@cadenway/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TaskBulkAction, TaskSummary } from '@features/task';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { WorkloadApi } from '../../data-access/services/workload-api/workload-api.service';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { ViewTaskOutcome } from '../../models/view-task-write/view-task-write.interface';
import type {
  WorkloadEntry,
  WorkloadLoad,
  WorkloadReassignment,
  WorkloadSnapshot,
} from '../../models/workload/workload.interface';
import { addDays } from '../../utils/workload/workload.util';
import { ListPageStore } from '../list-page/list-page.store';
import { ListTasksStore, type TasksSnapshot } from '../list-tasks/list-tasks.store';
import { WorkloadViewStore, type WorkloadViewStoreInstance } from './workload-view.store';

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
 * Function window
 *
 * @description
 * The workload of two weeks from a Monday: CAD-482, two hours a day for Camille on the first
 * two days.
 *
 * @param {string} weekStart - The Monday.
 * @returns {Omit<WorkloadSnapshot, 'key'>} The workload.
 */
function window(weekStart: string): Omit<WorkloadSnapshot, 'key'> {
  return {
    weekStart,
    days: Array.from({ length: 14 }, (_: unknown, index: number) => ({
      date: addDays(weekStart, index),
      totalMinutes: 0,
      capacityMinutes: index % 7 < 5 ? 360 : 0,
    })),
    items: [
      {
        assigneeId: 'u-camille',
        taskKey: 'CAD-482',
        name: 'Redesign the SSO sign-in screen',
        status: 'todo',
        minutesByDay: [120, 120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
  };
}

/**
 * Function outcome
 *
 * @description
 * A write of CAD-482 that applied at a version, or was refused.
 *
 * @param {number | null} version - The version reached, null for a refusal.
 * @returns {ViewTaskOutcome} The outcome.
 */
function outcome(version: number | null): ViewTaskOutcome {
  return version === null
    ? {
        affected: 0,
        done: [],
        failed: [{ taskKey: 'CAD-482', version: 3 }],
        unknown: [],
        notSent: [],
        before: {},
        after: {},
        changed: [],
      }
    : {
        affected: 1,
        done: [{ taskKey: 'CAD-482', version, newTaskKey: null, trashEntryId: null }],
        failed: [],
        unknown: [],
        notSent: [],
        before: {},
        after: { 'CAD-482': version },
        changed: [],
      };
}

/**
 * Function rowOf
 *
 * @description
 * The task keys of a row on Monday 23 November.
 *
 * @param {WorkloadViewStoreInstance} store - The store.
 * @param {string | null} assigneeId - The row.
 * @returns {readonly string[]} The keys.
 */
function rowOf(store: WorkloadViewStoreInstance, assigneeId: string | null): readonly string[] {
  return (
    store
      .loads()
      .find((load: WorkloadLoad): boolean => load.assigneeId === assigneeId)
      ?.days['2026-11-23']?.map((entry: WorkloadEntry): string => entry.taskKey) ?? []
  );
}

describe('WorkloadViewStore', () => {
  let workload: Mock<WorkloadApi['workload']>;
  let spent: Mock<WorkloadApi['spent']>;
  let act: Mock;
  let items: WritableSignal<readonly ListTaskItem[]>;
  let tasksSnapshot: WritableSignal<TasksSnapshot | undefined>;
  let toasts: { show: Mock; error: Mock; warning: Mock; dismiss: Mock };
  let refreshCounts: Mock;
  let organization: WritableSignal<{ id: string; slug: string }>;

  /**
   * Function settle
   *
   * @description
   * Lets the resources and the writes answer.
   *
   * @returns {Promise<void>} Resolves once settled.
   */
  async function settle(): Promise<void> {
    for (let round: number = 0; round < 10; round++) {
      TestBed.tick();
      await Promise.resolve();
    }
  }

  /**
   * Function setup
   *
   * @description
   * Provides the store with a faked workload access and task reader, then reads Sprint 14.
   *
   * @returns {Promise<WorkloadViewStoreInstance>} The store, once read.
   */
  async function setup(): Promise<WorkloadViewStoreInstance> {
    TestBed.configureTestingModule({
      providers: [
        WorkloadViewStore,
        { provide: WorkloadApi, useValue: { workload, spent } },
        {
          provide: ListTasksStore,
          useValue: {
            items,
            taskOf: (key: string): TaskSummary | undefined =>
              items().find((item: ListTaskItem) => item.task.key === key)?.task,
            primary: { hasValue: () => tasksSnapshot() !== undefined, value: tasksSnapshot },
            act,
          },
        },
        { provide: ListPageStore, useValue: { refreshCounts } },
        { provide: CwToastService, useValue: toasts },
        { provide: WORKSPACE_CONTEXT, useValue: { organization } },
      ],
    });
    const store: WorkloadViewStoreInstance = TestBed.inject(WorkloadViewStore);
    store.load({ listId: 'sprint-14', query: { level: 'roots', sort: 'manual' } });
    await settle();
    return store;
  }

  /**
   * Function show
   *
   * @description
   * Makes the task reader show CAD-482 with assignees.
   *
   * @param {readonly string[]} assigneeIds - Its assignees.
   */
  function show(assigneeIds: readonly string[]): void {
    items.set([{ task: task('CAD-482', { assigneeIds }), status: 'todo' }]);
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 26, 10));
    workload = vi.fn((_listId: string, _query, weekStart: string) =>
      Promise.resolve(window(weekStart)),
    );
    spent = vi.fn(() => Promise.resolve({ 'u-camille': 90 }));
    act = vi.fn();
    items = signal<readonly ListTaskItem[]>([]);
    tasksSnapshot = signal<TasksSnapshot | undefined>(undefined);
    toasts = { show: vi.fn(() => 'toast-1'), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
    refreshCounts = vi.fn();
    organization = signal({ id: 'org-atelier-nord', slug: 'atelier-nord' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the two weeks from this Monday and the time spent over them', async () => {
    const store: WorkloadViewStoreInstance = await setup();

    expect(store.weekStart()).toBe('2026-11-23');
    expect(store.today()).toBe('2026-11-26');
    expect(store.days()).toHaveLength(10);
    expect(workload).toHaveBeenCalledWith(
      'sprint-14',
      { level: 'roots', sort: 'manual' },
      '2026-11-23',
      expect.any(AbortSignal),
    );
    expect(store.loading()).toBe(false);
    expect(store.hasCurrentSnapshot()).toBe(true);
    expect(rowOf(store, 'u-camille')).toEqual(['CAD-482']);
    expect(store.spent.value()).toEqual({ 'u-camille': 90 });
  });

  it('shows the skeleton while another week is read and comes back to this week', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    let answer: (value: Omit<WorkloadSnapshot, 'key'>) => void = () => undefined;
    workload.mockImplementationOnce(
      () =>
        new Promise((resolve: (value: Omit<WorkloadSnapshot, 'key'>) => void) => {
          answer = resolve;
        }),
    );

    store.nextWeek();
    await settle();

    expect(store.weekStart()).toBe('2026-11-30');
    expect(store.loading()).toBe(true);
    answer(window('2026-11-30'));
    await settle();
    expect(store.loading()).toBe(false);

    store.previousWeek();
    store.previousWeek();
    expect(store.weekStart()).toBe('2026-11-16');
    store.thisWeek();
    expect(store.weekStart()).toBe('2026-11-23');
  });

  it('reads again when the task reader reads the same query again in place', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    const base: TasksSnapshot = {
      key: 'q',
      generation: 1,
      tasks: [],
      total: 0,
      truncated: false,
      pages: 1,
    };
    tasksSnapshot.set(base);
    await settle();
    expect(workload).toHaveBeenCalledTimes(1);

    tasksSnapshot.set({ ...base, generation: 2 });
    await settle();

    expect(workload).toHaveBeenCalledTimes(2);
    expect(spent).toHaveBeenCalledTimes(2);
    expect(store.hasCurrentSnapshot()).toBe(true);

    tasksSnapshot.set({ ...base, key: 'other', generation: 3 });
    await settle();
    expect(workload).toHaveBeenCalledTimes(2);
  });

  it('leaves out a task the view shows cancelled and moves a task shown with other people', async () => {
    const store: WorkloadViewStoreInstance = await setup();

    items.set([{ task: task('CAD-482', { assigneeIds: ['u-ines'] }), status: 'todo' }]);
    expect(rowOf(store, 'u-camille')).toEqual([]);
    expect(rowOf(store, 'u-ines')).toEqual(['CAD-482']);

    items.set([{ task: task('CAD-482', { assigneeIds: ['u-camille'] }), status: 'cancelled' }]);
    expect(rowOf(store, 'u-camille')).toEqual([]);
  });

  /**
   * Function writer
   *
   * @description
   * Makes the faked task reader's `act` behave as `ListTasksStore`: the shown assignees of
   * CAD-482 change at once, a refusal puts them back, and each applied write bumps the version.
   * Each answer is taken in order: `done`, `refused`, or `held` (applied once `release` runs).
   *
   * @param {readonly ('done' | 'refused' | 'held')[]} answers - The answers, in order.
   * @returns {{ release: () => void }} Releases the held write.
   */
  function writer(answers: readonly ('done' | 'refused' | 'held')[]): { release: () => void } {
    const queue: ('done' | 'refused' | 'held')[] = [...answers];
    const control: { release: () => void } = { release: () => undefined };
    let version: number = 3;
    act.mockImplementation(
      async (_tasks: readonly TaskSummary[], action: TaskBulkAction): Promise<ViewTaskOutcome> => {
        const before: readonly ListTaskItem[] = items();
        const shown: readonly string[] = before[0]?.task.assigneeIds ?? [];
        if (action.type === 'assign') show([...new Set([...shown, action.userId])]);
        if (action.type === 'unassign') show(shown.filter((id: string) => id !== action.userId));
        const answer: 'done' | 'refused' | 'held' = queue.shift() ?? 'done';
        if (answer === 'held') {
          await new Promise<void>((resolve: () => void) => {
            control.release = resolve;
          });
        }
        if (answer === 'refused') {
          items.set(before);
          return outcome(null);
        }
        version += 1;
        return outcome(version);
      },
    );
    return control;
  }

  /**
   * Function actions
   *
   * @description
   * The writes sent, with the versions they expected.
   *
   * @returns {readonly unknown[][]} Each action and its expected versions.
   */
  function actions(): readonly unknown[][] {
    return act.mock.calls.map((call: unknown[]) => [call[1], call[2]]);
  }

  /**
   * Constant camilleToInes
   *
   * @description
   * CAD-482 dragged from Camille's row to Inès's.
   *
   * @type {WorkloadReassignment}
   */
  const camilleToInes: WorkloadReassignment = {
    task: task('CAD-482', { assigneeIds: ['u-camille'] }),
    from: 'u-camille',
    to: 'u-ines',
    fromName: 'Camille Martin',
    toName: 'Inès Robert',
  };

  it('reassigns at once, assigns then removes, and offers an Undo bound to the new version', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    show(['u-camille']);
    const control: { release: () => void } = writer(['held', 'done']);

    const done: Promise<void> = store.reassign(camilleToInes);

    expect(rowOf(store, 'u-camille')).toEqual([]);
    expect(rowOf(store, 'u-ines')).toEqual(['CAD-482']);
    control.release();
    await done;

    expect(actions()).toEqual([
      [{ type: 'assign', userId: 'u-ines' }, undefined],
      [{ type: 'unassign', userId: 'u-camille' }, undefined],
    ]);
    expect(rowOf(store, 'u-ines')).toEqual(['CAD-482']);
    expect(refreshCounts).toHaveBeenCalled();
    expect(toasts.show).toHaveBeenCalledWith('CAD-482 reassigned', {
      description: 'From Camille Martin to Inès Robert.',
      undo: expect.any(Function) as unknown,
    });

    const undo: () => void = (toasts.show.mock.calls[0][1] as { undo: () => void }).undo;
    undo();
    await settle();

    expect(actions().slice(2)).toEqual([
      [{ type: 'assign', userId: 'u-camille' }, { 'CAD-482': 5 }],
      [{ type: 'unassign', userId: 'u-ines' }, { 'CAD-482': 6 }],
    ]);
    expect(items()[0]?.task.assigneeIds).toEqual(['u-camille']);
    expect(toasts.show).toHaveBeenCalledTimes(1);
  });

  it('never unassigns the person a task is dragged back to while its first write runs', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    show(['u-camille']);
    const control: { release: () => void } = writer(['held', 'done']);

    const first: Promise<void> = store.reassign(camilleToInes);
    const back: Promise<void> = store.reassign({
      task: task('CAD-482', { assigneeIds: ['u-camille', 'u-ines'] }),
      from: 'u-ines',
      to: 'u-camille',
      fromName: 'Inès Robert',
      toName: 'Camille Martin',
    });

    expect(rowOf(store, 'u-camille')).toEqual(['CAD-482']);
    expect(rowOf(store, 'u-ines')).toEqual([]);
    control.release();
    await Promise.all([first, back]);

    expect(actions()).toEqual([
      [{ type: 'assign', userId: 'u-ines' }, undefined],
      [{ type: 'unassign', userId: 'u-ines' }, undefined],
    ]);
    expect(
      act.mock.calls.some(
        (call: unknown[]) =>
          (call[1] as TaskBulkAction).type === 'unassign' &&
          (call[1] as { userId: string }).userId === 'u-camille',
      ),
    ).toBe(false);
    expect(items()[0]?.task.assigneeIds).toEqual(['u-camille']);
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('sends nothing more when the assignment is refused and puts the task back', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    show(['u-camille']);
    writer(['refused']);

    await store.reassign(camilleToInes);

    expect(act).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith('The task could not be reassigned');
    expect(toasts.show).not.toHaveBeenCalled();
    expect(rowOf(store, 'u-camille')).toEqual(['CAD-482']);
    expect(rowOf(store, 'u-ines')).toEqual([]);
  });

  it('says a reassignment was only partly done and offers to undo the applied assignment', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    show(['u-camille']);
    writer(['done', 'refused', 'done']);

    await store.reassign(camilleToInes);

    expect(items()[0]?.task.assigneeIds).toEqual(['u-camille', 'u-ines']);
    expect(toasts.show).not.toHaveBeenCalled();
    expect(toasts.warning).toHaveBeenCalledWith(
      'CAD-482 was assigned to Inès Robert but stays assigned to Camille Martin.',
      { undo: expect.any(Function) as unknown },
    );

    const undo: () => void = (toasts.warning.mock.calls[0][1] as { undo: () => void }).undo;
    undo();
    await settle();

    expect(actions().slice(2)).toEqual([
      [{ type: 'unassign', userId: 'u-ines' }, { 'CAD-482': 4 }],
    ]);
    expect(items()[0]?.task.assigneeIds).toEqual(['u-camille']);
  });

  it('only removes the person when the task goes to the unassigned row', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    show(['u-camille']);
    writer(['done']);

    await store.reassign({ ...camilleToInes, to: null, toName: 'Unassigned' });

    expect(actions()).toEqual([[{ type: 'unassign', userId: 'u-camille' }, undefined]]);
    expect(toasts.show).toHaveBeenCalledWith('CAD-482 reassigned', {
      description: 'From Camille Martin to Unassigned.',
      undo: expect.any(Function) as unknown,
    });
  });

  it('empties the grid at once for another organization', async () => {
    const store: WorkloadViewStoreInstance = await setup();
    workload.mockImplementationOnce(() => new Promise(() => undefined));

    organization.set({ id: 'org-other', slug: 'other' });
    await settle();

    expect(store.loads()).toEqual([]);
    expect(store.loading()).toBe(true);
  });
});
