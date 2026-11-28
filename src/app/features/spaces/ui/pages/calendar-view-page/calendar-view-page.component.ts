import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { OverlayContainer } from '@angular/cdk/overlay';
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
import type { StatusKey } from '@cadenway/contracts';
import {
  CwAlertDialog,
  CwAlertDialogAction,
  CwAlertDialogCancel,
  CwAlertDialogDescription,
  CwAlertDialogTitle,
} from '@cadenway/ui/components/alert-dialog';
import { CwButton } from '@cadenway/ui/components/button';
import {
  type CwCalendarDayMenuData,
  CwCalendarItemDef,
  type CwCalendarItemMove,
  type CwCalendarItemSchedule,
  type CwCalendarSpan,
  CwCalendarView,
  type CwCalendarViewProvidedLabels,
  provideCwCalendarViewLabels,
} from '@cadenway/ui/components/calendar-view';
import { CwContextMenuTriggerFor } from '@cadenway/ui/components/context-menu';
import { CwMenu, CwMenuItem, CwMenuLabel } from '@cadenway/ui/components/menu';
import { CwSkeleton } from '@cadenway/ui/components/skeleton';
import { CwStatusIcon } from '@cadenway/ui/components/status-icon';
import { NgIcon } from '@ng-icons/core';

import {
  TaskCancelDialog,
  TaskCreate,
  TaskDetailOpener,
  TaskMenu,
  type TaskSummary,
} from '@features/task';

import { SPACES_RETRY } from '../../../constants/data-table-texts/data-table-texts.constants';
import type { CalendarRead } from '../../../models/calendar-view/calendar-view.interface';
import type { ListTaskItem } from '../../../models/list-tasks/list-tasks.interface';
import type { TaskFieldChanges } from '../../../models/view-task-write/view-task-write.interface';
import {
  CalendarViewStore,
  type CalendarViewStoreInstance,
} from '../../../state/calendar-view/calendar-view.store';
import { LIST_TASKS_CAP } from '../../../state/list-tasks/list-tasks.store';
import { ListViewStore } from '../../../state/list-view/list-view.store';
import {
  ViewTaskWritesStore,
  type ViewTaskWritesStoreInstance,
} from '../../../state/view-task-writes/view-task-writes.store';
import { VIEW_TASK_WRITER } from '../../../state/view-task-writes/view-task-writer.token';
import { todayIso, toLocalDate } from '../../../utils/calendar-date/calendar-date.util';
import { formatLongDay, rescheduleChanges } from '../../../utils/calendar-view/calendar-view.util';
import { TaskCard } from '../../components/task-card/task-card.component';

/**
 * Constant MAX_PER_DAY
 *
 * @description
 * Tasks a day of the month grid shows before `+N others` (`App.dc.html` line 6394).
 *
 * @type {number}
 */
const MAX_PER_DAY: number = 3;

/**
 * Constant SWALLOW_MS
 *
 * @description
 * Time after a keyboard opening of a task's menu during which the `contextmenu` event some
 * systems send for the same key is ignored, in milliseconds.
 *
 * @type {number}
 */
const SWALLOW_MS: number = 500;

/**
 * Constant COUNT_TOKEN
 *
 * @description
 * A token `cw-calendar-view` replaces in its texts; passed as a placeholder so the catalogs do
 * not read its braces as an ICU expression.
 *
 * @type {string}
 */
const COUNT_TOKEN: string = '{count}';

/**
 * Constant DATE_TOKEN
 *
 * @description
 * The day token of `cw-calendar-view`'s texts.
 *
 * @type {string}
 */
const DATE_TOKEN: string = '{date}';

/**
 * Constant ITEM_TOKEN
 *
 * @description
 * The task name token of `cw-calendar-view`'s texts.
 *
 * @type {string}
 */
const ITEM_TOKEN: string = '{item}';

/**
 * Constant FROM_TOKEN
 *
 * @description
 * The first day token of `cw-calendar-view`'s texts.
 *
 * @type {string}
 */
const FROM_TOKEN: string = '{from}';

/**
 * Constant TO_TOKEN
 *
 * @description
 * The last day token of `cw-calendar-view`'s texts.
 *
 * @type {string}
 */
const TO_TOKEN: string = '{to}';

