import type {
  ShownWorkloadTask,
  WorkloadEntry,
  WorkloadItem,
  WorkloadLoad,
  WorkloadSnapshot,
} from '../../models/workload/workload.interface';

/**
 * Constant WORKLOAD_DAY_CAPACITY_MINUTES
 *
 * @description
 * Capacity of one person on a weekday, in minutes: 6 h (`WL_CAP` of `App.dc.html`, and the
 * contract's `dailyCapacityMinutes`).
 *
 * @type {number}
 */
export const WORKLOAD_DAY_CAPACITY_MINUTES: number = 360;

/**
 * Constant WORKLOAD_DAY_OFFSETS
 *
 * @description
 * The weekdays the grid shows, as days after the Monday of the first week: two weeks, weekends
 * left out (`wlDays` of `App.dc.html`).
 *
 * @type {readonly number[]}
 */
const WORKLOAD_DAY_OFFSETS: readonly number[] = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11];

/**
 * Constant UNASSIGNED
 *
 * @description
 * Key of the unassigned bucket among the assignee ids of a task.
 *
 * @type {string}
 */
const UNASSIGNED: string = '\u0000none';

/**
 * Function addDays
 *
 * @description
 * Moves a `YYYY-MM-DD` date by a number of days, in UTC so no time zone shifts it.
 *
 * @param {string} date - The date.
 * @param {number} days - Days to add, negative to go back.
 * @returns {string} The moved date.
 */
export function addDays(date: string, days: number): string {
  const moved: Date = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * Function mondayOf
 *
 * @description
 * The Monday of the week holding a date (`mondayOf` of `App.dc.html`).
 *
 * @param {string} date - The date, `YYYY-MM-DD`.
 * @returns {string} Its Monday.
 */
export function mondayOf(date: string): string {
  const weekday: number = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/**
 * Function workloadDays
 *
 * @description
 * The ten weekdays of the two weeks starting on a Monday, the grid's columns.
 *
 * @param {string} weekStart - The Monday of the first week.
 * @returns {readonly string[]} The days, `YYYY-MM-DD`.
 */
export function workloadDays(weekStart: string): readonly string[] {
  return WORKLOAD_DAY_OFFSETS.map((offset: number): string => addDays(weekStart, offset));
}

/**
 * Function sameAssignees
 *
 * @description
 * Whether two lists of assignee keys hold the same people, in any order.
 *
 * @param {readonly string[]} a - The first.
 * @param {readonly string[]} b - The second.
 * @returns {boolean} Whether they match.
 */
function sameAssignees(a: readonly string[], b: readonly string[]): boolean {
  const first: Set<string> = new Set<string>(a);
  const second: Set<string> = new Set<string>(b);
  return first.size === second.size && [...first].every((key: string) => second.has(key));
}

/**
 * Function allocationsOf
 *
 * @description
 * The allocations of one task by assignee key. When the task as shown has other assignees than
 * the read ones (a write of the view, or a newer read of the task), its minutes of each day are
 * split evenly between the shown assignees, as the gateway splits an estimate; the next read
 * brings the gateway's exact split.
 *
 * @param {readonly WorkloadItem[]} items - The task's allocations, as read.
 * @param {readonly string[] | null} assignees - The assignees the task shows (empty for nobody),
 * null when the task is not read.
 * @returns {readonly { key: string; minutesByDay: readonly number[] }[]} The allocations.
 */
function allocationsOf(
  items: readonly WorkloadItem[],
  assignees: readonly string[] | null,
): readonly { key: string; minutesByDay: readonly number[] }[] {
  const read: readonly { key: string; minutesByDay: readonly number[] }[] = items.map(
    (item: WorkloadItem) => ({
      key: item.assigneeId ?? UNASSIGNED,
      minutesByDay: item.minutesByDay,
    }),
  );
  if (assignees === null) return read;
  const shown: readonly string[] = assignees.length > 0 ? assignees : [UNASSIGNED];
  if (
    sameAssignees(
      read.map((allocation) => allocation.key),
      shown,
    )
  ) {
    return read;
  }
  const length: number = Math.max(
    0,
    ...items.map((item: WorkloadItem) => item.minutesByDay.length),
  );
  const totals: readonly number[] = Array.from({ length }, (_: unknown, day: number): number =>
    items.reduce(
      (sum: number, item: WorkloadItem): number => sum + (item.minutesByDay[day] ?? 0),
      0,
    ),
  );
  const unique: readonly string[] = [...new Set(shown)];
  return unique.map((key: string) => ({
    key,
    minutesByDay: totals.map((minutes: number): number => minutes / unique.length),
  }));
}

/**
 * Function workloadLoads
 *
 * @description
 * The load of each row of the grid from a workload read and the tasks as the view shows them:
 * one load per assignee holding a task in the window, the unassigned bucket included (its
 * `assigneeId` null). A task the view shows elsewhere (moved, deleted, cancelled: `shown` answers
 * null) leaves the grid; a task shown with other assignees moves to them at once; a task not read
 * (`shown` answers undefined) stays as read. Names, statuses and milestones come from the shown
 * task when there is one.
 *
 * @param {WorkloadSnapshot} snapshot - The workload read.
 * @param {(taskKey: string) => ShownWorkloadTask | null | undefined} shown - The task as shown,
 * null when the view no longer shows it, undefined when it is not read.
 * @returns {readonly WorkloadLoad[]} The loads, in the read's assignee order, new assignees after.
 */
export function workloadLoads(
  snapshot: WorkloadSnapshot,
  shown: (taskKey: string) => ShownWorkloadTask | null | undefined,
): readonly WorkloadLoad[] {
  const byTask: Map<string, WorkloadItem[]> = new Map<string, WorkloadItem[]>();
  for (const item of snapshot.items) {
    const items: WorkloadItem[] | undefined = byTask.get(item.taskKey);
    if (items) items.push(item);
    else byTask.set(item.taskKey, [item]);
  }
  const rows: Map<string, Record<string, WorkloadEntry[]>> = new Map<
    string,
    Record<string, WorkloadEntry[]>
  >();
  for (const item of snapshot.items) {
    const key: string = item.assigneeId ?? UNASSIGNED;
    if (!rows.has(key)) rows.set(key, {});
  }
  for (const [taskKey, items] of byTask) {
    const task: ShownWorkloadTask | null | undefined = shown(taskKey);
    if (task === null) continue;
    const first: WorkloadItem = items[0];
    for (const allocation of allocationsOf(items, task ? task.assigneeIds : null)) {
      const days: Record<string, WorkloadEntry[]> = rows.get(allocation.key) ?? {};
      rows.set(allocation.key, days);
      const length: number = Math.min(allocation.minutesByDay.length, snapshot.days.length);
      for (let index: number = 0; index < length; index++) {
        const minutes: number = allocation.minutesByDay[index];
        if (minutes <= 0) continue;
        (days[snapshot.days[index].date] ??= []).push({
          taskKey,
          name: task?.task.name ?? first.name,
          status: task?.status ?? first.status,
          milestone: task?.task.milestone ?? false,
          minutes,
          task: task?.task ?? null,
        });
      }
    }
  }
  return [...rows].map(([key, days]: [string, Record<string, WorkloadEntry[]>]): WorkloadLoad => ({
    assigneeId: key === UNASSIGNED ? null : key,
    days,
  }));
}
