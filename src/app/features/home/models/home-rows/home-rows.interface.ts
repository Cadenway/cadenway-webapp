import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

/**
 * Interface HomePriorityRow
 *
 * @description
 * One line of `My priorities` as the page shows it.
 */
export interface HomePriorityRow {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task, as the menu's writes show it.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * The status drawn, a pending change included.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property listName
   *
   * @description
   * The text after the key: the list's name, `Archived list`, or empty when unknown.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;
  // #endregion
}

/**
 * Interface HomeListRow
 *
 * @description
 * One row of `Lists` as the page shows it.
 */
export interface HomeListRow {
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
   * Property spaceName
   *
   * @description
   * Its space's name, or empty while the sidebar does not know it.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property open
   *
   * @description
   * Its open top-level tasks.
   *
   * @type {number}
   * @readonly
   */
  readonly open: number;

  /**
   * Property link
   *
   * @description
   * The list's address (`/<slug>/l/<listId>`).
   *
   * @type {string}
   * @readonly
   */
  readonly link: string;
  // #endregion
}
