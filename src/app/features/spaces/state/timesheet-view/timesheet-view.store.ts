import {
  computed,
  DOCUMENT,
  inject,
  linkedSignal,
  resource,
  type ResourceRef,
  type ResourceStatus,
  type Signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
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
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  auditTime,
  catchError,
  EMPTY,
  filter,
  fromEvent,
  merge,
  type Observable,
  pipe,
  switchMap,
  tap,
} from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { TaskDetailOpener } from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { TimesheetApi } from '../../data-access/services/timesheet-api/timesheet-api.service';
import type {
  ListTimesheet,
  TimesheetEntry,
  TimesheetFigures,
  TimesheetPerson,
  TimesheetTopTask,
} from '../../models/timesheet/timesheet.interface';
import { todayIso, toLocalDate } from '../../utils/calendar-date/calendar-date.util';

/**
 * Constant REFRESH_WINDOW_MS
 *
 * @description
 * Window after the first refresh cause (a notice, the detail closing, the tab shown again) before
 * the week is read again, once for the whole window, as the `List` view's rows do.
 *
 * @type {number}
 */
export const REFRESH_WINDOW_MS: number = 1000;

/**
 * Constant WORKING_DAYS
 *
 * @description
 * Monday to Friday: the days the average per working day counts (`App.dc.html` line 7858).
 *
 * @type {number}
 */
const WORKING_DAYS: number = 5;

/**
 * Constant REFRESHING_NOTICES
 *
 * @description
 * The task notices, which name no list, after which the week is read again: a task renamed or
 * whose status changed shows differently. Time entries have no notice (gap G13);
 * `list.tasks-changed.v1` names its list and counts through the list id.
 *
 * @type {ReadonlySet<string>}
 */
const REFRESHING_NOTICES: ReadonlySet<string> = new Set([
  'task.updated.v1',
  'task.status-changed.v1',
]);

/**
 * Function addDays
 *
 * @description
 * The calendar date a number of days after another one, in the caller's calendar.
 *
 * @param {string} iso - A date, `YYYY-MM-DD`.
 * @param {number} days - Days to add, negative to go back.
 * @returns {string} The date, `YYYY-MM-DD`.
 */
export function addDays(iso: string, days: number): string {
  const date: Date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/**
 * Function mondayOf
 *
 * @description
 * The Monday of the week holding a date (`App.dc.html` line 7817).
 *
 * @param {string} iso - A date, `YYYY-MM-DD`.
 * @returns {string} Its Monday, `YYYY-MM-DD`.
 */
export function mondayOf(iso: string): string {
  return addDays(iso, -((toLocalDate(iso).getDay() + 6) % 7));
}

/**
 * Function sumByDay
 *
 * @description
 * Adds the minutes of entries day by day.
 *
 * @param {readonly TimesheetEntry[]} entries - The entries.
 * @returns {readonly number[]} Seven sums, Monday first.
 */
function sumByDay(entries: readonly TimesheetEntry[]): readonly number[] {
  return Array.from({ length: 7 }, (_: unknown, day: number): number =>
    entries.reduce(
      (sum: number, entry: TimesheetEntry): number => sum + entry.minutesByDay[day],
      0,
    ),
  );
}

/**
 * Function peopleOf
 *
 * @description
 * Groups the entries of a week by person, in the gateway's order (by account), each with the
 * sums of their tasks.
 *
 * @param {readonly TimesheetEntry[]} entries - The week's entries.
 * @returns {readonly TimesheetPerson[]} The people.
 */
function peopleOf(entries: readonly TimesheetEntry[]): readonly TimesheetPerson[] {
  const byPerson: Map<string, TimesheetEntry[]> = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    if (entry.totalMinutes <= 0) continue;
    const tasks: TimesheetEntry[] = byPerson.get(entry.userId) ?? [];
    tasks.push(entry);
    byPerson.set(entry.userId, tasks);
  }
  return [...byPerson].map(([userId, tasks]: [string, TimesheetEntry[]]): TimesheetPerson => ({
    userId,
    tasks,
    minutesByDay: sumByDay(tasks),
    totalMinutes: tasks.reduce(
      (sum: number, task: TimesheetEntry): number => sum + task.totalMinutes,
      0,
    ),
  }));
}

/**
 * Function figuresOf
 *
 * @description
 * The key figures of a week (`App.dc.html` lines 7856-7868): the total, the tasks with time, the
 * average per working day with time, and the task with the most minutes across people (the first
 * one in the gateway's order on a tie).
 *
 * @param {ListTimesheet} sheet - The week.
 * @returns {TimesheetFigures} The figures.
 */
