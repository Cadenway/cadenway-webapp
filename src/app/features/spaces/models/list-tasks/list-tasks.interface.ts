import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

import type { ListTaskQuery } from '../list-view-config/list-view-config.interface';

/**
 * Interface DueWindow
 *
 * @description
 * The due dates a read keeps (`dueFrom` and `dueTo` of `queryListTasks`), both included, as
 * `YYYY-MM-DD`. The gateway leaves undated tasks out of a windowed read.
 */
export interface DueWindow {
  // #region Properties
  /**
   * Property from
   *
   * @description
   * First due date kept.
   *
   * @type {string}
   * @readonly
   */
  readonly from: string;

  /**
   * Property to
   *
   * @description
   * Last due date kept.
   *
   * @type {string}
   * @readonly
   */
  readonly to: string;
  // #endregion
}

/**
 * Interface ListTasksRead
 *
 * @description
 * What `ListTasksStore` reads: a list, the view's query (`ListViewStore.taskQuery`) and an
 * optional due window.
 */
export interface ListTasksRead {
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
   * The view's filters, search, milestones, level and sort.
   *
   * @type {ListTaskQuery}
   * @readonly
   */
  readonly query: ListTaskQuery;

  /**
   * Property due
   *
   * @description
   * The due dates kept, or null for every task (undated ones included).
   *
   * @type {DueWindow | null | undefined}
   * @readonly
   */
  readonly due?: DueWindow | null;
  // #endregion
}

/**
 * Interface ListTaskItem
 *
 * @description
 * One task of a flat task view (calendar, Gantt, sheet), as shown: the views' writes applied.
 */
export interface ListTaskItem {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task as last read, with the view's pending and confirmed writes applied (status,
   * priority, assignees, name and dates).
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * The status the task shows: a pending click of its status icon or a write of the view.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}
