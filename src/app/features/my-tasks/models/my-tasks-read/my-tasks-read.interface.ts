import type { TaskSummary } from '@features/task';

/**
 * Type MyTasksTab
 *
 * @description
 * The tabs of `My tasks` (`App.dc.html` line 9151): `open` (`To do`, every status that is not
 * closed) and `closed` (`Done`, `done` and `cancelled`); the `state` of `listMyTasks`.
 *
 * @type {'open' | 'closed'}
 */
export type MyTasksTab = 'open' | 'closed';

/**
 * Interface MyTasksCounts
 *
 * @description
 * The caller's assigned tasks per tab, in every space, whatever page was read.
 */
export interface MyTasksCounts {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Tasks that are not closed (`To do`).
   *
   * @type {number}
   * @readonly
   */
  readonly open: number;

  /**
   * Property closed
   *
   * @description
   * Done and cancelled tasks (`Done`).
   *
   * @type {number}
   * @readonly
   */
  readonly closed: number;
  // #endregion
}

/**
 * Interface MyTasksPage
 *
 * @description
 * One tab of the caller's assigned tasks as the data-access service reads it: every page up to the
 * last cursor, in the gateway's order (by due date, undated last).
 */
export interface MyTasksPage {
  // #region Properties
  /**
   * Property tasks
   *
   * @description
   * The tasks read, each key once.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly tasks: readonly TaskSummary[];

  /**
   * Property counts
   *
   * @description
   * The counts of both tabs, from the last page read.
   *
   * @type {MyTasksCounts}
   * @readonly
   */
  readonly counts: MyTasksCounts;

  /**
   * Property complete
   *
   * @description
   * False when a page after the first failed: `tasks` then holds the pages read before it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly complete: boolean;
  // #endregion
}

/**
 * Interface MyTasksRead
 *
 * @description
 * What the page shows of one tab: the last successful read of that tab in the organization, the
 * local day its due buckets are computed against, and whether the latest refresh failed.
 */
export interface MyTasksRead extends MyTasksPage {
  // #region Properties
  /**
   * Property tab
   *
   * @description
   * The tab read.
   *
   * @type {MyTasksTab}
   * @readonly
   */
  readonly tab: MyTasksTab;

  /**
   * Property today
   *
   * @description
   * The local day of the read (`YYYY-MM-DD`).
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property refreshFailed
   *
   * @description
   * Whether the latest background refresh or `Retry` failed, so these rows are the previous read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly refreshFailed: boolean;
  // #endregion
}
