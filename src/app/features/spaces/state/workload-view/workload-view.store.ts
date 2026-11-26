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
 * Interface WorkloadDrag
 *
 * @description
 * What the toasts of a task's reassignment name: the rows of its latest drag.
 */
interface WorkloadDrag {
  // #region Properties
  /**
   * Property fromName
   *
   * @description
   * Name of the row the task left.
   *
   * @type {string}
   * @readonly
   */
  readonly fromName: string;

  /**
   * Property toName
   *
   * @description
   * Name of the row the task joined.
   *
   * @type {string}
   * @readonly
   */
  readonly toName: string;
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
   * Property _intents
   *
   * @description
   * The assignees each task is being reassigned to, by task key (empty for nobody), while its
   * writes run: the grid files the task under them at once.
   *
   * @type {Readonly<Partial<Record<string, readonly string[]>>>}
   * @readonly
   */
  readonly _intents: Readonly<Partial<Record<string, readonly string[]>>>;
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
    _intents: {},
  };
}

/**
 * Function draggedAssignees
 *
 * @description
 * The assignees a task is meant to have once a chip is dropped: `to` joins (unless null, the
 * unassigned row), `from` leaves.
 *
 * @param {readonly string[]} assignees - The assignees meant so far.
 * @param {string | null} from - The person the task leaves.
 * @param {string | null} to - The person the task joins.
 * @returns {readonly string[]} The assignees meant now.
 */
function draggedAssignees(
  assignees: readonly string[],
  from: string | null,
  to: string | null,
): readonly string[] {
  const joined: readonly string[] = to === null ? assignees : [...new Set([...assignees, to])];
  return joined.filter((id: string): boolean => id !== from);
}

/**
 * Function sameAssignees
 *
 * @description
 * Whether two lists of assignees hold the same people, in any order.
 *
 * @param {readonly string[]} a - The first.
 * @param {readonly string[]} b - The second.
 * @returns {boolean} Whether they match.
 */
function sameAssignees(a: readonly string[], b: readonly string[]): boolean {
  const second: ReadonlySet<string> = new Set<string>(b);
  return new Set<string>(a).size === second.size && a.every((id: string) => second.has(id));
}

/**
 * Function nextStep
 *
 * @description
 * The next write that brings a task's assignees towards the meant ones: an assignment first, so
 * a refusal never leaves the task with fewer people than meant, then a removal; null once they
 * match.
 *
 * @param {readonly string[]} current - The assignees as shown.
 * @param {readonly string[]} meant - The assignees meant.
 * @returns {TaskBulkAction | null} The write.
 */
