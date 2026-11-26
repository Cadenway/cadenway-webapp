import { formatNumber } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  model,
  type ModelSignal,
  type Signal,
} from '@angular/core';
import { CwButton } from '@cadenway/ui/components/button';
import {
  type CwChartCategoryFormat,
  type CwChartDatum,
  type CwChartMarker,
  type CwChartSeries,
  CwChart,
  provideCwChartLabels,
} from '@cadenway/ui/components/chart';
import {
  CwDialog,
  CwDialogDescription,
  CwDialogHeader,
  CwDialogTitle,
} from '@cadenway/ui/components/dialog';
import {
  CwEmpty,
  CwEmptyContent,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStat, provideCwStatLabels } from '@cadenway/ui/components/stat';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { TaskDetailOpener } from '@features/task';

import type {
  SprintBurndownDay,
  SprintReport,
  SprintReportBreakdown,
  SprintReportTask,
} from '../../../models/sprint-report/sprint-report.interface';
import type { TaskList } from '../../../models/task-list/task-list.interface';
import {
  SprintReportStore,
  type SprintReportStoreInstance,
} from '../../../state/sprint-report/sprint-report.store';
import { formatDayMonth, isWithin } from '../../../utils/calendar-date/calendar-date.util';
import {
  averageVelocity,
  deliveredShare,
  isOnTrack,
  projectedEnd,
  scopeTaskCount,
  type SprintDay,
  sprintDayOf,
  type VelocityBar,
  velocityBars,
} from '../../../utils/sprint-report/sprint-report.util';

/**
 * Interface ReportFigure
 *
 * @description
 * One key figure of the report (`Points committed`, `42`, `18 tasks`).
 */
interface ReportFigure {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Stable key of the figure.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property label
   *
   * @description
   * Name of the figure.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property value
   *
   * @description
   * Formatted value, or a dash when unknown.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property hint
   *
   * @description
   * Line under the value, or empty.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;
  // #endregion
}

/**
 * Interface ReportTaskGroup
 *
 * @description
 * `Delivered` or `To carry over`: the count, the first tasks and the tasks left out.
 */
interface ReportTaskGroup {
  // #region Properties
  /**
   * Property count
   *
   * @description
   * Tasks of the group, or a dash when unknown.
   *
   * @type {string}
   * @readonly
   */
  readonly count: string;

  /**
   * Property tasks
   *
   * @description
   * The first six tasks.
   *
   * @type {readonly SprintReportTask[]}
   * @readonly
   */
  readonly tasks: readonly SprintReportTask[];

  /**
   * Property more
   *
   * @description
   * `+ n others`, or empty when every task shows.
   *
   * @type {string}
   * @readonly
   */
  readonly more: string;
  // #endregion
}

/**
 * Interface ReportView
 *
 * @description
 * What the dialog shows of a read report.
 */
interface ReportView {
  // #region Properties
  /**
   * Property empty
   *
   * @description
   * Whether the sprint holds no task: the empty state replaces the report.
   *
   * @type {boolean}
   * @readonly
   */
  readonly empty: boolean;

  /**
   * Property figures
   *
   * @description
   * The four key figures.
   *
   * @type {readonly ReportFigure[]}
   * @readonly
   */
  readonly figures: readonly ReportFigure[];

  /**
   * Property burndown
   *
   * @description
   * One entry per day: `day` (`Nov 8`), `actual`, `ideal` and `projected`.
   *
   * @type {readonly CwChartDatum[]}
   * @readonly
   */
  readonly burndown: readonly CwChartDatum[];

  /**
   * Property markers
   *
   * @description
   * The today marker, while the caller's day is a day of the sprint.
   *
   * @type {readonly CwChartMarker[]}
   * @readonly
   */
  readonly markers: readonly CwChartMarker[];

