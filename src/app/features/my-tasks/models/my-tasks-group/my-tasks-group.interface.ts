import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

import type { DueBucket } from '../../utils/due-bucket/due-bucket.util';

/**
 * Type MyTasksGroupKey
 *
 * @description
 * A group of the page: an open due bucket on the `To do` tab, or `closed` (`Done and cancelled`)
 * on the `Done` tab (`App.dc.html` lines 6661-6665).
 *
 * @type {DueBucket}
 */
export type MyTasksGroupKey = DueBucket;

/**
 * Interface MyTaskRow
 *
 * @description
 * One line of a group, as the page resolved it for `cw-task-line`.
 */
export interface MyTaskRow {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as the row writes show it (`TaskRowActionsStore.rows`).
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * The status shown, a pending click included, from the read copy of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property listName
   *
   * @description
   * The name of the task's list, the archived-list label, or empty while the lists are unknown.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;
  // #endregion
}

/**
 * Interface MyTasksGroup
 *
 * @description
 * One section of the page, never empty.
 */
export interface MyTasksGroup {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Which group it is.
   *
   * @type {MyTasksGroupKey}
   * @readonly
   */
  readonly key: MyTasksGroupKey;

  /**
   * Property rows
   *
   * @description
   * Its lines, in the gateway's order.
   *
   * @type {readonly MyTaskRow[]}
   * @readonly
   */
  readonly rows: readonly MyTaskRow[];
  // #endregion
}
