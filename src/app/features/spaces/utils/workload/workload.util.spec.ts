import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '@features/task';

import type {
  ShownWorkloadTask,
  WorkloadDay,
  WorkloadEntry,
  WorkloadLoad,
  WorkloadSnapshot,
} from '../../models/workload/workload.interface';
import { addDays, mondayOf, workloadDays, workloadLoads } from './workload.util';

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
 * Constant days
 *
 * @description
 * The fourteen days from Monday 23 November 2026.
 *
 * @type {readonly WorkloadDay[]}
 */
const days: readonly WorkloadDay[] = Array.from(
  { length: 14 },
  (_: unknown, index: number): WorkloadDay => ({
    date: addDays('2026-11-23', index),
    totalMinutes: 0,
    capacityMinutes: index % 7 < 5 ? 360 : 0,
  }),
);

/**
 * Function minutes
 *
 * @description
 * Fourteen days of minutes, the given ones first.
 *
 * @param {readonly number[]} values - Minutes of the first days.
 * @returns {readonly number[]} The minutes.
 */
function minutes(values: readonly number[]): readonly number[] {
  return Array.from({ length: 14 }, (_: unknown, index: number): number => values[index] ?? 0);
}

/**
 * Constant snapshot
 *
 * @description
 * CAD-482 split between Camille and Inès on Monday and Tuesday, CAD-483 unassigned on Monday.
 *
 * @type {WorkloadSnapshot}
 */
const snapshot: WorkloadSnapshot = {
  key: 'k',
  weekStart: '2026-11-23',
  days,
  items: [
    {
      assigneeId: 'u-camille',
      taskKey: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'todo',
      minutesByDay: minutes([120, 60]),
    },
    {
      assigneeId: 'u-ines',
      taskKey: 'CAD-482',
      name: 'Redesign the SSO sign-in screen',
      status: 'todo',
      minutesByDay: minutes([120, 60]),
    },
    {
      assigneeId: null,
      taskKey: 'CAD-483',
      name: 'Organization quotas page',
      status: 'progress',
      minutesByDay: minutes([90]),
    },
  ],
};

/**
 * Function loadOf
 *
 * @description
 * The load of a row.
 *
 * @param {readonly WorkloadLoad[]} loads - The loads.
 * @param {string | null} assigneeId - The row.
 * @returns {WorkloadLoad | undefined} Its load.
 */
function loadOf(
  loads: readonly WorkloadLoad[],
  assigneeId: string | null,
): WorkloadLoad | undefined {
  return loads.find((load: WorkloadLoad): boolean => load.assigneeId === assigneeId);
}

/**
 * Function minutesOn
 *
 * @description
 * Minutes of a task in a row on a day.
 *
 * @param {WorkloadLoad | undefined} load - The row.
 * @param {string} date - The day.
 * @param {string} key - The task.
 * @returns {number | undefined} The minutes, undefined without the task.
 */
function minutesOn(load: WorkloadLoad | undefined, date: string, key: string): number | undefined {
  return load?.days[date]?.find((entry: WorkloadEntry): boolean => entry.taskKey === key)?.minutes;
}

describe('workload dates', () => {
  it('finds the Monday of a week and the ten weekdays of two weeks', () => {
    expect(mondayOf('2026-11-26')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
    expect(workloadDays('2026-11-23')).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
    ]);
  });
});

describe('workloadLoads', () => {
  it('files each allocation under its assignee as read when the task is not read', () => {
    const loads: readonly WorkloadLoad[] = workloadLoads(snapshot, () => undefined);

    expect(loads.map((load: WorkloadLoad) => load.assigneeId)).toEqual([
      'u-camille',
      'u-ines',
      null,
    ]);
    expect(minutesOn(loadOf(loads, 'u-camille'), '2026-11-23', 'CAD-482')).toBe(120);
    expect(minutesOn(loadOf(loads, 'u-camille'), '2026-11-24', 'CAD-482')).toBe(60);
    expect(minutesOn(loadOf(loads, null), '2026-11-23', 'CAD-483')).toBe(90);
    expect(loadOf(loads, null)?.days['2026-11-23']?.[0]).toMatchObject({
      name: 'Organization quotas page',
      status: 'progress',
      milestone: false,
      task: null,
    });
  });

  it('moves a task to the assignees it is shown with, its minutes split evenly', () => {
    const shown: TaskSummary = task('CAD-482', { assigneeIds: ['u-hugo'], milestone: true });
    const loads: readonly WorkloadLoad[] = workloadLoads(
      snapshot,
      (key: string): ShownWorkloadTask | undefined =>
        key === 'CAD-482' ? { task: shown, status: 'review', assigneeIds: ['u-hugo'] } : undefined,
    );

    expect(minutesOn(loadOf(loads, 'u-camille'), '2026-11-23', 'CAD-482')).toBeUndefined();
    expect(minutesOn(loadOf(loads, 'u-ines'), '2026-11-23', 'CAD-482')).toBeUndefined();
    expect(minutesOn(loadOf(loads, 'u-hugo'), '2026-11-23', 'CAD-482')).toBe(240);
    expect(loadOf(loads, 'u-hugo')?.days['2026-11-24']?.[0]).toMatchObject({
      status: 'review',
      milestone: true,
      minutes: 120,
      task: shown,
    });
  });

  it('keeps the read split when the shown assignees are the read ones, in any order', () => {
    const loads: readonly WorkloadLoad[] = workloadLoads(snapshot, (key: string) =>
      key === 'CAD-482'
        ? { task: task('CAD-482'), status: 'todo', assigneeIds: ['u-ines', 'u-camille'] }
        : undefined,
    );

    expect(minutesOn(loadOf(loads, 'u-camille'), '2026-11-23', 'CAD-482')).toBe(120);
    expect(minutesOn(loadOf(loads, 'u-ines'), '2026-11-23', 'CAD-482')).toBe(120);
  });

  it('files a task shown without assignees under the unassigned bucket', () => {
    const loads: readonly WorkloadLoad[] = workloadLoads(snapshot, (key: string) =>
      key === 'CAD-482' ? { task: task('CAD-482'), status: 'todo', assigneeIds: [] } : undefined,
    );

    expect(minutesOn(loadOf(loads, null), '2026-11-23', 'CAD-482')).toBe(240);
    expect(loadOf(loads, 'u-camille')?.days['2026-11-23']).toBeUndefined();
  });

  it('leaves out a task the view no longer shows', () => {
    const loads: readonly WorkloadLoad[] = workloadLoads(snapshot, (key: string) =>
      key === 'CAD-483' ? null : undefined,
    );

    expect(loadOf(loads, null)?.days['2026-11-23']).toBeUndefined();
    expect(minutesOn(loadOf(loads, 'u-ines'), '2026-11-23', 'CAD-482')).toBe(120);
  });
});
