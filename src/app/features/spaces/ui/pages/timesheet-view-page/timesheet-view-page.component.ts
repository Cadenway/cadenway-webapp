import { Component, computed, inject, LOCALE_ID, type Signal } from '@angular/core';
import { CwAvatar } from '@cadenway/ui/components/avatar';
import { CwBadge } from '@cadenway/ui/components/badge';
import { CwButton } from '@cadenway/ui/components/button';
import {
  type CwChartColor,
  type CwChartDatum,
  type CwChartSeries,
  CwChart,
  provideCwChartLabels,
} from '@cadenway/ui/components/chart';
import {
  CwEmpty,
  CwEmptyDescription,
  CwEmptyHeader,
  CwEmptyMedia,
  CwEmptyTitle,
} from '@cadenway/ui/components/empty';
import { CwMeter, provideCwMeterLabels } from '@cadenway/ui/components/meter';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStat, provideCwStatLabels } from '@cadenway/ui/components/stat';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import {
  CwTable,
  CwTableBody,
  CwTableCell,
  CwTableContainer,
  CwTableFooter,
  CwTableHead,
  CwTableHeader,
  CwTableRow,
} from '@cadenway/ui/components/table';
import { formatDuration } from '@cadenway/ui/components/time-tracker';
import { NgIcon } from '@ng-icons/core';

import { TaskDetailOpener } from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import type { ListMember } from '../../../models/list-member/list-member.interface';
import type { StatusKey } from '../../../models/list-view-config/list-view-config.interface';
import type {
  ListTimesheet,
  TimesheetEntry,
  TimesheetFigures,
  TimesheetPerson,
} from '../../../models/timesheet/timesheet.interface';
import {
  ListPageStore,
  type ListPageStoreInstance,
} from '../../../state/list-page/list-page.store';
import {
  ListViewStore,
  type ListViewStoreInstance,
} from '../../../state/list-view/list-view.store';
import {
  TimesheetViewStore,
  type TimesheetViewStoreInstance,
} from '../../../state/timesheet-view/timesheet-view.store';
import { formatDayMonth, toLocalDate } from '../../../utils/calendar-date/calendar-date.util';

/**
 * Constant CHART_COLORS
 *
 * @description
 * The data colors of the people, largest share first; past five people the chart sums the last
 * ones into `Others`, in `chart-5`.
 *
 * @type {readonly CwChartColor[]}
 */
const CHART_COLORS: readonly CwChartColor[] = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
];

/**
 * Constant DOT_CLASSES
 *
 * @description
 * The dot of each data color in `Breakdown by person`, as literal classes.
 *
 * @type {Readonly<Record<CwChartColor, string>>}
 */
const DOT_CLASSES: Readonly<Record<CwChartColor, string>> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
};

/**
 * Constant MAX_SERIES
 *
 * @description
 * People drawn apart in `Time per day`: the chart's five data colors.
 *
 * @type {number}
 */
const MAX_SERIES: number = 5;

/**
 * Constant BOUNDED_ROWS
 *
 * @description
 * Body rows (people and tasks) past which the table scrolls inside a bounded frame
 * (`max-h-[36rem]`, about fifteen rows) with its header and `Total` footer kept in view. The
 * table is not virtualized: measured in Chromium with the built styles, 1,000 rows lay out and
 * paint in about 100 ms and scroll at 60 frames per second, 2,000 in about 200 ms, and a week
 * holds one row per person and task with time.
 *
 * @type {number}
 */
export const BOUNDED_ROWS: number = 15;

/**
 * Constant WEEKEND
 *
 * @description
 * Index of Saturday in a week starting on Monday.
 *
 * @type {number}
 */
const WEEKEND: number = 5;

/**
 * Interface TimesheetSkeletonRow
 *
 * @description
 * A placeholder row of the skeleton.
 */
interface TimesheetSkeletonRow {
  // #region Properties
  /**
   * Property index
   *
   * @description
   * Rank of the row.
   *
   * @type {number}
   * @readonly
   */
  readonly index: number;

