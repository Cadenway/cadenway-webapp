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
import { CwToastService } from '@cadenway/ui/components/toast';
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
import {
  WORKSPACE_CONTEXT,
  type WorkspaceContextPort,
} from '@features/workspace/ports/workspace-context';

import { undoConflictText, undoConflictTitle } from '../../constants/bulk-copy/bulk-copy.constants';
import { WorkloadApi } from '../../data-access/services/workload-api/workload-api.service';
import type { ListTaskItem } from '../../models/list-tasks/list-tasks.interface';
import type { ViewTaskOutcome } from '../../models/view-task-write/view-task-write.interface';
import type {
  ShownWorkloadTask,
  WorkloadLoad,
  WorkloadRead,
  WorkloadReassignment,
  WorkloadSnapshot,
} from '../../models/workload/workload.interface';
import { todayIso } from '../../utils/calendar-date/calendar-date.util';
import { addDays, mondayOf, workloadDays, workloadLoads } from '../../utils/workload/workload.util';
import { ListPageStore } from '../list-page/list-page.store';
import {
  ListTasksStore,
  type ListTasksStoreInstance,
  type TasksSnapshot,
} from '../list-tasks/list-tasks.store';

/**
 * Interface WorkloadParams
 *
 * @description
 * A workload read in the committed organization, with its key.
 */
interface WorkloadParams extends WorkloadRead {
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
   * Property weekStart
   *
   * @description
   * Monday of the first week shown.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property key
   *
   * @description
   * Identity of the read: the organization, the list, the query and the week.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;
  // #endregion
}

/**
 * Interface SpentParams
 *
 * @description
 * A timesheet read: the organization, the list and the two weeks, with its key.
 */
interface SpentParams {
  // #region Properties
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
   * Monday of the first week.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

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
  // #endregion
}

/**
 * Interface WorkloadMove
 *
 * @description
 * A reassignment of the view in flight: the person a task leaves and the one it joins (null for
 * the unassigned bucket), shown at once while its writes run one after the other.
 */
interface WorkloadMove {
  // #region Properties
  /**
   * Property from
   *
   * @description
   * The person the task leaves.
   *
   * @type {string | null}
   * @readonly
   */
  readonly from: string | null;

  /**
   * Property to
   *
   * @description
   * The person the task joins.
   *
   * @type {string | null}
   * @readonly
   */
  readonly to: string | null;
  // #endregion
}

/**
 * Interface WorkloadViewState
 *
 * @description
 * The week shown, the read and the reassignments in flight.
 */
interface WorkloadViewState {
  // #region Properties
  /**
   * Property _read
   *
   * @description
   * The list and query to read, null before `load`.
   *
   * @type {WorkloadRead | null}
   * @readonly
   */
  readonly _read: WorkloadRead | null;

  /**
   * Property today
   *
   * @description
   * The caller's date when the view opened, `YYYY-MM-DD`: the current column and `Today`.
   *
   * @type {string}
   * @readonly
   */
  readonly today: string;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the first of the two weeks shown.
   *
   * @type {string}
   * @readonly
   */
  readonly weekStart: string;

  /**
   * Property _scope
   *
   * @description
   * Organization and list of the workload shown; another one empties it at once.
   *
   * @type {string | null}
   * @readonly
   */
  readonly _scope: string | null;

  /**
   * Property _snapshot
   *
   * @description
   * The last workload read of the scope, kept while another query or week is read.
   *
   * @type {WorkloadSnapshot | null}
   * @readonly
   */
  readonly _snapshot: WorkloadSnapshot | null;

  /**
   * Property _moves
   *
   * @description
   * Reassignments in flight, by task key.
   *
   * @type {Readonly<Record<string, WorkloadMove>>}
   * @readonly
   */
  readonly _moves: Readonly<Record<string, WorkloadMove>>;
  // #endregion
}

/**
 * Function initialStateOf
 *
 * @description
 * Nothing read, the current week shown.
 *
 * @param {string} today - The caller's date.
 * @returns {WorkloadViewState} The state.
 */
function initialStateOf(today: string): WorkloadViewState {
  return {
    _read: null,
    today,
    weekStart: mondayOf(today),
    _scope: null,
    _snapshot: null,
    _moves: {},
  };
}

