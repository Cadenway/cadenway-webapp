import type {
  ListGroupQuery,
  ListSort,
  ListSortField,
  ListTaskQuery,
  ListViewConfig,
  ListViewFilters,
} from '../../models/list-view-config/list-view-config.interface';

/**
 * Constant EMPTY_FILTERS
 *
 * @description
 * No filter on any field.
 *
 * @type {ListViewFilters}
 */
export const EMPTY_FILTERS: ListViewFilters = { status: [], priority: [], assignee: [], label: [] };

/**
 * Constant DEFAULT_VIEW_CONFIG
 *
 * @description
 * What a list shows when nothing was chosen (`SV_DEFAULT` of `App.dc.html`): no filter, manual
 * order, grouped by status, subtasks folded under their parent.
 *
 * @type {ListViewConfig}
 */
export const DEFAULT_VIEW_CONFIG: ListViewConfig = {
  filters: EMPTY_FILTERS,
  sort: { field: 'manual', direction: 'asc' },
  groupBy: 'status',
  subtasks: 'nested',
};

/**
 * Constant SORT_FIELDS
 *
 * @description
 * The criteria of `Sort by`, in the mockup's order (`SORTS`).
 *
 * @type {readonly ListSortField[]}
 */
export const SORT_FIELDS: readonly ListSortField[] = [
  'manual',
  'dueDate',
  'priority',
  'name',
  'createdAt',
];

/**
 * Function toSortKey
 *
 * @description
 * The gateway's signed sort key: the field, prefixed with `-` when descending.
 *
 * @param {ListSort} sort - Sort and direction.
 * @returns {string} The sort key (`-dueDate`).
 */
export function toSortKey(sort: ListSort): string {
  return sort.direction === 'desc' ? `-${sort.field}` : sort.field;
}

/**
 * Function fromSortKey
 *
 * @description
 * Reads a signed sort key; an unknown field is the manual order.
 *
 * @param {string} key - Gateway sort key.
 * @returns {ListSort} The sort.
 */
export function fromSortKey(key: string): ListSort {
  const descending: boolean = key.startsWith('-');
  const field: string = descending ? key.slice(1) : key;
  return (SORT_FIELDS as readonly string[]).includes(field)
    ? { field: field as ListSortField, direction: descending ? 'desc' : 'asc' }
    : { field: 'manual', direction: 'asc' };
}

/**
 * Function filterCount
 *
 * @description
 * Fields that filter something, the number on `Filter`.
 *
 * @param {ListViewFilters} filters - Filters.
 * @returns {number} Active fields.
 */
export function filterCount(filters: ListViewFilters): number {
  return [filters.status, filters.priority, filters.assignee, filters.label].filter(
    (values: readonly string[]): boolean => values.length > 0,
  ).length;
}

/**
 * Function toTaskQuery
 *
 * @description
 * The task query of a view: the non-empty filters, the trimmed search, the milestones switch, the
 * level of the subtask display and the signed sort.
 *
 * @param {ListViewConfig} config - View configuration.
 * @param {string} search - Typed search.
 * @param {boolean} milestonesOnly - Whether `Milestones` is pressed.
 * @returns {ListTaskQuery} The query.
 */
export function toTaskQuery(
  config: ListViewConfig,
  search: string,
  milestonesOnly: boolean,
): ListTaskQuery {
  const filters: ListViewFilters = config.filters;
  const text: string = search.trim();
  return {
    ...(filters.status.length ? { status: filters.status } : {}),
    ...(filters.priority.length ? { priority: filters.priority } : {}),
    ...(filters.assignee.length ? { assignee: filters.assignee } : {}),
    ...(filters.label.length ? { label: filters.label } : {}),
    ...(text ? { search: text } : {}),
    ...(milestonesOnly ? { milestone: true } : {}),
    level: config.subtasks === 'separate' ? 'all' : 'roots',
    sort: toSortKey(config.sort),
  };
}

/**
 * Function toGroupQuery
 *
 * @description
 * The group counts of a view, or null when it is not grouped.
 *
 * @param {ListViewConfig} config - View configuration.
 * @param {ListTaskQuery} query - Its task query.
 * @returns {ListGroupQuery | null} The group query.
 */
export function toGroupQuery(config: ListViewConfig, query: ListTaskQuery): ListGroupQuery | null {
  return config.groupBy === null ? null : { groupBy: config.groupBy, query };
}

/**
 * Function sameSavedSettings
 *
 * @description
 * Whether two configurations store the same view: filters (in any order), sort and grouping.
 * The subtask display is local and never makes a saved view `Modified`.
 *
 * @param {ListViewConfig} first - A configuration.
 * @param {ListViewConfig} second - Another configuration.
 * @returns {boolean} Whether they match.
 */
export function sameSavedSettings(first: ListViewConfig, second: ListViewConfig): boolean {
  const sameValues: (a: readonly string[], b: readonly string[]) => boolean = (a, b) =>
    a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
  return (
    sameValues(first.filters.status, second.filters.status) &&
    sameValues(first.filters.priority, second.filters.priority) &&
    sameValues(first.filters.assignee, second.filters.assignee) &&
    sameValues(first.filters.label, second.filters.label) &&
    first.sort.field === second.sort.field &&
    first.sort.direction === second.sort.direction &&
    first.groupBy === second.groupBy
  );
}
