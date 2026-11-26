import { CdkDrag, type CdkDragEnd } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import {
  CwHeatGrid,
  type CwHeatGridCell,
  type CwHeatGridCellLabelContext,
  CwHeatGridChipDef,
  type CwHeatGridColumn,
  type CwHeatGridLabels,
  type CwHeatGridRow,
  CwHeatGridTotalDef,
  provideCwHeatGridLabels,
} from '@cadenway/ui/components/heat-grid';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import { type Person, TaskCancelDialog, TaskCreate, type TaskSummary } from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import type {
  WorkloadEntry,
  WorkloadLoad,
  WorkloadRead,
} from '../../../models/workload/workload.interface';
import { ListPageStore } from '../../../state/list-page/list-page.store';
import {
  LIST_TASKS_CAP,
  ListTasksStore,
  type ListTasksStoreInstance,
} from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import {
  WorkloadViewStore,
  type WorkloadViewStoreInstance,
} from '../../../state/workload-view/workload-view.store';
import { toLocalDate } from '../../../utils/calendar-date/calendar-date.util';
import { WORKLOAD_DAY_CAPACITY_MINUTES } from '../../../utils/workload/workload.util';
import { TaskMenu } from '../../components/task-menu/task-menu.component';

/**
 * Constant UNASSIGNED_ROW
 *
 * @description
 * Key of the `Unassigned` row of the grid; an account id never takes it.
 *
 * @type {string}
 */
const UNASSIGNED_ROW: string = '-none';

/**
 * Constant DAY_CAPACITY_HOURS
 *
 * @description
 * Capacity of one person on a weekday, in hours (6 h).
 *
 * @type {number}
 */
const DAY_CAPACITY_HOURS: number = WORKLOAD_DAY_CAPACITY_MINUTES / 60;

/**
 * Constant DRAG_START_DELAY
 *
 * @description
 * How long a chip is held before it drags, in milliseconds: at once with a mouse, after a press
 * on a touch screen, so the grid still scrolls under a finger.
 *
 * @type {{ touch: number; mouse: number }}
 */
const DRAG_START_DELAY: { touch: number; mouse: number } = { touch: 300, mouse: 0 };

/**
 * Constant WORKLOAD_EMPTY
 *
 * @description
 * The text shown when no task matches the view (`App.dc.html` line 1026).
 *
 * @type {string}
 */
const WORKLOAD_EMPTY: string = $localize`:@@spaces.workload.empty:No task matches the search or the filters.`;

/**
 * Function hoursFormat
 *
 * @description
 * Writes a number of hours in the application locale, one decimal at most (`7.5 h`, `fmtH` of
 * `App.dc.html`).
 *
 * @param {string} locale - Application locale.
 * @returns {(hours: number) => string} The formatter.
 */
function hoursFormat(locale: string): (hours: number) => string {
  const number: Intl.NumberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (hours: number): string => {
    const value: string = number.format(hours);
    return $localize`:@@spaces.workload.hours:${value}:hours: h`;
  };
}

/**
 * Function workloadLabels
 *
 * @description
 * The English texts of `cw-heat-grid` for the workload, the mockup's French in the catalog
 * (`App.dc.html` lines 959-1026 and 7497-7516).
 *
 * @param {string} locale - Application locale, for the hours.
 * @returns {Partial<CwHeatGridLabels>} The texts.
 */
