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
 * The five criteria of `Sort by`: manual order, due date, priority, name and creation date.
 *
 * @type {'manual' | 'dueDate' | 'priority' | 'name' | 'createdAt'}
 */
export type ListSortField = 'manual' | 'dueDate' | 'priority' | 'name' | 'createdAt';

/**
 * Type SortDirection
 *
 * @description
 * Direction of the sort (`Ascending`, `Descending`).
 *
 * @type {'asc' | 'desc'}
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Type ListGroupBy
 *
 * @description
 * Grouping of `Group by`; null is `None`.
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
 * The four fields of the `Filter` dialog.
 *
 * @type {'status' | 'priority' | 'assignee' | 'label'}
 */
export type FilterField = 'status' | 'priority' | 'assignee' | 'label';

/**
 * Type AssigneeFilter
 *
 * @description
 * An assignee kept by the filter: `me` for the reader (`Me`), `none` for the unassigned tasks
 * (`Unassigned`), or an account id.
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
 * The sort of `Sort by` and its direction.
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
 * Type SheetColumn
 *
 * @description
 * The built-in columns of the `Sheet` view (`TBL_COLS` of `App.dc.html`), with the contract's
 * keys (`SavedViewSheetColumn`): `points` and `client` are the mockup's seed custom fields that
 * the contract names.
 *
 * @type {'name' | 'status' | 'priority' | 'people' | 'due' | 'estimate' | 'spent' | 'labels' | 'list' | 'points' | 'client'}
 */
export type SheetColumn =
  | 'name'
  | 'status'
  | 'priority'
  | 'people'
  | 'due'
  | 'estimate'
  | 'spent'
  | 'labels'
  | 'list'
  | 'points'
  | 'client';

/**
 * Interface SheetSort
 *
 * @description
 * The `Sheet` view's own sort by a built-in column, applied to the fully read rows; it never
 * changes the task query's sort.
 */
export interface SheetSort {
  // #region Properties
  /**
   * Property column
   *
   * @description
   * Column sorted.
   *
   * @type {SheetColumn}
   * @readonly
   */
  readonly column: SheetColumn;

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
 * Interface CustomFieldSort
 *
 * @description
 * The `Sheet` view's sort by a custom field; it takes precedence over `SheetSort` while the list
 * still has that field.
 */
export interface CustomFieldSort {
  // #region Properties
  /**
   * Property fieldId
   *
   * @description
   * Stable id of the custom field.
   *
   * @type {string}
   * @readonly
   */
  readonly fieldId: string;

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
 * Interface ActiveCustomField
 *
 * @description
 * A custom field the list still has, as the sheet publishes it to the frame
 * (`ListViewStore.followCustomFields`): stored ids of other fields are retired.
 */
export interface ActiveCustomField {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable id of the field.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the field, its column header.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;
  // #endregion
}

/**
 * Interface ListViewPresentation
 *
 * @description
 * How a layout presents the tasks, without changing which tasks are read (the contract's
 * `SavedViewPresentation`): the board's hidden status columns, the sheet's hidden columns and its
 * own sort. Only the members of the shown layout count for `Save the view`, `Modified` and the
 * saved-view summary (`presentationFor`).
 */
export interface ListViewPresentation {
  // #region Properties
  /**
   * Property hiddenBoardStatusKeys
   *
   * @description
   * Status columns the board hides (`Columns shown`).
   *
   * @type {readonly StatusKey[]}
   * @readonly
   */
  readonly hiddenBoardStatusKeys: readonly StatusKey[];

  /**
   * Property hiddenSheetColumns
   *
   * @description
   * Built-in columns the sheet hides; the name always shows.
   *
   * @type {readonly SheetColumn[]}
   * @readonly
   */
  readonly hiddenSheetColumns: readonly SheetColumn[];

  /**
   * Property hiddenCustomFieldIds
   *
   * @description
   * Custom-field columns the sheet hides, by stable id; unknown or retired ids are ignored.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly hiddenCustomFieldIds: readonly string[];

  /**
   * Property sheetSort
   *
   * @description
   * The sheet's sort by a built-in column, or null for the task query's order.
   *
   * @type {SheetSort | null}
   * @readonly
   */
  readonly sheetSort: SheetSort | null;

  /**
   * Property customFieldSort
   *
   * @description
   * The sheet's sort by a custom field, or null.
   *
   * @type {CustomFieldSort | null}
   * @readonly
   */
  readonly customFieldSort: CustomFieldSort | null;
  // #endregion
}

/**
 * Interface ListViewConfig
 *
 * @description
 * What a list view shows, shared by every layout: filters, sort, grouping, subtask display and
 * presentation. Saved views store all but the subtask display, which stays local.
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

  /**
   * Property presentation
   *
   * @description
   * Hidden columns and the sheet's own sort.
   *
   * @type {ListViewPresentation}
   * @readonly
   */
  readonly presentation: ListViewPresentation;
  // #endregion
}

/**
 * Interface SheetExportSort
 *
 * @description
 * The sheet's sort as `exportListTasks` takes it (`sheetSortColumn`, `sheetSortDirection`): a
 * built-in column key or a custom field's id.
 */
export interface SheetExportSort {
  // #region Properties
  /**
   * Property column
   *
   * @description
   * Built-in column key or custom field id.
   *
   * @type {string}
   * @readonly
   */
  readonly column: string;

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
   * True to keep only the milestones (`Milestones`); absent otherwise.
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
