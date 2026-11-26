import { PRIORITY_KEYS, STATUS_KEYS } from '@cadenway/contracts';

import type {
  ListGroupBy,
  ListViewPresentation,
  SheetColumn,
} from '../../models/list-view-config/list-view-config.interface';
import type {
  SheetColumnKey,
  SheetCustomField,
  SheetFieldValue,
  SheetOrder,
  SheetRow,
  SheetTotals,
} from '../../models/sheet-view/sheet-view.interface';

/**
 * Constant SHEET_TABLE_COLUMNS
 *
 * @description
 * The built-in columns the sheet draws, in the mockup's order (`TBL_COLS` of `App.dc.html`
 * lines 3768-3782). The contract's `points` and `client` keys name the mockup's seed custom
 * fields: the sheet draws the list's real custom fields after these columns instead.
 *
 * @type {readonly SheetColumn[]}
 */
export const SHEET_TABLE_COLUMNS: readonly SheetColumn[] = [
  'name',
  'status',
  'priority',
  'people',
  'due',
  'estimate',
  'spent',
  'labels',
  'list',
];

/**
 * Constant UNSORTABLE_COLUMNS
 *
 * @description
 * The built-in columns the sheet does not sort by: the time spent is read only for the rows the
 * virtual table renders (gap G6), so an order by it would place every other row as empty.
 *
 * @type {readonly SheetColumn[]}
 */
export const UNSORTABLE_COLUMNS: readonly SheetColumn[] = ['spent'];

/**
 * Constant NO_ASSIGNEE
 *
 * @description
 * The assignee group of the unassigned tasks, as the gateway names it.
 *
 * @type {string}
 */
export const NO_ASSIGNEE: string = 'none';

/**
 * Constant FIELD_PREFIX
 *
 * @description
 * Prefix of a custom field's column key (`field:<id>`).
 *
 * @type {string}
 */
const FIELD_PREFIX: string = 'field:';

/**
 * Function fieldColumnKey
 *
 * @description
 * The column key of a custom field.
 *
 * @param {string} fieldId - Id of the field.
 * @returns {SheetColumnKey} The key.
 */
export function fieldColumnKey(fieldId: string): SheetColumnKey {
  return `field:${fieldId}`;
}

/**
 * Function fieldIdOf
 *
 * @description
 * The custom field of a column key, null for a built-in column.
 *
 * @param {string} key - A column key.
 * @returns {string | null} The field id.
 */
export function fieldIdOf(key: string): string | null {
  return key.startsWith(FIELD_PREFIX) ? key.slice(FIELD_PREFIX.length) : null;
}

/**
 * Function isTableColumn
 *
 * @description
 * Whether a key is a built-in column the sheet draws.
 *
 * @param {string} key - A column key.
 * @returns {boolean} Whether it is one.
 */
export function isTableColumn(key: string): key is SheetColumn {
  return (SHEET_TABLE_COLUMNS as readonly string[]).includes(key);
}

/**
 * Function sheetOrderOf
 *
 * @description
 * The order the sheet shows from the presentation: the custom field's sort while the list has
 * that field (it takes precedence), else the built-in column's sort when the sheet draws and
 * sorts that column, else none (the read order, the task query's sort). A saved sort by the time
 * spent (`UNSORTABLE_COLUMNS`) shows the read order.
 *
 * @param {ListViewPresentation} presentation - The view's presentation.
 * @param {readonly SheetCustomField[]} fields - The list's custom fields.
 * @returns {SheetOrder | null} The order.
 */
export function sheetOrderOf(
  presentation: ListViewPresentation,
  fields: readonly SheetCustomField[],
): SheetOrder | null {
  const fieldSort: ListViewPresentation['customFieldSort'] = presentation.customFieldSort;
  if (fieldSort && fields.some((field: SheetCustomField) => field.id === fieldSort.fieldId)) {
    return { key: fieldColumnKey(fieldSort.fieldId), direction: fieldSort.direction };
  }
  const sheetSort: ListViewPresentation['sheetSort'] = presentation.sheetSort;
  if (
    sheetSort &&
    isTableColumn(sheetSort.column) &&
    !UNSORTABLE_COLUMNS.includes(sheetSort.column)
  ) {
    return { key: sheetSort.column, direction: sheetSort.direction };
  }
  return null;
}

/**
 * Function presentationOfOrder
 *
 * @description
 * The presentation members that store an order of the sheet: a custom field's sort or a built-in
 * column's sort, the other cleared; both cleared without an order.
 *
 * @param {SheetOrder | null} order - The order.
 * @returns {Pick<ListViewPresentation, 'sheetSort' | 'customFieldSort'>} The members.
 */
