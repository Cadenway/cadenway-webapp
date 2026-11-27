import type { StatusKey } from '@cadenway/contracts';

/**
 * Interface TrashRestore
 *
 * @description
 * What a restore brought back, for its toast (`App.dc.html` line 8385) and the sidebar.
 */
export interface TrashRestore {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the restored task, which the toast's `Open` opens.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property taskName
   *
   * @description
   * Name of the restored task, shown while its detail is read.
   *
   * @type {string}
   * @readonly
   */
  readonly taskName: string;

  /**
   * Property status
   *
   * @description
   * Status of the restored task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property listName
   *
   * @description
   * Name of the list the task is back in.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;

  /**
   * Property subtaskCount
   *
   * @description
   * Subtasks that came back with it, at every level.
   *
   * @type {number}
   * @readonly
   */
  readonly subtaskCount: number;

  /**
   * Property detached
   *
   * @description
   * Whether the task left a parent that is no longer live and is now a top-level task.
   *
   * @type {boolean}
   * @readonly
   */
  readonly detached: boolean;
  // #endregion
}