function figuresOf(sheet: ListTimesheet): TimesheetFigures {
  const working: readonly number[] = sheet.days
    .slice(0, WORKING_DAYS)
    .map((day: { totalMinutes: number }): number => day.totalMinutes);
  const workedDays: number = working.filter((minutes: number): boolean => minutes > 0).length;
  const byTask: Map<string, TimesheetTopTask> = new Map<string, TimesheetTopTask>();
  for (const entry of sheet.entries) {
    if (entry.totalMinutes <= 0) continue;
    const known: TimesheetTopTask | undefined = byTask.get(entry.taskKey);
    byTask.set(entry.taskKey, {
      taskKey: entry.taskKey,
      name: entry.name,
      minutes: (known?.minutes ?? 0) + entry.totalMinutes,
    });
  }
  let topTask: TimesheetTopTask | null = null;
  for (const task of byTask.values()) {
    if (topTask === null || task.minutes > topTask.minutes) topTask = task;
  }
  return {
    totalMinutes: sheet.totalMinutes,
    taskCount: byTask.size,
    workedDays,
    averageMinutes: Math.round(
      working.reduce((sum: number, minutes: number): number => sum + minutes, 0) /
        Math.max(workedDays, 1),
    ),
    topTask,
  };
}

/**
 * Function taskKeysOf
 *
 * @description
 * The keys of the tasks with time in a week, each once, sorted, so the estimates are read again
 * only when the set of tasks changes.
 *
 * @param {ListTimesheet} sheet - The week.
 * @returns {readonly string[]} The keys.
 */
function taskKeysOf(sheet: ListTimesheet): readonly string[] {
  return [
    ...new Set(
      sheet.entries
        .filter((entry: TimesheetEntry): boolean => entry.totalMinutes > 0)
        .map((entry: TimesheetEntry): string => entry.taskKey),
    ),
  ].sort();
}

/**
 * Interface TimesheetViewState
 *
 * @description
 * The list and the week the view shows.
 */
interface TimesheetViewState {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list of the route, or null before the page binds it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly listId: string | null;

  /**
   * Property today
   *
   * @description
   * The caller's today when the view opened or came back to this week, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the week shown, `YYYY-MM-DD`.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property hasRead
   *
   * @description
   * Whether a week of this list was read once: until then a failed read belongs to the route's
   * error boundary, afterwards to the view's own error state.
   *
   * @type {boolean}
   * @readonly
   */
  readonly hasRead: boolean;
  // #endregion
}

/**
 * Interface TimesheetWeekParams
 *
 * @description
 * What a week read depends on.
 */
interface TimesheetWeekParams {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The committed organization, so a switch reads again.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property listId
   *
   * @description
   * The list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the week.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;
  // #endregion
}

/**
 * Interface TimesheetViewStoreInstance
 *
 * @description
 * The week of the `Timesheet` view, its figures and the estimates of its tasks.
 */
export interface TimesheetViewStoreInstance {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * The list shown, or null before the page binds it.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly listId: Signal<string | null>;

  /**
   * Property today
   *
   * @description
   * The caller's today, `YYYY-MM-DD`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly today: Signal<string>;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the week shown, `YYYY-MM-DD`.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly weekStart: Signal<string>;

  /**
   * Property hasRead
   *
   * @description
   * Whether a week of the list was read once.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasRead: Signal<boolean>;

  /**
   * Property timesheet
   *
   * @description
   * The read of the week shown (primary): its loader rejects with the typed route error.
   *
   * @type {ResourceRef<ListTimesheet | undefined>}
   * @readonly
   */
  readonly timesheet: ResourceRef<ListTimesheet | undefined>;

  /**
   * Property sheet
   *
   * @description
   * The week shown: the last answer for the current list and week, kept while it is read again
   * and when a refresh fails; undefined while another week or list is read, or after its read
   * failed.
   *
   * @type {Signal<ListTimesheet | undefined>}
   * @readonly
   */
  readonly sheet: Signal<ListTimesheet | undefined>;

  /**
   * Property estimates
   *
   * @description
   * The estimates of the week's tasks (secondary), by task key; idle without time.
   *
   * @type {ResourceRef<ReadonlyMap<string, number | null> | undefined>}
   * @readonly
   */
  readonly estimates: ResourceRef<ReadonlyMap<string, number | null> | undefined>;

  /**
   * Property days
   *
   * @description
   * The seven dates of the week shown, Monday first.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly days: Signal<readonly string[]>;

  /**
   * Property isThisWeek
   *
   * @description
   * Whether the week shown holds today.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly isThisWeek: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the week was read and holds no time.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;

  /**
   * Property people
   *
   * @description
   * The people with time in the week, in the gateway's order, with their tasks.
   *
   * @type {Signal<readonly TimesheetPerson[]>}
   * @readonly
   */
  readonly people: Signal<readonly TimesheetPerson[]>;