/**
 * Function calendarLabels
 *
 * @description
 * The English texts of `cw-calendar-view`, whose defaults are French: the mockup's calendar
 * (`App.dc.html` lines 775-828, 6394-6408) and the brick's own texts for what the mockup does
 * not show (the week view, the day popover, the keyboard announcements).
 *
 * @returns {CwCalendarViewProvidedLabels} The texts.
 */
function calendarLabels(): CwCalendarViewProvidedLabels {
  return {
    ariaLabel: $localize`:@@spaces.calendar.region:Calendar`,
    today: $localize`:@@spaces.calendar.today:Today`,
    previousMonth: $localize`:@@spaces.calendar.previous-month:Previous month`,
    nextMonth: $localize`:@@spaces.calendar.next-month:Next month`,
    previousWeek: $localize`:@@spaces.calendar.previous-week:Previous week`,
    nextWeek: $localize`:@@spaces.calendar.next-week:Next week`,
    views: $localize`:@@spaces.calendar.views:View`,
    month: $localize`:@@spaces.calendar.month:Month`,
    week: $localize`:@@spaces.calendar.week:Week`,
    unscheduled: $localize`:@@spaces.calendar.unscheduled:No date`,
    allDay: $localize`:@@spaces.calendar.all-day:All day`,
    hour: $localize`:@@spaces.calendar.hour:Hour`,
    moreOne: $localize`:@@spaces.calendar.more-one:+${COUNT_TOKEN}:count: other`,
    moreOther: $localize`:@@spaces.calendar.more-other:+${COUNT_TOKEN}:count: others`,
    countOne: $localize`:@@spaces.calendar.count-one:${COUNT_TOKEN}:count: task`,
    countOther: $localize`:@@spaces.calendar.count-other:${COUNT_TOKEN}:count: tasks`,
    createOn: $localize`:@@spaces.calendar.create-on:Add a task on ${DATE_TOKEN}:date:`,
    addOn: $localize`:@@spaces.calendar.add-on:Add a task on ${DATE_TOKEN}:date:`,
    close: $localize`:@@spaces.calendar.close:Close`,
    weekGrid: $localize`:@@spaces.calendar.week-grid:Week of ${FROM_TOKEN}:from: to ${TO_TOKEN}:to:`,
    range: $localize`:@@spaces.calendar.range:${ITEM_TOKEN}:item:, from ${FROM_TOKEN}:from: to ${TO_TOKEN}:to:`,
    grabbed: $localize`:@@spaces.calendar.grabbed:${ITEM_TOKEN}:item: grabbed. Arrows to choose the day, Space to drop, Escape to cancel.`,
    moved: $localize`:@@spaces.calendar.moved:${ITEM_TOKEN}:item: moved to ${DATE_TOKEN}:date:`,
    cancelled: $localize`:@@spaces.calendar.cancelled:Move cancelled.`,
    loading: $localize`:@@spaces.calendar.loading:Loading the calendar`,
    scheduled: $localize`:@@spaces.calendar.scheduled:${ITEM_TOKEN}:item: rescheduled. Due: ${DATE_TOKEN}:date:.`,
    navigation: $localize`:@@spaces.calendar.navigation:Calendar navigation`,
  };
}

/**
 * Function isMenuGesture
 *
 * @description
 * Whether an event asks for a context menu: a right click (or a long press, which browsers
 * report the same way), the Menu key or Shift F10 without another modifier.
 *
 * @param {Event} event - A `contextmenu` or `keydown` event.
 * @returns {boolean} Whether it opens a menu.
 */
function isMenuGesture(event: Event): boolean {
  if (!(event instanceof KeyboardEvent)) return event.type === 'contextmenu';
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
}

