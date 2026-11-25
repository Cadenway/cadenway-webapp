/**
 * Type StatusKey
 *
 * @description
 * The ten fixed status keys of a task, in workflow order.
 *
 * @type {'triage' | 'backlog' | 'todo' | 'progress' | 'review' | 'testing' | 'waiting' | 'blocked' | 'done' | 'cancelled'}
 */
export type StatusKey =
  | 'triage'
  | 'backlog'
  | 'todo'
  | 'progress'
  | 'review'
  | 'testing'
  | 'waiting'
  | 'blocked'
  | 'done'
  | 'cancelled';

/**
 * Type PriorityKey
 *
 * @description
 * The four priority keys, from the highest.
 *
 * @type {'urgente' | 'haute' | 'moyenne' | 'basse'}
 */
export type PriorityKey = 'urgente' | 'haute' | 'moyenne' | 'basse';

/**
 * Type ListSortField
 *
 * @description
 * The five criteria of « Trier par »: manual order, due date, priority, name and creation date.
 *
 * @type {'manual' | 'dueDate' | 'priority' | 'name' | 'createdAt'}
 */
export type ListSortField = 'manual' | 'dueDate' | 'priority' | 'name' | 'createdAt';

/**
 * Type SortDirection
 *
 * @description
 * Direction of the sort (« Croissant », « Décroissant »).
 *
 * @type {'asc' | 'desc'}
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Type ListGroupBy
 *
 * @description
 * Grouping of « Grouper par »; null is « Aucun ».
 *
 * @type {'status' | 'priority' | 'assignee' | null}
 */
export type ListGroupBy = 'status' | 'priority' | 'assignee' | null;

/**
 * Type SubtaskMode
 *
 * @description
 * Display of the subtasks: folded under their parent, unfolded under it, or apart as tasks.
 *
 * @type {'nested' | 'expanded' | 'separate'}
 */
export type SubtaskMode = 'nested' | 'expanded' | 'separate';

/**
 * Type FilterField
 *
 * @description
 * The four fields of the « Filtrer » dialog.
 *
 * @type {'status' | 'priority' | 'assignee' | 'label'}
 */
export type FilterField = 'status' | 'priority' | 'assignee' | 'label';

/**
 * Type AssigneeFilter
 *
 * @description
 * An assignee kept by the filter: `me` for the reader (« Moi »), `none` for the unassigned tasks
 * (« Non assigné »), or an account id.
 *
 * @type {string}
 */
export type AssigneeFilter = string;

/**
 * Interface ListViewFilters
 *
 * @description
 * The values kept by each filter field; an empty field filters nothing.
 */
export interface ListViewFilters {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Statuses kept.
   *
   * @type {readonly StatusKey[]}
   * @readonly
   */
  readonly status: readonly StatusKey[];

  /**
   * Property priority
   *
   * @description
   * Priorities kept.
   *
   * @type {readonly PriorityKey[]}
   * @readonly
   */
  readonly priority: readonly PriorityKey[];

  /**
   * Property assignee
   *
   * @description
   * Assignees kept.
   *
   * @type {readonly AssigneeFilter[]}
   * @readonly
   */
  readonly assignee: readonly AssigneeFilter[];

  /**
   * Property label
   *
   * @description
   * Labels kept.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly label: readonly string[];
  // #endregion
}

/**
 * Interface ListSort
 *
 * @description
 * The sort of « Trier par » and its direction.
 */
export interface ListSort {
  // #region Properties
  /**
   * Property field
   *
   * @description
   * Sort criterion.
   *
   * @type {ListSortField}
   * @readonly
   */
  readonly field: ListSortField;

  /**
   * Property direction
   *
   * @description
   * Sort direction.
   *
   * @type {SortDirection}
   * @readonly
   */
  readonly direction: SortDirection;
  // #endregion
}

/**
 * Interface ListViewConfig
 *
 * @description
 * What a list view shows, shared by every layout: filters, sort, grouping and subtask display.
 * Saved views store the first three; the subtask display stays local.
 */
export interface ListViewConfig {
  // #region Properties
  /**
   * Property filters
   *
   * @description
   * Values kept by each field.
   *
   * @type {ListViewFilters}
   * @readonly
   */
  readonly filters: ListViewFilters;

  /**
   * Property sort
   *
   * @description
   * Sort criterion and direction.
   *
   * @type {ListSort}
   * @readonly
   */
  readonly sort: ListSort;

  /**
   * Property groupBy
   *
   * @description
   * Grouping, or null for none.
   *
   * @type {ListGroupBy}
   * @readonly
   */
  readonly groupBy: ListGroupBy;

  /**
   * Property subtasks
   *
   * @description
   * Subtask display.
   *
   * @type {SubtaskMode}
   * @readonly
   */
  readonly subtasks: SubtaskMode;
  // #endregion
}

/**
 * Interface ListTaskQuery
 *
 * @description
 * The task query of a list view, in the shape of `queryListTasks`'s body without its cursor and
 * limit: an absent member filters nothing. The rows pass sends it through its data-access service.
 */
export interface ListTaskQuery {
  // #region Properties
  /**
   * Property status
   *
   * @description
   * Statuses kept.
   *
   * @type {readonly StatusKey[] | undefined}
   * @readonly
   */
  readonly status?: readonly StatusKey[];

  /**
   * Property priority
   *
   * @description
   * Priorities kept.
   *
   * @type {readonly PriorityKey[] | undefined}
   * @readonly
   */
  readonly priority?: readonly PriorityKey[];

  /**
   * Property assignee
   *
   * @description
   * Assignees kept (`me`, `none` or account ids).
   *
   * @type {readonly AssigneeFilter[] | undefined}
   * @readonly
   */
  readonly assignee?: readonly AssigneeFilter[];

  /**
   * Property label
   *
   * @description
   * Labels kept.
   *
   * @type {readonly string[] | undefined}
   * @readonly
   */
  readonly label?: readonly string[];

  /**
   * Property search
   *
   * @description
   * Text the task names contain, trimmed; absent when empty.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly search?: string;

  /**
   * Property milestone
   *
   * @description
   * True to keep only the milestones (« Jalons »); absent otherwise.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly milestone?: boolean;

  /**
   * Property level
   *
   * @description
   * `roots` when subtasks show under their parent, `all` when they show apart.
   *
   * @type {'roots' | 'all'}
   * @readonly
   */
  readonly level: 'roots' | 'all';

  /**
   * Property sort
   *
   * @description
   * Gateway sort key, `-` prefixed for a descending sort.
   *
   * @type {string}
   * @readonly
   */
  readonly sort: string;
  // #endregion
}

/**
 * Interface ListGroupQuery
 *
 * @description
 * The group counts of a list view, in the shape of `countTaskGroups`'s parameters: the task query's
 * filters (without its sort) and the grouping.
 */
export interface ListGroupQuery {
  // #region Properties
  /**
   * Property groupBy
   *
   * @description
   * Grouping counted.
   *
   * @type {'status' | 'priority' | 'assignee'}
   * @readonly
   */
  readonly groupBy: 'status' | 'priority' | 'assignee';

  /**
   * Property query
   *
   * @description
   * The filters of the task query; its sort is ignored.
   *
   * @type {ListTaskQuery}
   * @readonly
   */
  readonly query: ListTaskQuery;
  // #endregion
}
