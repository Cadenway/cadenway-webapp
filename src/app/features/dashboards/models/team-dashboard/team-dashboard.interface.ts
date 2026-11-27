import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

/**
 * Type DashboardWeeks
 *
 * @description
 * The periods the dashboard offers (`8 weeks`, `12 weeks`): the weeks of completions it reads,
 * the current week included.
 *
 * @type {8 | 12}
 */
export type DashboardWeeks = 8 | 12;

/**
 * Interface DashboardStatusCount
 *
 * @description
 * One line of `By status`: a status the caller's visible tasks have, with their number.
 */
export interface DashboardStatusCount {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * The status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property count
   *
   * @description
   * Tasks in that status, one at least.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}

/**
 * Interface DashboardAssigneeLoad
 *
 * @description
 * The open tasks of one assignee, as `Workload per person` measures them.
 */
export interface DashboardAssigneeLoad {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * User id of the assignee, the one the member list names.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property openCount
   *
   * @description
   * Open tasks assigned to them, each task counted once.
   *
   * @type {number}
   * @readonly
   */
  readonly openCount: number;
  // #endregion
}

/**
 * Interface DashboardCompletionWeek
 *
 * @description
 * One bar of `Tasks completed per week`.
 */
export interface DashboardCompletionWeek {
  // #region Properties
  /**
   * Property startsOn
   *
   * @description
   * Monday of the week, as an ISO calendar date, in the caller's time zone.
   *
   * @type {string}
   * @readonly
   */
  readonly startsOn: string;

  /**
   * Property week
   *
   * @description
   * ISO week number of that Monday (`45`), which the bar's label shows.
   *
   * @type {number}
   * @readonly
   */
  readonly week: number;

  /**
   * Property completed
   *
   * @description
   * Tasks that reached `done` during the week; the current week stops at the read.
   *
   * @type {number}
   * @readonly
   */
  readonly completed: number;
  // #endregion
}

/**
 * Interface TeamDashboard
 *
 * @description
 * The team dashboard of the organization (mockup `App.dc.html` lines 1791-1892), restricted to the
 * tasks the caller sees: its counters, its tasks per status, its first late tasks, the load of
 * each assignee and the completions per week.
 */
export interface TeamDashboard {
  // #region Properties
  /**
   * Property today
   *
   * @description
   * The caller's date the dashboard was computed for, as an ISO calendar date.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property weeks
   *
   * @description
   * Weeks of completions read.
   *
   * @type {DashboardWeeks}
   * @readonly
   */
  readonly weeks: DashboardWeeks;

  /**
   * Property openCount
   *
   * @description
   * Visible tasks whose status is not closed (`Open tasks`).
   *
   * @type {number}
   * @readonly
   */
  readonly openCount: number;

  /**
   * Property lateCount
   *
   * @description
   * Open tasks due before today (`Late`), every one of them, past the ten `overdueTasks` hold.
   *
   * @type {number}
   * @readonly
   */
  readonly lateCount: number;

  /**
   * Property blockedCount
   *
   * @description
   * Tasks whose status is exactly `blocked` (`Blocked`).
   *
   * @type {number}
   * @readonly
   */
  readonly blockedCount: number;

  /**
   * Property completedCount
   *
   * @description
   * Completions over the weeks read (`Completed`).
   *
   * @type {number}
   * @readonly
   */
  readonly completedCount: number;

  /**
   * Property byStatus
   *
   * @description
   * The represented statuses, in workflow order.
   *
   * @type {readonly DashboardStatusCount[]}
   * @readonly
   */
  readonly byStatus: readonly DashboardStatusCount[];

  /**
   * Property overdueTasks
   *
   * @description
   * The first ten late tasks, by due date then key (the contract's cap, gap G-D1).
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly overdueTasks: readonly TaskSummary[];

  /**
   * Property assigneeThreshold
   *
   * @description
   * Open tasks one person can take on (6): the full width of a workload meter.
   *
   * @type {number}
   * @readonly
   */
  readonly assigneeThreshold: number;

  /**
   * Property assignees
   *
   * @description
   * The load of each assignee of the visible tasks.
   *
   * @type {readonly DashboardAssigneeLoad[]}
   * @readonly
   */
  readonly assignees: readonly DashboardAssigneeLoad[];

  /**
   * Property completions
   *
   * @description
   * Every week read, in chronological order, the last one being the current week.
   *
   * @type {readonly DashboardCompletionWeek[]}
   * @readonly
   */
  readonly completions: readonly DashboardCompletionWeek[];
  // #endregion
}