  /**
   * Property velocity
   *
   * @description
   * One entry per sprint: `sprint` (`S13`), `committed` and `delivered`.
   *
   * @type {readonly CwChartDatum[]}
   * @readonly
   */
  readonly velocity: readonly CwChartDatum[];

  /**
   * Property velocityLabel
   *
   * @description
   * Summary of the velocity chart for screen readers, one sentence per sprint.
   *
   * @type {string}
   * @readonly
   */
  readonly velocityLabel: string;

  /**
   * Property velocityNames
   *
   * @description
   * Full sprint name of each velocity category, for the tooltip.
   *
   * @type {ReadonlyMap<string, string>}
   * @readonly
   */
  readonly velocityNames: ReadonlyMap<string, string>;

  /**
   * Property velocityNote
   *
   * @description
   * `Average velocity: n points per sprint · gray bar: points committed`, the average left out
   * without history.
   *
   * @type {string}
   * @readonly
   */
  readonly velocityNote: string;

  /**
   * Property delivered
   *
   * @description
   * `Delivered`.
   *
   * @type {ReportTaskGroup}
   * @readonly
   */
  readonly delivered: ReportTaskGroup;

  /**
   * Property remaining
   *
   * @description
   * `To carry over`.
   *
   * @type {ReportTaskGroup}
   * @readonly
   */
  readonly remaining: ReportTaskGroup;
  // #endregion
}

/**
 * Constant UNKNOWN
 *
 * @description
 * What a figure shows when the gateway cannot establish it.
 *
 * @type {string}
 */
const UNKNOWN: string = '—';

/**
 * Constant SKELETON_FIGURES
 *
 * @description
 * Keys of the figures drawn while the report is read.
 *
 * @type {readonly string[]}
 */
const SKELETON_FIGURES: readonly string[] = ['committed', 'delivered', 'remaining', 'projected'];

/**
 * Component SprintReportDialog
 *
 * @description
 * `Sprint report` (`App.dc.html` lines 2729-2776, logic lines 5512-5561), hosted by the list
 * page, which opens it from the `Sprint report` button of a sprint's goal line (`App.dc.html`
 * line 309). Inputs: `open` (two-way; the dialog sets it to false when it closes) and `list`,
 * always a sprint. Each opening reads `getSprintReport` again through its component-scoped
 * `SprintReportStore`, observed on the caller's date and time zone: skeletons while it reads, an
 * inline error with `Retry`, an empty state for a sprint without tasks. The title (`Sprint 14
 * report`) and the subtitle (`Nov 3 – Nov 17 · day 6 of 15`) come from the list until the report
 * answers. The report shows four figures (`Points committed` with the tasks of the scope,
 * `Points delivered` with their share, `Points remaining` with the open tasks, `Projected end`),
 * the burndown (`Actual`, dashed `Ideal` and `Projection`, a today marker), the velocity of up to
 * four earlier sprints and the current one (gray: committed, jade: delivered) with the average of
 * the earlier ones, and the first six tasks `Delivered` and `To carry over` with `+ n others`; a
 * task closes the dialog and opens its detail (`TaskDetailOpener`). The window fills the screen
 * under 768 px (`cw-dialog`); Escape, the close button and the backdrop close it.
 */
