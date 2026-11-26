import { MediaMatcher } from '@angular/cdk/layout';
import { DestroyRef, inject } from '@angular/core';
import {
  type EmptyFeatureResult,
  patchState,
  type SignalStoreFeature,
  signalStoreFeature,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  STATUS_SETTLE_MS,
  TaskActionsApi,
  type TaskBulkAction,
  type TaskBulkEntry,
  type TaskBulkOutcome,
  type TaskBulkSelection,
  type TaskStatusChangesInstance,
  TaskStatusChangesStore,
  type TaskSummary,
} from '@features/task';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import type {
  ConfirmedTask,
  TaskFieldChanges,
  TaskFieldWriteResult,
  ViewTaskOutcome,
  ViewTaskWriter,
  ViewTaskWriteSource,
} from '../../models/view-task-write/view-task-write.interface';
import { settleLimited } from '../../utils/list-rows/list-rows.util';

/**
 * Type TaskWriteChanges
 *
 * @description
 * The fields of a task a write of the view changes before the gateway confirms it.
 *
 * @type {Partial<Pick<TaskSummary, 'status' | 'cancelReason' | 'priority' | 'assigneeIds' | 'listId' | 'name' | 'due' | 'start'>>}
 */
export type TaskWriteChanges = Partial<
  Pick<
    TaskSummary,
    'status' | 'cancelReason' | 'priority' | 'assigneeIds' | 'listId' | 'name' | 'due' | 'start'
  >
>;

/**
 * Interface TaskWritePatch
 *
 * @description
 * The optimistic change one write of the view made to one task: shown at once, filed (grouped)
 * 460 ms after the task's last write, removed alone when its write fails, and applied once
 * confirmed until a read of the task reaches the version the gateway returned, so that read wins
 * over it. A task's patches apply in the order of their writes.
 */
interface TaskWritePatch {
  // #region Properties
  /**
   * Property seq
   *
   * @description
   * Sequence number of the write that made the change.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property pending
   *
   * @description
   * Whether the write is not answered yet.
   *
   * @type {boolean}
   * @readonly
   */
  readonly pending: boolean;

  /**
   * Property until
   *
   * @description
   * Once confirmed, the version the gateway returned: a read at that version or later replaces
   * the change. Null when the gateway returned none: the next read begun after the confirmation
   * replaces it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly until: number | null;

  /**
   * Property reads
   *
   * @description
   * Reads of the view begun when the write was confirmed; a later read replaces a change without
   * a returned version.
   *
   * @type {number}
   * @readonly
   */
  readonly reads: number;

  /**
   * Property changes
   *
   * @description
   * The changed fields.
   *
   * @type {TaskWriteChanges}
   * @readonly
   */
  readonly changes: TaskWriteChanges;

  /**
   * Property filed
   *
   * @description
   * Whether the view already files (groups) the task by the changed fields.
   *
   * @type {boolean}
   * @readonly
   */
  readonly filed: boolean;

  /**
   * Property hidden
   *
   * @description
   * Whether the task leaves the view at once (moved to another list or deleted).
   *
   * @type {boolean}
   * @readonly
   */
  readonly hidden: boolean;
  // #endregion
}

/**
 * Interface AppliedTaskWrite
 *
 * @description
 * What the writes still applied to a task change, merged in the order of their writes.
 */
export interface AppliedTaskWrite {
  // #region Properties
  /**
   * Property changes
   *
   * @description
   * Every applied change: what the task shows.
   *
   * @type {TaskWriteChanges}
   * @readonly
   */
  readonly changes: TaskWriteChanges;

  /**
   * Property filedChanges
   *
   * @description
   * The applied changes the view already files (groups) the task by.
   *
   * @type {TaskWriteChanges}
   * @readonly
   */
  readonly filedChanges: TaskWriteChanges;

  /**
   * Property hidden
   *
   * @description
   * Whether an applied change takes the task out of the view.
   *
   * @type {boolean}
   * @readonly
   */
  readonly hidden: boolean;
  // #endregion
}

/**
 * Interface QueuedWrite
 *
 * @description
 * A write waiting for an earlier write of one of its tasks to end before it is sent.
 */
interface QueuedWrite {
  // #region Properties
  /**
   * Property seq
   *
   * @description
   * Sequence number of the write.
   *
   * @type {number}
   * @readonly
   */
  readonly seq: number;