/**
 * Component CalendarViewPage
 *
 * @description
 * The `Calendar` view at `/:org/l/:listId/calendar` (`App.dc.html` lines 775-828), below the
 * list frame: `cw-calendar-view`, a Monday-first month grid of six weeks (or one week) with at
 * most three tasks a day, then `+N others`, and the `No due date` panel beside it from 1280 px
 * (below it under, the grid keeping 720 px and scrolling across on a phone). It reads through
 * `CalendarViewStore` (the grid's due window and the unwindowed read of the panel) with the view's
 * query and publishes the summary to the tools. A task opens its detail on a click or Enter
 * (`TaskDetailOpener`); a right click, the Menu key or Shift F10 on a task, in the grid or the
 * panel, opens the task menu (`cw-task-menu`, through `ViewTaskWritesStore`). Dropping a task on
 * a day, with the pointer or the keyboard (Space, the arrows, Space), reschedules it: the panel's
 * tasks through `itemSchedule` (their drop list connects to the grid's days; Space calls
 * `scheduleWithKeyboard`), the grid's through `itemMove`. The task moves at once, and the toast
 * `<key> rescheduled` / `Due: <day>.` offers `Undo`; a refusal puts it back. A day's `+`, `N`
 * and its menu's `New task on that day` open Task's create dialog due that day; its menu's
 * `Go to today` shows today's month. The grid's first read shows its skeleton and fails to the
 * route's error boundary; a failed refresh shows an inline error with `Retry`. The panel is a
 * secondary read: skeleton, inline error with `Retry`, `All tasks have a due date.` when it has no
 * task, `No task` when the list has none at all.
 */
@Component({
  selector: 'cw-calendar-view-page',
  imports: [
    CdkDrag,
    CdkDropList,
    CwAlertDialog,
    CwAlertDialogAction,
    CwAlertDialogCancel,
    CwAlertDialogDescription,
    CwAlertDialogTitle,
    CwButton,
    CwCalendarItemDef,
    CwCalendarView,
    CwContextMenuTriggerFor,
    CwMenu,
    CwMenuItem,
    CwMenuLabel,
    CwSkeleton,
    CwStatusIcon,
    NgIcon,
    TaskCancelDialog,
    TaskCard,
    TaskMenu,
  ],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  providers: [
    ViewTaskWritesStore,
    { provide: VIEW_TASK_WRITER, useExisting: CalendarViewStore },
    provideCwCalendarViewLabels(calendarLabels),
  ],
  templateUrl: './calendar-view-page.component.html',
})
export class CalendarViewPage {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list shown, from the route.
   *
   * @type {InputSignal<string>}
   * @readonly
   */
  public readonly listId: InputSignal<string> = input.required<string>();

  /**
   * Property calendar
   *
   * @description
   * The shown period, the tasks of the grid and of the panel, and the writer of the view.
   *
   * @type {CalendarViewStoreInstance}
   * @readonly
   */
  protected readonly calendar: CalendarViewStoreInstance = inject(CalendarViewStore);

  /**
   * Property writes
   *
   * @description
   * The task menu's writes and the reschedules, with their toasts and confirmations,
   * page-scoped over the calendar (`VIEW_TASK_WRITER`).
   *
   * @type {ViewTaskWritesStoreInstance}
   * @readonly
   */
  protected readonly writes: ViewTaskWritesStoreInstance = inject(ViewTaskWritesStore);

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
   * Property loadingLabel
   *
   * @description
   * Accessible name of the panel's skeleton.
   *
   * @type {string}
   * @readonly
   */
  protected readonly loadingLabel: string = $localize`:@@spaces.calendar.loading:Loading the calendar`;

  /**
   * Property truncatedText
   *
   * @description
   * The notice of a grid read stopped at `LIST_TASKS_CAP`.
   *
   * @type {string}
   * @readonly
   */
  protected readonly truncatedText: string;

  /**
   * Property undatedTruncatedText
   *
   * @description
   * The panel's notice when the unwindowed read stopped at `LIST_TASKS_CAP`: undated tasks may
   * be missing, so it replaces `All tasks have a due date.`.
   *
   * @type {string}
   * @readonly
   */
  protected readonly undatedTruncatedText: string;

  /**
   * Property maxPerDay
   *
   * @description
   * Tasks a day of the month grid shows before `+N others`.
   *
   * @type {number}
   * @readonly
   */
  protected readonly maxPerDay: number = MAX_PER_DAY;

  /**
   * Property menuKey
   *
   * @description
   * Key of the task whose menu is open.
   *
   * @type {WritableSignal<string | null>}
   * @readonly
   */
  protected readonly menuKey: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Property menuItem
   *
   * @description
   * The task the menu acts on, as shown.
   *
   * @type {Signal<ListTaskItem | null>}
   * @readonly
   */
  protected readonly menuItem: Signal<ListTaskItem | null> = computed((): ListTaskItem | null => {
    const key: string | null = this.menuKey();
    return key === null ? null : (this.calendar.itemOf(key) ?? null);
  });