@Component({
  selector: 'cw-sprint-report-dialog',
  imports: [
    CwButton,
    CwChart,
    CwDialog,
    CwDialogDescription,
    CwDialogHeader,
    CwDialogTitle,
    CwEmpty,
    CwEmptyContent,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwSkeleton,
    CwStat,
    CwStatusIcon,
    NgIcon,
  ],
  providers: [
    SprintReportStore,
    provideCwChartLabels(() => ({
      emptyText: $localize`:@@spaces.sprint-report.chart-empty:No data for this sprint`,
      categoryHeader: $localize`:@@spaces.sprint-report.chart-day:Day`,
      capacityLabel: $localize`:@@spaces.sprint-report.chart-capacity:Capacity`,
      othersLabel: $localize`:@@spaces.sprint-report.chart-others:Others`,
      marker: (label: string, category: string): string =>
        $localize`:@@spaces.sprint-report.chart-marker:${label}:label:: ${category}:category:`,
    })),
    provideCwStatLabels(() => ({
      up: $localize`:@@spaces.sprint-report.stat-up:up`,
      down: $localize`:@@spaces.sprint-report.stat-down:down`,
      flat: $localize`:@@spaces.sprint-report.stat-flat:flat`,
      refreshing: $localize`:@@spaces.sprint-report.stat-refreshing:Refreshing`,
      goalOf: $localize`:@@spaces.sprint-report.stat-goal-of:of`,
    })),
  ],
  templateUrl: './sprint-report-dialog.component.html',
})
export class SprintReportDialog {
  // #region Properties
  /**
   * Property open
   *
   * @description
   * Whether the dialog shows; `[(open)]`.
   *
   * @type {ModelSignal<boolean>}
   * @readonly
   */
  public readonly open: ModelSignal<boolean> = model(false);

  /**
   * Property list
   *
   * @description
   * The list the dialog is about, or null while it is read.
   *
   * @type {InputSignal<TaskList | null>}
   * @readonly
   */
  public readonly list: InputSignal<TaskList | null> = input<TaskList | null>(null);

  /**
   * Property store
   *
   * @description
   * The report of the open sprint.
   *
   * @type {SprintReportStoreInstance}
   * @readonly
   */
  protected readonly store: SprintReportStoreInstance = inject(SprintReportStore);

  /**
   * Property taskDetail
   *
   * @description
   * Opens a task's detail over the list.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property locale
   *
   * @description
   * Application locale, for dates and points.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property skeletonFigures
   *
   * @description
   * Keys of the figures drawn while the report is read.
   *
   * @type {readonly string[]}
   * @readonly
   */
  protected readonly skeletonFigures: readonly string[] = SKELETON_FIGURES;

  /**
   * Property retryLabel
   *
   * @description
   * `Retry` of the failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = $localize`:@@spaces.retry:Retry`;

  /**
   * Property burndownLabel
   *
   * @description
   * Accessible name of the burndown chart (`Points restants par jour`, `App.dc.html` line 2743).
   *
   * @type {string}
   * @readonly
   */
  protected readonly burndownLabel: string = $localize`:@@spaces.sprint-report.burndown-label:Points remaining per day`;

  /**
   * Property burndownSeries
   *
   * @description
   * `Actual`, then the dashed `Ideal` and `Projection`, colored as the mockup's lines.
   *
   * @type {readonly CwChartSeries[]}
   * @readonly
   */
  protected readonly burndownSeries: readonly CwChartSeries[] = [
    {
      key: 'actual',
      label: $localize`:@@spaces.sprint-report.actual:Actual`,
      color: 'chart-1',
    },
    {
      key: 'ideal',
      label: $localize`:@@spaces.sprint-report.ideal:Ideal`,
      color: 'chart-5',
      dashed: true,
    },
    {
      key: 'projected',
      label: $localize`:@@spaces.sprint-report.projection:Projection`,
      color: 'chart-1',
      dashed: true,
    },
  ];

  /**
   * Property velocitySeries
   *
   * @description
   * The gray committed bar, then the jade delivered bar.
   *
   * @type {readonly CwChartSeries[]}
   * @readonly
   */
  protected readonly velocitySeries: readonly CwChartSeries[] = [
    {
      key: 'committed',
      label: $localize`:@@spaces.sprint-report.committed:Points committed`,
      color: 'chart-5',
    },
    {
      key: 'delivered',
      label: $localize`:@@spaces.sprint-report.delivered:Points delivered`,
      color: 'chart-2',
    },
  ];

  /**
   * Property sprintHeader
   *
   * @description
   * Header of the velocity chart's category column, read by screen readers.
   *
   * @type {string}
   * @readonly
   */
  protected readonly sprintHeader: string = $localize`:@@spaces.sprint-report.chart-sprint:Sprint`;