export function presentationOfOrder(
  order: SheetOrder | null,
): Pick<ListViewPresentation, 'sheetSort' | 'customFieldSort'> {
  if (!order) return { sheetSort: null, customFieldSort: null };
  const fieldId: string | null = fieldIdOf(order.key);
  if (fieldId !== null) {
    return { sheetSort: null, customFieldSort: { fieldId, direction: order.direction } };
  }
  return {
    sheetSort: { column: order.key as SheetColumn, direction: order.direction },
    customFieldSort: null,
  };
}

/**
 * Interface SheetSortContext
 *
 * @description
 * What sorting the rows needs beyond them.
 */
export interface SheetSortContext {
  // #region Properties
  /**
   * Property locale
   *
   * @description
   * Application locale, for the collation of texts.
   *
   * @type {string}
   * @readonly
   */
  readonly locale: string;
  // #endregion

  // #region Methods
  /**
   * Method personName
   *
   * @description
   * The name of a member, for the assignees' order.
   *
   * @param {string} userId - The member.
   * @returns {string} The name, empty when unknown.
   */
  personName(userId: string): string;

  /**
   * Method listName
   *
   * @description
   * The name of a list, for the list's order.
   *
   * @param {string} listId - The list.
   * @returns {string} The name, empty when unknown.
   */
  listName(listId: string): string;
  // #endregion
}

/**
 * Function sortValue
 *
 * @description
 * What a row sorts by in a column: statuses in workflow order, priorities from urgent to low,
 * the first assignee's name, the first label; null for an empty cell.
 *
 * @param {SheetRow} row - The row.
 * @param {SheetColumnKey} key - The column.
 * @param {SheetSortContext} context - Names of members and lists.
 * @returns {number | string | null} The value.
 */
function sortValue(
  row: SheetRow,
  key: SheetColumnKey,
  context: SheetSortContext,
): number | string | null {
  const fieldId: string | null = fieldIdOf(key);
  if (fieldId !== null) {
    const value: SheetFieldValue | undefined = row.customFieldValues[fieldId];
    return value === undefined || value === '' ? null : value;
  }
  switch (key as SheetColumn) {
    case 'name':
      return row.task.name;
    case 'status':
      return STATUS_KEYS.indexOf(row.status);
    case 'priority':
      return PRIORITY_KEYS.indexOf(row.task.priority);
    case 'people':
      return row.task.assigneeIds.length === 0
        ? null
        : context.personName(row.task.assigneeIds[0]) || row.task.assigneeIds[0];
    case 'due':
      return row.task.due;
    case 'estimate':
      return row.estimateMinutes;
    case 'spent':
      return row.spentMinutes;
    case 'labels':
      return row.task.labels[0] ?? null;
    case 'list':
      return context.listName(row.task.listId) || row.task.listId;
    default:
      return null;
  }
}

/**
 * Function sortSheetRows
 *
 * @description
 * Orders the rows by a column, empty cells last in both directions; rows that compare equal keep
 * the read order (the task query's sort). Without an order, the rows stay as read.
 *
 * @param {readonly SheetRow[]} rows - The rows, in the read order.
 * @param {SheetOrder | null} order - The order.
 * @param {SheetSortContext} context - Locale and names.
 * @returns {readonly SheetRow[]} The sorted rows.
 */
export function sortSheetRows(
  rows: readonly SheetRow[],
  order: SheetOrder | null,
  context: SheetSortContext,
): readonly SheetRow[] {
  if (!order) return rows;
  const collator: Intl.Collator = new Intl.Collator(context.locale, {
    numeric: true,
    sensitivity: 'base',
  });
  const sign: number = order.direction === 'desc' ? -1 : 1;
  return rows
    .map((row: SheetRow) => ({ row, value: sortValue(row, order.key, context) }))
    .sort((first, second): number => {
      if (first.value === null || second.value === null) {
        return first.value === second.value ? 0 : first.value === null ? 1 : -1;
      }
      const compared: number =
        typeof first.value === 'number' && typeof second.value === 'number'
          ? first.value - second.value
          : collator.compare(String(first.value), String(second.value));
      return compared * sign;
    })
    .map(({ row }: { row: SheetRow }) => row);
}

/**
 * Function sheetTotals
 *
 * @description
 * The footer's and the title's aggregates over every row: the count, the tasks done, the sum of
 * the estimates, the sum of the time spent once every row's is read, and the sum of each numeric
 * custom field.
 *
 * @param {readonly SheetRow[]} rows - The rows.
 * @param {readonly SheetCustomField[]} fields - The list's custom fields.
 * @returns {SheetTotals} The aggregates.
 */
