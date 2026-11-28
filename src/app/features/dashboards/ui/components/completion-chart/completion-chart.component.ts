import {
  booleanAttribute,
  Component,
  computed,
  input,
  type InputSignal,
  type InputSignalWithTransform,
  model,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  CwChart,
  type CwChartCategoryFormat,
  type CwChartDatum,
  type CwChartSeries,
} from '@cadenway/ui/components/chart';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { NgIcon } from '@ng-icons/core';

import type { DashboardCompletionWeek } from '../../../models/team-dashboard/team-dashboard.interface';

/**
 * Type CompletionView
 *
 * @description
 * How the completions show: as bars or as a table of the same values.
 *
 * @type {'chart' | 'table'}
 */
export type CompletionView = 'chart' | 'table';

/**
 * Interface CompletionBar
 *
 * @description
 * One week as the chart and the table show it.
 */
interface CompletionBar {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * The week's label (`W45`).
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property completed
   *
   * @description
   * Tasks completed that week.
   *
   * @type {number}
   * @readonly
   */
  readonly completed: number;
  // #endregion
}

/**
 * Component CompletionChart
 *
 * @description
 * The `Tasks completed per week` card of the dashboard (`App.dc.html` lines 1812-1849): a bar per
 * week (`cw-chart`, `size="lg"`, `chart-1`), labelled `W45` after the ISO week, and a ghost button
 * that swaps it for a table of the same values (`Show the table`, `Show the chart`). The current
 * week, the last one, is the chart's `current` category: its bar is lighter and reads
 * `W45 (current week)` in the tooltip and the announcement. `valueLabels="peak"` writes the
 * highest weeks' and the current week's values over their bars (lines 1819-1828). The chart's
 * summary lists every value. `busy` marks the card while another period loads. Presentational:
 * inputs and the `view` model.
 */
@Component({
  selector: 'cw-completion-chart',
  imports: [
    CwButton,
    CwChart,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
    NgIcon,
  ],
  host: { class: 'flex min-w-0 flex-col' },
  templateUrl: './completion-chart.component.html',
})
export class CompletionChart {
  // #region Properties
  /**
   * Property weeks
   *
   * @description
   * The weeks in chronological order, the last one being the current week.
   *
   * @type {InputSignal<readonly DashboardCompletionWeek[]>}
   * @readonly
   */
  public readonly weeks: InputSignal<readonly DashboardCompletionWeek[]> =
    input.required<readonly DashboardCompletionWeek[]>();

  /**
   * Property busy
   *
   * @description
   * Whether the weeks shown are the previous period's while another loads (`aria-busy`).
   *
   * @type {InputSignalWithTransform<boolean, unknown>}
   * @readonly
   */
  public readonly busy: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  });

  /**
   * Property view
   *
   * @description
   * Bars or table; the bars by default. The toggle button changes it.
   *
   * @type {ModelSignal<CompletionView>}
   * @readonly
   */
  public readonly view: ModelSignal<CompletionView> = model<CompletionView>('chart');

  /**
   * Property weekHeader
   *
   * @description
   * Header of the week column, in the table and the chart's hidden table.
   *
   * @type {string}
   * @readonly
   */
  protected readonly weekHeader: string = $localize`:@@dashboards.chart.week:Week`;

  /**
   * Property series
   *
   * @description
   * The one series drawn: the completions, in the first data color.
   *
   * @type {readonly CwChartSeries[]}
   * @readonly
   */
  protected readonly series: readonly CwChartSeries[] = [
    {
      key: 'completed',
      label: $localize`:@@dashboards.chart.series:Completed`,
      color: 'chart-1',
    },
  ];

  /**
   * Property bars
   *
   * @description
   * The weeks with their labels.
   *
   * @type {Signal<readonly CompletionBar[]>}
   * @readonly
   */
  protected readonly bars: Signal<readonly CompletionBar[]> = computed(
    (): readonly CompletionBar[] =>
      this.weeks().map((week: DashboardCompletionWeek): CompletionBar => ({
        label: $localize`:@@dashboards.chart.week-label:W${week.week}:week:`,
        completed: week.completed,
      })),
  );

  /**
   * Property data
   *
   * @description
   * The chart's entries, one per week under the `week` key.
   *
   * @type {Signal<readonly CwChartDatum[]>}
   * @readonly
   */
  protected readonly data: Signal<readonly CwChartDatum[]> = computed((): readonly CwChartDatum[] =>
    this.bars().map((bar: CompletionBar): CwChartDatum => ({
      week: bar.label,
      completed: bar.completed,
    })),
  );

  /**
   * Property ariaLabel
   *
   * @description
   * The chart's summary: `Tasks completed per week, last 8 weeks: 6, 8, …`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly ariaLabel: Signal<string> = computed((): string => {
    const count: number = this.bars().length;
    const values: string = this.bars()
      .map((bar: CompletionBar): string => String(bar.completed))
      .join(', ');
    return $localize`:@@dashboards.chart.label:Tasks completed per week, last ${count}:count: weeks: ${values}:values:`;
  });

  /**
   * Property currentWeek
   *
   * @description
   * The label of the last week, the one in progress, which the chart draws lighter; null without
   * any week.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  protected readonly currentWeek: Signal<string | null> = computed(
    (): string | null => this.bars().at(-1)?.label ?? null,
  );

  /**
   * Property categoryFormat
   *
   * @description
   * Names the last week `W45 (current week)` in the tooltip and the announcement.
   *
   * @type {Signal<CwChartCategoryFormat>}
   * @readonly
   */
  protected readonly categoryFormat: Signal<CwChartCategoryFormat> = computed(
    (): CwChartCategoryFormat => {
      const current: string | null = this.currentWeek();
      return (week: string): string =>
        week === current
          ? $localize`:@@dashboards.chart.current-week:${week}:week: (current week)`
          : week;
    },
  );

  /**
   * Property toggleLabel
   *
   * @description
   * The toggle button's text: what it shows next.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly toggleLabel: Signal<string> = computed((): string =>
    this.view() === 'chart'
      ? $localize`:@@dashboards.chart.show-table:Show the table`
      : $localize`:@@dashboards.chart.show-chart:Show the chart`,
  );
  // #endregion

  // #region Methods
  /**
   * Method toggle
   *
   * @description
   * Swaps the bars and the table.
   */
  protected toggle(): void {
    this.view.set(this.view() === 'chart' ? 'table' : 'chart');
  }
  // #endregion
}