function workloadLabels(locale: string): Partial<CwHeatGridLabels> {
  const hours: (value: number) => string = hoursFormat(locale);
  const capacity: string = hours(DAY_CAPACITY_HOURS * 10);
  const tasksOf: (count: number) => string = (count: number): string =>
    count === 1
      ? $localize`:@@spaces.workload.tasks-one:${count}:count: task`
      : $localize`:@@spaces.workload.tasks-many:${count}:count: tasks`;
  return {
    rowHeader: $localize`:@@spaces.workload.person:Person`,
    totalHeader: $localize`:@@spaces.workload.total:Total · ${capacity}:capacity:`,
    available: $localize`:@@spaces.workload.available:Available`,
    high: $localize`:@@spaces.workload.high:High load`,
    over: $localize`:@@spaces.workload.overloaded:Overloaded`,
    placeholderNote: $localize`:@@spaces.workload.to-assign:To assign`,
    emptyCell: $localize`:@@spaces.workload.no-task-day:No task that day.`,
    emptyText: WORKLOAD_EMPTY,
    loading: $localize`:@@spaces.workload.loading:Loading the workload`,
    more: (hidden: number): string => $localize`:@@spaces.workload.more:+${hidden}:count:`,
    moreLabel: (count: number): string =>
      $localize`:@@spaces.workload.more-label:Show the ${count}:count: tasks`,
    cell: (context: CwHeatGridCellLabelContext): string => {
      const { row, column }: CwHeatGridCellLabelContext = context;
      if (context.count === 0) {
        return $localize`:@@spaces.workload.cell-empty:${row}:row:, ${column}:day:: no task`;
      }
      const load: string =
        context.capacity === null
          ? context.value
          : $localize`:@@spaces.workload.of-capacity:${context.value}:value: of ${context.capacity}:capacity:`;
      const level: string =
        context.level === 'over'
          ? $localize`:@@spaces.workload.cell-over:, overloaded`
          : context.level === 'high'
            ? $localize`:@@spaces.workload.cell-high:, high load`
            : '';
      const tasks: string = tasksOf(context.count);
      return $localize`:@@spaces.workload.cell:${row}:row:, ${column}:day:: ${load}:load:${level}:level:, ${tasks}:tasks:`;
    },
    popoverTitle: (row: string, column: string): string => `${row} · ${column}`,
    popoverSum: (value: string, cellCapacity: string | null): string =>
      cellCapacity === null
        ? value
        : $localize`:@@spaces.workload.of-capacity:${value}:value: of ${cellCapacity}:capacity:`,
    meter: (row: string, total: string, rowCapacity: string): string =>
      $localize`:@@spaces.workload.meter:Workload of ${row}:row:: ${total}:total: of ${rowCapacity}:capacity:`,
  };
}

/**
 * Function capitalized
 *
 * @description
 * A text with its first letter in upper case (`capFirst` of `App.dc.html`).
 *
 * @param {string} text - The text.
 * @returns {string} The text, capitalized.
 */
function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/**
 * Component WorkloadViewPage
 *
 * @description
 * The `Workload` view at `/:org/l/:listId/workload` (`App.dc.html` lines 958-1029, skeleton
 * 572-582, day popover 3437-3453): the load of each person of the organization, then
 * `Unassigned`, over two weeks of weekdays, against 6 h a day (`cw-heat-grid`). The heading
 * names the weeks; `Today`, `Previous week` and `Next week` move them. A cell shows its hours
 * and bar and its first two tasks as chips; the cell (or `+n`) opens the popover of the day's
 * tasks with their hours. A chip or a popover line opens its task's detail; its context menu
 * (right click, Menu key, Shift F10, long press) is the task menu (`cw-task-menu`, writing
 * through `ViewTaskWritesStore` over `ListTasksStore`). Dragging a chip onto another row
 * reassigns the task (`WorkloadViewStore.reassign`, with a toast and `Undo`); the row under the
 * pointer is tinted while dragging. The drag is pointer only: the menu's `Assign` reassigns from
 * the keyboard. The total column shows each person's hours over 60 h, the note and meter, and
 * the time they recorded on the list over the two weeks. The view reads the list's tasks with the
 * view's query (for the menu and the tools' count) and the workload; a first read that fails
 * reaches the route's error boundary, a failed refresh offers `Retry` in place, and so does a
 * failed read of the time spent. Without any task matching the view, the mockup's filter text
 * shows under the grid. When the task reader stops at its cap (`LIST_TASKS_CAP`), a notice says
 * the tasks past it cannot be reassigned here, and their chips (no menu, no drag) say why.
 */
