import {
  groupLabels,
  layoutLabels,
  sheetColumnLabels,
  sortLabels,
} from '../../constants/view-labels/view-labels.constants';
import type {
  ActiveCustomField,
  ListViewConfig,
  ListViewPresentation,
} from '../../models/list-view-config/list-view-config.interface';
import type { ViewLayout } from '../../models/saved-view/saved-view.interface';
import { filterCount, hiddenColumnCount } from '../list-view-query/list-view-query.util';

/**
 * Function sortCriterion
 *
 * @description
 * The name of what orders the view: on the sheet, its own sort (the custom field's while the
 * list still has it, else the built-in column's, `TBL_COLS`), which decides the order shown;
 * otherwise, or without one, the task query's sort; null for the manual order.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Its configuration.
 * @param {readonly ActiveCustomField[] | null} customFields - The list's custom fields, or null while unknown.
 * @returns {string | null} The criterion's name.
 */
function sortCriterion(
  layout: ViewLayout,
  config: ListViewConfig,
  customFields: readonly ActiveCustomField[] | null,
): string | null {
  if (layout === 'table') {
    const presentation: ListViewPresentation = config.presentation;
    const field: ActiveCustomField | undefined = presentation.customFieldSort
      ? customFields?.find(
          (item: ActiveCustomField): boolean => item.id === presentation.customFieldSort?.fieldId,
        )
      : undefined;
    if (field) return field.name;
    if (presentation.sheetSort) return sheetColumnLabels()[presentation.sheetSort.column];
  }
  return config.sort.field === 'manual' ? null : sortLabels()[config.sort.field];
}

/**
 * Function viewSummary
 *
 * @description
 * Describes a view as the mockup does (`cfgSummary`, `App.dc.html` line 7426): `List · 2 filters ·
 * sort: due date · grouped by priority`, then `2 columns hidden` on the board or the sheet. On the
 * sheet, the sort is the sheet's own when it has one (`sort: time spent`). The manual order, the
 * grouping by status and no hidden column, the defaults, are left out; once the list's custom
 * fields are known, retired ones are left out too.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Its configuration.
 * @param {string} locale - Application locale, for the lower case.
 * @param {readonly ActiveCustomField[] | null} customFields - The list's custom fields, or null while unknown.
 * @returns {string} The summary.
 */
export function viewSummary(
  layout: ViewLayout,
  config: ListViewConfig,
  locale: string,
  customFields: readonly ActiveCustomField[] | null = null,
): string {
  const count: number = filterCount(config.filters);
  const parts: string[] = [
    layoutLabels()[layout],
    count === 0
      ? $localize`:@@spaces.summary.no-filter:no filter`
      : count === 1
        ? $localize`:@@spaces.summary.one-filter:1 filter`
        : $localize`:@@spaces.summary.filters:${count}:count: filters`,
  ];
  const sort: string | null = sortCriterion(layout, config, customFields);
  if (sort !== null) {
    const criterion: string = sort.toLocaleLowerCase(locale);
    parts.push($localize`:@@spaces.summary.sort:sort: ${criterion}:criterion:`);
  }
  if (config.groupBy !== 'status') {
    const group: string = groupLabels()[config.groupBy ?? 'none'].toLocaleLowerCase(locale);
    parts.push($localize`:@@spaces.summary.group:grouped by ${group}:group:`);
  }
  const hidden: number = hiddenColumnCount(
    layout,
    config.presentation,
    customFields?.map((field: ActiveCustomField): string => field.id) ?? null,
  );
  if (hidden > 0) {
    parts.push(
      hidden === 1
        ? $localize`:@@spaces.summary.one-hidden-column:1 column hidden`
        : $localize`:@@spaces.summary.hidden-columns:${hidden}:count: columns hidden`,
    );
  }
  return parts.join(' · ');
}
