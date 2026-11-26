import { BreakpointObserver } from '@angular/cdk/layout';
import { formatNumber } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  type InputSignal,
  LOCALE_ID,
  type Signal,
  signal,
  viewChild,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { PriorityKey, StatusKey } from '@cadenway/contracts';
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
  CwMenu,
  CwMenuItem,
  CwMenuItemRadio,
  CwMenuLabel,
  CwMenuRadioGroup,
  CwMenuSeparator,
  CwMenuTriggerFor,
} from '@cadenway/ui/components/menu';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import {
  CwTimeline,
  type CwTimelineItem,
  type CwTimelineItemChange,
  CwTimelineNameDef,
  type CwTimelineRange,
  type CwTimelineScale,
  type CwTimelineSchedule,
} from '@cadenway/ui/components/timeline';
import { CwToastService } from '@cadenway/ui/components/toast';
import { CwToggleGroup, CwToggleGroupItem } from '@cadenway/ui/components/toggle-group';
import { NgIcon } from '@ng-icons/core';
import { map } from 'rxjs';

import {
  type Person,
  PRIORITY_LABELS,
  type StatusOption,
  TaskCancelDialog,
  TaskCreate,
  type TaskSummary,
} from '@features/task';

import {
  GANTT_TIMELINE_LABELS,
  ganttPeriodTitle,
  ganttRescheduledText,
  ganttScaleLabels,
} from '../../../constants/gantt-labels/gantt-labels.constants';
import type {
  GanttGroupOption,
  GanttGrouping,
  GanttParent,
  GanttTimeline,
} from '../../../models/gantt-timeline/gantt-timeline.interface';
import type { ListTaskItem, ListTasksRead } from '../../../models/list-tasks/list-tasks.interface';
import type { SubtaskMode } from '../../../models/list-view-config/list-view-config.interface';
import type { TaskFieldChanges } from '../../../models/view-task-write/view-task-write.interface';
import {
  GanttViewStore,
  type GanttViewStoreInstance,
} from '../../../state/gantt-view/gantt-view.store';
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
import { todayIso } from '../../../utils/calendar-date/calendar-date.util';
import {
  addDays,
  daysBetween,
  GANTT_SCHEDULE_DAYS,
  ganttTimelineOf,
} from '../../../utils/gantt-timeline/gantt-timeline.util';
import { NO_ASSIGNEE_GROUP } from '../../../utils/list-rows/list-rows.util';
import { TaskMenu } from '../../components/task-menu/task-menu.component';

/**
 * Constant PRIORITY_ORDER
 *
 * @description
 * The priority groups, most urgent first.
 *
 * @type {readonly PriorityKey[]}
 */
const PRIORITY_ORDER: readonly PriorityKey[] = ['urgente', 'haute', 'moyenne', 'basse'];

/**
 * Constant NAME_WIDTH
 *
 * @description
 * Width of the name column in pixels: the mockup's `w-72`, and `w-44` under 768 px.
 *
 * @type {{ readonly wide: number; readonly narrow: number }}
 */
const NAME_WIDTH: { readonly wide: number; readonly narrow: number } = { wide: 288, narrow: 176 };

/**
 * Interface ScaleOption
 *
 * @description
 * A scale of the scale radios and of the menu's `Scale`.
 */
interface ScaleOption {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The scale.
   *
   * @type {CwTimelineScale}
   * @readonly
   */
  readonly value: CwTimelineScale;