  /**
   * Property status
   *
   * @description
   * Whether the write changes the status: a newer status change of the same task replaces it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly status: boolean;

  /**
   * Property superseded
   *
   * @description
   * Keys of its tasks a newer status change took over; they are not sent.
   *
   * @type {Set<string>}
   * @readonly
   */
  readonly superseded: Set<string>;
  // #endregion
}

/**
 * Interface WritePlan
 *
 * @description
 * How one write shows and sends: a bulk action of the menu or a single-field write.
 */
interface WritePlan {
  // #region Properties
  /**
   * Property action
   *
   * @description
   * The bulk action, which records the cancellation notes of a status change; null for a
   * single-field write.
   *
   * @type {TaskBulkAction | null}
   * @readonly
   */
  readonly action: TaskBulkAction | null;
  // #endregion

  // #region Methods
  /**
   * Method changesOf
   *
   * @description
   * What the write shows on a task before the gateway confirms it, null when nothing shows.
   *
   * @param {TaskSummary} task - The task as shown.
   * @returns {{ changes: TaskWriteChanges; hidden: boolean } | null} The changes.
   */
  changesOf(task: TaskSummary): { changes: TaskWriteChanges; hidden: boolean } | null;

  /**
   * Method send
   *
   * @description
   * Sends the write for the selected tasks at their versions.
   *
   * @param {readonly TaskBulkSelection[]} selection - The tasks and their versions.
   * @param {() => boolean} current - Whether the view, its list and its organization still hold.
   * @returns {Promise<TaskBulkOutcome>} How it ended; never rejects.
   */
  send(selection: readonly TaskBulkSelection[], current: () => boolean): Promise<TaskBulkOutcome>;
  // #endregion
}

/**
 * Interface ViewTaskWritesState
 *
 * @description
 * The optimistic changes of the view's writes.
 */
interface ViewTaskWritesState {
  // #region Properties
  /**
   * Property _patches
   *
   * @description
   * Optimistic changes of the view's writes, by task key, oldest write first.
   *
   * @type {Readonly<Partial<Record<string, readonly TaskWritePatch[]>>>}
   * @readonly
   */
  readonly _patches: Readonly<Partial<Record<string, readonly TaskWritePatch[]>>>;
  // #endregion
}

/**
 * Interface ViewTaskWritesProps
 *
 * @description
 * The collaborators of the writes, kept apart from the host's own members.
 */
export interface ViewTaskWritesProps {
  // #region Properties
  /**
   * Property _writeActions
   *
   * @description
   * The bulk actions, reminders and trash restores.
   *
   * @type {TaskActionsApi}
   * @readonly
   */
  readonly _writeActions: TaskActionsApi;

  /**
   * Property _writeFields
   *
   * @description
   * The single-field writes.
   *
   * @type {ListTasksApi}
   * @readonly
   */
  readonly _writeFields: ListTasksApi;

  /**
   * Property _writeStatus
   *
   * @description
   * The status icon's changes of the view, whose settled versions the writes start from.
   *
   * @type {TaskStatusChangesInstance}
   * @readonly
   */
  readonly _writeStatus: TaskStatusChangesInstance;

  /**
   * Property _writeDestroyRef
   *
   * @description
   * Lifetime of the host store.
   *
   * @type {DestroyRef}
   * @readonly
   */
  readonly _writeDestroyRef: DestroyRef;

  /**
   * Property _writeReduceMotion
   *
   * @description
   * Whether reduced motion is requested: a write files its tasks at once.
   *
   * @type {boolean}
   * @readonly
   */
  readonly _writeReduceMotion: boolean;
  // #endregion
}

/**
 * Interface ViewTaskWritesMethods
 *
 * @description
 * The methods the writes add to their host store: the writes of `ViewTaskWriter` but `reload`
 * and `shownStatus`, which the host owns, and the host's hooks.
 */
export interface ViewTaskWritesMethods extends Pick<
  ViewTaskWriter,
  'act' | 'update' | 'remind' | 'restore'