  /**
   * Property figures
   *
   * @description
   * The key figures of the week, or null while it is unknown.
   *
   * @type {Signal<TimesheetFigures | null>}
   * @readonly
   */
  readonly figures: Signal<TimesheetFigures | null>;

  /**
   * Property estimatedMinutes
   *
   * @description
   * The estimates of the week's tasks added up (`Estimated on these tasks`), or null when they
   * are unknown or none of the tasks has one.
   *
   * @type {Signal<number | null>}
   * @readonly
   */
  readonly estimatedMinutes: Signal<number | null>;
  // #endregion

  // #region Methods
  /**
   * Method show
   *
   * @description
   * Binds the list of the route; another list starts over on the current week.
   *
   * @param {Signal<string | null> | string | null} listId - The list.
   */
  show(listId: Signal<string | null> | string | null): void;

  /**
   * Method previousWeek
   *
   * @description
   * Shows the week before the one shown.
   */
  previousWeek(): void;

  /**
   * Method nextWeek
   *
   * @description
   * Shows the week after the one shown.
   */
  nextWeek(): void;

  /**
   * Method showThisWeek
   *
   * @description
   * Shows the week holding today, today read again.
   */
  showThisWeek(): void;

  /**
   * Method reload
   *
   * @description
   * Reads the week shown again, and its estimates; a read asked while one runs follows it.
   */
  reload(): void;
  // #endregion
}

/**
 * Function initialState
 *
 * @description
 * The current week of no list yet.
 *
 * @returns {TimesheetViewState} The state.
 */
function initialState(): TimesheetViewState {
  const today: string = todayIso();
  return { listId: null, today, weekStart: mondayOf(today), hasRead: false };
}

/**
 * Function createTimesheetViewStore
 *
 * @description
 * Creates the `Timesheet` view's store.
 *
 * @returns {Type<TimesheetViewStoreInstance>} Injectable store constructor.
 */
