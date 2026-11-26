import { computed, inject, type ResourceRef, type Signal, type Type } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import type { TaskBulkAction, TaskSummary } from '@features/task';

import type {
  CalendarMode,
  CalendarRead,
} from '../../models/calendar-view/calendar-view.interface';
import type { ListRowsSummary } from '../../models/list-rows/list-rows.interface';
import type {
  DueWindow,
  ListTaskItem,
  ListTasksRead,
} from '../../models/list-tasks/list-tasks.interface';
import type {
  TaskFieldChanges,
  ViewTaskOutcome,
  ViewTaskWriter,
} from '../../models/view-task-write/view-task-write.interface';
import { todayIso, toLocalDate } from '../../utils/calendar-date/calendar-date.util';
import { calendarWindow } from '../../utils/calendar-view/calendar-view.util';
import {
  ListTasksStore,
  type ListTasksStoreInstance,
  type TasksSnapshot,
} from '../list-tasks/list-tasks.store';
import { UNWINDOWED_TASKS } from './unwindowed-tasks.token';

/**
 * Interface CalendarViewState
 *
 * @description
 * What the calendar shows.
 */
interface CalendarViewState {
  // #region Properties
  /**
   * Property mode
   *
   * @description
   * The month grid or one week.
   *
   * @type {CalendarMode}
   * @readonly
   */
  readonly mode: CalendarMode;

  /**
   * Property shown
   *
   * @description
   * A day of the month or week shown, `YYYY-MM-DD`; today when the view opens.
   *
   * @type {string}
   * @readonly
   */
  readonly shown: string;
  // #endregion
}

/**
 * Interface CalendarViewStoreInstance
 *
 * @description
 * Public API of `CalendarViewStore`: the shown period, the tasks of the grid and of the
 * `No due date` panel, and the writes of the view (`ViewTaskWriter`), each sent through the read
 * that shows the task.
 */
export interface CalendarViewStoreInstance extends ViewTaskWriter {
  // #region Properties
  /**
   * Property mode
   *
   * @description
   * The month grid or one week.
   *
   * @type {Signal<CalendarMode>}
   * @readonly
   */
  readonly mode: Signal<CalendarMode>;

  /**
   * Property shownDate
   *
   * @description
   * A day of the month or week shown, at local midnight, for `cw-calendar-view`'s `date`.
   *
   * @type {Signal<Date>}
   * @readonly
   */
  readonly shownDate: Signal<Date>;

  /**
   * Property window
   *
   * @description
   * The due dates the grid covers (six Monday-first weeks, or the week), which the grid's read
   * keeps.
   *
   * @type {Signal<DueWindow>}
   * @readonly
   */
  readonly window: Signal<DueWindow>;

  /**
   * Property primary
   *
   * @description
   * The grid's read: a failure of a read with nothing current to show reaches the route's error
   * boundary through its `value()`.
   *
   * @type {ResourceRef<TasksSnapshot | undefined>}
   * @readonly
   */
  readonly primary: ResourceRef<TasksSnapshot | undefined>;

  /**
   * Property hasCurrentSnapshot
   *
   * @description
   * Whether the grid's current read has answered.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasCurrentSnapshot: Signal<boolean>;

  /**
   * Property gridItems
   *
   * @description
   * The dated tasks, as shown: those of the grid's read, then those of the unwindowed read that
   * the grid's read does not hold (a task scheduled from the panel, or any task before the
   * grid's read answers). A task both reads hold shows as the grid's read has it.
   *
   * @type {Signal<readonly ListTaskItem[]>}
   * @readonly
   */
  readonly gridItems: Signal<readonly ListTaskItem[]>;

  /**
   * Property undatedItems
   *
   * @description
   * The tasks without a due date, as shown, in the view's order: those of the unwindowed read
   * the grid's read does not hold, then those of the grid's read whose due date a write removed
   * (an `Undo`).
   *
   * @type {Signal<readonly ListTaskItem[]>}
   * @readonly
   */
  readonly undatedItems: Signal<readonly ListTaskItem[]>;