> {
  // #region Methods
  /**
   * Method _connectWrites
   *
   * @description
   * Lends the writes the host's reads; called once in the host's `onInit`.
   *
   * @param {ViewTaskWriteSource} source - The host's reads.
   */
  _connectWrites(source: ViewTaskWriteSource): void;

  /**
   * Method _resetWrites
   *
   * @description
   * Forgets every write when the host's scope (organization or list) changes: no queued write
   * starts afterwards.
   */
  _resetWrites(): void;

  /**
   * Method _settleWrites
   *
   * @description
   * Drops the confirmed patches a read replaced: those it read the returned version of, and
   * those without a returned version once a read begun after their confirmation answered.
   *
   * @param {number} generation - Rank of the read that answered, as `source.reads()` counted it.
   */
  _settleWrites(generation: number): void;

  /**
   * Method _appliedWrite
   *
   * @description
   * The writes still applied to a task as read; null when none.
   *
   * @param {TaskSummary} task - The task as read.
   * @returns {AppliedTaskWrite | null} The merged changes.
   */
  _appliedWrite(task: TaskSummary): AppliedTaskWrite | null;
  // #endregion
}

/**
 * Type Literal
 *
 * @description
 * An interface as the type literal a store feature's result needs (an interface has no index
 * signature, which `SignalStoreFeatureResult` requires of its members).
 *
 * @type {{ [K in keyof T]: T[K] }}
 */
type Literal<T> = { [K in keyof T]: T[K] };

/**
 * Constant WRITE_CALLS
 *
 * @description
 * Reminder and restore calls in flight at most for one action of the view.
 *
 * @type {number}
 */
const WRITE_CALLS: number = 4;

/**
 * Constant NO_OUTCOME
 *
 * @description
 * The outcome of a write whose every task a newer status change replaced.
 *
 * @type {ViewTaskOutcome}
 */
const NO_OUTCOME: ViewTaskOutcome = {
  affected: 0,
  done: [],
  failed: [],
  unknown: [],
  notSent: [],
  before: {},
  after: {},
  changed: [],
};

/**
 * Function patchApplies
 *
 * @description
 * Whether a patch still shows over a task read at a version: always while its write is pending,
 * then until a read reaches the version the gateway returned.
 *
 * @param {TaskWritePatch} patch - The patch.
 * @param {number} version - Version of the task as read.
 * @returns {boolean} Whether it applies.
 */
function patchApplies(patch: TaskWritePatch, version: number): boolean {
  return patch.pending || patch.until === null || version < patch.until;
}

/**
 * Function appliedOf
 *
 * @description
 * Merges the patches of a task that still apply, oldest write first; null when none applies.
 *
 * @param {readonly TaskWritePatch[] | undefined} patches - The task's patches, oldest first.
 * @param {number} version - Version of the task as read.
 * @returns {AppliedTaskWrite | null} The merged changes.
 */
function appliedOf(
  patches: readonly TaskWritePatch[] | undefined,
  version: number,
): AppliedTaskWrite | null {
  const applied: readonly TaskWritePatch[] = (patches ?? []).filter((patch: TaskWritePatch) =>
    patchApplies(patch, version),
  );
  if (applied.length === 0) return null;
  return {
    changes: Object.assign(
      {},
      ...applied.map((patch: TaskWritePatch) => patch.changes),
    ) as TaskWriteChanges,
    filedChanges: Object.assign(
      {},
      ...applied
        .filter((patch: TaskWritePatch) => patch.filed)
        .map((patch: TaskWritePatch) => patch.changes),
    ) as TaskWriteChanges,
    hidden: applied.some((patch: TaskWritePatch): boolean => patch.hidden),
  };
}

/**
 * Function actionChangesOf
 *
 * @description
 * What a bulk action changes on a task, shown before the gateway confirms it; null for an action
 * that changes nothing visible (a copy).
 *
 * @param {TaskSummary} task - The task as shown.
 * @param {TaskBulkAction} action - The action.
 * @returns {{ changes: TaskWriteChanges; hidden: boolean } | null} The changes.
 */
function actionChangesOf(
  task: TaskSummary,
  action: TaskBulkAction,
): { changes: TaskWriteChanges; hidden: boolean } | null {
  switch (action.type) {
    case 'status':
      return {
        changes: { status: action.status, cancelReason: action.cancelReason ?? null },
        hidden: false,
      };
    case 'priority':
      return { changes: { priority: action.priority }, hidden: false };
    case 'assign':
      return {
        changes: { assigneeIds: [...new Set([...task.assigneeIds, action.userId])] },
        hidden: false,
      };
    case 'unassign':
      return {
        changes: { assigneeIds: task.assigneeIds.filter((id: string) => id !== action.userId) },
        hidden: false,
      };
    case 'move':
      return { changes: { listId: action.listId }, hidden: true };
    case 'trash':
      return { changes: {}, hidden: true };
    case 'duplicate':
      return null;
  }
}