  /**
   * Property lead
   *
   * @description
   * Whether the row stands for a person (with an avatar placeholder).
   *
   * @type {boolean}
   * @readonly
   */
  readonly lead: boolean;

  /**
   * Property width
   *
   * @description
   * Literal width class of the name placeholder.
   *
   * @type {string}
   * @readonly
   */
  readonly width: string;

  /**
   * Property cells
   *
   * @description
   * Whether each day shows a placeholder.
   *
   * @type {readonly boolean[]}
   * @readonly
   */
  readonly cells: readonly boolean[];
  // #endregion
}

/**
 * Constant SKELETON_WIDTHS
 *
 * @description
 * The name widths of the skeleton rows, in the mockup's order (`skw` of `App.dc.html` line 4149).
 *
 * @type {readonly string[]}
 */
const SKELETON_WIDTHS: readonly string[] = [
  'w-2/5',
  'w-2/3',
  'w-3/5',
  'w-1/3',
  'w-4/5',
  'w-3/4',
  'w-7/12',
  'w-1/2',
];

/**
 * Constant SKELETON_ROWS
 *
 * @description
 * The eight placeholder rows of the skeleton (`skTsRows` of `App.dc.html` line 4180): every
 * third one a person, working days filled two times out of three.
 *
 * @type {readonly TimesheetSkeletonRow[]}
 */
const SKELETON_ROWS: readonly TimesheetSkeletonRow[] = SKELETON_WIDTHS.map(
  (width: string, index: number): TimesheetSkeletonRow => ({
    index,
    lead: index % 3 === 0,
    width,
    cells: Array.from(
      { length: 7 },
      (_: unknown, day: number): boolean => day < 5 && (index + day) % 3 !== 0,
    ),
  }),
);

/**
 * Interface TimesheetCell
 *
 * @description
 * One day of a row of the table: its duration (`·` without time) and its tint.
 */
interface TimesheetCell {
  // #region Properties
  /**
   * Property date
   *
   * @description
   * The day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly date: string;

  /**
   * Property text
   *
   * @description
   * The duration, or `·`.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property classes
   *
   * @description
   * The heat tint (`App.dc.html` line 7825), the weekend shade and today's ring.
   *
   * @type {string}
   * @readonly
   */
  readonly classes: string;
  // #endregion
}

/**
 * Interface TimesheetDayColumn
 *
 * @description
 * A day column of the table (`Mon 23`).
 */
interface TimesheetDayColumn {
  // #region Properties
  /**
   * Property date
   *
   * @description
   * The day, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly date: string;

  /**
   * Property label
   *
   * @description
   * Short weekday and day of the month in the locale.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property classes
   *
   * @description
   * The weekend shade and today's color.
   *
   * @type {string}
   * @readonly
   */
  readonly classes: string;
  // #endregion
}

/**
 * Interface TimesheetTaskRow
 *
 * @description
 * A task row under a person.
 */
interface TimesheetTaskRow {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property openLabel
   *
   * @description
   * Accessible name of the row's button (`Open CAD-482 · SSO screen`).
   *
   * @type {string}
   * @readonly
   */
  readonly openLabel: string;

  /**
   * Property cells
   *
   * @description
   * The seven days.
   *
   * @type {readonly TimesheetCell[]}
   * @readonly
   */
  readonly cells: readonly TimesheetCell[];

  /**
   * Property total
   *
   * @description
   * The week's duration.
   *
   * @type {string}
   * @readonly
   */
  readonly total: string;
  // #endregion
}

/**
 * Interface TimesheetPersonRow
 *
 * @description
 * A person of the table with their tasks.
 */
interface TimesheetPersonRow {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Directory name, or `Unknown user`.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property cells
   *
   * @description
   * The seven days.
   *
   * @type {readonly TimesheetCell[]}
   * @readonly
   */
  readonly cells: readonly TimesheetCell[];

  /**
   * Property total
   *
   * @description
   * The week's duration.
   *
   * @type {string}
   * @readonly
   */
  readonly total: string;