  /**
   * Property gridLoading
   *
   * @description
   * Whether the grid's first read runs: the grid shows its skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly gridLoading: Signal<boolean>;

  /**
   * Property refreshFailed
   *
   * @description
   * Whether the grid's last read failed while the grid shows its answered tasks: an inline
   * error offers `Retry`.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly refreshFailed: Signal<boolean>;

  /**
   * Property undatedLoading
   *
   * @description
   * Whether the unwindowed first read runs: the panel shows its skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedLoading: Signal<boolean>;

  /**
   * Property undatedReady
   *
   * @description
   * Whether the unwindowed read has answered for this list: the panel shows its tasks, its count
   * or its empty text.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedReady: Signal<boolean>;

  /**
   * Property undatedFailed
   *
   * @description
   * Whether the unwindowed read failed: a secondary read, whose inline error offers `Retry`.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedFailed: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the unwindowed read answered without any task: the list (with the view's filters)
   * has no task at all.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;

  /**
   * Property truncated
   *
   * @description
   * Whether a read stopped at `LIST_TASKS_CAP` with tasks left out.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly truncated: Signal<boolean>;

  /**
   * Property summary
   *
   * @description
   * What the view publishes with `ListViewStore.followRows`: the unwindowed read's summary, whose
   * count is every task the view's query matches (the grid's windowed count is unknown).
   *
   * @type {Signal<ListRowsSummary>}
   * @readonly
   */
  readonly summary: Signal<ListRowsSummary>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list and the view's query: the grid reads them with its window, the panel
   * without one. Call it in an injection context (the page's constructor), whose lifetime the
   * reads follow.
   *
   * @param {Signal<CalendarRead>} read - What to read.
   */
  load(read: Signal<CalendarRead>): void;

  /**
   * Method showMode
   *
   * @description
   * Shows the month grid or one week; the grid reads its new window.
   *
   * @param {CalendarMode} mode - Month or week.
   */
  showMode(mode: CalendarMode): void;

  /**
   * Method showDay
   *
   * @description
   * Shows the month or week of a day; null shows today's.
   *
   * @param {Date | null} date - The day.
   */
  showDay(date: Date | null): void;

  /**
   * Method retryUndated
   *
   * @description
   * Reads the tasks of the `No due date` panel again.
   */
  retryUndated(): void;

  /**
   * Method itemOf
   *
   * @description
   * A task as the view shows it, by key: in the grid or in the panel.
   *
   * @param {string} key - Task key.
   * @returns {ListTaskItem | undefined} The task.
   */
  itemOf(key: string): ListTaskItem | undefined;
  // #endregion
}

/**
 * Function createCalendarViewStore
 *
 * @description
 * Creates the `Calendar` view's store.
 *
 * @returns {Type<CalendarViewStoreInstance>} Injectable store constructor.
 */
function createCalendarViewStore(): Type<CalendarViewStoreInstance> {
  return signalStore(
    withState((): CalendarViewState => ({ mode: 'month', shown: todayIso() })),
    withProps(() => {
      const windowed: ListTasksStoreInstance = inject(ListTasksStore);
      return {
        _windowed: windowed,
        _unwindowed: inject(UNWINDOWED_TASKS),
        primary: windowed.primary,
      };
    }),
    withComputed((store) => {
      const held: (key: string) => boolean = (key: string): boolean =>
        store._windowed.taskOf(key) !== undefined;
      return {
        shownDate: (): Date => toLocalDate(store.shown()),
        window: computed((): DueWindow => calendarWindow(store.mode(), store.shown()), {
          equal: (a: DueWindow, b: DueWindow): boolean => a.from === b.from && a.to === b.to,
        }),
        hasCurrentSnapshot: (): boolean => store._windowed.hasCurrentSnapshot(),
        gridItems: (): readonly ListTaskItem[] => [
          ...store._windowed
            .items()
            .filter((item: ListTaskItem): boolean => item.task.due !== null),
          ...store._unwindowed
            .items()
            .filter(
              (item: ListTaskItem): boolean => item.task.due !== null && !held(item.task.key),
            ),
        ],
        undatedItems: (): readonly ListTaskItem[] => [
          ...store._unwindowed
            .items()
            .filter(
              (item: ListTaskItem): boolean => item.task.due === null && !held(item.task.key),
            ),
          ...store._windowed
            .items()
            .filter((item: ListTaskItem): boolean => item.task.due === null),
        ],
        gridLoading: (): boolean =>
          store._windowed.initialLoading() && store._windowed.primary.error() === undefined,
        refreshFailed: (): boolean =>
          store._windowed.hasCurrentSnapshot() && store._windowed.primary.error() !== undefined,
        undatedFailed: (): boolean => store._unwindowed.primary.error() !== undefined,
        undatedReady: (): boolean => !store._unwindowed.initialLoading(),
        empty: (): boolean => store._unwindowed.empty(),
        truncated: (): boolean => store._windowed.truncated() || store._unwindowed.truncated(),
        summary: (): ListRowsSummary => store._unwindowed.summary(),
      };
    }),
    withComputed((store) => ({
      undatedLoading: (): boolean => !store.undatedReady() && !store.undatedFailed(),
    })),
    withMethods((store) => {
      const sourceOf: (key: string | undefined) => ListTasksStoreInstance = (
        key: string | undefined,
      ): ListTasksStoreInstance =>
        key !== undefined && store._windowed.taskOf(key) !== undefined
          ? store._windowed
          : store._unwindowed;
      return {
        load(read: Signal<CalendarRead>): void {
          store._windowed.load(computed((): ListTasksRead => ({ ...read(), due: store.window() })));
          store._unwindowed.load(computed((): ListTasksRead => ({ ...read(), due: null })));
        },
        showMode(mode: CalendarMode): void {
          patchState(store, { mode });
        },
        showDay(date: Date | null): void {
          patchState(store, { shown: todayIso(date ?? new Date()) });
        },
        retryUndated(): void {
          store._unwindowed.reload();
        },
        itemOf(key: string): ListTaskItem | undefined {
          const matches: (item: ListTaskItem) => boolean = (item: ListTaskItem): boolean =>
            item.task.key === key;
          return store.gridItems().find(matches) ?? store.undatedItems().find(matches);
        },
        act(
          tasks: readonly TaskSummary[],
          action: TaskBulkAction,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          return sourceOf(tasks[0]?.key).act(tasks, action, expected);
        },
        update(
          task: TaskSummary,
          changes: TaskFieldChanges,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          return sourceOf(task.key).update(task, changes, expected);
        },
        remind(taskKeys: readonly string[], at: Date): Promise<readonly string[]> {
          return store._windowed.remind(taskKeys, at);
        },
        async restore(entryIds: readonly string[]): Promise<boolean> {
          const restored: boolean = await store._windowed.restore(entryIds);
          store._unwindowed.reload();
          return restored;
        },
        reload(): void {
          store._windowed.reload();
          store._unwindowed.reload();
        },
        shownStatus(task: TaskSummary): StatusKey {
          return sourceOf(task.key).shownStatus(task);
        },
      };
    }),
  );
}

/**
 * Constant CalendarViewStore
 *
 * @description
 * The state of the `Calendar` view (`l/:listId/calendar`), route-scoped through
 * `CALENDAR_VIEW_PROVIDERS`: the month or week shown (today's month when the view opens) and two
 * `ListTasksStore` reads with the view's query. The grid's read (`ListTasksStore`) keeps the
 * due dates of the six weeks or the week shown, and reads again when another one shows; the
 * unwindowed read (`UNWINDOWED_TASKS`) feeds the `No due date` panel, since the gateway has no
 * "no due date" filter (gap G4). Each read keeps its own realtime window, retries and writes;
 * the store merges them by key, the grid's read winning for a task both hold. It is the view's
 * `VIEW_TASK_WRITER`: a write goes through the read that shows the task (the grid's read once it
 * holds it, else the unwindowed one), so a task scheduled from the panel leaves the panel and
 * shows on its day at once, and comes back when the gateway refuses it or its `Undo` runs.
 *
 * @type {Type<CalendarViewStoreInstance>}
 */
export const CalendarViewStore: Type<CalendarViewStoreInstance> = createCalendarViewStore();
