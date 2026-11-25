import type { StatusKey } from '@cadenway/contracts';

import type { TaskSummary } from '@features/task';

import type { ListGroupQuery, ListTaskQuery } from '../list-view-config/list-view-config.interface';

/**
 * Interface TaskGroupCount
 *
 * @description
 * One group of `countTaskGroups`: its value, added to the filters to read its tasks, and how
 * many tasks it holds.
 */
export interface TaskGroupCount {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * Status key, priority, user id, or `none` for the tasks nobody is assigned.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property count
   *
   * @description
   * Tasks of the group that match the filters.
   *
   * @type {number}
   * @readonly
   */
  readonly count: number;
  // #endregion
}

/**
 * Interface GroupFilter
 *
 * @description
 * The value of one group added to the filters of a page read ("grouping is a filter").
 */
export interface GroupFilter {
  // #region Properties
  /**
   * Property groupBy
   *
   * @description
   * Field the view groups by.
   *
   * @type {ListGroupQuery['groupBy']}
   * @readonly
   */
  readonly groupBy: ListGroupQuery['groupBy'];

  /**
   * Property value
   *
   * @description
   * Value of the group.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;
  // #endregion
}

/**
 * Interface ListTaskPage
 *
 * @description
 * One cursor page of the tasks of a list.
 */
export interface ListTaskPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * Tasks of the page, in the view's order.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly items: readonly TaskSummary[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, null after the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;

  /**
   * Property total
   *
   * @description
   * Tasks that match the filters of the read, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface GroupProgress
 *
 * @description
 * How far the rows of one group are read.
 */
export interface GroupProgress {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * Value of the group (`all` for a view that does not group).
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property count
   *
   * @description
   * Tasks of the group from `countTaskGroups`, or the page total for an ungrouped view; null before that page.
   *
   * @type {number | null}
   * @readonly
   */
  readonly count: number | null;

  /**
   * Property cursor
   *
   * @description
   * Cursor of the next page to read, null before the first page.
   *
   * @type {string | null}
   * @readonly
   */
  readonly cursor: string | null;

  /**
   * Property started
   *
   * @description
   * Whether its first page was read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly started: boolean;

  /**
   * Property done
   *
   * @description
   * Whether its last page was read, or it holds no task.
   *
   * @type {boolean}
   * @readonly
   */
  readonly done: boolean;
  // #endregion
}

/**
 * Interface ListRowsQuery
 *
 * @description
 * What the rows of the « Liste » view read: the list, the view's query and grouping, and the
 * subtask display.
 */
export interface ListRowsQuery {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The open list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property query
   *
   * @description
   * The `queryListTasks` body of the view, without cursor and limit.
   *
   * @type {ListTaskQuery}
   * @readonly
   */
  readonly query: ListTaskQuery;

  /**
   * Property groupQuery
   *
   * @description
   * The `countTaskGroups` parameters, null when the view does not group.
   *
   * @type {ListGroupQuery | null}
   * @readonly
   */
  readonly groupQuery: ListGroupQuery | null;
  // #endregion
}

/**
 * Interface ListRow
 *
 * @description
 * One row of the « Liste » view: a task in one group, at a subtask depth, with what its cells
 * show at once.
 */
export interface ListRow {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identity of the row in the table and in its selection: the task key, prefixed by the group
   * when grouping by assignee puts a task in several groups.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property group
   *
   * @description
   * Value of the group the row is filed under: the settled status, which changes 460 ms after
   * the last click, the priority, an assignee, or `all`.
   *
   * @type {string}
   * @readonly
   */
  readonly group: string;

  /**
   * Property task
   *
   * @description
   * The task with its settled status applied.
   *
   * @type {TaskSummary}
   * @readonly
   */
  readonly task: TaskSummary;

  /**
   * Property status
   *
   * @description
   * Status the icon and the word show, the pending click included.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property depth
   *
   * @description
   * 0 for a task of the list, 1 or 2 for a subtask shown under its parent.
   *
   * @type {number}
   * @readonly
   */
  readonly depth: number;

  /**
   * Property canAddSubtask
   *
   * @description
   * Whether the known ancestry and child count permit adding another subtask.
   *
   * @type {boolean}
   * @readonly
   */
  readonly canAddSubtask: boolean;

  /**
   * Property expandable
   *
   * @description
   * Whether the row shows the caret of its subtasks.
   *
   * @type {boolean}
   * @readonly
   */
  readonly expandable: boolean;

  /**
   * Property expanded
   *
   * @description
   * Whether its subtasks show under it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly expanded: boolean;

  /**
   * Property childrenFailed
   *
   * @description
   * Whether reading its subtasks failed; the row offers « Réessayer ».
   *
   * @type {boolean}
   * @readonly
   */
  readonly childrenFailed: boolean;

  /**
   * Property entering
   *
   * @description
   * Whether the row just joined its group after a status change, for its entry motion.
   *
   * @type {boolean}
   * @readonly
   */
  readonly entering: boolean;
  // #endregion
}