function createTimesheetViewStore(): Type<TimesheetViewStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps((store) => {
      const api: TimesheetApi = inject(TimesheetApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const params: Signal<TimesheetWeekParams | undefined> = computed(
        (): TimesheetWeekParams | undefined => {
          const listId: string | null = store.listId();
          if (listId === null) return undefined;
          return {
            organizationId: workspace.organization().id,
            listId,
            weekStart: store.weekStart(),
          };
        },
      );
      const timesheet: ResourceRef<ListTimesheet | undefined> = resource({
        params,
        loader: ({
          params: week,
          abortSignal,
        }: {
          params: TimesheetWeekParams;
          abortSignal: AbortSignal;
        }): Promise<ListTimesheet> => api.week(week.listId, week.weekStart, abortSignal),
      });
      const shown: WritableSignal<ListTimesheet | undefined> = linkedSignal<
        { readonly key: string; readonly value: ListTimesheet | undefined },
        ListTimesheet | undefined
      >({
        source: () => {
          const week: TimesheetWeekParams | undefined = params();
          return {
            key: week ? `${week.organizationId}/${week.listId}/${week.weekStart}` : '',
            value: timesheet.hasValue() ? timesheet.value() : undefined,
          };
        },
        computation: (source, previous): ListTimesheet | undefined =>
          source.value ?? (previous?.source.key === source.key ? previous.value : undefined),
      });
      const sheet: Signal<ListTimesheet | undefined> = shown.asReadonly();
      const estimateParams: Signal<{ readonly keys: readonly string[] } | undefined> = computed(
        (): { readonly keys: readonly string[] } | undefined => {
          const current: ListTimesheet | undefined = sheet();
          if (!current) return undefined;
          const keys: readonly string[] = taskKeysOf(current);
          return keys.length === 0 ? undefined : { keys };
        },
        {
          equal: (
            a: { readonly keys: readonly string[] } | undefined,
            b: { readonly keys: readonly string[] } | undefined,
          ): boolean => a?.keys.join(' ') === b?.keys.join(' '),
        },
      );
      return {
        _api: api,
        _realtime: inject(RealtimeConnection, { optional: true }),
        _opener: inject(TaskDetailOpener),
        _document: inject(DOCUMENT),
        timesheet,
        sheet,
        estimates: resource({
          params: estimateParams,
          loader: ({
            params: tasks,
            abortSignal,
          }: {
            params: { readonly keys: readonly string[] };
            abortSignal: AbortSignal;
          }): Promise<ReadonlyMap<string, number | null>> => api.estimates(tasks.keys, abortSignal),
        }),
      };
    }),
    withComputed((store) => ({
      days: computed((): readonly string[] =>
        Array.from({ length: 7 }, (_: unknown, day: number): string =>
          addDays(store.weekStart(), day),
        ),
      ),
      isThisWeek: computed((): boolean => store.weekStart() === mondayOf(store.today())),
      empty: computed((): boolean => {
        const sheet: ListTimesheet | undefined = store.sheet();
        return sheet !== undefined && peopleOf(sheet.entries).length === 0;
      }),
      people: computed((): readonly TimesheetPerson[] => {
        const sheet: ListTimesheet | undefined = store.sheet();
        return sheet ? peopleOf(sheet.entries) : [];
      }),
      figures: computed((): TimesheetFigures | null => {
        const sheet: ListTimesheet | undefined = store.sheet();
        return sheet ? figuresOf(sheet) : null;
      }),
      estimatedMinutes: computed((): number | null => {
        const sheet: ListTimesheet | undefined = store.sheet();
        if (!sheet || !store.estimates.hasValue()) return null;
        const estimates: ReadonlyMap<string, number | null> = store.estimates.value();
        const keys: readonly string[] = taskKeysOf(sheet);
        if (keys.some((key: string): boolean => !estimates.has(key))) return null;
        const minutes: number = keys.reduce(
          (sum: number, key: string): number => sum + (estimates.get(key) ?? 0),
          0,
        );
        return minutes > 0 ? minutes : null;
      }),
    })),
    withMethods((store) => {
      let queued: boolean = false;
      const reload: () => void = (): void => {
        if (!store.timesheet.reload() && store.timesheet.isLoading()) queued = true;
        if (store.estimates.hasValue() || store.estimates.error()) store.estimates.reload();
      };
      return {
        show: signalMethod<string | null>((listId: string | null): void => {
          if (listId === store.listId()) return;
          const today: string = todayIso();
          patchState(store, { listId, today, weekStart: mondayOf(today), hasRead: false });
        }),
        previousWeek(): void {
          patchState(store, { weekStart: addDays(store.weekStart(), -7) });
        },
        nextWeek(): void {
          patchState(store, { weekStart: addDays(store.weekStart(), 7) });
        },
        showThisWeek(): void {
          const today: string = todayIso();
          patchState(store, { today, weekStart: mondayOf(today) });
        },
        reload,
        _settle: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status === 'resolved' && !store.hasRead()) patchState(store, { hasRead: true });
          if (queued && status !== 'loading' && status !== 'reloading') {
            queued = false;
            store.timesheet.reload();
          }
        }),
        _watch: rxMethod<string | null>(
          pipe(
            switchMap((listId: string | null): Observable<unknown> => {
              if (listId === null) return EMPTY;
              const notices: Observable<RealtimeChange> = store._realtime
                ? store._realtime.watch({ kind: 'list', listId }).pipe(
                    filter((notice: RealtimeChange): boolean => {
                      const data: unknown = notice.data;
                      if (typeof data !== 'object' || data === null) return false;
                      if ('listId' in data) return data.listId === listId;
                      return REFRESHING_NOTICES.has(notice.type);
                    }),
                    catchError(() => EMPTY),
                  )
                : EMPTY;
              return merge(
                notices,
                store._opener.closed,
                store._opener.changed,
                fromEvent(store._document, 'visibilitychange').pipe(
                  filter((): boolean => store._document.visibilityState === 'visible'),
                ),
              );
            }),
            auditTime(REFRESH_WINDOW_MS),
            tap((): void => {
              reload();
            }),
          ),
        ),
      };
    }),
    withHooks({
      onInit(store): void {
        store._settle(store.timesheet.status);
        store._watch(store.listId);
      },
    }),
  );
}

/**
 * Constant TimesheetViewStore
 *
 * @description
 * The state of the `Timesheet` view (`l/:listId/timesheet`), route-scoped through
 * `TIMESHEET_VIEW_PROVIDERS`: one week of the time recorded on the list's tasks
 * (`getListTimesheet`, every page), Monday to Sunday, starting on the caller's current week. The
 * view's filters do not apply: the timesheet covers every live task of the list. `timesheet` is the
 * primary read; `sheet` keeps its last answer for the list and week shown while it is read again
 * and when a refresh fails. Another week or list shows nothing until its answer. Until a week of
 * the list was read once (`hasRead`), a failed read belongs to the route's error boundary. The
 * estimates of the week's tasks are a secondary read (`getTaskTimeSummary`, four at a time, gap
 * G7), read again only when the set of tasks changes. Time entries have no realtime notice (G13):
 * the week is read again 1 s after the first of a task notice of the list, the task detail closing
 * or giving way (`TaskDetailOpener.closed`, `changed`: time is recorded from the detail) and the
 * tab being shown again, once per window. Another organization reads again.
 *
 * @type {ReturnType<typeof createTimesheetViewStore>}
 */
export const TimesheetViewStore: ReturnType<typeof createTimesheetViewStore> =
  createTimesheetViewStore();