  /**
   * Property menuTasks
   *
   * @description
   * What the task menu acts on: the one task it was opened on.
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  protected readonly menuTasks: Signal<readonly TaskSummary[]> = computed(
    (): readonly TaskSummary[] => {
      const item: ListTaskItem | null = this.menuItem();
      return item ? [item.task] : [];
    },
  );

  /**
   * Property menuStatus
   *
   * @description
   * The status the task of the menu shows.
   *
   * @type {Signal<StatusKey | null>}
   * @readonly
   */
  protected readonly menuStatus: Signal<StatusKey | null> = computed(
    (): StatusKey | null => this.menuItem()?.status ?? null,
  );

  /**
   * Property trackBy
   *
   * @description
   * A task's id in the calendar: its key.
   *
   * @type {(item: ListTaskItem) => string}
   * @readonly
   */
  protected readonly trackBy: (item: ListTaskItem) => string = (item: ListTaskItem): string =>
    item.task.key;

  /**
   * Property itemLabel
   *
   * @description
   * A task's name, for the frame's title and the announcements.
   *
   * @type {(item: ListTaskItem) => string}
   * @readonly
   */
  protected readonly itemLabel: (item: ListTaskItem) => string = (item: ListTaskItem): string =>
    item.task.name;

  /**
   * Property itemSpan
   *
   * @description
   * When a task shows: all day on its due date, as in the mockup (`t.date === iso`); an undated
   * task is not drawn.
   *
   * @type {(item: ListTaskItem) => CwCalendarSpan | null}
   * @readonly
   */
  protected readonly itemSpan: (item: ListTaskItem) => CwCalendarSpan | null = (
    item: ListTaskItem,
  ): CwCalendarSpan | null => {
    if (item.task.due === null) return null;
    const day: Date = toLocalDate(item.task.due);
    return { start: day, end: day, allDay: true };
  };

  /**
   * Property taskMenu
   *
   * @description
   * The task menu, opened by the panel's triggers and, for the grid's tasks, by `openItemMenu`.
   *
   * @type {Signal<TaskMenu>}
   * @readonly
   */
  private readonly taskMenu: Signal<TaskMenu> = viewChild.required<TaskMenu>(TaskMenu);

  /**
   * Property grid
   *
   * @description
   * The calendar, which the panel's tasks are scheduled on with the keyboard.
   *
   * @type {Signal<CwCalendarView<ListTaskItem>>}
   * @readonly
   */
  private readonly grid: Signal<CwCalendarView<ListTaskItem>> =
    viewChild.required<CwCalendarView<ListTaskItem>>(CwCalendarView);

  /**
   * Property view
   *
   * @description
   * The view configuration: the query to read.
   *
   * @type {InstanceType<typeof ListViewStore>}
   * @readonly
   */
  private readonly view: InstanceType<typeof ListViewStore> = inject(ListViewStore);

  /**
   * Property taskCreate
   *
   * @description
   * Task's create dialog.
   *
   * @type {TaskCreate}
   * @readonly
   */
  private readonly taskCreate: TaskCreate = inject(TaskCreate);

  /**
   * Property taskDetail
   *
   * @description
   * Task's detail, opened over the view.
   *
   * @type {TaskDetailOpener}
   * @readonly
   */
  private readonly taskDetail: TaskDetailOpener = inject(TaskDetailOpener);

  /**
   * Property locale
   *
   * @description
   * Application locale, for the days of the toasts and the day menu.
   *
   * @type {string}
   * @readonly
   */
  private readonly locale: string = inject(LOCALE_ID);