  /**
   * Property openListId
   *
   * @description
   * The sprint while the dialog is open, null while it is closed; each opening reads again.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  private readonly openListId: Signal<string | null> = computed((): string | null =>
    this.open() ? (this.list()?.id ?? null) : null,
  );

  /**
   * Property report
   *
   * @description
   * The read report, or null while it is read or failed.
   *
   * @type {Signal<SprintReport | null>}
   * @readonly
   */
  private readonly report: Signal<SprintReport | null> = computed(
    (): SprintReport | null =>
      (this.store.report.hasValue() ? this.store.report.value() : null) ?? null,
  );

  /**
   * Property today
   *
   * @description
   * The caller's date the report was asked for, or null before the first opening.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  private readonly today: Signal<string | null> = computed(
    (): string | null => this.store.request()?.today ?? null,
  );

  /**
   * Property title
   *
   * @description
   * `Sprint 14 report` (`Rapport du <sprint>`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly title: Signal<string> = computed((): string => {
    const name: string = this.report()?.name ?? this.list()?.name ?? '';
    return $localize`:@@spaces.sprint-report.title:${name}:name: report`;
  });

  /**
   * Property subtitle
   *
   * @description
   * `Nov 3 – Nov 17 · day 6 of 15`, or empty without sprint dates.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly subtitle: Signal<string> = computed((): string => {
    const report: SprintReport | null = this.report();
    const sprint: { readonly startDate: string; readonly endDate: string } | null =
      report ?? this.list()?.sprint ?? null;
    const today: string | null = this.today();
    if (sprint === null || today === null) return '';
    const place: SprintDay = sprintDayOf(today, sprint.startDate, sprint.endDate);
    const start: string = formatDayMonth(sprint.startDate, this.locale);
    const end: string = formatDayMonth(sprint.endDate, this.locale);
    const day: number = place.day;
    const days: number = place.days;
    return $localize`:@@spaces.sprint-report.subtitle:${start}:start: – ${end}:end: · day ${day}:day: of ${days}:days:`;
  });

  /**
   * Property failed
   *
   * @description
   * Whether the read failed: the inline error with `Retry` shows.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly failed: Signal<boolean> = computed(
    (): boolean => this.store.report.status() === 'error',
  );

  /**
   * Property view
   *
   * @description
   * What the dialog shows of the read report, or null while it is read or failed.
   *
   * @type {Signal<ReportView | null>}
   * @readonly
   */
  protected readonly view: Signal<ReportView | null> = computed((): ReportView | null => {
    const report: SprintReport | null = this.report();
    const today: string | null = this.today();
    if (report === null || today === null) return null;
    const bars: readonly VelocityBar[] = velocityBars(report);
    return {
      empty: scopeTaskCount(report) === 0 && !report.committed,
      figures: this.figures(report, today),
      burndown: report.days.map((day: SprintBurndownDay): CwChartDatum => ({
        day: formatDayMonth(day.date, this.locale),
        actual: day.actual,
        ideal: day.ideal,
        projected: day.projected,
      })),
      markers: isWithin(today, report.startDate, report.endDate)
        ? [
            {
              x: formatDayMonth(today, this.locale),
              label: $localize`:@@spaces.sprint-report.today:Today`,
            },
          ]
        : [],
      velocity: bars.map((bar: VelocityBar): CwChartDatum => ({
        sprint: bar.key,
        committed: bar.committed,
        delivered: bar.delivered,
      })),
      velocityLabel: bars.map((bar: VelocityBar): string => this.barLabel(bar)).join('; '),
      velocityNames: new Map<string, string>(
        bars.map((bar: VelocityBar): [string, string] => [bar.key, bar.name]),
      ),
      velocityNote: this.velocityNote(averageVelocity(report.velocity)),
      delivered: this.group(report.delivered),
      remaining: this.group(report.remaining),
    };
  });

