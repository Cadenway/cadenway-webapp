import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

import type { ListTaskQuery } from '../list-view-config/list-view-config.interface';

/**
 * Interface WorkloadDay
 *
 * @description
 * One calendar day of a workload window, as the gateway counts it.
 */
export interface WorkloadDay {
  // #region Properties
  /**
   * Property date
   *
   * @description
   * The day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly date: string;

  /**
   * Property totalMinutes
   *
   * @description
   * Minutes allocated that day across every row of the window, every page included.
   *
   * @type {number}
   * @readonly
   */
  readonly totalMinutes: number;

  /**
   * Property capacityMinutes
   *
   * @description
   * Capacity of one person that day: 360 on weekdays, 0 on weekends.
   *
   * @type {number}
   * @readonly
   */
  readonly capacityMinutes: number;
  // #endregion
}

/**
 * Interface WorkloadItem
 *
 * @description
 * One task's allocation to one assignee, or to the unassigned bucket, over the window.
 */
export interface WorkloadItem {
  // #region Properties
  /**
   * Property assigneeId
   *
   * @description
   * The assignee, null for the unassigned bucket.
   *
   * @type {string | null}
   * @readonly
   */
  readonly assigneeId: string | null;

  /**
   * Property taskKey
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Status of the task when read.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property minutesByDay
   *
   * @description
   * Minutes allocated each day of the window, aligned with its days.
   *
   * @type {readonly number[]}
   * @readonly
   */
  readonly minutesByDay: readonly number[];
  // #endregion
}

/**
 * Interface WorkloadSnapshot
 *
 * @description
 * What a workload read answers: the fourteen days of the window and every allocation of every
 * page, under the key of the read.
 */
export interface WorkloadSnapshot {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Identity of the read: the organization, the list, the query and the week.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the first week read.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property days
   *
   * @description
   * The fourteen days of the window, weekends included.
   *
   * @type {readonly WorkloadDay[]}
   * @readonly
   */
  readonly days: readonly WorkloadDay[];

  /**
   * Property items
   *
   * @description
   * Every allocation of the window, ordered by assignee (unassigned last), then task key.
   *
   * @type {readonly WorkloadItem[]}
   * @readonly
   */
  readonly items: readonly WorkloadItem[];
  // #endregion
}

/**
 * Interface WorkloadWindow
 *
 * @description
 * One page of a workload read, mapped from the gateway.
 */
export interface WorkloadWindow {
  // #region Properties
  /**
   * Property weekStart
   *
   * @description
   * Monday of the first week.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property days
   *
   * @description
   * The fourteen days of the window.
   *
   * @type {readonly WorkloadDay[]}
   * @readonly
   */
  readonly days: readonly WorkloadDay[];

  /**
   * Property items
   *
   * @description
   * The allocations of this page.
   *
   * @type {readonly WorkloadItem[]}
   * @readonly
   */
  readonly items: readonly WorkloadItem[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}

/**
 * Interface WorkloadRead
 *
 * @description
 * What the `Workload` view reads: the list and the view's query (`ListViewStore.taskQuery`).
 */
export interface WorkloadRead {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property query
   *
   * @description
   * The view's filters, search, milestones and level; the sort does not apply.
   *
   * @type {ListTaskQuery}
   * @readonly
   */
  readonly query: ListTaskQuery;
  // #endregion
}

/**
 * Interface WorkloadEntry
 *
 * @description
 * A task in one cell of the grid: a chip of the cell and a line of its popover.
 */
export interface WorkloadEntry {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property name
   *
   * @description
   * Name of the task, as shown.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Status the task shows, a pending change or a write of the view included.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone, once the task is read (workload rows carry no flag, G15).
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestone: boolean;

  /**
   * Property minutes
   *
   * @description
   * Minutes of the task allocated to the row that day.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property task
   *
   * @description
   * The task as the view shows it, for its menu, its reassignment and the detail's preview; null
   * while it is not read.
   *
   * @type {TaskSummary | null}
   * @readonly
   */
  readonly task: TaskSummary | null;
  // #endregion
}

/**
 * Interface WorkloadLoad
 *
 * @description
 * The load of one row of the grid, a person or the unassigned bucket: its tasks by day.
 */
export interface WorkloadLoad {
  // #region Properties
  /**
   * Property assigneeId
   *
   * @description
   * The person, null for the unassigned bucket.
   *
   * @type {string | null}
   * @readonly
   */
  readonly assigneeId: string | null;

  /**
   * Property days
   *
   * @description
   * The tasks of the row by day (`YYYY-MM-DD`), in the gateway's order; a day without task is
   * missing.
   *
   * @type {Readonly<Record<string, readonly WorkloadEntry[]>>}
   * @readonly
   */
  readonly days: Readonly<Record<string, readonly WorkloadEntry[]>>;
  // #endregion
}

/**
 * Interface ShownWorkloadTask
 *
 * @description
 * A task as the view shows it, from the list's task reader: its assignees, status and name, the
 * view's writes applied.
 */
export interface ShownWorkloadTask {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as shown.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property assigneeIds
   *
   * @description
   * The people the grid files the task under: its assignees as shown, with a reassignment of
   * the view still in flight applied; empty for the unassigned bucket.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly assigneeIds: readonly string[];

  /**
   * Property status
   *
   * @description
   * The status it shows.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Interface WorkloadReassignment
 *
 * @description
 * A chip dragged from one row to another: the task leaves `from` and joins `to` (null for the
 * unassigned bucket on either side).
 */
export interface WorkloadReassignment {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task, as shown.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property from
   *
   * @description
   * The person it leaves, null from the unassigned bucket.
   *
   * @type {string | null}
   * @readonly
   */
  readonly from: string | null;

  /**
   * Property to
   *
   * @description
   * The person it joins, null to the unassigned bucket (which only removes `from`).
   *
   * @type {string | null}
   * @readonly
   */
  readonly to: string | null;

  /**
   * Property fromName
   *
   * @description
   * Name of the row it leaves, for the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly fromName: string;

  /**
   * Property toName
   *
   * @description
   * Name of the row it joins, for the toast.
   *
   * @type {string}
   * @readonly
   */
  readonly toName: string;
  // #endregion
}