  /**
   * Property host
   *
   * @description
   * The page's element, which hands the grid's context-menu gestures to the task menu.
   *
   * @type {ElementRef<HTMLElement>}
   * @readonly
   */
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Property overlays
   *
   * @description
   * The CDK overlay container, where the `+N others` popover renders its tasks outside the page:
   * it hands their context-menu gestures to the task menu too. Its capture phase runs after the
   * body's, so the overlay's outside-click handling does not close the menu it opens.
   *
   * @type {OverlayContainer}
   * @readonly
   */
  private readonly overlays: OverlayContainer = inject(OverlayContainer);

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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Reads the tasks of the list with the view's query, publishes their summary to the tools and
   * makes `N` create in this list while the view lives. A failed first read is retried when the
   * error boundary runs the route again. Hands the context-menu gestures of the grid's tasks, in
   * the page or in the `+N others` popover, to the task menu, from the capture phase of the page
   * and of the CDK overlay container.
   *
   * @constructor
   */
  public constructor() {
    if (this.calendar.primary.error()) this.calendar.primary.reload();
    this.calendar.load(
      computed((): CalendarRead => ({ listId: this.listId(), query: this.view.taskQuery() })),
    );
    this.view.followRows(this.calendar.summary);
    this.taskCreate.useDefaults(() => ({ listId: this.listId() }), this.destroyRef);
    const cap: string = new Intl.NumberFormat(this.locale).format(LIST_TASKS_CAP);
    this.truncatedText = $localize`:@@spaces.calendar.truncated:Only the first ${cap}:count: tasks are shown.`;
    this.undatedTruncatedText = $localize`:@@spaces.calendar.undated-truncated:Only the first ${cap}:count: tasks of the list were read: tasks without a due date may be missing.`;
    const targets: readonly HTMLElement[] = [
      this.host.nativeElement,
      this.overlays.getContainerElement(),
    ];
    let swallowUntil: number = 0;
    const delegate: (event: Event) => void = (event: Event): void => {
      if (event.type === 'contextmenu' && performance.now() < swallowUntil) {
        event.preventDefault();
        return;
      }
      if (this.scheduleWithKeyboard(event)) return;
      if (this.openItemMenu(event) && event instanceof KeyboardEvent) {
        swallowUntil = performance.now() + SWALLOW_MS;
      }
    };
    for (const element of targets) {
      element.addEventListener('contextmenu', delegate, true);
      element.addEventListener('keydown', delegate, true);
    }
    this.destroyRef.onDestroy((): void => {
      for (const element of targets) {
        element.removeEventListener('contextmenu', delegate, true);
        element.removeEventListener('keydown', delegate, true);
      }
    });
  }
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens a task's detail over the view (`?task=<KEY>`), with what the view shows of it as the
   * header's preview while the detail is read.
   *
   * @param {TaskSummary} task - The task.
   */
  protected open(task: TaskSummary): void {
    void this.taskDetail.open(task.key, {
      key: task.key,
      name: task.name,
      status: task.status,
      milestone: task.milestone,
    });
  }

  /**
   * Method createOn
   *
   * @description
   * Opens Task's create dialog in the list, due on a day (a day's `+`, `N`, the day popover's
   * `Add a task on …`, the day menu's `New task on that day`).
   *
   * @param {Date} date - The day.
   */
  protected createOn(date: Date): void {
    this.taskCreate.open({ listId: this.listId(), due: todayIso(date) });
  }

  /**
   * Method createOnDay
   *
   * @description
   * The day menu's `New task on that day`.
   *
   * @param {unknown} data - The menu's data (`CwCalendarDayMenuData`).
   */
  protected createOnDay(data: unknown): void {
    const day: CwCalendarDayMenuData | null = this.dayOf(data);
    if (day) this.createOn(day.date);
  }

  /**
   * Method dayTitle
   *
   * @description
   * The day menu's title (`Tuesday, November 24`, `App.dc.html` line 7325).
   *
   * @param {unknown} data - The menu's data (`CwCalendarDayMenuData`).
   * @returns {string} The title, empty while the menu is closed.
   */
  protected dayTitle(data: unknown): string {
    const day: CwCalendarDayMenuData | null = this.dayOf(data);
    return day ? formatLongDay(todayIso(day.date), this.locale) : '';
  }

  /**
   * Method goToday
   *
   * @description
   * The day menu's `Go to today`: shows today's month or week.
   */
  protected goToday(): void {
    this.calendar.showDay(null);
  }

  /**
   * Method moved
   *
   * @description
   * A task of the grid dropped on another day (pointer or keyboard): reschedules it.
   *
   * @param {CwCalendarItemMove<ListTaskItem>} move - The task and its new span.
   */
  protected moved(move: CwCalendarItemMove<ListTaskItem>): void {
    this.reschedule(move.item.task, todayIso(move.start));
  }

  /**
   * Method scheduled
   *
   * @description
   * A task of the panel dropped on a day (pointer or keyboard): gives it that due date.
   *
   * @param {CwCalendarItemSchedule} schedule - The task's key and the day.
   */
  protected scheduled(schedule: CwCalendarItemSchedule): void {
    if (typeof schedule.data !== 'string') return;
    const item: ListTaskItem | undefined = this.calendar.itemOf(schedule.data);
    if (item) this.reschedule(item.task, todayIso(schedule.date));
  }