  /**
   * Property velocityCategory
   *
   * @description
   * The full sprint name of a velocity category, in the tooltip (`S13` → `Sprint 13`).
   *
   * @type {CwChartCategoryFormat}
   * @readonly
   */
  protected readonly velocityCategory: CwChartCategoryFormat = (category: string): string =>
    this.view()?.velocityNames.get(category) ?? category;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the report of the sprint at each opening.
   *
   * @constructor
   */
  public constructor() {
    this.store.follow(this.openListId);
  }
  // #endregion

  // #region Methods
  /**
   * Method openTask
   *
   * @description
   * Closes the report and opens a task's detail over the list (`App.dc.html` line 5553).
   *
   * @param {SprintReportTask} task - The task of the report.
   */
  protected openTask(task: SprintReportTask): void {
    this.open.set(false);
    void this.taskDetail.open(task.key, {
      key: task.key,
      name: task.name,
      status: task.status,
      milestone: false,
    });
  }

  /**
   * Method points
   *
   * @description
   * A task's points (`3 pts`, `1 pt`).
   *
   * @param {number} value - Points before rounding.
   * @returns {string} The points.
   */
  protected points(value: number): string {
    const count: string = this.formatPoints(value);
    return value === 1
      ? $localize`:@@spaces.sprint-report.points-one:${count}:count: pt`
      : $localize`:@@spaces.sprint-report.points:${count}:count: pts`;
  }

  /**
   * Method formatPoints
   *
   * @description
   * Points in the application locale, with one decimal at most.
   *
   * @param {number} value - Points before rounding.
   * @returns {string} The formatted points.
   */
  private formatPoints(value: number): string {
    return formatNumber(value, this.locale, '1.0-1');
  }

  /**
   * Method figures
   *
   * @description
   * `Points committed`, `Points delivered`, `Points remaining` and `Projected end` (`App.dc.html`
   * lines 5538-5543); a figure the gateway cannot establish shows a dash.
   *
   * @param {SprintReport} report - The report.
   * @param {string} today - The caller's date.
   * @returns {readonly ReportFigure[]} The figures.
   */
  private figures(report: SprintReport, today: string): readonly ReportFigure[] {
    const scope: number | null = scopeTaskCount(report);
    const share: number | null = deliveredShare(report);
    const left: number | null = projectedEnd(report, today);
    const remaining: number | null = report.remaining?.taskCount ?? null;
    return [
      {
        key: 'committed',
        label: this.velocitySeries[0].label,
        value: report.committed === null ? UNKNOWN : this.formatPoints(report.committed),
        hint: scope === null ? '' : this.taskCount(scope),
      },
      {
        key: 'delivered',
        label: this.velocitySeries[1].label,
        value: report.delivered === null ? UNKNOWN : this.formatPoints(report.delivered.points),
        hint:
          share === null
            ? ''
            : $localize`:@@spaces.sprint-report.delivered-share:${share}:share: % of the sprint`,
      },
      {
        key: 'remaining',
        label: $localize`:@@spaces.sprint-report.remaining:Points remaining`,
        value: report.remaining === null ? UNKNOWN : this.formatPoints(report.remaining.points),
        hint: remaining === null ? '' : this.openTaskCount(remaining),
      },
      {
        key: 'projected',
        label: $localize`:@@spaces.sprint-report.projected:Projected end`,
        ...this.projection(left, report.endDate),
      },
    ];
  }