export function sheetTotals(
  rows: readonly SheetRow[],
  fields: readonly SheetCustomField[],
): SheetTotals {
  const numeric: readonly SheetCustomField[] = fields.filter(
    (field: SheetCustomField) => field.type === 'number',
  );
  const fieldSums: Record<string, number> = {};
  for (const field of numeric) fieldSums[field.id] = 0;
  let done: number = 0;
  let estimateMinutes: number = 0;
  let spentMinutes: number | null = 0;
  for (const row of rows) {
    if (row.status === 'done') done++;
    estimateMinutes += row.estimateMinutes ?? 0;
    spentMinutes =
      spentMinutes === null || row.spentMinutes === null ? null : spentMinutes + row.spentMinutes;
    for (const field of numeric) {
      const value: SheetFieldValue | undefined = row.customFieldValues[field.id];
      if (typeof value === 'number') fieldSums[field.id] += value;
    }
  }
  return { count: rows.length, done, estimateMinutes, spentMinutes, fieldSums };
}

/**
 * Interface SheetGroups
 *
 * @description
 * The rows of the table under the view's grouping, and their groups.
 */
export interface SheetGroups {
  // #region Properties
  /**
   * Property rows
   *
   * @description
   * The rows in the sheet's order, each in its group; a task with several assignees has one row
   * per assignee while grouped by assignee.
   *
   * @type {readonly SheetRow[]}
   * @readonly
   */
  readonly rows: readonly SheetRow[];

  /**
   * Property order
   *
   * @description
   * The groups that hold rows: statuses in workflow order, priorities from urgent to low,
   * assignees with the most tasks first (first seen first between equals) and the unassigned
   * last; empty while the view does not group.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly order: readonly string[];

  /**
   * Property counts
   *
   * @description
   * Rows of each group.
   *
   * @type {Readonly<Partial<Record<string, number>>>}
   * @readonly
   */
  readonly counts: Readonly<Partial<Record<string, number>>>;
  // #endregion
}

/**
 * Function groupsOfRow
 *
 * @description
 * The groups a row shows in under a grouping.
 *
 * @param {SheetRow} row - The row.
 * @param {Exclude<ListGroupBy, null>} grouping - The grouping.
 * @returns {readonly string[]} The group values.
 */
function groupsOfRow(row: SheetRow, grouping: Exclude<ListGroupBy, null>): readonly string[] {
  switch (grouping) {
    case 'status':
      return [row.status];
    case 'priority':
      return [row.task.priority];
    case 'assignee':
      return row.task.assigneeIds.length === 0 ? [NO_ASSIGNEE] : row.task.assigneeIds;
  }
}

/**
 * Function groupSheetRows
 *
 * @description
 * Files the sorted rows into the view's groups (`Group by`), as the `List` view groups its rows;
 * without a grouping, the rows stay as they are.
 *
 * @param {readonly SheetRow[]} rows - The rows, in the sheet's order.
 * @param {ListGroupBy} grouping - The view's grouping.
 * @returns {SheetGroups} The grouped rows and their groups.
 */
export function groupSheetRows(rows: readonly SheetRow[], grouping: ListGroupBy): SheetGroups {
  if (grouping === null) return { rows, order: [], counts: {} };
  const grouped: SheetRow[] = [];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const group of groupsOfRow(row, grouping)) {
      grouped.push({ ...row, id: `${group}/${row.task.key}`, group });
      counts[group] = (counts[group] ?? 0) + 1;
    }
  }
  const present: readonly string[] = Object.keys(counts);
  let order: readonly string[];
  switch (grouping) {
    case 'status':
      order = STATUS_KEYS.filter((status: string) => status in counts);
      break;
    case 'priority':
      order = PRIORITY_KEYS.filter((priority: string) => priority in counts);
      break;
    case 'assignee':
      order = present
        .filter((group: string) => group !== NO_ASSIGNEE)
        .sort((first: string, second: string): number => counts[second] - counts[first])
        .concat(NO_ASSIGNEE in counts ? [NO_ASSIGNEE] : []);
      break;
  }
  return { rows: grouped, order, counts };
}

/**
 * Function collapsedGroupsOf
 *
 * @description
 * The folded groups of a grouping: the ones the user folded, else `Cancelled` under the status
 * grouping (collapsed by default, as in the `List` view and `App.dc.html`).
 *
 * @param {Readonly<Partial<Record<string, readonly string[]>>>} folded - Folded groups by grouping.
 * @param {ListGroupBy} grouping - The view's grouping.
 * @returns {readonly string[]} The folded group values.
 */
export function collapsedGroupsOf(
  folded: Readonly<Partial<Record<string, readonly string[]>>>,
  grouping: ListGroupBy,
): readonly string[] {
  return folded[grouping ?? 'all'] ?? (grouping === 'status' ? ['cancelled'] : []);
}