  /**
   * Method reschedule
   *
   * @description
   * Gives a task a new due date (`rescheduleChanges`) through `ViewTaskWritesStore.updateFields`:
   * it moves at once and the toast `<key> rescheduled` / `Due: <day>.` offers `Undo`
   * (`App.dc.html` lines 6401-6411); a refusal puts it back with the failure toast.
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {string} due - The new due date.
   */
  private reschedule(task: TaskSummary, due: string): void {
    const changes: TaskFieldChanges | null = rescheduleChanges(task, due);
    if (!changes) return;
    void this.writes.updateFields(task, changes, {
      title: $localize`:@@spaces.calendar.rescheduled:${task.key}:key: rescheduled`,
      description: $localize`:@@spaces.calendar.rescheduled-due:Due: ${formatLongDay(due, this.locale)}:date:.`,
    });
  }

  /**
   * Method dayOf
   *
   * @description
   * The day menu's data, when it is one.
   *
   * @param {unknown} data - The menu's data.
   * @returns {CwCalendarDayMenuData | null} The day, null otherwise.
   */
  private dayOf(data: unknown): CwCalendarDayMenuData | null {
    return typeof data === 'object' && data !== null && 'date' in data && data.date instanceof Date
      ? (data as CwCalendarDayMenuData)
      : null;
  }

  /**
   * Method openItemMenu
   *
   * @description
   * Opens the task menu for a context-menu gesture on a task of the grid, whose frame
   * `cw-calendar-view` draws (a pill of a day, or a row of the `+N others` popover, which renders
   * in a CDK overlay): at the pointer for a right click, on the task (first item focused) for the
   * Menu key or Shift F10. The day menu then does not open. Runs in the capture phase of the page and of the overlay container,
   * since the frame takes no menu of its own; the panel's tasks have their own triggers. A task
   * of the popover gives the focus back to the day's `+N others` button, since opening the menu
   * closes the popover.
   *
   * @param {Event} event - A `contextmenu` or `keydown` event in the page or an overlay.
   * @returns {boolean} Whether the menu opened.
   */
  private openItemMenu(event: Event): boolean {
    if (event.defaultPrevented || !isMenuGesture(event)) return false;
    const target: EventTarget | null = event.target;
    const frame: HTMLElement | null =
      target instanceof Element ? target.closest<HTMLElement>('button') : null;
    const key: string | null | undefined = frame
      ?.querySelector('[data-calendar-task]')
      ?.getAttribute('data-calendar-task');
    if (!frame || !key) return false;
    const host: HTMLElement = this.host.nativeElement;
    const inPage: boolean = host.contains(frame);
    if (!inPage && !this.overlays.getContainerElement().contains(frame)) return false;
    event.preventDefault();
    const trigger: HTMLElement = inPage
      ? frame
      : (host.querySelector<HTMLElement>('[data-more][aria-expanded="true"]') ?? frame);
    this.menuKey.set(key);
    this.taskMenu()
      .menu()
      .open(
        event instanceof MouseEvent
          ? { origin: { x: event.clientX, y: event.clientY }, trigger }
          : { origin: frame, trigger, focus: 'first' },
      );
    return true;
  }

  /**
   * Method scheduleWithKeyboard
   *
   * @description
   * Space on a task of the panel (the card's button or its wrapper): the grid takes the task,
   * the arrows choose its day, Space or Enter drop it and Escape gives the focus back
   * (`cw-calendar-view`'s `scheduleWithKeyboard`). Runs in the capture phase, before the card's
   * button would open the task.
   *
   * @param {Event} event - A `keydown` event inside the view.
   * @returns {boolean} Whether the grid took a task.
   */
  private scheduleWithKeyboard(event: Event): boolean {
    if (
      event.defaultPrevented ||
      !(event instanceof KeyboardEvent) ||
      event.key !== ' ' ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Element) ||
      !this.host.nativeElement.contains(event.target)
    ) {
      return false;
    }
    const key: string | null | undefined = event.target
      .closest('[data-undated-task]')
      ?.getAttribute('data-undated-task');
    const item: ListTaskItem | undefined = key ? this.calendar.itemOf(key) : undefined;
    if (!item) return false;
    event.preventDefault();
    this.grid().scheduleWithKeyboard(item.task.key, item.task.name);
    return true;
  }
  // #endregion
}
