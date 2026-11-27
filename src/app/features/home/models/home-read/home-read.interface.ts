import type { TaskSummary } from '@features/task';

/**
 * Interface HomeStats
 *
 * @description
 * The four counters of the home screen (`App.dc.html` lines 6652-6657), over the tasks assigned
 * to the caller in every space, subtasks included.
 */
export interface HomeStats {
  // #region Properties
  /**
   * Property assigned
   *
   * @description
   * Tasks that are not closed (`Assigned to me`).
   *
   * @type {number}
   * @readonly
   */
  readonly assigned: number;

  /**
   * Property late
   *
   * @description
   * Tasks that are not closed and were due before the local day of the read (`Late`).
   *
   * @type {number}
   * @readonly
   */
  readonly late: number;

  /**
   * Property dueToday
   *
   * @description
   * Tasks that are not closed and are due on the local day of the read (`Today`).
   *
   * @type {number}
   * @readonly
   */
  readonly dueToday: number;

  /**
   * Property done
   *
   * @description
   * Every task of the `done` status, without a sprint bound (`Done`, gap G-H1).
   *
   * @type {number}
   * @readonly
   */
  readonly done: number;
  // #endregion
}

/**
 * Interface HomeSprint
 *
 * @description
 * The sprint card of the home screen (`App.dc.html` lines 1717-1724): the first sprint current on
 * the local day of the read.
 */
export interface HomeSprint {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The sprint's list, opened by `Open the sprint`.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * The sprint's name (`Sprint 14`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property startDate
   *
   * @description
   * The first day of the sprint (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly startDate: string;

  /**
   * Property endDate
   *
   * @description
   * The last day of the sprint (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly endDate: string;

  /**
   * Property done
   *
   * @description
   * The sprint's top-level tasks of the `done` status.
   *
   * @type {number}
   * @readonly
   */
  readonly done: number;

  /**
   * Property live
   *
   * @description
   * The sprint's top-level tasks that are not cancelled (the mockup's `liveCount`).
   *
   * @type {number}
   * @readonly
   */
  readonly live: number;
  // #endregion
}

/**
 * Interface HomeList
 *
 * @description
 * One row of the home screen's `Lists` (`App.dc.html` lines 1735-1742).
 */
export interface HomeList {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * The list's name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceId
   *
   * @description
   * The list's space, whose name the row shows.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property open
   *
   * @description
   * The list's top-level tasks that are not closed.
   *
   * @type {number}
   * @readonly
   */
  readonly open: number;
  // #endregion
}

/**
 * Interface HomeSnapshot
 *
 * @description
 * One `getHome` answer as display models.
 */
export interface HomeSnapshot {
  // #region Properties
  /**
   * Property stats
   *
   * @description
   * The four counters.
   *
   * @type {HomeStats}
   * @readonly
   */
  readonly stats: HomeStats;

  /**
   * Property priorities
   *
   * @description
   * `My priorities`: seven open tasks at most, by due date.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly priorities: readonly TaskSummary[];

  /**
   * Property sprint
   *
   * @description
   * The first current sprint, or null when no sprint is current.
   *
   * @type {HomeSprint | null}
   * @readonly
   */
  readonly sprint: HomeSprint | null;

  /**
   * Property lists
   *
   * @description
   * The first six lists of the sidebar.
   *
   * @type {readonly HomeList[]}
   * @readonly
   */
  readonly lists: readonly HomeList[];
  // #endregion
}

/**
 * Interface HomeRead
 *
 * @description
 * What the page shows: the last successful read of the organization, the local day it was asked
 * for and whether the latest refresh failed.
 */
export interface HomeRead extends HomeSnapshot {
  // #region Properties
  /**
   * Property today
   *
   * @description
   * The local day of the read (`YYYY-MM-DD`), the `today` sent to `getHome`.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property refreshFailed
   *
   * @description
   * Whether the latest background refresh or `Retry` failed, so these values are the previous
   * read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly refreshFailed: boolean;
  // #endregion
}