/**
 * Function shiftDate
 *
 * @description
 * Moves a `YYYY-MM-DD` date by a number of days, in UTC so no time zone shifts it.
 *
 * @param {string} date - The date.
 * @param {number} days - Days to add, negative to go back.
 * @returns {string} The moved date.
 */
function shiftDate(date: string, days: number): string {
  const moved: Date = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * Function daysBetween
 *
 * @description
 * Days from one `YYYY-MM-DD` date to another.
 *
 * @param {string} from - The first date.
 * @param {string} to - The second date.
 * @returns {number} The days, negative when `to` comes first.
 */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Function fieldChangesOf
 *
 * @description
 * What a single-field write shows on a task: the name and the dates (a new due date without a
 * start date moves the start by the same days, as the gateway does); the estimate and custom
 * fields are not part of a task summary and show once read.
 *
 * @param {TaskSummary} task - The task as shown.
 * @param {TaskFieldChanges} changes - The written fields.
 * @returns {{ changes: TaskWriteChanges; hidden: boolean } | null} The changes, null when none
 * shows.
 */
function fieldChangesOf(
  task: TaskSummary,
  changes: TaskFieldChanges,
): { changes: TaskWriteChanges; hidden: boolean } | null {
  const shown: { -readonly [K in keyof TaskWriteChanges]: TaskWriteChanges[K] } = {};
  if (changes.name !== undefined) shown.name = changes.name;
  if (changes.dueDate !== undefined) shown.due = changes.dueDate;
  if (changes.startDate !== undefined) {
    shown.start = changes.startDate;
  } else if (changes.dueDate && task.due && task.start) {
    shown.start = shiftDate(task.start, daysBetween(task.due, changes.dueDate));
  }
  return Object.keys(shown).length > 0 ? { changes: shown, hidden: false } : null;
}

/**
 * Function fieldOutcomeOf
 *
 * @description
 * The bulk-shaped outcome of a single-field write.
 *
 * @param {TaskBulkSelection} sent - The task and its version.
 * @param {TaskFieldWriteResult} result - How the write ended.
 * @returns {TaskBulkOutcome} The outcome.
 */
function fieldOutcomeOf(sent: TaskBulkSelection, result: TaskFieldWriteResult): TaskBulkOutcome {
  switch (result.kind) {
    case 'done':
      return {
        affected: 1,
        done: [
          { taskKey: sent.taskKey, version: result.version, newTaskKey: null, trashEntryId: null },
        ],
        failed: [],
        unknown: [],
        notSent: [],
      };
    case 'refused':
      return { affected: 0, done: [], failed: [sent], unknown: [], notSent: [] };
    case 'unknown':
      return { affected: 0, done: [], failed: [], unknown: [sent], notSent: [] };
  }
}

/**
 * Function withViewTaskWrites
 *
 * @description
 * The writes of a task view, composed by its reader store (`ListRowsStore`, `ListTasksStore`,
 * the board's store): the actions of the task menu and the selection bar through
 * `TaskActionsApi.bulk` (chunks of 50, each with an idempotency key reused for one retry after an
 * uncertain answer), and single-field writes through `updateTask` with `If-Match`. Writes are
 * serialized per task: a write waits for the earlier writes of its tasks, then sends each task at
 * its newest known version (the last read, or the version the gateway returned to an earlier
 * write); a waiting status change gives way to a newer status change of the same task, which
 * alone is sent. Each write patches its tasks at once (`_appliedWrite`), files them 460 ms after
 * the task's last write (at once with reduced motion), and a refused, uncertain or unsent task
 * loses only that write's patch; a confirmed patch applies until a read reaches the version the
 * gateway returned. With expected versions (an `Undo`), a task known to have changed since is not
 * sent and is reported in `changed`. Every send checks the view, its scope and its organization:
 * once one changed, the rest is reported as not sent.
 *
 * The host connects its reads in `onInit` (`_connectWrites`), forgets every write when its scope
 * changes (`_resetWrites`) and prunes the patches a read replaced (`_settleWrites`).
 *
 * @returns {SignalStoreFeature} The feature.
 */
export function withViewTaskWrites(): SignalStoreFeature<
  EmptyFeatureResult,
  {
    state: Literal<ViewTaskWritesState>;
    props: Literal<ViewTaskWritesProps>;
    methods: Literal<ViewTaskWritesMethods>;
  }
> {
  return signalStoreFeature(
    withState<ViewTaskWritesState>({ _patches: {} }),
    withProps(() => ({
      _writeActions: inject(TaskActionsApi),
      _writeFields: inject(ListTasksApi),
      _writeStatus: inject<TaskStatusChangesInstance>(TaskStatusChangesStore),
      _writeDestroyRef: inject(DestroyRef),
      _writeReduceMotion: inject(MediaMatcher).matchMedia('(prefers-reduced-motion: reduce)')
        .matches,
    })),
    withMethods((store) => {
      let source: ViewTaskWriteSource | null = null;
      const timers: Set<ReturnType<typeof setTimeout>> = new Set<ReturnType<typeof setTimeout>>();
      store._writeDestroyRef.onDestroy((): void => {
        for (const timer of timers) clearTimeout(timer);
      });
      const confirmedVersions: Map<string, number> = new Map<string, number>();
      const notes: Map<string, { note: string | null; version: number }> = new Map<
        string,
        { note: string | null; version: number }
      >();
      const tails: Map<string, Promise<void>> = new Map<string, Promise<void>>();
      const queued: Map<string, QueuedWrite> = new Map<string, QueuedWrite>();
      let writes: number = 0;
      // Incremented on every scope change of the reused route store, so a write captured before
      // a change never starts after it, even once the user is back on its list.
      let generation: number = 0;
      // A write queued behind others must not start once its view is gone, its organization
      // changed (the organization pin is read when each request leaves) or the reused route store
      // moved to another list, even if it came back since.
      const notSent: Error = new Error('The view, its list or its organization changed.');
      const sameContext: () => () => boolean = (): (() => boolean) => {
        const scope: string | null = source?.scope() ?? null;
        const captured: number = generation;
        return (): boolean =>
          !store._writeDestroyRef.destroyed &&
          generation === captured &&
          (source?.scope() ?? null) === scope;
      };
      const loadedTask: (key: string) => TaskSummary | undefined = (
        key: string,
      ): TaskSummary | undefined => source?.taskOf(key);
      const editPatches: (
        keys: readonly string[],
        edit: (patches: readonly TaskWritePatch[], key: string) => readonly TaskWritePatch[],
      ) => void = (
        keys: readonly string[],
        edit: (patches: readonly TaskWritePatch[], key: string) => readonly TaskWritePatch[],
      ): void => {
        if (keys.length === 0) return;
        patchState(store, (state: ViewTaskWritesState): Partial<ViewTaskWritesState> => {
          const edited: Map<string, readonly TaskWritePatch[]> = new Map<
            string,
            readonly TaskWritePatch[]
          >(
            keys.map((key: string): [string, readonly TaskWritePatch[]] => [
              key,
              edit(state._patches[key] ?? [], key),
            ]),
          );
          return {
            _patches: Object.fromEntries(
              [
                ...Object.entries(state._patches).filter(
                  ([key]: [string, readonly TaskWritePatch[] | undefined]) => !edited.has(key),
                ),
                ...edited.entries(),
              ].filter(
                ([, patches]: [string, readonly TaskWritePatch[] | undefined]) =>
                  patches !== undefined && patches.length > 0,
              ),
            ),
          };
        });
      };
      const fileLater: (seq: number, keys: readonly string[]) => void = (
        seq: number,
        keys: readonly string[],
      ): void => {
        const timer: ReturnType<typeof setTimeout> = setTimeout((): void => {
          timers.delete(timer);
          const filed: string[] = keys.filter(
            (key: string): boolean => store._patches()[key]?.at(-1)?.seq === seq,
          );
          if (filed.length === 0) return;
          editPatches(filed, (patches: readonly TaskWritePatch[]) =>
            patches.map((patch: TaskWritePatch): TaskWritePatch => ({ ...patch, filed: true })),
          );
          source?.filed(filed);
        }, STATUS_SETTLE_MS);
        timers.add(timer);
      };
      const versionOf: (task: TaskSummary) => number = (task: TaskSummary): number => {
        const loaded: TaskSummary | undefined = loadedTask(task.key);
        return Math.max(
          task.version,
          loaded ? store._writeStatus.settledTask(loaded).version : 0,
          confirmedVersions.get(task.key) ?? 0,
        );
      };
      const shownOf: (task: TaskSummary) => TaskSummary = (task: TaskSummary): TaskSummary => {
        const loaded: TaskSummary = store._writeStatus.settledTask(loadedTask(task.key) ?? task);
        const applied: AppliedTaskWrite | null = appliedOf(
          store._patches()[task.key],
          loaded.version,
        );
        return applied ? { ...loaded, ...applied.changes } : loaded;
      };
      const confirmedOf: (task: TaskSummary) => ConfirmedTask = (
        task: TaskSummary,
      ): ConfirmedTask => {
        const loaded: TaskSummary = store._writeStatus.settledTask(loadedTask(task.key) ?? task);
        const changes: TaskWriteChanges = Object.assign(
          {},
          ...(store._patches()[task.key] ?? [])
            .filter((patch: TaskWritePatch): boolean => !patch.pending)
            .filter((patch: TaskWritePatch): boolean => patchApplies(patch, loaded.version))
            .map((patch: TaskWritePatch) => patch.changes),
        ) as TaskWriteChanges;
        const merged: TaskSummary = { ...loaded, ...changes };
        const note: { note: string | null; version: number } | undefined = notes.get(task.key);
        return {
          ...merged,
          version: versionOf(task),
          cancelNote:
            merged.status === 'cancelled' && note && note.version >= loaded.version
              ? note.note
              : null,
        };
      };
      const record: (
        action: TaskBulkAction | null,
        seq: number,
        outcome: TaskBulkOutcome,
        before: Readonly<Partial<Record<string, ConfirmedTask>>>,
        skipped: readonly string[],
      ) => void = (
        action: TaskBulkAction | null,
        seq: number,
        outcome: TaskBulkOutcome,
        before: Readonly<Partial<Record<string, ConfirmedTask>>>,
        skipped: readonly string[],
      ): void => {
        const returned: Map<string, number | null> = new Map<string, number | null>(
          outcome.done.map((entry: TaskBulkEntry): [string, number | null] => [
            entry.taskKey,
            entry.version,
          ]),
        );
        for (const [key, version] of returned) {
          if (version !== null) {
            confirmedVersions.set(key, Math.max(confirmedVersions.get(key) ?? 0, version));
          }
          if (action?.type !== 'status') continue;
          if (action.status === 'cancelled') {
            notes.set(key, {
              note: action.cancelNote === '' ? null : (action.cancelNote ?? null),
              version: version ?? before[key]?.version ?? 0,
            });
          } else {
            notes.delete(key);
          }
        }
        const reads: number = source?.reads() ?? 0;
        editPatches([...returned.keys()], (patches: readonly TaskWritePatch[], key: string) =>
          patches.map((patch: TaskWritePatch): TaskWritePatch =>
            patch.seq === seq
              ? { ...patch, pending: false, until: returned.get(key) ?? null, reads }
              : patch,
          ),
        );
        editPatches(
          [
            ...[...outcome.failed, ...outcome.unknown, ...outcome.notSent].map(
              (item: TaskBulkSelection): string => item.taskKey,
            ),
            ...skipped,
          ],
          (patches: readonly TaskWritePatch[]) =>
            patches.filter((patch: TaskWritePatch): boolean => patch.seq !== seq),
        );
      };
      const run: (
        tasks: readonly TaskSummary[],
        plan: WritePlan,
        expected?: Readonly<Partial<Record<string, number>>>,
      ) => Promise<ViewTaskOutcome> = (
        tasks: readonly TaskSummary[],
        plan: WritePlan,
        expected?: Readonly<Partial<Record<string, number>>>,
      ): Promise<ViewTaskOutcome> => {
        const current: () => boolean = sameContext();
        const seq: number = ++writes;
        const changedSince: (task: TaskSummary) => boolean = (task: TaskSummary): boolean => {
          if (!expected) return false;
          const at: number | undefined = expected[task.key];
          return at === undefined || versionOf(task) > at;
        };
        const unique: readonly TaskSummary[] = [
          ...new Map(tasks.map((task: TaskSummary) => [task.key, task])).values(),
        ];
        const early: readonly TaskSummary[] = unique.filter(changedSince);
        const targets: readonly TaskSummary[] = unique.filter(
          (task: TaskSummary): boolean => !changedSince(task),
        );
        const changedOf: (stale: readonly TaskSummary[]) => TaskBulkSelection[] = (
          stale: readonly TaskSummary[],
        ): TaskBulkSelection[] =>
          [...early, ...stale].map((task: TaskSummary): TaskBulkSelection => ({
            taskKey: task.key,
            version: versionOf(task),
          }));
        if (targets.length === 0) {
          return Promise.resolve({ ...NO_OUTCOME, changed: changedOf([]) });
        }
        const keys: readonly string[] = targets.map((task: TaskSummary): string => task.key);
        const entry: QueuedWrite = {
          seq,
          status: plan.action?.type === 'status',
          superseded: new Set<string>(),
        };
        const replaced: Map<string, number> = new Map<string, number>();
        if (entry.status) {
          for (const key of keys) {
            const waiting: QueuedWrite | undefined = queued.get(key);
            if (!waiting?.status) continue;
            waiting.superseded.add(key);
            replaced.set(key, waiting.seq);
          }
        }
        const changes: Map<string, { changes: TaskWriteChanges; hidden: boolean }> = new Map<
          string,
          { changes: TaskWriteChanges; hidden: boolean }
        >();
        for (const task of targets) {
          const change: { changes: TaskWriteChanges; hidden: boolean } | null = plan.changesOf(
            shownOf(task),
          );
          if (change) changes.set(task.key, change);
        }
        editPatches(
          keys.filter((key: string): boolean => changes.has(key) || replaced.has(key)),
          (patches: readonly TaskWritePatch[], key: string): readonly TaskWritePatch[] => {
            const merged: readonly TaskWritePatch[] = patches.map(
              (patch: TaskWritePatch): TaskWritePatch =>
                patch.seq === replaced.get(key) ? { ...patch, seq } : patch,
            );
            const change: { changes: TaskWriteChanges; hidden: boolean } | undefined =
              changes.get(key);
            return change
              ? [
                  ...merged,
                  {
                    seq,
                    pending: true,
                    until: null,
                    reads: 0,
                    changes: change.changes,
                    filed: store._writeReduceMotion || change.hidden,
                    hidden: change.hidden,
                  },
                ]
              : merged;
          },
        );
        if (changes.size > 0 && !store._writeReduceMotion) fileLater(seq, [...changes.keys()]);
        for (const key of keys) queued.set(key, entry);

        const send: () => Promise<ViewTaskOutcome> = async (): Promise<ViewTaskOutcome> => {
          for (const key of keys) if (queued.get(key) === entry) queued.delete(key);
          const unsuperseded: readonly TaskSummary[] = targets.filter(
            (task: TaskSummary): boolean => !entry.superseded.has(task.key),
          );
          const late: readonly TaskSummary[] = unsuperseded.filter(changedSince);
          const live: readonly TaskSummary[] = unsuperseded.filter(
            (task: TaskSummary): boolean => !changedSince(task),
          );
          const skipped: readonly string[] = late.map((task: TaskSummary): string => task.key);
          const changed: readonly TaskBulkSelection[] = changedOf(late);
          if (live.length === 0) {
            record(plan.action, seq, NO_OUTCOME, {}, skipped);
            return { ...NO_OUTCOME, changed };
          }
          const before: Readonly<Partial<Record<string, ConfirmedTask>>> = Object.fromEntries(
            live.map((task: TaskSummary): [string, ConfirmedTask] => [task.key, confirmedOf(task)]),
          );
          const selection: TaskBulkSelection[] = live.map(
            (task: TaskSummary): TaskBulkSelection => ({
              taskKey: task.key,
              version: expected?.[task.key] ?? before[task.key]?.version ?? task.version,
            }),
          );
          const outcome: TaskBulkOutcome = await plan.send(selection, current);
          const afterOf: () => Readonly<Partial<Record<string, number>>> = () =>
            Object.fromEntries(
              outcome.done.map((done: TaskBulkEntry): [string, number] => {
                const sent: ConfirmedTask | undefined = before[done.taskKey];
                return [done.taskKey, done.version ?? (sent ? versionOf(sent) : 0)];
              }),
            );
          if (store._writeDestroyRef.destroyed) {
            return { ...outcome, before, after: afterOf(), changed };
          }
          record(plan.action, seq, outcome, before, skipped);
          if (current() && (outcome.done.length > 0 || outcome.unknown.length > 0)) {
            source?.reload();
          }
          return { ...outcome, before, after: afterOf(), changed };
        };
        const earlier: readonly Promise<void>[] = keys.flatMap((key: string): Promise<void>[] => {
          const tail: Promise<void> | undefined = tails.get(key);
          return tail ? [tail] : [];
        });
        const result: Promise<ViewTaskOutcome> =
          earlier.length > 0 ? Promise.all(earlier).then(send) : send();
        const tail: Promise<void> = result.then(
          (): void => undefined,
          (): void => undefined,
        );
        for (const key of keys) tails.set(key, tail);
        void tail.then((): void => {
          for (const key of keys) if (tails.get(key) === tail) tails.delete(key);
        });
        return result;
      };

      return {
        _connectWrites(connected: ViewTaskWriteSource): void {
          source = connected;
        },
        _resetWrites(): void {
          generation++;
          confirmedVersions.clear();
          notes.clear();
          patchState(store, { _patches: {} });
        },
        _settleWrites(generationRead: number): void {
          editPatches(
            Object.keys(store._patches()),
            (patches: readonly TaskWritePatch[], key: string) => {
              const task: TaskSummary | undefined = loadedTask(key);
              const version: number | null = task
                ? store._writeStatus.settledTask(task).version
                : null;
              return patches.filter(
                (patch: TaskWritePatch): boolean =>
                  patch.pending ||
                  (patch.until === null
                    ? generationRead <= patch.reads
                    : version === null || version < patch.until),
              );
            },
          );
          for (const [key, version] of confirmedVersions) {
            const task: TaskSummary | undefined = loadedTask(key);
            if (task && store._writeStatus.settledTask(task).version >= version) {
              confirmedVersions.delete(key);
            }
          }
        },
        _appliedWrite(task: TaskSummary): AppliedTaskWrite | null {
          return appliedOf(
            store._patches()[task.key],
            store._writeStatus.settledTask(task).version,
          );
        },
        act(
          tasks: readonly TaskSummary[],
          action: TaskBulkAction,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          return run(
            tasks,
            {
              action,
              changesOf: (task: TaskSummary) => actionChangesOf(task, action),
              send: (selection: readonly TaskBulkSelection[], current: () => boolean) =>
                store._writeActions.bulk([...selection], action, current),
            },
            expected,
          );
        },
        update(
          task: TaskSummary,
          changes: TaskFieldChanges,
          expected?: Readonly<Partial<Record<string, number>>>,
        ): Promise<ViewTaskOutcome> {
          return run(
            [task],
            {
              action: null,
              changesOf: (shown: TaskSummary) => fieldChangesOf(shown, changes),
              send: async (
                selection: readonly TaskBulkSelection[],
                current: () => boolean,
              ): Promise<TaskBulkOutcome> => {
                const sent: TaskBulkSelection = selection[0];
                if (!current()) {
                  return { affected: 0, done: [], failed: [], unknown: [], notSent: [sent] };
                }
                const result: TaskFieldWriteResult = await store._writeFields.update(
                  sent.taskKey,
                  sent.version ?? task.version,
                  changes,
                );
                return fieldOutcomeOf(sent, result);
              },
            },
            expected,
          );
        },
        async remind(taskKeys: readonly string[], at: Date): Promise<readonly string[]> {
          const stillCurrent: () => boolean = sameContext();
          const results: PromiseSettledResult<void>[] = await settleLimited(
            taskKeys,
            WRITE_CALLS,
            (key: string): Promise<void> =>
              stillCurrent() ? store._writeActions.remind(key, at) : Promise.reject(notSent),
          );
          return taskKeys.filter(
            (_: string, index: number) => results[index].status === 'fulfilled',
          );
        },
        async restore(entryIds: readonly string[]): Promise<boolean> {
          const stillCurrent: () => boolean = sameContext();
          const results: PromiseSettledResult<void>[] = await settleLimited(
            entryIds,
            WRITE_CALLS,
            (id: string): Promise<void> =>
              stillCurrent() ? store._writeActions.restore(id) : Promise.reject(notSent),
          );
          if (!store._writeDestroyRef.destroyed) source?.reload();
          return results.every(
            (result: PromiseSettledResult<void>) => result.status === 'fulfilled',
          );
        },
      };
    }),
  );
}
