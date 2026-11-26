import {
  groupLabels,
  layoutLabels,
  sortLabels,
} from '../../constants/view-labels/view-labels.constants';
import type { ListViewConfig } from '../../models/list-view-config/list-view-config.interface';
import type { ViewLayout } from '../../models/saved-view/saved-view.interface';
import { filterCount, hiddenColumnCount } from '../list-view-query/list-view-query.util';

/**
 * Function viewSummary
 *
 * @description
 * Describes a view as the mockup does (`cfgSummary`, `App.dc.html` line 7426): `List · 2 filters ·
 * sort: due date · grouped by priority`, then `2 columns hidden` on the board or the sheet. The
 * manual order, the grouping by status and no hidden column, the defaults, are left out.
 *
 * @param {ViewLayout} layout - Layout of the view.
 * @param {ListViewConfig} config - Its configuration.
 * @param {string} locale - Application locale, for the lower case.
 * @returns {string} The summary.
 */
export function viewSummary(layout: ViewLayout, config: ListViewConfig, locale: string): string {
  const count: number = filterCount(config.filters);
  const parts: string[] = [
    layoutLabels()[layout],
    count === 0
      ? $localize`:@@spaces.summary.no-filter:no filter`
      : count === 1
        ? $localize`:@@spaces.summary.one-filter:1 filter`
        : $localize`:@@spaces.summary.filters:${count}:count: filters`,
  ];
  if (config.sort.field !== 'manual') {
    const criterion: string = sortLabels()[config.sort.field].toLocaleLowerCase(locale);
    parts.push($localize`:@@spaces.summary.sort:sort: ${criterion}:criterion:`);
  }
  if (config.groupBy !== 'status') {
    const group: string = groupLabels()[config.groupBy ?? 'none'].toLocaleLowerCase(locale);
    parts.push($localize`:@@spaces.summary.group:grouped by ${group}:group:`);
  }
  const hidden: number = hiddenColumnCount(layout, config.presentation);
  if (hidden > 0) {
    parts.push(
      hidden === 1
        ? $localize`:@@spaces.summary.one-hidden-column:1 column hidden`
        : $localize`:@@spaces.summary.hidden-columns:${hidden}:count: columns hidden`,
    );
  }
  return parts.join(' · ');
}