  /**
   * Method projection
   *
   * @description
   * `On track` at the current pace, `≈ n pts` left on the last day, or a dash until a pace is
   * known.
   *
   * @param {number | null} left - Points left at the end, or null.
   * @param {string} end - Last day of the sprint.
   * @returns {Pick<ReportFigure, 'value' | 'hint'>} The value and its hint.
   */
  private projection(left: number | null, end: string): Pick<ReportFigure, 'value' | 'hint'> {
    if (left === null) {
      return {
        value: UNKNOWN,
        hint: $localize`:@@spaces.sprint-report.projected-unknown:Not enough history yet`,
      };
    }
    if (isOnTrack(left)) {
      return {
        value: $localize`:@@spaces.sprint-report.on-track:On track`,
        hint: $localize`:@@spaces.sprint-report.on-track-hint:at the current pace`,
      };
    }
    const points: string = String(Math.round(left));
    const date: string = formatDayMonth(end, this.locale);
    return {
      value: $localize`:@@spaces.sprint-report.projected-left:≈ ${points}:points: pts`,
      hint: $localize`:@@spaces.sprint-report.projected-left-hint:would remain on ${date}:date:`,
    };
  }

  /**
   * Method taskCount
   *
   * @description
   * `18 tasks`, `1 task`.
   *
   * @param {number} count - Tasks.
   * @returns {string} The count.
   */
  private taskCount(count: number): string {
    return count === 1
      ? $localize`:@@spaces.sprint-report.tasks-one:${count}:count: task`
      : $localize`:@@spaces.sprint-report.tasks:${count}:count: tasks`;
  }

  /**
   * Method openTaskCount
   *
   * @description
   * `9 open tasks`, `1 open task`.
   *
   * @param {number} count - Open tasks.
   * @returns {string} The count.
   */
  private openTaskCount(count: number): string {
    return count === 1
      ? $localize`:@@spaces.sprint-report.open-tasks-one:${count}:count: open task`
      : $localize`:@@spaces.sprint-report.open-tasks:${count}:count: open tasks`;
  }

  /**
   * Method barLabel
   *
   * @description
   * A velocity bar for screen readers (`Sprint 13: 194 points delivered out of 210`, with
   * `(in progress)` for the current sprint).
   *
   * @param {VelocityBar} bar - The sprint.
   * @returns {string} The sentence.
   */
  private barLabel(bar: VelocityBar): string {
    const name: string = bar.name;
    const delivered: string = bar.delivered === null ? UNKNOWN : this.formatPoints(bar.delivered);
    const committed: string = bar.committed === null ? UNKNOWN : this.formatPoints(bar.committed);
    return bar.current
      ? $localize`:@@spaces.sprint-report.velocity-bar-current:${name}:name:: ${delivered}:delivered: points delivered out of ${committed}:committed: (in progress)`
      : $localize`:@@spaces.sprint-report.velocity-bar:${name}:name:: ${delivered}:delivered: points delivered out of ${committed}:committed:`;
  }

  /**
   * Method velocityNote
   *
   * @description
   * The note under the velocity chart; the average is left out without history.
   *
   * @param {number | null} average - Average points delivered by the earlier sprints.
   * @returns {string} The note.
   */
  private velocityNote(average: number | null): string {
    const legend: string = $localize`:@@spaces.sprint-report.velocity-legend:gray bar: points committed`;
    if (average === null) return legend;
    const points: string = this.formatPoints(average);
    return `${$localize`:@@spaces.sprint-report.velocity-average:Average velocity: ${points}:points: points per sprint`} · ${legend}`;
  }

  /**
   * Method group
   *
   * @description
   * `Delivered` or `To carry over`: its count, its first tasks and `+ n others`.
   *
   * @param {SprintReportBreakdown | null} part - The part, or null when unknown.
   * @returns {ReportTaskGroup} The group.
   */
  private group(part: SprintReportBreakdown | null): ReportTaskGroup {
    if (part === null) return { count: UNKNOWN, tasks: [], more: '' };
    const others: number = part.taskCount - part.tasks.length;
    return {
      count: String(part.taskCount),
      tasks: part.tasks,
      more: others > 0 ? $localize`:@@spaces.sprint-report.more:+ ${others}:count: others` : '',
    };
  }
  // #endregion
}