/**
 * Function movedAssignees
 *
 * @description
 * The assignees of a task once a reassignment in flight applies: `to` joins, `from` leaves.
 *
 * @param {readonly string[]} assignees - The assignees as shown.
 * @param {WorkloadMove | undefined} move - The reassignment, if any.
 * @returns {readonly string[]} The assignees the grid files the task under.
 */
function movedAssignees(
  assignees: readonly string[],
  move: WorkloadMove | undefined,
): readonly string[] {
  if (!move) return assignees;
  const joined: readonly string[] =
    move.to === null ? assignees : [...new Set([...assignees, move.to])];
  return joined.filter((id: string): boolean => id !== move.from);
}

/**
 * Interface WorkloadViewStoreInstance
 *
 * @description
 * Public API of `WorkloadViewStore`.
 */
export interface WorkloadViewStoreInstance {
  // #region Properties
  /**
   * Property primary
   *
   * @description
   * The workload read: a failure without a current answer reaches the route's error boundary
   * through its `value()`; a failed refresh keeps the grid.
   *
   * @type {ResourceRef<WorkloadSnapshot | undefined>}
   * @readonly
   */
  readonly primary: ResourceRef<WorkloadSnapshot | undefined>;

  /**
   * Property spent
   *
   * @description
   * Minutes each person recorded on the list over the two weeks, by account id: a secondary read
   * with its own inline error.
   *
   * @type {ResourceRef<Readonly<Record<string, number>> | undefined>}
   * @readonly
   */
  readonly spent: ResourceRef<Readonly<Record<string, number>> | undefined>;

  /**
   * Property today
   *
   * @description
   * The caller's date when the view opened.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly today: Signal<string>;

  /**
   * Property weekStart
   *
   * @description
   * Monday of the first week shown.
   *
   * @type {Signal<string>}
   * @readonly
   */
  readonly weekStart: Signal<string>;

  /**
   * Property days
   *
   * @description
   * The ten weekdays shown, `YYYY-MM-DD`.
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly days: Signal<readonly string[]>;

  /**
   * Property hasCurrentSnapshot
   *
   * @description
   * Whether the current read (list, query and week) has answered.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasCurrentSnapshot: Signal<boolean>;

  /**
   * Property loading
   *
   * @description
   * Whether the weeks shown are not read yet: the grid draws its skeleton. Another query of the
   * same weeks keeps the grid until it answers.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property loads
   *
   * @description
   * The load of each row read, the tasks as the view shows them (`workloadLoads`).
   *
   * @type {Signal<readonly WorkloadLoad[]>}
   * @readonly
   */
  readonly loads: Signal<readonly WorkloadLoad[]>;
  // #endregion

  // #region Methods
  /**
   * Method load
   *
   * @description
   * Follows the list and the view's query. Another read keeps the grid until it answers;
   * another list or organization empties it at once.
   *
   * @param {Signal<WorkloadRead> | WorkloadRead} read - What to read.
   */
  load(read: Signal<WorkloadRead> | WorkloadRead): void;

  /**
   * Method previousWeek
   *
   * @description
   * Shows the two weeks starting a week earlier.
   */
  previousWeek(): void;

  /**
   * Method nextWeek
   *
   * @description
   * Shows the two weeks starting a week later.
   */
  nextWeek(): void;

  /**
   * Method thisWeek
   *
   * @description
   * Shows the two weeks starting this week (`Today`).
   */
  thisWeek(): void;

  /**
   * Method reload
   *
   * @description
   * Reads the workload and the time spent again in place; queued while a read runs.
   */
  reload(): void;

  /**
   * Method reassign
   *
   * @description
   * A chip dropped on another row: assigns `to` (when it is not assigned already), then removes
   * `from`, through the task reader's writes (`ListTasksStore.act`), shown at once. The toast
   * `CAD-482 reassigned` / `From X to Y.` offers `Undo`, which assigns `from` back then removes
   * `to`, bound to the version the reassignment left the task at. A refused or unanswered
   * assignment sends nothing more; a refused removal leaves the task with both people, as the
   * grid then shows. The promise never rejects.
   *
   * @param {WorkloadReassignment} reassignment - The task and the two rows.
   * @returns {Promise<void>} Resolves once reported.
   */
  reassign(reassignment: WorkloadReassignment): Promise<void>;
  // #endregion
}

/**
 * Function createWorkloadViewStore
 *
 * @description
 * Creates the `Workload` view's store.
 *
 * @returns {Type<WorkloadViewStoreInstance>} Injectable store constructor.
 */