function nextStep(current: readonly string[], meant: readonly string[]): TaskBulkAction | null {
  const missing: string | undefined = meant.find((id: string) => !current.includes(id));
  if (missing !== undefined) return { type: 'assign', userId: missing };
  const extra: string | undefined = current.find((id: string) => !meant.includes(id));
  return extra === undefined ? null : { type: 'unassign', userId: extra };
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
   * A chip dropped on another row: the task is meant to have `to` (unless the unassigned row)
   * and no longer `from`, applied to the assignees meant by the drags still running, and shown at
   * once. One worker per task brings the assignees to the meant ones through the task reader's
   * writes (`ListTasksStore.act`), one write at a time, each computed from the assignees as
   * shown when its turn comes: assignments first, then removals. A drag made meanwhile changes
   * what is meant, so a task dragged back before the first write answers is never left without
   * the person it came back to. Once settled, the toast `CAD-482 reassigned` / `From X to Y.`
   * (the latest drag's rows) offers `Undo`, which waits for a reassignment of the task still
   * running to settle, then brings back the assignees of before, sent with the version the
   * reassignment left: a task changed since (by a later drag or elsewhere) is left as it is, with
   * `CAD-482 changed since`. A task brought back to where it started shows no toast. A
   * refused or unanswered first write sends nothing more; a refusal after an applied write
   * warns `CAD-482 was assigned to Y but stays assigned to X.` with an `Undo` of what was
   * applied. The promise never rejects.
   *
   * @param {WorkloadReassignment} reassignment - The task and the two rows.
   * @returns {Promise<void>} Resolves once the task's worker has settled and reported.
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
          const intents: Readonly<Partial<Record<string, readonly string[]>>> = store._intents();
          return workloadLoads(
            snapshot,
            (taskKey: string): ShownWorkloadTask | null | undefined => {
              const item: ListTaskItem | undefined = items.get(taskKey);
              if (item) {
                if (item.status === 'cancelled') return null;
                return {
                  task: item.task,
                  status: item.status,
                  assigneeIds: intents[taskKey] ?? item.task.assigneeIds,
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

      const drags: Map<string, WorkloadDrag> = new Map<string, WorkloadDrag>();
      const workers: Map<string, Promise<void>> = new Map<string, Promise<void>>();

      const setIntent: (key: string, meant: readonly string[] | null) => void = (
        key: string,
        meant: readonly string[] | null,
      ): void => {
        if (store._destroyRef.destroyed) return;
        const others: Partial<Record<string, readonly string[]>> = Object.fromEntries(
          Object.entries(store._intents()).filter(
            ([taskKey]: [string, readonly string[] | undefined]) => taskKey !== key,
          ),
        );
        patchState(store, { _intents: meant ? { ...others, [key]: meant } : others });
      };

      const keepToast: (id: string) => void = (id: string): void => {
        store._undoToasts.add(id);
      };

      const work: (
        key: string,
        expected: Readonly<Partial<Record<string, number>>> | null,
      ) => Promise<void> = async (
        key: string,
        expected: Readonly<Partial<Record<string, number>>> | null,
      ): Promise<void> => {
        const organizationId: string = store._workspace.organization().id;
        const current: () => boolean = (): boolean =>
          !store._destroyRef.destroyed && store._workspace.organization().id === organizationId;
        const start: readonly string[] = [...(shownTask(key)?.assigneeIds ?? [])];
        let versions: Readonly<Partial<Record<string, number>>> | undefined = expected ?? undefined;
        let last: ViewTaskOutcome | null = null;
        let stopped: 'refused' | 'unknown' | 'changed' | null = null;
        while (current()) {
          const meant: readonly string[] | undefined = store._intents()[key];
          const task: TaskSummary | undefined = shownTask(key);
          const step: TaskBulkAction | null =
            meant && task ? nextStep(task.assigneeIds, meant) : null;
          if (!task || !step) break;
          const outcome: ViewTaskOutcome = await store._tasks.act([task], step, versions);
          if (outcome.changed.length > 0) {
            stopped = 'changed';
            break;
          }
          if (outcome.done.length === 0) {
            stopped =
              outcome.unknown.length > 0 || outcome.notSent.length > 0 ? 'unknown' : 'refused';
            break;
          }
          last = outcome;
          if (versions) versions = outcome.after;
        }
        setIntent(key, null);
        if (!current()) return;
        if (last || stopped === 'unknown') store._page.refreshCounts();
        const { fromName, toName }: WorkloadDrag = drags.get(key) ?? { fromName: '', toName: '' };
        if (stopped === 'changed') {
          store._toasts.warning(undoConflictTitle([key]), { description: undoConflictText(1) });
          return;
        }
        if (stopped === 'unknown') {
          store._toasts.warning(
            $localize`:@@spaces.workload.reassign-unknown:The outcome of the reassignment is unknown. The workload is being refreshed.`,
          );
          return;
        }
        if (!last) {
          if (stopped === 'refused') {
            store._toasts.error(
              $localize`:@@spaces.workload.reassign-failed:The task could not be reassigned`,
            );
          }
          return;
        }
        if (sameAssignees(shownTask(key)?.assigneeIds ?? [], start)) return;
        const after: Readonly<Partial<Record<string, number>>> = last.after;
        const restore: () => void = (): void => {
          void undo(key, start, after);
        };
        if (stopped === 'refused') {
          keepToast(
            store._toasts.warning(
              $localize`:@@spaces.workload.reassigned-partly:${key}:key: was assigned to ${toName}:to: but stays assigned to ${fromName}:from:.`,
              { undo: restore },
            ),
          );
          return;
        }
        if (expected) return;
        keepToast(
          store._toasts.show($localize`:@@spaces.workload.reassigned:${key}:key: reassigned`, {
            description: $localize`:@@spaces.workload.reassigned-text:From ${fromName}:from: to ${toName}:to:.`,
            undo: restore,
          }),
        );
      };

      const drive: (
        key: string,
        meant: readonly string[],
        expected: Readonly<Partial<Record<string, number>>> | null,
      ) => Promise<void> = (
        key: string,
        meant: readonly string[],
        expected: Readonly<Partial<Record<string, number>>> | null,
      ): Promise<void> => {
        setIntent(key, meant);
        const running: Promise<void> | undefined = workers.get(key);
        if (running) return running;
        const worker: Promise<void> = work(key, expected).finally((): void => {
          workers.delete(key);
        });
        workers.set(key, worker);
        return worker;
      };

      const undo: (
        key: string,
        start: readonly string[],
        after: Readonly<Partial<Record<string, number>>>,
      ) => Promise<void> = async (
        key: string,
        start: readonly string[],
        after: Readonly<Partial<Record<string, number>>>,
      ): Promise<void> => {
        for (
          let running: Promise<void> | undefined = workers.get(key);
          running;
          running = workers.get(key)
        ) {
          await running;
        }
        if (store._destroyRef.destroyed) return;
        await drive(key, start, after);
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
        reassign(reassignment: WorkloadReassignment): Promise<void> {
          const { from, to, fromName, toName }: WorkloadReassignment = reassignment;
          const key: string = reassignment.task.key;
          if (from === to) return Promise.resolve();
          const meant: readonly string[] =
            store._intents()[key] ?? (shownTask(key) ?? reassignment.task).assigneeIds;
          const next: readonly string[] = draggedAssignees(meant, from, to);
          if (sameAssignees(next, meant)) return Promise.resolve();
          drags.set(key, { fromName, toName });
          return drive(key, next, null);
        },
        _follow: signalMethod<WorkloadParams | undefined>(
          (params: WorkloadParams | undefined): void => {
            const scope: string | null = params
              ? `${params.organizationId}\u0000${params.listId}`
              : null;
            if (scope === null || scope === store._scope()) return;
            patchState(store, { _scope: scope, _snapshot: null, _intents: {} });
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