  /**
   * Property tasks
   *
   * @description
   * The person's tasks.
   *
   * @type {readonly TimesheetTaskRow[]}
   * @readonly
   */
  readonly tasks: readonly TimesheetTaskRow[];
  // #endregion
}

/**
 * Interface TimesheetShare
 *
 * @description
 * A person of `Breakdown by person`, largest share first.
 */
interface TimesheetShare {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Account of the person.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property name
   *
   * @description
   * Directory name, or `Unknown user`.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property minutes
   *
   * @description
   * Minutes of the week.
   *
   * @type {number}
   * @readonly
   */
  readonly minutes: number;

  /**
   * Property total
   *
   * @description
   * The week's duration.
   *
   * @type {string}
   * @readonly
   */
  readonly total: string;

  /**
   * Property percent
   *
   * @description
   * Share of the week, `38%`.
   *
   * @type {string}
   * @readonly
   */
  readonly percent: string;

  /**
   * Property dot
   *
   * @description
   * Classes of the person's color dot, the color of their bars in `Time per day`.
   *
   * @type {string}
   * @readonly
   */
  readonly dot: string;
  // #endregion
}

/**
 * Interface TimesheetKpi
 *
 * @description
 * A key figure of the week.
 */
interface TimesheetKpi {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Stable identity for the template.
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
   * The figure, `—` when there is none.
   *
   * @type {string}
   * @readonly
   */
  readonly value: string;

  /**
   * Property hint
   *
   * @description
   * The line under it.
   *
   * @type {string}
   * @readonly
   */
  readonly hint: string;