function createWorkloadViewStore(): Type<WorkloadViewStoreInstance> {
  return signalStore(
    withState(() => initialStateOf(todayIso())),
    withProps((store) => {
      const api: WorkloadApi = inject(WorkloadApi);
      const workspace: WorkspaceContextPort = inject(WORKSPACE_CONTEXT);
      const params: Signal<WorkloadParams | undefined> = computed(
        (): WorkloadParams | undefined => {
          const read: WorkloadRead | null = store._read();
          if (!read) return undefined;
          const organizationId: string = workspace.organization().id;
          const weekStart: string = store.weekStart();
          return {
            ...read,
            organizationId,
            weekStart,
            key: JSON.stringify([organizationId, read.listId, read.query, weekStart]),
          };
        },
        {
          equal: (a: WorkloadParams | undefined, b: WorkloadParams | undefined) =>
            a?.key === b?.key,
        },
      );
      const spentParams: Signal<SpentParams | undefined> = computed(
        (): SpentParams | undefined => {
          const read: WorkloadParams | undefined = params();
          return read
            ? {
                listId: read.listId,
                weekStart: read.weekStart,
                key: JSON.stringify([read.organizationId, read.listId, read.weekStart]),
              }
            : undefined;
        },
        { equal: (a: SpentParams | undefined, b: SpentParams | undefined) => a?.key === b?.key },
      );
      return {
        _api: api,
        _workspace: workspace,
        _params: params,
        _tasks: inject<ListTasksStoreInstance>(ListTasksStore),
        _page: inject(ListPageStore),
        _toasts: inject(CwToastService),
        _destroyRef: inject(DestroyRef),
        _undoToasts: new Set<string>(),
        primary: resource({
          params: () => params(),
          loader: async ({
            params: read,
            abortSignal,
          }: {
            params: WorkloadParams;
            abortSignal: AbortSignal;
          }): Promise<WorkloadSnapshot> => ({
            key: read.key,
            ...(await api.workload(read.listId, read.query, read.weekStart, abortSignal)),
          }),
        }),
        spent: resource({
          params: () => spentParams(),
          loader: ({
            params: read,
            abortSignal,
          }: {
            params: SpentParams;
            abortSignal: AbortSignal;
          }): Promise<Readonly<Record<string, number>>> =>
            api.spent(read.listId, read.weekStart, abortSignal),
        }),
      };
    }),
    withComputed((store) => {
      const itemsByKey: Signal<ReadonlyMap<string, ListTaskItem>> = computed(
        () =>
          new Map<string, ListTaskItem>(
            store._tasks
              .items()
              .map((item: ListTaskItem): [string, ListTaskItem] => [item.task.key, item]),
          ),
      );
      return {
        days: (): readonly string[] => workloadDays(store.weekStart()),
        hasCurrentSnapshot: (): boolean =>
          store._params() !== undefined && store._snapshot()?.key === store._params()?.key,
        loading: (): boolean =>
          store._params() !== undefined && store._snapshot()?.weekStart !== store.weekStart(),
        loads: (): readonly WorkloadLoad[] => {
          const snapshot: WorkloadSnapshot | null = store._snapshot();
          if (!snapshot) return [];
          const items: ReadonlyMap<string, ListTaskItem> = itemsByKey();
          const moves: Readonly<Record<string, WorkloadMove>> = store._moves();
          return workloadLoads(
            snapshot,
            (taskKey: string): ShownWorkloadTask | null | undefined => {
              const item: ListTaskItem | undefined = items.get(taskKey);
              if (item) {
                if (item.status === 'cancelled') return null;
                return {
                  task: item.task,
                  status: item.status,
                  assigneeIds: movedAssignees(item.task.assigneeIds, moves[taskKey]),
                };
              }
              return store._tasks.taskOf(taskKey) ? null : undefined;
            },
          );
        },
      };
    }),
    withMethods((store) => {
      let reloadQueued: boolean = false;
      let seenTasks: { key: string; generation: number } | null = null;
      const reload: () => void = (): void => {
        if (store._params() === undefined) return;
        store.spent.reload();
        if (!store.primary.reload()) reloadQueued = true;
      };

      const shownTask: (key: string) => TaskSummary | undefined = (
        key: string,
      ): TaskSummary | undefined =>
        store._tasks.items().find((item: ListTaskItem): boolean => item.task.key === key)?.task ??
        store._tasks.taskOf(key);

      const setMove: (key: string, move: WorkloadMove | null) => void = (
        key: string,
        move: WorkloadMove | null,
      ): void => {
        if (store._destroyRef.destroyed) return;
        const others: Record<string, WorkloadMove> = Object.fromEntries(
          Object.entries(store._moves()).filter(
            ([taskKey]: [string, WorkloadMove]) => taskKey !== key,
          ),
        );
        patchState(store, { _moves: move ? { ...others, [key]: move } : others });
      };

      const reportFailure: (outcome: ViewTaskOutcome) => void = (
        outcome: ViewTaskOutcome,
      ): void => {
        if (outcome.unknown.length > 0 || outcome.notSent.length > 0) {
          store._toasts.warning(
            $localize`:@@spaces.workload.reassign-unknown:The outcome of the reassignment is unknown. The workload is being refreshed.`,
          );
          return;
        }
        store._toasts.error(
          $localize`:@@spaces.workload.reassign-failed:The task could not be reassigned`,
        );
      };

      const runSteps: (
        key: string,
        steps: readonly TaskBulkAction[],
        expected?: Readonly<Partial<Record<string, number>>>,
      ) => Promise<{ applied: readonly TaskBulkAction[]; last: ViewTaskOutcome | null }> = async (
        key: string,
        steps: readonly TaskBulkAction[],
        expected?: Readonly<Partial<Record<string, number>>>,
      ): Promise<{ applied: readonly TaskBulkAction[]; last: ViewTaskOutcome | null }> => {
        const applied: TaskBulkAction[] = [];
        let last: ViewTaskOutcome | null = null;
        let versions: Readonly<Partial<Record<string, number>>> | undefined = expected;
        for (const action of steps) {
          const task: TaskSummary | undefined = shownTask(key);
          if (!task) break;
          const outcome: ViewTaskOutcome = await store._tasks.act([task], action, versions);
          if (outcome.changed.length > 0) {
            store._toasts.warning(undoConflictTitle([key]), {
              description: undoConflictText(1),
            });
            break;
          }
          if (outcome.done.length === 0) {
            reportFailure(outcome);
            break;
          }
          applied.push(action);
          last = outcome;
          if (versions) versions = outcome.after;
        }
        return { applied, last };
      };

      const undo: (
        key: string,
        move: WorkloadMove,
        applied: readonly TaskBulkAction[],
        after: Readonly<Partial<Record<string, number>>>,
      ) => Promise<void> = async (
        key: string,
        move: WorkloadMove,
        applied: readonly TaskBulkAction[],
        after: Readonly<Partial<Record<string, number>>>,
      ): Promise<void> => {
        const reverse: readonly TaskBulkAction[] = [...applied]
          .reverse()
          .flatMap((action: TaskBulkAction): TaskBulkAction[] =>
            action.type === 'assign'
              ? [{ type: 'unassign', userId: action.userId }]
              : action.type === 'unassign'
                ? [{ type: 'assign', userId: action.userId }]
                : [],
          );
        const organizationId: string = store._workspace.organization().id;
        setMove(key, { from: move.to, to: move.from });
        const { applied: undone }: { applied: readonly TaskBulkAction[] } = await runSteps(
          key,
          reverse,
          after,
        );
        setMove(key, null);
        if (undone.length > 0 && store._workspace.organization().id === organizationId) {
          if (!store._destroyRef.destroyed) store._page.refreshCounts();
        }
      };

      return {
        load: signalMethod<WorkloadRead>((read: WorkloadRead): void => {
          patchState(store, { _read: read });
        }),
        previousWeek(): void {
          patchState(store, { weekStart: addDays(store.weekStart(), -7) });
        },
        nextWeek(): void {
          patchState(store, { weekStart: addDays(store.weekStart(), 7) });
        },
        thisWeek(): void {
          patchState(store, { weekStart: mondayOf(store.today()) });
        },
        reload,
        async reassign(reassignment: WorkloadReassignment): Promise<void> {
          const { from, to, fromName, toName }: WorkloadReassignment = reassignment;
          const key: string = reassignment.task.key;
          if (from === to) return;
          const shown: TaskSummary = shownTask(key) ?? reassignment.task;
          const steps: TaskBulkAction[] = [];
          if (to !== null && !shown.assigneeIds.includes(to)) {
            steps.push({ type: 'assign', userId: to });
          }
          if (from !== null && shown.assigneeIds.includes(from)) {
            steps.push({ type: 'unassign', userId: from });
          }
          if (steps.length === 0) return;
          const organizationId: string = store._workspace.organization().id;
          const move: WorkloadMove = { from, to };
          setMove(key, move);
          const {
            applied,
            last,
          }: { applied: readonly TaskBulkAction[]; last: ViewTaskOutcome | null } = await runSteps(
            key,
            steps,
          );
          setMove(key, null);
          if (
            applied.length === 0 ||
            !last ||
            store._destroyRef.destroyed ||
            store._workspace.organization().id !== organizationId
          ) {
            return;
          }
          store._page.refreshCounts();
          if (applied.length < steps.length) return;
          const after: Readonly<Partial<Record<string, number>>> = last.after;
          const id: string = store._toasts.show(
            $localize`:@@spaces.workload.reassigned:${key}:key: reassigned`,
            {
              description: $localize`:@@spaces.workload.reassigned-text:From ${fromName}:from: to ${toName}:to:.`,
              undo: (): void => {
                void undo(key, move, applied, after);
              },
            },
          );
          store._undoToasts.add(id);
        },
        _follow: signalMethod<WorkloadParams | undefined>(
          (params: WorkloadParams | undefined): void => {
            const scope: string | null = params
              ? `${params.organizationId}\u0000${params.listId}`
              : null;
            if (scope === null || scope === store._scope()) return;
            patchState(store, { _scope: scope, _snapshot: null, _moves: {} });
          },
        ),
        _apply: signalMethod<WorkloadSnapshot | undefined>(
          (snapshot: WorkloadSnapshot | undefined): void => {
            if (!snapshot || snapshot.key !== store._params()?.key) return;
            patchState(store, { _snapshot: snapshot });
          },
        ),
        _followTasks: signalMethod<TasksSnapshot | undefined>(
          (snapshot: TasksSnapshot | undefined): void => {
            if (!snapshot) return;
            const refreshed: boolean =
              seenTasks !== null &&
              seenTasks.key === snapshot.key &&
              snapshot.generation > seenTasks.generation;
            seenTasks = { key: snapshot.key, generation: snapshot.generation };
            if (refreshed) reload();
          },
        ),
        _flushReload: signalMethod<ResourceStatus>((status: ResourceStatus): void => {
          if (status !== 'loading' && status !== 'reloading' && reloadQueued) {
            reloadQueued = false;
            store.primary.reload();
          }
        }),
      };
    }),
    withHooks({
      onInit(store): void {
        store._follow(store._params);
        store._apply(
          computed((): WorkloadSnapshot | undefined =>
            store.primary.hasValue() ? store.primary.value() : undefined,
          ),
        );
        store._flushReload(store.primary.status);
        store._followTasks(
          computed((): TasksSnapshot | undefined =>
            store._tasks.primary.hasValue() ? store._tasks.primary.value() : undefined,
          ),
        );
      },
      onDestroy(store): void {
        for (const id of store._undoToasts) store._toasts.dismiss(id);
        store._undoToasts.clear();
      },
    }),
  );
}

