import { computed, inject, type ResourceRef, type Signal, type Type } from '@angular/core';
import type { StatusKey } from '@cadenway/contracts';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
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

  /**
   * Property _scheduled
   *
   * @description
   * Keys of the tasks this view scheduled from the panel that the grid's read does not hold yet:
   * the grid shows each from the unwindowed read (its optimistic due date, then the date that
   * read reads back) until the grid's read holds it, then forgets it.
   *
   * @type {Readonly<Record<string, true>>}
   * @readonly
   */
  readonly _scheduled: Readonly<Record<string, true>>;
  // #endregion
}

/**
 * Function wrote
 *
 * @description
 * Whether a write reached the gateway with an answer or without a certain one: applied,
 * refused or uncertain, which both reads then read again. A write not sent at all is not.
 *
 * @param {ViewTaskOutcome} outcome - What the write ended with.
 * @returns {boolean} Whether it was answered or uncertain.
 */
function wrote(outcome: ViewTaskOutcome): boolean {
  return outcome.done.length + outcome.failed.length + outcome.unknown.length > 0;
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
   * The dated tasks, as shown: those of the grid's read only, then the tasks this view scheduled
   * from the panel that the grid's read does not hold yet, as the unwindowed read shows them (its
   * optimistic patch, then what it reads back). The unwindowed read never fills in for a task the
   * grid's read dropped (deleted, moved out of the window), so no stale copy comes back.
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
   * only, its writes applied, once that read answered the current list and query. While another
   * query reads, or after it failed, the panel holds no task: the previous query's tasks may not
   * match the filters, so they are neither shown nor acted on.
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
   * Whether the unwindowed read of the current list and query runs without an answer yet (the
   * first read, or a read after the filters changed): the panel shows its skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedLoading: Signal<boolean>;

  /**
   * Property undatedReady
   *
   * @description
   * Whether the unwindowed read has answered the current list and query: the panel shows its
   * tasks, its count or its empty text. A reload of the same query (realtime, after a write)
   * keeps it ready.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedReady: Signal<boolean>;

  /**
   * Property undatedFailed
   *
   * @description
   * Whether the unwindowed read failed: a secondary read, whose inline error offers `Retry`. A
   * failed read of another query shows the error alone; a failed reload of the same query keeps
   * the tasks it answered before.
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
   * Whether the grid's read stopped at `LIST_TASKS_CAP` with tasks of the window left out.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly truncated: Signal<boolean>;

  /**
   * Property undatedTruncated
   *
   * @description
   * Whether the unwindowed read stopped at `LIST_TASKS_CAP`: the panel may miss undated tasks
   * of the pages left out (no "no due date" filter, gap G4), so it never says that every task
   * has a due date.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly undatedTruncated: Signal<boolean>;

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
    withState((): CalendarViewState => ({ mode: 'month', shown: todayIso(), _scheduled: {} })),
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
        gridItems: (): readonly ListTaskItem[] => {
          const scheduled: Readonly<Record<string, true>> = store._scheduled();
          return [
            ...store._windowed
              .items()
              .filter((item: ListTaskItem): boolean => item.task.due !== null),
            ...store._unwindowed
              .items()
              .filter(
                (item: ListTaskItem): boolean =>
                  item.task.due !== null && item.task.key in scheduled && !held(item.task.key),
              ),
          ];
        },
        undatedItems: (): readonly ListTaskItem[] =>
          store._unwindowed.hasCurrentSnapshot()
            ? store._unwindowed
                .items()
                .filter((item: ListTaskItem): boolean => item.task.due === null)
            : [],
        _settledSchedules: (): readonly string[] => {
          const dated: ReadonlySet<string> = new Set<string>(
            store._unwindowed
              .items()
              .filter((item: ListTaskItem): boolean => item.task.due !== null)
              .map((item: ListTaskItem): string => item.task.key),
          );
          return Object.keys(store._scheduled()).filter(
            (key: string): boolean => held(key) || !dated.has(key),
          );
        },
        gridLoading: (): boolean =>
          store._windowed.initialLoading() && store._windowed.primary.error() === undefined,
        refreshFailed: (): boolean =>
          store._windowed.hasCurrentSnapshot() && store._windowed.primary.error() !== undefined,
        undatedFailed: (): boolean => store._unwindowed.primary.error() !== undefined,
        undatedReady: (): boolean => store._unwindowed.hasCurrentSnapshot(),
        empty: (): boolean => store._unwindowed.empty(),
        truncated: (): boolean => store._windowed.truncated(),
        undatedTruncated: (): boolean =>
          store._unwindowed.hasCurrentSnapshot() && store._unwindowed.truncated(),
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
      const reloadBoth: () => void = (): void => {
        store._windowed.reload();
        store._unwindowed.reload();
      };
      const settle: (outcome: ViewTaskOutcome) => ViewTaskOutcome = (
        outcome: ViewTaskOutcome,
      ): ViewTaskOutcome => {
        if (wrote(outcome)) reloadBoth();
        return outcome;
      };
      return {
        _forget: signalMethod<readonly string[]>((keys: readonly string[]): void => {
          if (keys.length === 0) return;
          patchState(store, (state: CalendarViewState): Partial<CalendarViewState> => ({
            _scheduled: Object.fromEntries(
              Object.keys(state._scheduled)
                .filter((key: string): boolean => !keys.includes(key))
                .map((key: string): [string, true] => [key, true]),
            ),
          }));
        }),
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
        async act(
          tasks: readonly TaskSummary[],
          action: TaskBulkAction,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          return settle(await sourceOf(tasks[0]?.key).act(tasks, action, expected));
        },
        async update(
          task: TaskSummary,
          changes: TaskFieldChanges,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          const source: ListTasksStoreInstance = sourceOf(task.key);
          const written: Promise<ViewTaskOutcome> = source.update(task, changes, expected);
          if (source === store._unwindowed && typeof changes.dueDate === 'string') {
            patchState(store, (state: CalendarViewState): Partial<CalendarViewState> => ({
              _scheduled: { ...state._scheduled, [task.key]: true },
            }));
          }
          return settle(await written);
        },
        remind(taskKeys: readonly string[], at: Date): Promise<readonly string[]> {
          return store._windowed.remind(taskKeys, at);
        },
        async restore(entryIds: readonly string[]): Promise<boolean> {
          const restored: boolean = await store._windowed.restore(entryIds);
          store._unwindowed.reload();
          return restored;
        },
        reload: reloadBoth,
        shownStatus(task: TaskSummary): StatusKey {
          return sourceOf(task.key).shownStatus(task);
        },
      };
    }),
    withHooks({
      onInit(store): void {
        store._forget(store._settledSchedules);
      },
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
 * "no due date" filter (gap G4). Neither read fills in for the other: the grid draws the dated
 * tasks of its read, the panel the undated tasks of the unwindowed read. It is the view's
 * `VIEW_TASK_WRITER`: a write goes through the read that shows the task (the grid's read once it
 * holds it, else the unwindowed one), and every answered or uncertain write reads both again
 * (the patches stay until a read reaches their version). A task scheduled from the panel shows
 * on its day from the unwindowed read until the grid's read holds it, and comes back to the panel
 * when the gateway refuses it or its `Undo` runs.
 *
 * @type {Type<CalendarViewStoreInstance>}
 */
export const CalendarViewStore: Type<CalendarViewStoreInstance> = createCalendarViewStore();
