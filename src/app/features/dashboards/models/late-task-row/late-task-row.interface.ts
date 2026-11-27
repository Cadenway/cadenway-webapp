import type { StatusKey } from '@cadenway/contracts';

import type { Person, TaskSummary } from '@features/task';

/**
 * Interface LateTaskRow
 *
 * @description
 * One line of `Late`: the task as the menu's writes show it, with its list name and assignees.
 */
export interface LateTaskRow {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as the line draws it, with the values of its pending writes.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property source
   *
   * @description
   * The task as the dashboard read it, without pending values: the copy the row writes take, so
   * an `Undo` only ever puts back a confirmed value.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly source: TaskSummary;

  /**
   * Property status
   *
   * @description
   * Status shown, a pending click included.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property listName
   *
   * @description
   * Name of its list from the sidebar's directory; empty while the directory does not hold it.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;

  /**
   * Property people
   *
   * @description
   * Its assignees, in order.
   *
   * @type {readonly Person[]}
   * @readonly
   */
  readonly people: readonly Person[];
  // #endregion
}