/**
 * Constant WorkloadViewStore
 *
 * @description
 * The state of the `Workload` view (`l/:listId/workload`), route-scoped through
 * `WORKLOAD_VIEW_PROVIDERS` with the list's task reader (`ListTasksStore`), which the view reads
 * with the same query for its task menu and its writes. It reads the allocations of the two
 * weeks shown (`WorkloadApi.workload`, every page) and the time each person recorded over them
 * (`WorkloadApi.spent`, a secondary read); `previousWeek`, `nextWeek` and `thisWeek` move the
 * weeks. Another list or organization empties the grid at once; another query keeps it until the
 * answer, another week shows the skeleton. Each time the task reader reads the same query again
 * in place (realtime notices, a completed status write, a closed task detail, a write of the
 * view), the workload and the time spent are read again. `loads` files each task under the
 * people the view shows it with, so a write of the menu or a reassignment moves it at once, and
 * leaves out the tasks the view no longer shows (moved, deleted, cancelled). `reassign` serves
 * the drag of a chip to another row, with its toast and `Undo`; leaving the view dismisses its
 * `Undo` toasts.
 *
 * @type {Type<WorkloadViewStoreInstance>}
 */
export const WorkloadViewStore: Type<WorkloadViewStoreInstance> = createWorkloadViewStore();