@Component({
  selector: 'cw-workload-view-page',
  imports: [
    CdkDrag,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwContextMenuTriggerFor,
    CwHeatGrid,
    CwHeatGridChipDef,
    CwHeatGridTotalDef,
    CwStatusIcon,
    NgIcon,
    TaskCancelDialog,
    TaskMenu,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [
    ViewTaskWritesStore,
    { provide: VIEW_TASK_WRITER, useExisting: ListTasksStore },
    provideCwHeatGridLabels(() => workloadLabels(inject(LOCALE_ID))),
  ],
  templateUrl: './workload-view-page.component.html',
})
export class WorkloadViewPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list, from the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property retryLabel
   *
   * @description
   * Label for retrying a failed read.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = SPACES_RETRY;

  /**
   * Property capacity
   *
   * @description
   * Capacity of a cell, in hours.
   *
   * @type {number}
   * @readonly
   */
  protected readonly capacity: number = DAY_CAPACITY_HOURS;

  /**
   * Property emptyText
   *
   * @description
   * The text shown under the grid when no task matches the view.
   *
   * @type {string}
   * @readonly
   */
  protected readonly emptyText: string = WORKLOAD_EMPTY;

  /**
   * Property dragDelay
   *
   * @description
   * Hold before a chip drags.
   *
   * @type {{ touch: number; mouse: number }}
   * @readonly
   */
  protected readonly dragDelay: { touch: number; mouse: number } = DRAG_START_DELAY;

  /**
   * Property page
   *
   * @description
   * The list frame: the list, its members and its counts.
   *
   * @type {InstanceType<typeof ListPageStore>}
   * @readonly
   */
  private readonly page: InstanceType<typeof ListPageStore> = inject(ListPageStore);

  /**
   * Property view
   *
   * @description
   * The view configuration: the query read and the tools' summary.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  private readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property tasks
   *
   * @description
   * The list's tasks with the view's query: the chips' menu, writes and statuses.
   *
   * @type {ListTasksStoreInstance}
   * @readonly
   */
  protected readonly tasks: ListTasksStoreInstance = inject(ListTasksStore);

  /**
   * Property workload
   *
   * @description
   * The workload of the weeks shown and the reassignments.
   *
   * @type {WorkloadViewStoreInstance}
   * @readonly
   */
  protected readonly workload: WorkloadViewStoreInstance = inject(WorkloadViewStore);

  /**
   * Property writes
   *
   * @description
   * The task menu's writes, toasts and confirmations.
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property taskCreate
   *
   * @description
   * Makes `N` create a task in this list while the view lives.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property destroyRef
   *
   * @description
   * Lifetime of the view.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property document
   *
   * @description
   * Finds the row under a dropped chip.
   *
   * @type {Document}
   * @readonly
   */
  private readonly document: Document = inject(DOCUMENT);

  /**
   * Property locale
   *
   * @description
   * Application locale, for the dates and hours.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property hours
   *
   * @description
   * Writes a number of hours (`7.5 h`), for the grid's values and the popover lines.
   *
   * @type {(hours: number) => string}
   * @readonly
   */
  protected readonly hours: (hours: number) => string = hoursFormat(this.locale);

  /**
   * Property dragging
   *
   * @description
   * Key of the task whose chip is being dragged, null otherwise: the chip lets the pointer
   * through to the row under it, and that row is tinted.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly dragging: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuTask
   *
   * @description
   * The task whose menu was opened last.
   *
   * @type {WritableSignal<TaskSummary | null>}
   * @readonly
   */
  protected readonly menuTask: WritableSignal<TaskSummary | null> = signal<TaskSummary | null>(
    null,
  );

  /**
   * Property menuTasks
   *
   * @description
   * What the task menu acts on: the chip's task.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const task: TaskSummary | null = this.menuTask();
      if (!task) return [];
      const shown: TaskSummary | undefined =
        this.tasks.items().find((item) => item.task.key === task.key)?.task ??
        this.tasks.taskOf(task.key);
      return [shown ?? task];
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status the menu's task shows.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed((): StatusKey | null => {
    const task: TaskSummary | undefined = this.menuTasks().at(0);
    return task ? this.tasks.shownStatus(task) : null;
  });

  /**
   * Property menuMilestone
   *
   * @description
   * Whether the menu's task is a milestone, which offers a milestone's statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly menuMilestone: Signal<boolean> = computed(
    (): boolean => this.menuTasks().at(0)?.milestone ?? false,
  );

  /**
   * Property membersSettled
   *
   * @description
   * Whether the member directory answered (or failed): the rows wait for it, so nobody shows as
   * a former member while it is read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  private readonly membersSettled: Signal<boolean> = computed(
    (): boolean =>
      this.page.organizationMembers.hasValue() ||
      this.page.organizationMembers.error() !== undefined,
  );

  /**
   * Property loading
   *
   * @description
   * Whether the grid draws its skeleton: the weeks shown, the list's tasks or the members are not
   * read yet. While a read has no current answer, it reads the read's `value()`, which throws
   * when that read failed: the route's error boundary then replaces the view.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly loading: Signal<boolean> = computed((): boolean => {
    if (!this.tasks.hasCurrentSnapshot()) this.tasks.primary.value();
    if (!this.workload.hasCurrentSnapshot()) this.workload.primary.value();
    return this.workload.loading() || this.tasks.initialLoading() || !this.membersSettled();
  });

  /**
   * Property columns
   *
   * @description
   * The ten weekdays shown: `Mon` over `23`, today inverted, the second week set apart.
   *
   * @type {Signal<readonly CwHeatGridColumn[]>}
   * @readonly
   */
  protected readonly columns: Signal<readonly CwHeatGridColumn[]> = computed(
    (): readonly CwHeatGridColumn[] => {
      const today: string = this.workload.today();
      const weekday: Intl.DateTimeFormat = new Intl.DateTimeFormat(this.locale, {
        weekday: 'short',
      });
      return this.workload.days().map((date: string, index: number): CwHeatGridColumn => ({
        key: date,
        label: capitalized(this.longDay(date)),
        caption: weekday.format(toLocalDate(date)),
        short: String(toLocalDate(date).getDate()),
        current: date === today,
        groupStart: index === 5,
      }));
    },
  );

  /**
   * Property rows
   *
   * @description
   * One row per member of the organization (the signed-in member first), then any other
   * assignee holding a task (a former member), then `Unassigned`; each cell holds the day's hours
   * and tasks, each person's total a capacity of 60 h.
   *
   * @type {Signal<readonly CwHeatGridRow<WorkloadEntry>[]>}
   * @readonly
   */
  protected readonly rows: Signal<readonly CwHeatGridRow<WorkloadEntry>[]> = computed(
    (): readonly CwHeatGridRow<WorkloadEntry>[] => {
      const days: readonly string[] = this.workload.days();
      const loads: ReadonlyMap<string, WorkloadLoad> = new Map<string, WorkloadLoad>(
        this.workload
          .loads()
          .map((load: WorkloadLoad): [string, WorkloadLoad] => [
            load.assigneeId ?? UNASSIGNED_ROW,
            load,
          ]),
      );
      const cellsOf: (key: string) => Record<string, CwHeatGridCell<WorkloadEntry>> = (
        key: string,
      ): Record<string, CwHeatGridCell<WorkloadEntry>> => {
        const load: WorkloadLoad | undefined = loads.get(key);
        const cells: Record<string, CwHeatGridCell<WorkloadEntry>> = {};
        for (const date of days) {
          const items: readonly WorkloadEntry[] = load?.days[date] ?? [];
          cells[date] = {
            value:
              items.reduce((sum: number, entry: WorkloadEntry): number => sum + entry.minutes, 0) /
              60,
            items,
          };
        }
        return cells;
      };
      const capacity: number = DAY_CAPACITY_HOURS * days.length;
      const people: readonly Person[] = this.writes.people();
      const known: Set<string> = new Set<string>(people.map((person: Person) => person.id));
      const former: string = $localize`:@@spaces.workload.former-member:Former member`;
      return [
        ...people.map((person: Person): CwHeatGridRow<WorkloadEntry> => ({
          key: person.id,
          label: person.name,
          src: person.avatar,
          cells: cellsOf(person.id),
          capacity,
        })),
        ...[...loads.keys()]
          .filter((key: string): boolean => key !== UNASSIGNED_ROW && !known.has(key))
          .map((key: string): CwHeatGridRow<WorkloadEntry> => ({
            key,
            label: former,
            cells: cellsOf(key),
            capacity,
          })),
        {
          key: UNASSIGNED_ROW,
          label: $localize`:@@spaces.workload.unassigned:Unassigned`,
          placeholder: true,
          cells: cellsOf(UNASSIGNED_ROW),
          capacity: null,
        },
      ];
    },
  );

  /**
   * Property rangeLabel
   *
   * @description
   * The heading: the first and last weekdays shown with the year (`Nov 23 – Dec 4, 2026`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly rangeLabel: Signal<string> = computed((): string => {
    const days: readonly string[] = this.workload.days();
    return new Intl.DateTimeFormat(this.locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .formatRange(toLocalDate(days[0]), toLocalDate(days[days.length - 1]))
      .replace(/\s*[–-]\s*/u, ' – ');
  });

  /**
   * Property gridLabel
   *
   * @description
   * Accessible name of the grid: the weeks shown and the daily capacity.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly gridLabel: Signal<string> = computed((): string => {
    const days: readonly string[] = this.workload.days();
    const start: string = this.longDay(days[0]);
    const end: string = this.longDay(days[days.length - 1]);
    const capacity: string = this.hours(DAY_CAPACITY_HOURS);
    return $localize`:@@spaces.workload.grid:Workload from ${start}:start: to ${end}:end:, capacity ${capacity}:capacity: a day`;
  });

  /**
   * Property refreshFailed
   *
   * @description
   * Whether a refresh of the workload or of the list's tasks failed while the grid shows the last
   * answer.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly refreshFailed: Signal<boolean> = computed(
    (): boolean =>
      (this.workload.hasCurrentSnapshot() && this.workload.primary.error() !== undefined) ||
      (this.tasks.hasCurrentSnapshot() && this.tasks.primary.error() !== undefined),
  );

  /**
   * Property capCount
   *
   * @description
   * The task reader's cap (`LIST_TASKS_CAP`), written in the application locale.
   *
   * @type {string}
   * @readonly
   */
  private readonly capCount: string = new Intl.NumberFormat(this.locale).format(LIST_TASKS_CAP);

  /**
   * Property truncatedText
   *
   * @description
   * The notice shown when the task reader stopped at its cap: the tasks past it have no menu and
   * no drag.
   *
   * @type {string}
   * @readonly
   */
  protected readonly truncatedText: string = $localize`:@@spaces.workload.truncated:Tasks past the first ${this.capCount}:count: cannot be reassigned from this view.`;

  /**
   * Property suppressClick
   *
   * @description
   * Set while the click that ends a drag arrives, so a dropped chip does not open its task.
   *
   * @type {boolean}
   */
  private suppressClick: boolean = false;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the list's tasks and the workload with the view's query, publishes the tasks' summary
   * to the tools and makes `N` create in this list while the view lives. A failed first read is
   * retried when the error boundary runs the route again.
   *
   * @constructor
   */
  public constructor() {
    if (this.workload.primary.error()) this.workload.primary.reload();
    if (this.tasks.primary.error()) this.tasks.primary.reload();
    const read: Signal<WorkloadRead> = computed((): WorkloadRead => ({
      listId: this.listId(),
      query: this.view.taskQuery(),
    }));
    this.tasks.load(read);
    this.workload.load(read);
    this.view.followRows(this.tasks.summary);
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), this.destroyRef);
  }
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens the detail of a chip's or a popover line's task over the view, the task as shown as
   * the header's preview; not for the click that ends a drag.
   *
   * @param {WorkloadEntry} entry - The task of the cell.
   */
  protected open(entry: WorkloadEntry): void {
    if (this.suppressClick) return;
    this.writes.open(entry.taskKey, entry.task ?? undefined);
  }

  /**
   * Method chipTitle
   *
   * @description
   * The tooltip of a chip: its key, name, hours that day and the drag hint; for a task past the
   * task reader's cap (not read, so without menu or drag), why it cannot be reassigned here.
   *
   * @param {WorkloadEntry} entry - The task of the cell.
   * @returns {string} The tooltip.
   */
  protected chipTitle(entry: WorkloadEntry): string {
    const key: string = entry.taskKey;
    const name: string = entry.name;
    const hours: string = this.hours(entry.minutes / 60);
    if (!entry.task) {
      const count: string = this.capCount;
      return $localize`:@@spaces.workload.chip-title-unread:${key}:key: · ${name}:name: · ${hours}:hours: that day · past the first ${count}:count: tasks, it cannot be reassigned from this view`;
    }
    return $localize`:@@spaces.workload.chip-title:${key}:key: · ${name}:name: · ${hours}:hours: that day · drag to another person to reassign`;
  }

  /**
   * Method spentLabel
   *
   * @description
   * The time a person recorded on the list over the two weeks (`Spent: 3 h 05`), or
   * `No time logged`.
   *
   * @param {string} userId - The person.
   * @returns {string} The line.
   */
  protected spentLabel(userId: string): string {
    const minutes: number = this.workload.spent.hasValue()
      ? (this.workload.spent.value()[userId] ?? 0)
      : 0;
    if (minutes <= 0) return $localize`:@@spaces.workload.no-time:No time logged`;
    const whole: number = Math.floor(minutes / 60);
    const rest: number = Math.round(minutes % 60);
    const pad: string = String(rest).padStart(2, '0');
    const duration: string =
      whole === 0
        ? $localize`:@@spaces.workload.minutes:${rest}:minutes: min`
        : rest === 0
          ? this.hours(whole)
          : $localize`:@@spaces.workload.hours-minutes:${whole}:hours: h ${pad}:minutes:`;
    return $localize`:@@spaces.workload.spent:Spent: ${duration}:duration:`;
  }

  /**
   * Method openMenu
   *
   * @description
   * Remembers the task whose menu opens.
   *
   * @param {WorkloadEntry} entry - The task of the cell.
   */
  protected openMenu(entry: WorkloadEntry): void {
    this.menuTask.set(entry.task);
  }

  /**
   * Method dragStarted
   *
   * @description
   * A chip starts dragging: it lets the pointer through to the rows under it.
   *
   * @param {WorkloadEntry} entry - The dragged task.
   */
  protected dragStarted(entry: WorkloadEntry): void {
    this.dragging.set(entry.taskKey);
  }

  /**
   * Method dragEnded
   *
   * @description
   * A chip is dropped: on another row of the grid, the task is reassigned from the chip's row to
   * that row; anywhere else, nothing changes. The chip goes back to its place either way, and
   * moves with the task once reassigned.
   *
   * @param {CdkDragEnd} event - The end of the drag.
   * @param {WorkloadEntry} entry - The dragged task.
   * @param {CwHeatGridRow<WorkloadEntry>} row - The row it was dragged from.
   */
  protected dragEnded(
    event: CdkDragEnd,
    entry: WorkloadEntry,
    row: CwHeatGridRow<WorkloadEntry>,
  ): void {
    const target: string | null =
      this.document
        .elementFromPoint(event.dropPoint.x, event.dropPoint.y)
        ?.closest('[data-cw-row]')
        ?.getAttribute('data-cw-row') ?? null;
    event.source.reset();
    this.dragging.set(null);
    this.suppressClick = true;
    setTimeout((): void => {
      this.suppressClick = false;
    });
    const to: CwHeatGridRow<WorkloadEntry> | undefined = this.rows().find(
      (candidate: CwHeatGridRow<WorkloadEntry>): boolean => candidate.key === target,
    );
    if (!to || to.key === row.key || !entry.task) return;
    void this.workload.reassign({
      task: entry.task,
      from: row.key === UNASSIGNED_ROW ? null : row.key,
      to: to.key === UNASSIGNED_ROW ? null : to.key,
      fromName: row.label,
      toName: to.label,
    });
  }

  /**
   * Method retry
   *
   * @description
   * Reads the workload and the list's tasks again after a failed refresh.
   */
  protected retry(): void {
    this.tasks.reload();
    this.workload.reload();
  }

  /**
   * Method longDay
   *
   * @description
   * A day written in full (`Monday, November 23`; `longDay` of `App.dc.html`).
   *
   * @param {string} date - The day, `YYYY-MM-DD`.
   * @returns {string} The day.
   */
  private longDay(date: string): string {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(toLocalDate(date));
  }
  // #endregion
}