  /**
   * Property loading
   *
   * @description
   * Whether the figure is still being read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;
  // #endregion
}

/**
 * Function minutesText
 *
 * @description
 * Writes minutes the way the mockup writes durations (`2 h 05`, `45 min`, `fmtMin` of
 * `App.dc.html` line 3573).
 *
 * @param {number} minutes - Whole minutes.
 * @returns {string} The duration.
 */
function minutesText(minutes: number): string {
  return formatDuration(minutes * 60_000);
}

/**
 * Function heatClasses
 *
 * @description
 * The tint of a day's minutes (`heat` of `App.dc.html` line 7825).
 *
 * @param {number} minutes - Minutes of the day.
 * @returns {string} Literal classes.
 */
function heatClasses(minutes: number): string {
  if (minutes >= 300) return 'bg-primary/25 font-semibold text-foreground';
  if (minutes >= 180) return 'bg-primary/15 text-foreground';
  if (minutes >= 60) return 'bg-primary/10 text-foreground';
  if (minutes > 0) return 'bg-primary/5 text-foreground';
  return 'text-muted-foreground/40';
}

/**
 * Component TimesheetViewPage
 *
 * @description
 * The `Timesheet` view at `/:org/l/:listId/timesheet`, below the list frame (`App.dc.html` lines
 * 1363-1449 and 7813-7880): the time recorded on the list's tasks over one week, Monday to
 * Sunday, starting on the current week. The header moves a week back or forward, names the week
 * (`Week of Nov 2 to Nov 8`, announced politely), marks `This week` or offers `Back to this week`,
 * and gives the week's total. Under it: four key figures (`cw-stat`: the total with its tasks, the
 * average per working day, the longest task, the estimates of these tasks and the share consumed),
 * the table `Person and task` × seven days × `Total` (`table[cwTable]`: a person row with the daily
 * sums and their heat tint, then the person's task rows, whose button opens the task's detail over
 * the view with the row as its preview; a `Total` footer), `Time per day` (stacked bars per
 * person, five series at most, the rest summed into `Others`) and `Breakdown by person` (a gauge
 * per person). People are named from the organization's members; a former member reads as
 * `Unknown user`. The view's filters do not apply to time entries. A first failed read reaches the
 * route's error boundary; a failed read of another week shows an error with `Retry` in place of
 * the week, a failed refresh keeps the week with a `Retry` line, and failed estimates a `Retry`
 * line under the figures. The skeleton follows `App.dc.html` lines 613-624; a week without time
 * shows its empty state. Under 768 px the table scrolls and the charts stack.
 */
@Component({
  selector: 'cw-timesheet-view-page',
  imports: [
    CwAvatar,
    CwBadge,
    CwButton,
    CwChart,
    CwEmpty,
    CwEmptyDescription,
    CwEmptyHeader,
    CwEmptyMedia,
    CwEmptyTitle,
    CwMeter,
    CwSkeleton,
    CwStat,
    CwStatusIcon,
    CwTable,
    CwTableBody,
    CwTableCell,
    CwTableContainer,
    CwTableFooter,
    CwTableHead,
    CwTableHeader,
    CwTableRow,
    NgIcon,
  ],
  providers: [
    provideCwChartLabels(() => ({
      emptyText: $localize`:@@spaces.timesheet.chart-empty:No data for the period`,
      categoryHeader: $localize`:@@spaces.timesheet.chart-category:Day`,
      capacityLabel: $localize`:@@spaces.timesheet.chart-capacity:Capacity`,
      othersLabel: $localize`:@@spaces.timesheet.chart-others:Others`,
      marker: (label: string, category: string): string =>
        $localize`:@@spaces.timesheet.chart-marker:${label}:label:: ${category}:category:`,
    })),
    provideCwStatLabels(() => ({
      up: $localize`:@@spaces.timesheet.stat-up:up`,
      down: $localize`:@@spaces.timesheet.stat-down:down`,
      flat: $localize`:@@spaces.timesheet.stat-flat:steady`,
      refreshing: $localize`:@@spaces.timesheet.stat-refreshing:Refreshing`,
      goalOf: $localize`:@@spaces.timesheet.stat-goal-of:of`,
    })),
    provideCwMeterLabels(() => ({
      free: $localize`:@@spaces.timesheet.meter-free:Free`,
      unmeasured: $localize`:@@spaces.timesheet.meter-unmeasured:No measure`,
      threshold: $localize`:@@spaces.timesheet.meter-threshold:Capacity`,
    })),
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './timesheet-view-page.component.html',
})
export class TimesheetViewPage {
  // #region Properties
  /**
   * Property store
   *
   * @description
   * The week shown, its figures and estimates.
   *
   * @type {TimesheetViewStoreInstance}
   * @readonly
   */
  protected readonly store: TimesheetViewStoreInstance = inject(TimesheetViewStore);

  /**
   * Property listPage
   *
   * @description
   * The open list: its id and the organization's members, who name the people.
   *
   * @type {ListPageStoreInstance}
   * @readonly
   */
  private readonly listPage: ListPageStoreInstance = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The list's view configuration: its query filters the week.
   *
   * @type {ListViewStoreInstance}
   * @readonly
   */
  private readonly view: ListViewStoreInstance = inject(ListViewStore);

  /**
   * Property taskDetail
   *
   * @description
   * Opens a task's detail over the view.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property locale
   *
   * @description
   * Locale of the dates and weekdays.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property retryLabel
   *
   * @description
   * Label of the buttons that read again.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property previousLabel
   *
   * @description
   * Accessible name of the previous-week button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly previousLabel: string = $localize`:@@spaces.timesheet.previous:Previous week`;

  /**
   * Property nextLabel
   *
   * @description
   * Accessible name of the next-week button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly nextLabel: string = $localize`:@@spaces.timesheet.next:Next week`;

  /**
   * Property perDayLabel
   *
   * @description
   * Title and accessible name of the stacked chart.
   *
   * @type {string}
   * @readonly
   */
  protected readonly perDayLabel: string = $localize`:@@spaces.timesheet.per-day:Time per day`;

  /**
   * Property breakdownLabel
   *
   * @description
   * Title and accessible name of the share of each person.
   *
   * @type {string}
   * @readonly
   */
  protected readonly breakdownLabel: string = $localize`:@@spaces.timesheet.breakdown:Breakdown by person`;

  /**
   * Property formatMinutes
   *
   * @description
   * Writes the chart's values as durations.
   *
   * @type {(minutes: number) => string}
   * @readonly
   */
  protected readonly formatMinutes: (minutes: number) => string = minutesText;

  /**
   * Property skeletonKpis
   *
   * @description
   * The key figure placeholders of the skeleton (`App.dc.html` line 616).
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeletonKpis: readonly number[] = [0, 1, 2, 3];

  /**
   * Property skeletonDays
   *
   * @description
   * The day header placeholders of the skeleton.
   *
   * @type {readonly number[]}
   * @readonly
   */
  protected readonly skeletonDays: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

  /**
   * Property skeletonRows
   *
   * @description
   * The row placeholders of the skeleton (`skTsRows` of `App.dc.html`): a person row, then task
   * rows, with a few days filled.
   *
   * @type {readonly TimesheetSkeletonRow[]}
   * @readonly
   */
  protected readonly skeletonRows: readonly TimesheetSkeletonRow[] = SKELETON_ROWS;

  /**
   * Property ready
   *
   * @description
   * Whether the members that name the people are settled (read, or failed, which shows
   * `Unknown user`), so names never flash.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly ready: Signal<boolean> = computed(
    (): boolean => !this.listPage.organizationMembers.isLoading(),
  );

  /**
   * Property membersFailed
   *
   * @description
   * Whether the members that name the people could not be read: the people read `Unknown user`
   * and a `Retry` line offers to read them again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly membersFailed: Signal<boolean> = computed(
    (): boolean => this.listPage.organizationMembers.error() !== undefined,
  );

  /**
   * Property memberNames
   *
   * @description
   * The directory names of the organization's members, by account.
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  private readonly memberNames: Signal<ReadonlyMap<string, string>> = computed(
    (): ReadonlyMap<string, string> => {
      const members: readonly ListMember[] = this.listPage.organizationMembers.hasValue()
        ? this.listPage.organizationMembers.value()
        : [];
      return new Map(
        members
          .filter((member: ListMember): boolean => member.name !== null)
          .map((member: ListMember): [string, string] => [member.userId, member.name ?? '']),
      );
    },
  );

  /**
   * Property bounded
   *
   * @description
   * Whether the table has more than `BOUNDED_ROWS` body rows and scrolls in its bounded frame.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly bounded: Signal<boolean> = computed(
    (): boolean =>
      this.store
        .people()
        .reduce(
          (rows: number, person: TimesheetPerson): number => rows + 1 + person.tasks.length,
          0,
        ) > BOUNDED_ROWS,
  );

  /**
   * Property noMatch
   *
   * @description
   * Whether the week has time but none of it on the tasks and people the filters keep.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly noMatch: Signal<boolean> = computed(
    (): boolean =>
      this.store.filtering() &&
      this.store.empty() &&
      (this.store
        .sheet()
        ?.entries.some((entry: TimesheetEntry): boolean => entry.totalMinutes > 0) ??
        false),
  );

  /**
   * Property rangeLabel
   *
   * @description
   * The week shown (`Week of Nov 2 to Nov 8`, `App.dc.html` line 7831).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly rangeLabel: Signal<string> = computed((): string => {
    const days: readonly string[] = this.store.days();
    const start: string = formatDayMonth(days[0], this.locale);
    const end: string = formatDayMonth(days[6], this.locale);
    return $localize`:@@spaces.timesheet.range:Week of ${start}:start: to ${end}:end:`;
  });

  /**
   * Property weekTotal
   *
   * @description
   * The week's duration, empty while it is unknown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly weekTotal: Signal<string> = computed((): string => {
    const sheet: ListTimesheet | undefined = this.store.week();
    return sheet ? minutesText(sheet.totalMinutes) : '';
  });

  /**
   * Property columns
   *
   * @description
   * The day columns of the table (`Mon 23`; weekend shaded, today in the primary color).
   *
   * @type {Signal<readonly TimesheetDayColumn[]>}
   * @readonly
   */
  protected readonly columns: Signal<readonly TimesheetDayColumn[]> = computed(
    (): readonly TimesheetDayColumn[] => {
      const weekday: Intl.DateTimeFormat = new Intl.DateTimeFormat(this.locale, {
        weekday: 'short',
      });
      const today: string = this.store.today();
      return this.store.days().map((date: string, index: number): TimesheetDayColumn => ({
        date,
        label: `${weekday.format(toLocalDate(date))} ${String(toLocalDate(date).getDate())}`,
        classes: (index >= WEEKEND ? 'bg-muted/40 ' : '') + (date === today ? 'text-primary' : ''),
      }));
    },
  );

  /**
   * Property people
   *
   * @description
   * The rows of the table: each person, sorted by name, then their tasks.
   *
   * @type {Signal<readonly TimesheetPersonRow[]>}
   * @readonly
   */
  protected readonly people: Signal<readonly TimesheetPersonRow[]> = computed(
    (): readonly TimesheetPersonRow[] =>
      this.store
        .people()
        .map((person: TimesheetPerson): TimesheetPersonRow => ({
          userId: person.userId,
          name: this.nameOf(person.userId),
          cells: this.cellsOf(person.minutesByDay),
          total: minutesText(person.totalMinutes),
          tasks: person.tasks.map((task: TimesheetEntry): TimesheetTaskRow => ({
            taskKey: task.taskKey,
            name: task.name,
            status: task.status,
            openLabel: $localize`:@@spaces.timesheet.open:Open ${task.taskKey}:key: · ${task.name}:name:`,
            cells: this.cellsOf(task.minutesByDay),
            total: minutesText(task.totalMinutes),
          })),
        }))
        .sort((a: TimesheetPersonRow, b: TimesheetPersonRow): number =>
          a.name.localeCompare(b.name, this.locale),
        ),
  );

  /**
   * Property footer
   *
   * @description
   * The `Total` row: each day across people.
   *
   * @type {Signal<readonly TimesheetCell[]>}
   * @readonly
   */
  protected readonly footer: Signal<readonly TimesheetCell[]> = computed(
    (): readonly TimesheetCell[] =>
      (this.store.week()?.days ?? []).map(
        (day: { readonly date: string; readonly totalMinutes: number }): TimesheetCell => ({
          date: day.date,
          text: day.totalMinutes > 0 ? minutesText(day.totalMinutes) : '·',
          classes: '',
        }),
      ),
  );

  /**
   * Property kpis
   *
   * @description
   * The four key figures (`App.dc.html` lines 7865-7868).
   *
   * @type {Signal<readonly TimesheetKpi[]>}
   * @readonly
   */
  protected readonly kpis: Signal<readonly TimesheetKpi[]> = computed(
    (): readonly TimesheetKpi[] => {
      const figures: TimesheetFigures | null = this.store.figures();
      if (!figures) return [];
      const estimate: number | null = this.store.estimatedMinutes();
      const estimating: boolean = this.store.estimates.isLoading() && estimate === null;
      return [
        {
          key: 'total',
          label: $localize`:@@spaces.timesheet.kpi-total:Week total`,
          value: minutesText(figures.totalMinutes),
          hint:
            figures.taskCount === 1
              ? $localize`:@@spaces.timesheet.kpi-tasks-one:1 task`
              : $localize`:@@spaces.timesheet.kpi-tasks:${figures.taskCount}:count: tasks`,
          loading: false,
        },
        {
          key: 'average',
          label: $localize`:@@spaces.timesheet.kpi-average:Average per working day`,
          value: minutesText(figures.averageMinutes),
          hint:
            figures.workedDays === 1
              ? $localize`:@@spaces.timesheet.kpi-days-one:1 day with time`
              : $localize`:@@spaces.timesheet.kpi-days:${figures.workedDays}:count: days with time`,
          loading: false,
        },
        {
          key: 'top',
          label: $localize`:@@spaces.timesheet.kpi-top:Longest task`,
          value: figures.topTask ? minutesText(figures.topTask.minutes) : '—',
          hint: figures.topTask
            ? `${figures.topTask.taskKey} · ${figures.topTask.name}`
            : $localize`:@@spaces.timesheet.kpi-top-none:None`,
          loading: false,
        },
        {
          key: 'estimate',
          label: $localize`:@@spaces.timesheet.kpi-estimate:Estimated on these tasks`,
          value: estimate === null ? '—' : minutesText(estimate),
          hint:
            estimate === null
              ? estimating || this.store.estimates.error()
                ? ''
                : $localize`:@@spaces.timesheet.kpi-no-estimate:No estimate`
              : $localize`:@@spaces.timesheet.kpi-consumed:${String(
                  Math.round((figures.totalMinutes / estimate) * 100),
                )}:percent:% consumed`,
          loading: estimating,
        },
      ];
    },
  );

  /**
   * Property shares
   *
   * @description
   * `Breakdown by person`: each person's minutes and share, largest first, in the color of their
   * bars.
   *
   * @type {Signal<readonly TimesheetShare[]>}
   * @readonly
   */
  protected readonly shares: Signal<readonly TimesheetShare[]> = computed(
    (): readonly TimesheetShare[] => {
      const people: readonly TimesheetPerson[] = [...this.store.people()].sort(
        (a: TimesheetPerson, b: TimesheetPerson): number => b.totalMinutes - a.totalMinutes,
      );
      const total: number = people.reduce(
        (sum: number, person: TimesheetPerson): number => sum + person.totalMinutes,
        0,
      );
      return people.map((person: TimesheetPerson, index: number): TimesheetShare => ({
        userId: person.userId,
        name: this.nameOf(person.userId),
        minutes: person.totalMinutes,
        total: minutesText(person.totalMinutes),
        percent: this.percentText(person.totalMinutes, total),
        dot: DOT_CLASSES[this.colorOf(index, people.length)],
      }));
    },
  );

  /**
   * Property shareTotal
   *
   * @description
   * The week's minutes across people: the range of each gauge.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly shareTotal: Signal<number> = computed((): number =>
    this.shares().reduce((sum: number, share: TimesheetShare): number => sum + share.minutes, 0),
  );

  /**
   * Property chartSeries
   *
   * @description
   * One series per person, largest share first, so the chart keeps the four largest apart and sums
   * the others past five.
   *
   * @type {Signal<readonly CwChartSeries[]>}
   * @readonly
   */
  protected readonly chartSeries: Signal<readonly CwChartSeries[]> = computed(
    (): readonly CwChartSeries[] =>
      this.shares().map(
        (share: TimesheetShare, index: number, all: readonly TimesheetShare[]): CwChartSeries => ({
          key: share.userId,
          label: share.name,
          color: this.colorOf(index, all.length),
        }),
      ),
  );

  /**
   * Property chartDays
   *
   * @description
   * The categories of the chart, `M 23` (`App.dc.html` line 7871), with their full name for the
   * tooltip (`Mon 23`).
   *
   * @type {Signal<ReadonlyMap<string, string>>}
   * @readonly
   */
  protected readonly chartDays: Signal<ReadonlyMap<string, string>> = computed(
    (): ReadonlyMap<string, string> => {
      const letter: Intl.DateTimeFormat = new Intl.DateTimeFormat(this.locale, {
        weekday: 'narrow',
      });
      return new Map(
        this.store
          .days()
          .map((date: string, index: number): [string, string] => [
            `${letter.format(toLocalDate(date))} ${String(toLocalDate(date).getDate())}`,
            this.columns()[index].label,
          ]),
      );
    },
  );

  /**
   * Property chartData
   *
   * @description
   * One entry per day: each person's minutes, a gap without time.
   *
   * @type {Signal<readonly CwChartDatum[]>}
   * @readonly
   */
  protected readonly chartData: Signal<readonly CwChartDatum[]> = computed(
    (): readonly CwChartDatum[] => {
      const categories: readonly string[] = [...this.chartDays().keys()];
      const people: readonly TimesheetPerson[] = this.store.people();
      return categories.map(
        (category: string, day: number): CwChartDatum =>
          Object.fromEntries([
            ['day', category],
            ...people.map((person: TimesheetPerson): [string, number | null] => [
              person.userId,
              person.minutesByDay[day] > 0 ? person.minutesByDay[day] : null,
            ]),
          ]) as CwChartDatum,
      );
    },
  );

  /**
   * Property dayName
   *
   * @description
   * The full name of a chart category, for the tooltip and the announcement.
   *
   * @type {(category: string) => string}
   * @readonly
   */
  protected readonly dayName: (category: string) => string = (category: string): string =>
    this.chartDays().get(category) ?? category;

  /**
   * Property shareFormat
   *
   * @description
   * The value text of a person's gauge (`38%`).
   *
   * @type {(value: number, max: number) => string}
   * @readonly
   */
  protected readonly shareFormat: (value: number, max: number) => string = (
    value: number,
    max: number,
  ): string => this.percentText(value, max);
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the store to the list of the route and to the view's query. A failed first read is read
   * again when the error boundary runs the route again, which renders the page anew over the same
   * route store.
   *
   * @constructor
   */
  public constructor() {
    if (this.store.timesheet.error()) this.store.reload();
    this.store.show(this.listPage.listId);
    this.store.followQuery(this.view.taskQuery);
  }
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the view (`?task=<KEY>`), with what the row shows of it as the
   * header's preview.
   *
   * @param {TimesheetTaskRow} task - The task row.
   */
  protected open(task: TimesheetTaskRow): void {
    void this.taskDetail.open(task.taskKey, {
      key: task.taskKey,
      name: task.name,
      status: task.status,
      milestone: false,
    });
  }

  /**
   * Method retryMembers
   *
   * @description
   * Reads the organization's members again, for the people's names.
   */
  protected retryMembers(): void {
    this.listPage.organizationMembers.reload();
  }

  /**
   * Method nameOf
   *
   * @description
   * The directory name of a person, or `Unknown user` for a former member or a failed read.
   *
   * @param {string} userId - Account of the person.
   * @returns {string} The name.
   */
  private nameOf(userId: string): string {
    return (
      this.memberNames().get(userId) ?? $localize`:@@spaces.labels.avatar-unknown:Unknown user`
    );
  }

  /**
   * Method cellsOf
   *
   * @description
   * The seven cells of a row of the table.
   *
   * @param {readonly number[]} minutes - Minutes of each day, Monday first.
   * @returns {readonly TimesheetCell[]} The cells.
   */
  private cellsOf(minutes: readonly number[]): readonly TimesheetCell[] {
    const today: string = this.store.today();
    return this.store.days().map((date: string, index: number): TimesheetCell => ({
      date,
      text: minutes[index] > 0 ? minutesText(minutes[index]) : '·',
      classes:
        heatClasses(minutes[index]) +
        (index >= WEEKEND && minutes[index] === 0 ? ' bg-muted/40' : '') +
        (date === today ? ' ring-1 ring-primary/30 ring-inset' : ''),
    }));
  }

  /**
   * Method colorOf
   *
   * @description
   * The data color of the person at a rank, largest share first: past five people every person
   * from the fifth on is summed into `Others`, in `chart-5`.
   *
   * @param {number} index - Rank of the person.
   * @param {number} count - People of the week.
   * @returns {CwChartColor} The color.
   */
  private colorOf(index: number, count: number): CwChartColor {
    const rank: number = count > MAX_SERIES ? Math.min(index, MAX_SERIES - 1) : index;
    return CHART_COLORS[Math.min(rank, CHART_COLORS.length - 1)];
  }

  /**
   * Method percentText
   *
   * @description
   * A share as a rounded percentage (`38%`).
   *
   * @param {number} value - The part.
   * @param {number} total - The whole.
   * @returns {string} The percentage.
   */
  private percentText(value: number, total: number): string {
    const percent: string = String(Math.round((value / (total || 1)) * 100));
    return $localize`:@@spaces.timesheet.share-percent:${percent}:percent:%`;
  }
  // #endregion
}