  /**
   * Property label
   *
   * @description
   * Its name.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;
  // #endregion
}

/**
 * Function isScale
 *
 * @description
 * Whether a value picked in the scale radios is a scale.
 *
 * @param {unknown} value - The value.
 * @returns {boolean} Whether it is `day`, `week` or `month`.
 */
function isScale(value: unknown): value is CwTimelineScale {
  return value === 'day' || value === 'week' || value === 'month';
}

/**
 * Component GanttViewPage
 *
 * @description
 * The `Gantt` view at `/:org/l/:listId/gantt` (`App.dc.html` lines 830-956, 6417-6600,
 * 9223-9280), below the list frame: every task of the list with the view's query at every
 * level (`ListTasksStore`, without a due window) on `cw-timeline`, grouped by the view's
 * `groupBy` (one `All tasks` group without it; `Cancelled` folded by status), each subtask right
 * after its parent and indented unless the view shows subtasks apart, each with its status, name,
 * key and duration, its bar filled with its progress (`taskProgress`), and the dated milestones
 * as full-height lines. The toolbar shows the period, the hint, the scale radios, zoom out and in
 * along `GANTT_ZOOM_LADDER` with the scale and zoom, `Fit` (`cw-timeline`'s `fit()`, or
 * `Nothing to fit` without a dated task), `Today` and the previous and next periods; the scale,
 * period and folded groups live in `GanttViewStore`. Moving or resizing a bar, the arrow keys
 * and `Schedule` (three days from the day under the pointer or today; one for a milestone)
 * write the start and due dates through `ViewTaskWritesStore.updateFields`, with the toast
 * `<key> rescheduled` and its `Undo`; a milestone keeps a single day. A name opens the task;
 * Enter or a double click on a bar does too. A right click, the Menu key or Shift F10 on a task
 * row opens the shared task menu; elsewhere in the chart, the chart's menu (`Go to today`,
 * `Scale`, `New task`). A first read shows the timeline's skeleton; a failed one reaches the
 * route's error boundary, whose `Retry` runs the route again; a failed refresh keeps the chart
 * under an inline error whose `Retry` reads again; a read without a task shows the timeline's
 * empty text; a read stopped at `LIST_TASKS_CAP` says only the first tasks are shown, and `Fit`
 * then speaks of the tasks shown. Dependencies are not drawn: they can only be read task by task
 * (G5).
 */
@Component({
  selector: 'cw-gantt-view-page',
  imports: [
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwContextMenuTriggerFor,
    CwMenu,
    CwMenuItem,
    CwMenuItemRadio,
    CwMenuLabel,
    CwMenuRadioGroup,
    CwMenuSeparator,
    CwMenuTriggerFor,
    CwStatusIcon,
    CwTimeline,
    CwTimelineNameDef,
    CwToggleGroup,
    CwToggleGroupItem,
    NgIcon,
    TaskCancelDialog,
    TaskMenu,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [
    ViewTaskWritesStore,
    { provide: VIEW_TASK_WRITER, useExisting: ListTasksStore },
    GANTT_TIMELINE_LABELS,
  ],
  templateUrl: './gantt-view-page.component.html',
})
export class GanttViewPage {
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
   * Property tasks
   *
   * @description
   * The tasks of the list with the view's query, and their writes.
   *
   * @type {ListTasksStoreInstance}
   * @readonly
   */
  protected readonly tasks: ListTasksStoreInstance = inject(ListTasksStore);

  /**
   * Property gantt
   *
   * @description
   * The scale, period and folded groups.
   *
   * @type {GanttViewStoreInstance}
   * @readonly
   */
  protected readonly gantt: GanttViewStoreInstance = inject(GanttViewStore);

  /**
   * Property writes
   *
   * @description
   * The writes of the task menu and of the bars, with their toasts and confirmations.
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

  /**
   * Property scales
   *
   * @description
   * The scales, finest first.
   *
   * @type {readonly ScaleOption[]}
   * @readonly
   */
  protected readonly scales: readonly ScaleOption[] = ((): readonly ScaleOption[] => {
    const labels: Readonly<Record<CwTimelineScale, string>> = ganttScaleLabels();
    return (['day', 'week', 'month'] as const).map((value: CwTimelineScale): ScaleOption => ({
      value,
      label: labels[value],
    }));
  })();

  /**
   * Property zoomOutLabel
   *
   * @description
   * Name of the zoom-out button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly zoomOutLabel: string = $localize`:@@spaces.gantt.zoom-out:Zoom out (Ctrl −)`;

  /**
   * Property zoomInLabel
   *
   * @description
   * Name of the zoom-in button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly zoomInLabel: string = $localize`:@@spaces.gantt.zoom-in:Zoom in (Ctrl +)`;

  /**
   * Property retryLabel
   *
   * @description
   * Label of the inline refresh error's button.
   *
   * @type {string}
   * @readonly
   */
  protected readonly retryLabel: string = $localize`:@@spaces.retry:Retry`;

  /**
   * Property truncatedText
   *
   * @description
   * What the chart says when the read stopped at `LIST_TASKS_CAP` with tasks left out.
   *
   * @type {string}
   * @readonly
   */
  protected readonly truncatedText: string = ((count: string): string =>
    $localize`:@@spaces.gantt.truncated:Only the first ${count}:count: tasks are shown.`)(
    formatNumber(LIST_TASKS_CAP, inject(LOCALE_ID)),
  );

  /**
   * Property nameWidth
   *
   * @description
   * Width of the name column in pixels, narrower under 768 px.
   *
   * @type {Signal<number>}
   * @readonly
   */
  protected readonly nameWidth: Signal<number> = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => (state.matches ? NAME_WIDTH.narrow : NAME_WIDTH.wide))),
    { initialValue: NAME_WIDTH.wide },
  );

  /**
   * Property grouping
   *
   * @description
   * What the group rows follow: the view's `groupBy`, or one `All tasks` group.
   *
   * @type {Signal<GanttGrouping>}
   * @readonly
   */
  protected readonly grouping: Signal<GanttGrouping> = computed(
    (): GanttGrouping => this.view.config().groupBy ?? 'all',
  );

  /**
   * Property chart
   *
   * @description
   * The items, groups and milestone lines of the tasks shown: each subtask right after its
   * parent, indented, unless the view shows subtasks apart; the subtasks of a folded parent left
   * out.
   *
   * @type {Signal<GanttTimeline>}
   * @readonly
   */
  protected readonly chart: Signal<GanttTimeline> = computed((): GanttTimeline =>
    ganttTimelineOf(
      this.tasks.items(),
      this.grouping(),
      this.groupOptions(),
      (value: string): string => value,
      this.subtasksOpen(),
    ),
  );

  /**
   * Property subtasksOpen
   *
   * @description
   * Whether a parent's subtasks show under it: as the user folded or unfolded them, else folded
   * (`Folded under their parent`, the default) or unfolded (`Unfolded under their parent`);
   * null when the view shows subtasks apart, as tasks.
   *
   * @type {Signal<((taskKey: string) => boolean) | null>}
   * @readonly
   */
  private readonly subtasksOpen: Signal<((taskKey: string) => boolean) | null> = computed(
    (): ((taskKey: string) => boolean) | null => {
      const mode: SubtaskMode = this.view.config().subtasks;
      if (mode === 'separate') return null;
      return (taskKey: string): boolean => this.gantt.subtasksOpen(taskKey, mode === 'expanded');
    },
  );

  /**
   * Property collapsed
   *
   * @description
   * The folded groups of the current grouping.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  protected readonly collapsed: Signal<readonly string[]> = computed((): readonly string[] =>
    this.gantt.collapsedOf(this.grouping()),
  );

  /**
   * Property periodTitle
   *
   * @description
   * The period shown, as the toolbar's title.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly periodTitle: Signal<string> = computed((): string => {
    const window: CwTimelineRange = this.gantt.window();
    return ganttPeriodTitle(window.start, window.end, this.locale);
  });

  /**
   * Property zoomLevel
   *
   * @description
   * The scale and zoom, beside the zoom buttons (`Day · 150%`).
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly zoomLevel: Signal<string> = computed((): string => {
    const scale: string =
      this.scales.find((option: ScaleOption): boolean => option.value === this.gantt.scale())
        ?.label ?? '';
    const percent: number = Math.round(this.gantt.zoom() * 100);
    return $localize`:@@spaces.gantt.zoom-level:${scale}:scale: · ${percent}:percent:%`;
  });

  /**
   * Property fitLabel
   *
   * @description
   * The tooltip of `Fit`, with the dated tasks it fits; only those shown when the read stopped
   * at the cap.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly fitLabel: Signal<string> = computed((): string => {
    const count: number = this.chart().datedCount;
    return this.tasks.truncated()
      ? $localize`:@@spaces.gantt.fit-title-truncated:Fit to the ${count}:count: dated tasks shown`
      : $localize`:@@spaces.gantt.fit-title:Fit to the ${count}:count: dated tasks`;
  });

  /**
   * Property previousLabel
   *
   * @description
   * Name of the previous-period button: a week by day, a period otherwise.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly previousLabel: Signal<string> = computed((): string =>
    this.gantt.scale() === 'day'
      ? $localize`:@@spaces.gantt.previous-week:Previous week`
      : $localize`:@@spaces.gantt.previous-period:Previous period`,
  );

  /**
   * Property nextLabel
   *
   * @description
   * Name of the next-period button: a week by day, a period otherwise.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly nextLabel: Signal<string> = computed((): string =>
    this.gantt.scale() === 'day'
      ? $localize`:@@spaces.gantt.next-week:Next week`
      : $localize`:@@spaces.gantt.next-period:Next period`,
  );

  /**
   * Property menuItem
   *
   * @description
   * The timeline item whose task menu is open.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuItem: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuTasks
   *
   * @description
   * What the task menu acts on: the task of its row, as shown.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const id: string | null = this.menuItem();
      const item: ListTaskItem | undefined = id === null ? undefined : this.chart().tasks.get(id);
      return item ? [item.task] : [];
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
    const id: string | null = this.menuItem();
    return (id === null ? undefined : this.chart().tasks.get(id))?.status ?? null;
  });

  /**
   * Property menuMilestone
   *
   * @description
   * Whether the menu's task is a milestone, which offers a milestone's four statuses.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  protected readonly menuMilestone: Signal<boolean> = computed((): boolean =>
    this.menuTasks().some((task: TaskSummary): boolean => task.milestone),
  );

  /**
   * Property scheduleLabel
   *
   * @description
   * `Schedule` in an undated row's menu, the timeline's button text.
   *
   * @type {string}
   * @readonly
   */
  protected readonly scheduleLabel: string = $localize`:@@spaces.gantt.schedule:Schedule`;

  /**
   * Property menuTitle
   *
   * @description
   * The title of a row menu, as the task menu writes it: `CAD-482 · <name>`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  protected readonly menuTitle: Signal<string> = computed((): string => {
    const task: TaskSummary | undefined = this.menuTasks().at(0);
    return task ? `${task.key} · ${task.name}` : '';
  });

  /**
   * Property timeline
   *
   * @description
   * The timeline, for `Fit`.
   *
   * @type {Signal<CwTimeline | undefined>}
   * @readonly
   */
  private readonly timeline: Signal<CwTimeline | undefined> = viewChild(CwTimeline);

  /**
   * Property view
   *
   * @description
   * The view configuration: the query read and the grouping.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  private readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property taskCreate
   *
   * @description
   * Task creation, for the chart menu's `New task` and `N` in this list.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property toasts
   *
   * @description
   * Toasts, for `Nothing to fit`.
   *
   * @type {CwToastService}
   * @readonly
   */
  private readonly toasts: CwToastService = inject(CwToastService);

  /**
   * Property locale
   *
   * @description
   * The locale of the dates.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property destroyRef
   *
   * @description
   * The page's lifetime.
   *
   * @type {DestroyRef}
   * @readonly
   */
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /**
   * Property host
   *
   * @description
   * The page element, which hands a task row's menu to its name.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property groupOptions
   *
   * @description
   * The groups of the current grouping, in order: the space's statuses, the priorities, the
   * people then `Unassigned`, or `All tasks`.
   *
   * @type {Signal<readonly GanttGroupOption[]>}
   * @readonly
   */
  private readonly groupOptions: Signal<readonly GanttGroupOption[]> = computed(
    (): readonly GanttGroupOption[] => {
      switch (this.grouping()) {
        case 'status':
          return this.writes.statusOptions().map((option: StatusOption): GanttGroupOption => ({
            value: option.key,
            label: option.label,
          }));
        case 'priority':
          return PRIORITY_ORDER.map((priority: PriorityKey): GanttGroupOption => ({
            value: priority,
            label: PRIORITY_LABELS[priority],
          }));
        case 'assignee':
          return [
            ...this.writes.people().map((person: Person): GanttGroupOption => ({
              value: person.id,
              label: person.name,
            })),
            { value: NO_ASSIGNEE_GROUP, label: $localize`:@@spaces.rows.unassigned:Unassigned` },
          ];
        case 'all':
          return [{ value: 'all', label: $localize`:@@spaces.rows.all:All tasks` }];
      }
    },
  );
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads every task of the list, subtasks included, with the view's query, publishes the count
   * to the view tools, makes `N` create in this list while the view lives and hands a task row's
   * menu to its name.
   * A failed first read is retried when the error boundary runs the route again.
   *
   * @constructor
   */
  public constructor() {
    if (this.tasks.primary.error()) this.tasks.primary.reload();
    this.tasks.load(
      computed((): ListTasksRead => ({
        listId: this.listId(),
        query: { ...this.view.taskQuery(), level: 'all' },
        due: null,
      })),
    );
    this.view.followRows(this.tasks.summary);
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), this.destroyRef);
    const element: HTMLElement = this.host.nativeElement;
    const delegate: (event: Event) => void = (event: Event): void => {
      this.openUndatedOnEnter(event);
      this.delegateRowMenu(event);
    };
    element.addEventListener('contextmenu', delegate, true);
    element.addEventListener('keydown', delegate, true);
    this.destroyRef.onDestroy((): void => {
      element.removeEventListener('contextmenu', delegate, true);
      element.removeEventListener('keydown', delegate, true);
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method itemOf
   *
   * @description
   * The task an item shows.
   *
   * @param {string} id - The item id.
   * @returns {ListTaskItem | undefined} The task, as shown.
   */
  protected itemOf(id: string): ListTaskItem | undefined {
    return this.chart().tasks.get(id);
  }

  /**
   * Method depthOf
   *
   * @description
   * How deep an item sits under its parents, for its indent.
   *
   * @param {string} id - The item id.
   * @returns {number} The depth, 0 for a top-level task.
   */
  protected depthOf(id: string): number {
    return this.chart().depths.get(id) ?? 0;
  }

  /**
   * Method parentOf
   *
   * @description
   * The subtasks under an item's task, for its chevron.
   *
   * @param {string} id - The item id.
   * @returns {GanttParent | undefined} Whether they show and how many, undefined without any.
   */
  protected parentOf(id: string): GanttParent | undefined {
    return this.chart().parents.get(id);
  }

  /**
   * Method nesting
   *
   * @description
   * Whether subtasks show under their parent, so rows keep the chevron's room.
   *
   * @returns {boolean} Whether they do.
   */
  protected nesting(): boolean {
    return this.subtasksOpen() !== null;
  }

  /**
   * Method subtasksLabel
   *
   * @description
   * Name of a parent's chevron, the `List` view's: `Show the 2 subtasks of CAD-482`.
   *
   * @param {string} id - The item id.
   * @returns {string} The name.
   */
  protected subtasksLabel(id: string): string {
    const parent: GanttParent | undefined = this.parentOf(id);
    const count: number = parent?.count ?? 0;
    const key: string = this.itemOf(id)?.task.key ?? '';
    return parent?.open
      ? $localize`:@@spaces.rows.hide-subtasks:Hide the ${count}:count: subtasks of ${key}:key:`
      : $localize`:@@spaces.rows.show-subtasks:Show the ${count}:count: subtasks of ${key}:key:`;
  }

  /**
   * Method toggleMenuSubtasks
   *
   * @description
   * `Show the n subtasks` / `Hide the n subtasks` of a parent row's menu: the chevron's toggle,
   * for the keyboard.
   */
  protected toggleMenuSubtasks(): void {
    const id: string | null = this.menuItem();
    if (id !== null) this.toggleSubtasks(id);
  }

  /**
   * Method toggleSubtasks
   *
   * @description
   * Folds or unfolds the subtasks of an item's task, kept while the view lives.
   *
   * @param {string} id - The item id.
   */
  protected toggleSubtasks(id: string): void {
    const parent: GanttParent | undefined = this.parentOf(id);
    const shown: ListTaskItem | undefined = this.itemOf(id);
    if (parent && shown) this.gantt.setSubtasksOpen(shown.task.key, !parent.open);
  }

  /**
   * Method open
   *
   * @description
   * Opens an item's task over the view.
   *
   * @param {CwTimelineItem} item - The item.
   */
  protected open(item: CwTimelineItem): void {
    const shown: ListTaskItem | undefined = this.itemOf(item.id);
    if (shown) this.writes.open(shown.task.key, shown.task);
  }

  /**
   * Method reschedule
   *
   * @description
   * A bar moved or resized, by pointer or keyboard: writes only what changed, so a start the
   * bar does not show is neither wiped nor invented. `updateTask` moves an existing start by as
   * many days as a new due date and keeps the duration, unless the patch sets `startDate` too
   * (`cadenway-api-contracts`, `openapi/public/tasks.yaml`, `updateTask`, `dueDate`):
   * - a move sends the new due date alone, and the start follows on the gateway;
   * - a milestone holds one day: the edge that moved becomes its due date, alone;
   * - a resized start sends the new start alone;
   * - a resized end sends the new due date with the start shown, so that the start stays (a task
   *   without a start date gets the day its bar started from, the range the user drew).
   *
   * @param {CwTimelineItemChange} change - The new days.
   */
  protected reschedule(change: CwTimelineItemChange): void {
    const shown: ListTaskItem | undefined = this.itemOf(change.item.id);
    if (!shown) return;
    const task: TaskSummary = shown.task;
    const startShift: number = daysBetween(change.previous.start, change.start);
    const endShift: number = daysBetween(change.previous.end, change.end);
    if (startShift === 0 && endShift === 0) return;
    if (task.milestone) {
      const day: Date = startShift !== 0 ? change.start : change.end;
      this.write(task, { dueDate: todayIso(day) }, day, day);
      return;
    }
    const startDate: string = todayIso(change.start);
    const dueDate: string = todayIso(change.end);
    let changes: TaskFieldChanges;
    if (startShift === endShift) changes = { dueDate };
    else if (endShift === 0) changes = { startDate };
    else changes = { startDate, dueDate };
    this.write(task, changes, change.start, change.end);
  }

  /**
   * Method schedule
   *
   * @description
   * The `Schedule` button of an undated task: three days from the day given (one for a
   * milestone).
   *
   * @param {CwTimelineSchedule} event - The task and its first day.
   */
  protected schedule(event: CwTimelineSchedule): void {
    const shown: ListTaskItem | undefined = this.itemOf(event.item.id);
    if (shown) this.scheduleFrom(shown.task, event.start);
  }

  /**
   * Method scheduleFromMenu
   *
   * @description
   * `Schedule` in an undated row's menu, the keyboard's way to the button: three days from today
   * (one for a milestone), as the button without a pointer gives.
   */
  protected scheduleFromMenu(): void {
    const id: string | null = this.menuItem();
    const shown: ListTaskItem | undefined = id === null ? undefined : this.itemOf(id);
    if (shown?.task.due === null) this.scheduleFrom(shown.task, this.gantt.today());
  }

  /**
   * Method fit
   *
   * @description
   * `Fit`: the period and scale of the dated tasks, or `Nothing to fit` without one.
   */
  protected fit(): void {
    if (this.timeline()?.fit()) return;
    this.toasts.show($localize`:@@spaces.gantt.nothing-to-fit:Nothing to fit`, {
      description: this.tasks.truncated()
        ? $localize`:@@spaces.gantt.nothing-to-fit-truncated:No dated task among the tasks shown.`
        : $localize`:@@spaces.gantt.nothing-to-fit-text:No dated task in this list.`,
    });
  }

  /**
   * Method pickScale
   *
   * @description
   * A scale picked in the radios or the chart menu.
   *
   * @param {unknown} value - The picked value.
   */
  protected pickScale(value: unknown): void {
    if (isScale(value)) this.gantt.pickScale(value);
  }

  /**
   * Method create
   *
   * @description
   * The chart menu's `New task`, in this list.
   */
  protected create(): void {
    this.taskCreate.open({ listId: this.listId() });
  }

  /**
   * Method scheduleFrom
   *
   * @description
   * Gives an undated task three days from a day (a milestone: that day alone).
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {Date} start - Its first day.
   */
  private scheduleFrom(task: TaskSummary, start: Date): void {
    if (task.milestone) {
      this.write(task, { dueDate: todayIso(start) }, start, start);
      return;
    }
    const end: Date = addDays(start, GANTT_SCHEDULE_DAYS - 1);
    this.write(task, { startDate: todayIso(start), dueDate: todayIso(end) }, start, end);
  }

  /**
   * Method write
   *
   * @description
   * Writes a task's dates with the toast `<key> rescheduled` and its `Undo`, unless they are the
   * task's already.
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {TaskFieldChanges} changes - The dates to send.
   * @param {Date} start - First day the bar shows once written, for the toast.
   * @param {Date} end - Last day the bar shows once written, for the toast.
   */
  private write(task: TaskSummary, changes: TaskFieldChanges, start: Date, end: Date): void {
    if (
      (changes.dueDate === undefined || changes.dueDate === task.due) &&
      (changes.startDate === undefined || changes.startDate === task.start)
    ) {
      return;
    }
    const key: string = task.key;
    void this.writes.updateFields(task, changes, {
      title: $localize`:@@spaces.gantt.rescheduled:${key}:key: rescheduled`,
      description: ganttRescheduledText(start, end, this.locale),
    });
  }

  /**
   * Method openUndatedOnEnter
   *
   * @description
   * Enter on an undated task row opens the task, as on any other row: `cw-timeline` would
   * schedule it instead, so the key stops here, in the capture phase. Scheduling stays on the
   * row's `Schedule` button.
   *
   * @param {Event} event - A `keydown` or `contextmenu` event inside the view.
   */
  private openUndatedOnEnter(event: Event): void {
    if (
      !(event instanceof KeyboardEvent) ||
      event.key !== 'Enter' ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const target: EventTarget | null = event.target;
    if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'row') return;
    const name: HTMLElement | null = target.querySelector<HTMLElement>(
      '[data-row-menu][data-undated]',
    );
    if (!name) return;
    event.preventDefault();
    event.stopPropagation();
    name.click();
  }

  /**
   * Method delegateRowMenu
   *
   * @description
   * Makes a whole task row open its menu, as the mockup's bars and names do (`App.dc.html`
   * lines 897, 909): a right click, the Menu key or Shift F10 on a bar or anywhere in a task row
   * is handed to the row's name, which holds the menu's trigger (the task menu, or for a parent
   * or an undated task the row menu with `Schedule`, `Show` / `Hide the n subtasks` and the task
   * menu as a submenu), and the chart menu does not open. Elsewhere (a group row, the empty chart) the event goes on to the chart menu. Runs in
   * the capture phase, since `cw-timeline` offers no item menu.
   *
   * @param {Event} event - A `contextmenu` or `keydown` event inside the view.
   */
  private delegateRowMenu(event: Event): void {
    if (event.defaultPrevented) return;
    if (
      event instanceof KeyboardEvent &&
      !(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
    ) {
      return;
    }
    const target: EventTarget | null = event.target;
    if (!(target instanceof Element) || target.closest('[data-row-menu]')) return;
    const trigger: HTMLElement | null | undefined = target
      .closest('[role="row"]')
      ?.querySelector<HTMLElement>('[data-row-menu]');
    if (!trigger) return;
    event.preventDefault();
    trigger.dispatchEvent(
      event instanceof KeyboardEvent
        ? new KeyboardEvent('keydown', {
            key: event.key,
            shiftKey: event.shiftKey,
            bubbles: true,
            cancelable: true,
          })
        : new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: event instanceof MouseEvent ? event.clientX : 0,
            clientY: event instanceof MouseEvent ? event.clientY : 0,
          }),
    );
  }
  // #endregion
}
