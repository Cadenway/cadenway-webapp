import {
  computed,
  DestroyRef,
  inject,
  resource,
  type ResourceRef,
  type ResourceStatus,
  type Signal,
  type Type,
} from '@angular/core';
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
import { removeAllEntities, setAllEntities, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  audit,
  catchError,
  EMPTY,
  filter,
  merge,
  type Observable,
  pipe,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import {
  type CreatedTask,
  type TaskBulkAction,
  TaskCreate,
  TaskDetailOpener,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type { ListRowsSummary, ListTaskPage } from '../../models/list-rows/list-rows.interface';
import type {
  DueWindow,
  ListTaskItem,
  ListTasksRead,
} from '../../models/list-tasks/list-tasks.interface';
import type {
  TaskFieldChanges,
  ViewTaskOutcome,
} from '../../models/view-task-write/view-task-write.interface';
import {
  type AppliedTaskWrite,
  withViewTaskWrites,
} from '../view-task-writes/view-task-writes.feature';

/**
 * Constant LIST_TASKS_PAGE_SIZE
 *
 * @description
 * Tasks per page of the flat read: the gateway's largest page.
 *
 * @type {number}
 */
export const LIST_TASKS_PAGE_SIZE: number = 100;

/**
 * Constant LIST_TASKS_CAP
 *
 * @description
 * Tasks a flat read stops at, so a huge list cannot hold the view for long: the read ends after
 * the page that reaches it, and `truncated` tells the view tasks were left out.
 *
 * @type {number}
 */
export const LIST_TASKS_CAP: number = 2000;

/**
 * Constant NOTICE_REFRESH_MS
 *
 * @description
 * Time between the first realtime notice (or completed status write, closed detail) of a window
 * and the read it gathers, in milliseconds, for a read of three pages at most: one read per
 * window, as the `List` view does.
 *
 * @type {number}
 */
const NOTICE_REFRESH_MS: number = 1000;

/**
 * Constant MAX_REFRESH_MS
 *
 * @description
 * The widest refresh window, in milliseconds, for a read of fifteen pages or more or a truncated
 * one, so a large list is read again at most every 5 s however many notices arrive.
 *
 * @type {number}
 */
const MAX_REFRESH_MS: number = 5000;

/**
 * Function refreshWindowOf
 *
 * @description
 * The refresh window of a list read in a number of pages: 1 s up to three pages, then 1 s more
 * per three pages, at most 5 s; 5 s for a truncated read.
 *
 * @param {number} pages - Pages the last read took.
 * @param {boolean} truncated - Whether it stopped at the cap.
 * @returns {number} The window, in milliseconds.
 */
export function refreshWindowOf(pages: number, truncated: boolean): number {
  if (truncated) return MAX_REFRESH_MS;
  return Math.min(MAX_REFRESH_MS, Math.max(1, Math.ceil(pages / 3)) * NOTICE_REFRESH_MS);
}

/**
 * Interface TasksParams
 *
 * @description
 * A flat read in the committed organization, with its key.
 */
interface TasksParams extends ListTasksRead {
  // #region Properties
  /**
   * Property organizationId
   *
   * @description
   * The committed organization.
   *
   * @type {string}
   * @readonly
   */
  readonly organizationId: string;

  /**
   * Property key
   *
   * @description
   * Identity of the read: the organization, the list, the query and the due window.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface TasksSnapshot
 *
 * @description
 * What a flat read answers.
 */
export interface TasksSnapshot {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Identity of the read.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property generation
   *
   * @description
   * Rank of the read among the reads begun by the store, from 1.
   *
   * @type {number}
   * @readonly
   */
  readonly generation: number;

  /**
   * Property tasks
   *
   * @description
   * The tasks read, in the view's order.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly tasks: readonly TaskSummary[];

  /**
   * Property total
   *
   * @description
   * Tasks the query matches, as the gateway counts them.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property truncated
   *
   * @description
   * Whether the read stopped at `LIST_TASKS_CAP` with pages left.
   *
   * @type {boolean}
   * @readonly
   */
  readonly truncated: boolean;

  /**
   * Property pages
   *
   * @description
   * Pages the read took, which widens the refresh window of a large list.
   *
   * @type {number}
   * @readonly
   */
  readonly pages: number;
  // #endregion
}

/**
 * Interface ListTasksState
 *
 * @description
 * The read the tasks come from.
 */
interface ListTasksState {
  // #region Properties
  /**
   * Property _read
   *
   * @description
   * The list, query and window to read, null before `load`.
   *
   * @type {ListTasksRead | null}
   * @readonly
   */
  readonly _read: ListTasksRead | null;

  /**
   * Property _scope
   *
   * @description
   * Organization and list of the tasks shown; another one empties them at once.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _scope: string | null;

  /**
   * Property _key
   *
   * @description
   * Key of the read the tasks come from, null before the first answer.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _key: string | null;

  /**
   * Property _total
   *
   * @description
   * Tasks the read query matches, as the gateway counts them.
   *
   * @type {number | null}
   * @readonly
   */
  readonly _total: number | null;

  /**
   * Property truncated
   *
   * @description
   * Whether the last read stopped at `LIST_TASKS_CAP` with tasks left out.
   *
   * @type {boolean}
   * @readonly
   */
  readonly truncated: boolean;

  /**
   * Property _pages
   *
   * @description
   * Pages the last read took.
   *
   * @type {number}
   * @readonly
   */
  readonly _pages: number;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * Nothing read.
 *
 * @type {ListTasksState}
 */
const initialState: ListTasksState = {
  _read: null,
  _scope: null,
  _key: null,
  _total: null,
  truncated: false,
  _pages: 0,
};

/**
 * Function scopeOf
 *
 * @description
 * Organization and list of a read, as one string.
 *
 * @param {TasksParams | undefined} params - The read.
 * @returns {string | null} The scope, null without a read.
 */
function scopeOf(params: TasksParams | undefined): string | null {
  return params ? `${params.organizationId}\u0000${params.listId}` : null;
}

/**
 * Function readAll
 *
 * @description
 * Reads the pages of a flat read in the view's order until the last one, or until the cap.
 *
 * @param {ListTasksApi} api - The data access.
 * @param {TasksParams} params - The read.
 * @param {number} generation - Rank of the read.
 * @param {AbortSignal} signal - Cancels a superseded read.
 * @returns {Promise<TasksSnapshot>} What was read.
 */
async function readAll(
  api: ListTasksApi,
  params: TasksParams,
  generation: number,
  signal: AbortSignal,
): Promise<TasksSnapshot> {
  const tasks: TaskSummary[] = [];
  const seen: Set<string> = new Set<string>();
  const due: DueWindow | null = params.due ?? null;
  let cursor: string | null = null;
  let total: number;
  let pages: number = 0;
  do {
    const page: ListTaskPage = await api.page(
      params.listId,
      params.query,
      null,
      cursor,
      LIST_TASKS_PAGE_SIZE,
      signal,
      due,
    );
    for (const task of page.items) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      tasks.push(task);
    }
    total = page.total;
    cursor = page.nextCursor;
    pages++;
  } while (cursor !== null && tasks.length < LIST_TASKS_CAP);
  return { key: params.key, generation, tasks, total, truncated: cursor !== null, pages };
}

/**
 * Interface ListTasksStoreInstance
 *
 * @description
 * Public API of `ListTasksStore`.
 */
export interface ListTasksStoreInstance {
  // #region Properties
  /**
   * Property primary
   *
   * @description
   * The primary read: a failure reaches the route's error boundary through its `value()`. A
   * reload keeps the tasks in place.
   *
   * @type {ResourceRef<TasksSnapshot | undefined>}
   * @readonly
   */
  readonly primary: ResourceRef<TasksSnapshot | undefined>;

  /**
   * Property items
   *
   * @description
   * The tasks in the view's order, each as shown: the view's writes applied, a moved or deleted
   * task left out, the status a pending click or a write shows.
   *
   * @type {Signal<readonly ListTaskItem[]>}
   * @readonly
   */
  readonly items: Signal<readonly ListTaskItem[]>;

  /**
   * Property initialLoading
   *
   * @description
   * Whether the first read runs with no task to show: the view draws its skeleton.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly initialLoading: Signal<boolean>;

  /**
   * Property hasCurrentSnapshot
   *
   * @description
   * Whether the current read has answered, an empty answer included.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasCurrentSnapshot: Signal<boolean>;

  /**
   * Property empty
   *
   * @description
   * Whether the current read succeeded with no task: the empty state, never a failure.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly empty: Signal<boolean>;

  /**
   * Property truncated
   *
   * @description
   * Whether the read stopped at `LIST_TASKS_CAP` with tasks left out.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly truncated: Signal<boolean>;

  /**
   * Property summary
   *
   * @description
   * The tasks the query matches (the gateway's total, unknown until the read answers) and
   * whether the tasks read have subtasks or are ones, for `ListViewStore.followRows`. With a due
   * window the count stays unknown (null): the window, not the view's filters, narrows the read,
   * and its total leaves out the undated tasks and those due outside it.
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
   * Follows the list, the view's query (`ListViewStore.taskQuery`) and the optional due window.
   * Another read keeps the tasks until it answers (a superseded read is aborted); another list
   * or organization empties them at once and drops late answers.
   *
   * @param {Signal<ListTasksRead> | ListTasksRead} read - What to read.
   */
  load(read: Signal<ListTasksRead> | ListTasksRead): void;

  /**
   * Method reload
   *
   * @description
   * Reads the tasks again in place; queued while a read runs.
   */
  reload(): void;

  /**
   * Method taskOf
   *
   * @description
   * A task as last read, by key.
   *
   * @param {string} key - Task key.
   * @returns {TaskSummary | undefined} The task.
   */
  taskOf(key: string): TaskSummary | undefined;

  /**
   * Method shownStatus
   *
   * @description
   * The status a task shows in the view (a pending change or a write included).
   *
   * @param {TaskSummary} task - The task.
   * @returns {StatusKey} The status.
   */
  shownStatus(task: TaskSummary): StatusKey;

  /**
   * Method act
   *
   * @description
   * A bulk action of the task menu (`withViewTaskWrites`); the tasks change at once and a
   * refusal puts them back. The promise never rejects.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks, as shown.
   * @param {TaskBulkAction} action - The action.
   * @param {Readonly<Partial<Record<string, number>>>} [expected] - The version each task must
   * still be at (an `Undo`).
   * @returns {Promise<ViewTaskOutcome>} What the action ended with.
   */
  act(
    tasks: readonly TaskSummary[],
    action: TaskBulkAction,
    expected?: Readonly<Partial<Record<string, number>>>,
  ): Promise<ViewTaskOutcome>;

  /**
   * Method update
   *
   * @description
   * A single-field write (`updateTask` with `If-Match`): a reschedule, an estimate, a name or
   * custom fields; the name and the dates show at once and a refusal puts them back.
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {TaskFieldChanges} changes - The fields.
   * @param {Readonly<Partial<Record<string, number>>>} [expected] - The version the task must
   * still be at (an `Undo`).
   * @returns {Promise<ViewTaskOutcome>} What the write ended with.
   */
  update(
    task: TaskSummary,
    changes: TaskFieldChanges,
    expected?: Readonly<Partial<Record<string, number>>>,
  ): Promise<ViewTaskOutcome>;

  /**
   * Method remind
   *
   * @description
   * Sets the caller's reminder of each task, four calls at a time.
   *
   * @param {readonly string[]} taskKeys - The tasks.
   * @param {Date} at - When to remind.
   * @returns {Promise<readonly string[]>} The recorded keys.
   */
  remind(taskKeys: readonly string[], at: Date): Promise<readonly string[]>;

  /**
   * Method restore
   *
   * @description
   * Takes deleted tasks out of the trash, four calls at a time, then reads again.
   *
   * @param {readonly string[]} entryIds - The trash entries.
   * @returns {Promise<boolean>} Whether all were restored.
   */
  restore(entryIds: readonly string[]): Promise<boolean>;
  // #endregion
}

/**
 * Function createListTasksStore
 *
 * @description
 * Creates the flat task reader of the calendar, Gantt and sheet views.
 *
 * @returns {Type<ListTasksStoreInstance>} Injectable store constructor.
 */
function createListTasksStore(): Type<ListTasksStoreInstance> {
  return signalStore(
    withEntities<TaskSummary>(),
    withState(initialState),
    withProps((store) => {
      const api: ListTasksApi = inject(ListTasksApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const params: Signal<TasksParams | undefined> = computed(
        (): TasksParams | undefined => {
          const read: ListTasksRead | null = store._read();
          if (!read) return undefined;
          const organizationId: string = workspace.organization().id;
          return {
            ...read,
            organizationId,
            key: JSON.stringify([organizationId, read.listId, read.query, read.due ?? null]),
          };
        },
        { equal: (a: TasksParams | undefined, b: TasksParams | undefined) => a?.key === b?.key },
      );
      let reads: number = 0;
      const primary: ResourceRef<TasksSnapshot | undefined> = resource({
        params: () => params(),
        loader: ({
          params: read,
          abortSignal,
        }: {
          params: TasksParams;
          abortSignal: AbortSignal;
        }): Promise<TasksSnapshot> => readAll(api, read, ++reads, abortSignal),
      });
      return {
        _reloadRequests: new Subject<void>(),
        _reads: (): number => reads,
        _params: params,
        _status: inject(TaskStatusChangesStore),
        _taskCreate: inject(TaskCreate),
        _taskDetail: inject(TaskDetailOpener),
        _realtime: inject(RealtimeConnection, { optional: true }),
        primary,
      };
    }),
    withViewTaskWrites(),
    withComputed((store) => ({
      items: (): readonly ListTaskItem[] =>
        store.entities().flatMap((task: TaskSummary): ListTaskItem[] => {
          const patch: AppliedTaskWrite | null = store._appliedWrite(task);
          if (patch?.hidden) return [];
          const settled: TaskSummary = store._status.settledTask(task);
          const shown: TaskSummary = patch ? { ...settled, ...patch.changes } : settled;
          return [
            {
              task: shown,
              status: patch?.changes.status ?? store._status.displayedStatus(shown),
            },
          ];
        }),
      initialLoading: (): boolean => store._key() === null && store._params() !== undefined,
      hasCurrentSnapshot: (): boolean =>
        store._params() !== undefined && store._key() === store._params()?.key,
    })),
    withComputed((store) => ({
      empty: (): boolean => store.hasCurrentSnapshot() && store.items().length === 0,
      summary: (): ListRowsSummary =>
        store.hasCurrentSnapshot()
          ? {
              visibleCount: store._params()?.due ? null : store._total(),
              hasSubtasks: store
                .entities()
                .some(
                  (task: TaskSummary): boolean =>
                    task.subtasks.total > 0 || task.parentKey !== null,
                ),
            }
          : { visibleCount: null, hasSubtasks: null },
    })),
    withMethods((store) => {
      let reloadQueued: boolean = false;
      const reload: () => void = (): void => {
        if (!store.primary.reload() && store._params() !== undefined) reloadQueued = true;
      };
      return {
        _follow: signalMethod<TasksParams | undefined>((params: TasksParams | undefined): void => {
          const scope: string | null = scopeOf(params);
          if (scope === null || scope === store._scope()) return;
          store._resetWrites();
          patchState(store, removeAllEntities(), {
            _scope: scope,
            _key: null,
            _total: null,
            truncated: false,
            _pages: 0,
          });
        }),
        _apply: signalMethod<TasksSnapshot | undefined>(
          (snapshot: TasksSnapshot | undefined): void => {
            if (!snapshot || snapshot.key !== store._params()?.key) return;
            patchState(store, setAllEntities([...snapshot.tasks]), {
              _key: snapshot.key,
              _total: snapshot.total,
              truncated: snapshot.truncated,
              _pages: snapshot.pages,
            });
            store._settleWrites(snapshot.generation);
          },
        ),
        _flushReload: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status !== 'loading' && status !== 'reloading' && reloadQueued) {
            reloadQueued = false;
            store.primary.reload();
          }
        }),
        _watch: rxMethod<string | null>(
          pipe(
            switchMap((listId: string | null): Observable<RealtimeChange> =>
              listId === null || !store._realtime
                ? EMPTY
                : store._realtime.watch({ kind: 'list', listId }).pipe(catchError(() => EMPTY)),
            ),
            filter((notice: RealtimeChange): boolean => {
              const data: unknown = notice.data;
              const listId: string | undefined = store._params()?.listId;
              return (
                typeof data === 'object' &&
                data !== null &&
                (!('listId' in data) || data.listId === listId)
              );
            }),
            tap((): void => {
              store._reloadRequests.next();
            }),
          ),
        ),
        load: signalMethod<ListTasksRead>((read: ListTasksRead): void => {
          patchState(store, { _read: read });
        }),
        reload,
        taskOf(key: string): TaskSummary | undefined {
          return store.entityMap()[key];
        },
        shownStatus(task: TaskSummary): StatusKey {
          return (
            store.items().find((item: ListTaskItem): boolean => item.task.key === task.key)
              ?.status ?? store._status.displayedStatus(task)
          );
        },
      };
    }),
    withHooks({
      onInit(store): void {
        const destroyRef: DestroyRef = inject(DestroyRef);
        store._connectWrites({
          taskOf: (key: string): TaskSummary | undefined => store.taskOf(key),
          reads: store._reads,
          scope: (): string | null => scopeOf(store._params()),
          reload: (): void => {
            store.reload();
          },
          filed: (): void => undefined,
        });
        store._follow(store._params);
        store._apply(
          computed((): TasksSnapshot | undefined =>
            store.primary.hasValue() ? store.primary.value() : undefined,
          ),
        );
        store._flushReload(store.primary.status);
        const reloads: { unsubscribe: () => void } = store._reloadRequests
          .pipe(audit(() => timer(refreshWindowOf(store._pages(), store.truncated()))))
          .subscribe((): void => {
            store.reload();
          });
        store._watch(computed((): string | null => store._params()?.listId ?? null));
        const completions: { unsubscribe: () => void } = store._status.completed.subscribe(
          ({
            task,
            organizationId,
          }: {
            task: TaskSummary;
            organizationId: string | null;
          }): void => {
            const params: TasksParams | undefined = store._params();
            if (task.listId === params?.listId && organizationId === params.organizationId) {
              store._reloadRequests.next();
            }
          },
        );
        const created: { unsubscribe: () => void } = store._taskCreate.created.subscribe(
          (task: CreatedTask): void => {
            if (task.listId === store._params()?.listId) store.reload();
          },
        );
        const detailClosings: { unsubscribe: () => void } = merge(
          store._taskDetail.closed,
          store._taskDetail.changed,
        ).subscribe((): void => {
          if (store._params()) store._reloadRequests.next();
        });
        destroyRef.onDestroy((): void => {
          completions.unsubscribe();
          created.unsubscribe();
          detailClosings.unsubscribe();
          reloads.unsubscribe();
          store._reloadRequests.complete();
        });
      },
    }),
  );
}

/**
 * Constant ListTasksStore
 *
 * @description
 * The flat task reader of the calendar, Gantt and sheet views, route-scoped through their
 * `<VIEW>_VIEW_PROVIDERS` (with Task's `TaskStatusChangesStore`): the tasks of the list with the
 * view's query (`ListViewStore.taskQuery`) and an optional due window (`queryListTasks` with
 * `dueFrom` and `dueTo`), read page after page to the last one, stopping at `LIST_TASKS_CAP`
 * (`truncated`). Another read keeps the tasks until it answers and aborts a superseded one;
 * another list or organization (`WORKSPACE_CONTEXT`) empties them at once and drops late
 * answers. A failed first read fails `primary` to the route's error boundary; a failed refresh
 * keeps the tasks. It watches the list's realtime room and reads again in place 1 s after the
 * first notice of a window, once per window (up to 5 s for a large or truncated read:
 * `refreshWindowOf`); so do a completed status write, a task detail that
 * closes over the view or whose `Undo` restored a task (`TaskDetailOpener.closed`, `changed`),
 * and a task created in the list (at once). It composes the shared task writes
 * (`withViewTaskWrites`): `act` and `update` change `items` at once and a refusal puts them back.
 * `summary` is what the view publishes with `ListViewStore.followRows` (its count unknown while a
 * due window applies).
 *
 * @type {Type<ListTasksStoreInstance>}
 */
export const ListTasksStore: Type<ListTasksStoreInstance> = createListTasksStore();
