import type { Provider } from '@angular/core';
import { provideCwDataTableTexts } from '@cadenway/ui/components/data-table';

/**
 * Constant LIST_TABLE_TEXTS
 *
 * @description
 * The English source texts of the data table of the « Liste » view, replacing the brick's French
 * defaults; their `fr` translations are those defaults.
 *
 * @type {Provider}
 */
export const LIST_TABLE_TEXTS: Provider = provideCwDataTableTexts(() => ({
  selectAll: $localize`:@@spaces.table.select-all:Select all on the page`,
  selectRow: (label: string): string =>
    $localize`:@@spaces.table.select-row:Select ${label}:label:`,
  selected: (count: number): string =>
    count === 1
      ? $localize`:@@spaces.table.selected-one:1 task selected`
      : $localize`:@@spaces.table.selected-many:${count}:count: tasks selected`,
  selectAllMatching: (total: number): string =>
    $localize`:@@spaces.table.select-matching:Select the ${total}:total: tasks`,
  allSelected: (total: number): string =>
    $localize`:@@spaces.table.all-selected:The ${total}:total: tasks are selected`,
  clearSelection: $localize`:@@spaces.bulk.clear:Cancel the selection`,
  sortState: (dir: 'asc' | 'desc', rank: number): string => {
    const order: string =
      dir === 'asc'
        ? $localize`:@@spaces.table.ascending:ascending`
        : $localize`:@@spaces.table.descending:descending`;
    return rank === 1
      ? $localize`:@@spaces.table.sort-primary:, primary sort ${order}:order:`
      : $localize`:@@spaces.table.sort-rank:, sort ${rank}:rank: ${order}:order:`;
  },
  sorted: (criteria: readonly { header: string; dir: 'asc' | 'desc' }[]): string => {
    const headers: string = criteria.map(({ header }: { header: string }) => header).join(', ');
    return criteria.length === 0
      ? $localize`:@@spaces.table.sort-removed:Sort removed`
      : $localize`:@@spaces.table.sorted:Sorted by ${headers}:criteria:`;
  },
  groupToggled: (label: string, collapsed: boolean): string =>
    collapsed
      ? $localize`:@@spaces.table.group-collapsed:Group ${label}:label: collapsed`
      : $localize`:@@spaces.table.group-expanded:Group ${label}:label: expanded`,
  groupAdd: (label: string): string =>
    $localize`:@@spaces.table.group-add:Add a task in ${label}:label:`,
  columnWidth: (header: string): string =>
    $localize`:@@spaces.table.column-width:Width of the ${header}:header: column`,
  columnResized: (header: string, width: number): string =>
    $localize`:@@spaces.table.column-resized:${header}:header: column: ${width}:width: pixels`,
  columnMoved: (header: string, position: number): string =>
    $localize`:@@spaces.table.column-moved:${header}:header: column in position ${position}:position:`,
  loading: $localize`:@@spaces.table.loading:Loading`,
  retry: $localize`:@@spaces.retry:Retry`,
  bulkBar: $localize`:@@spaces.bulk.label:Actions on the selection`,
  deselect: $localize`:@@spaces.table.deselect:Deselect`,
  pagination: $localize`:@@spaces.table.pagination:Pagination`,
  range: (first: number, last: number, total: number): string =>
    total === 0
      ? $localize`:@@spaces.table.range-none:0 tasks`
      : $localize`:@@spaces.table.range:${first}:first:–${last}:last: of ${total}:total: tasks`,
  emptyText: $localize`:@@spaces.rows.no-match:No task matches`,
}));
