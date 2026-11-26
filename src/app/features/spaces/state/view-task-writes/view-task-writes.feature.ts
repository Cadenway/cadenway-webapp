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

import {
  ListTasksApi,
  type TaskReadBack,
} from '../../data-access/services/list-tasks-api/list-tasks-api.service';
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
 * Type WriteKind
 *
 * @description
 * How a write without a certain outcome settles. `versioned`: a single-field write (`If-Match`)
 * or a bulk status, priority, assignee or move, which sets a target state at the version sent; it
 * is sent again unchanged, and once a read of the task answered, a later write carries a version
 * the original request would move past. `trash` and `copy` (bulk `trash` and `duplicate`): never
 * sent again from the view, since `TaskActionsApi.bulk` keeps their `Idempotency-Key` to itself,
 * so a new send could not replay the first one. A deletion holds its task until a read of it
 * shows the outcome; a copy never holds its source, which it does not change.
 *
 * @type {'versioned' | 'trash' | 'copy'}
 */
type WriteKind = 'versioned' | 'trash' | 'copy';

/**
 * Interface ResolvedWrite
 *
 * @description
 * How the resends of a `versioned` write ended.
 */
interface ResolvedWrite {
  // #region Properties
  /**
   * Property outcome
   *
   * @description
   * The write's outcome, resends included.
   *
   * @type {TaskBulkOutcome}
   * @readonly
   */
  readonly outcome: TaskBulkOutcome;

  /**
   * Property stale
   *
   * @description
   * Whether a refusal may come from a version the view has not read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly stale: boolean;

  /**
   * Property byRead
   *
   * @description
   * Applied tasks a read back settled rather than the write's own answer: no `Undo` is offered
   * for them.
   *
   * @type {ReadonlySet<string>}
   * @readonly
   */
  readonly byRead: ReadonlySet<string>;

  /**
   * Property read
   *
   * @description
   * The tasks of `byRead` read more than one version past the one sent: their version is never
   * one the next write is sent at.
   *
   * @type {ReadonlySet<string>}
   * @readonly
   */
  readonly read: ReadonlySet<string>;
  // #endregion
}

/**
 * Type HeldSettlement
 *
 * @description
 * What one read of a task held by a write without a certain outcome settles: `applied` (the task
 * holds what the write sets and the original request can no longer change it), `released` (the
 * task may write again: a later write cannot be overwritten silently by the original request),
 * or `open` (read again later).
 *
 * @type {'applied' | 'released' | 'open'}
 */
type HeldSettlement = 'applied' | 'released' | 'open';

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

  /**
   * Property kind
   *
   * @description
   * How a task of the write without a certain outcome settles: resent (`versioned`), or held
   * until a read of it shows the outcome (`trash`, `copy`).
   *
   * @type {WriteKind}
   * @readonly
   */
  readonly kind: WriteKind;
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
   * Method shows
   *
   * @description
   * Whether a task read back holds what the write sets, cancellation note included: read at a
   * version past the one sent, the write (or one with the same effect) was applied.
   *
   * @param {TaskReadBack} read - The task as read back.
   * @returns {boolean} Whether it shows the written values.
   */
  shows(read: TaskReadBack): boolean;

  /**
   * Method send
   *
   * @description
   * Sends the write for the selected tasks at their versions, and tells whether a refusal may
   * come from a version the view has not read (`stale`), which reads the tasks again.
   *
   * @param {readonly TaskBulkSelection[]} selection - The tasks and their versions.
   * @param {() => boolean} current - Whether the view, its list and its organization still hold.
   * @returns {Promise<{ outcome: TaskBulkOutcome; stale: boolean }>} How it ended; never rejects.
   */
  send(
    selection: readonly TaskBulkSelection[],
    current: () => boolean,
  ): Promise<{ readonly outcome: TaskBulkOutcome; readonly stale: boolean }>;
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
   * starts afterwards, no resend leaves and no task stays held by an uncertain write.
   */
  _resetWrites(): void;

  /**
   * Method _settleWrites
   *
   * @description
   * Drops the confirmed patches a read replaced: those it read the returned version of, and
   * those without a returned version once a read begun after their confirmation answered. A
   * pending patch stays: a read of the view never settles a write without a certain outcome.
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
 * Constant RESEND_DELAYS_MS
 *
 * @description
 * Waits before each resend of a `versioned` write without a certain outcome (a lost answer, a
 * timeout, a `5xx`, a refusal that does not prove the version moved), in milliseconds; once they
 * are spent, the outcome is unknown.
 *
 * @type {readonly number[]}
 */
export const RESEND_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * Constant RECONCILE_DELAY_MS
 *
 * @description
 * Wait, in milliseconds, between the end of a write whose outcome is unknown and the first read
 * of each of its tasks (`ListTasksApi.readBack`), so a request still running on the server has
 * time to commit first. Each read that settles nothing doubles the wait, up to
 * `HELD_READ_MAX_MS`.
 *
 * @type {number}
 */
export const RECONCILE_DELAY_MS: number = 2_000;

/**
 * Constant HELD_READ_MAX_MS
 *
 * @description
 * Longest wait, in milliseconds, between two reads of a task a write without a certain outcome
 * still holds. Time alone never releases a task: only a read of it, leaving the view or a change
 * of its scope.
 *
 * @type {number}
 */
const HELD_READ_MAX_MS: number = 30_000;

/**
 * Constant FOLLOW_UP_READS_MS
 *
 * @description
 * When, in milliseconds after its release, a task released by a read still at the version its
 * write was sent at is read again, in case the original request commits late: a read past that
 * version that holds the written values shows them again, without holding the task's writes.
 *
 * @type {readonly number[]}
 */
const FOLLOW_UP_READS_MS: readonly number[] = [10_000, 30_000];

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
 * Function kindOf
 *
 * @description
 * How a bulk action without a certain outcome settles: a status, a priority, an assignee added
 * or removed and a destination list set a target state at the version sent, so a second send
 * changes nothing more (`versioned`). A deletion (`trash`) and a copy (`copy`, each send of which
 * creates one) are not sent again: `TaskActionsApi.bulk` already retried each once with its own
 * `Idempotency-Key`, which it does not expose, and a send under a new key would not replay it.
 *
 * @param {TaskBulkAction} action - The action.
 * @returns {WriteKind} How it settles.
 */
function kindOf(action: TaskBulkAction): WriteKind {
  switch (action.type) {
    case 'trash':
      return 'trash';
    case 'duplicate':
      return 'copy';
    default:
      return 'versioned';
  }
}

/**
 * Function movedPast
 *
 * @description
 * Whether a read of a task is at a version past the one a write was sent at: the original
 * request, checked against that version, can no longer commit, so the read is its outcome.
 *
 * @param {TaskReadBack | 'trashed' | null} read - The read, `trashed` or null when it failed.
 * @param {number} sent - The version the write was sent at.
 * @returns {read is TaskReadBack} Whether the read settles the write.
 */
function movedPast(read: TaskReadBack | 'trashed' | null, sent: number): read is TaskReadBack {
  return read !== null && read !== 'trashed' && read.task.version > sent;
}

/**
 * Function heldSettlement
 *
 * @description
 * What a read of a task settles once its write's resends are spent. A `versioned` write is
 * released by any read of the task: applied when the read is past the version sent and holds
 * what the write sets, released otherwise (a later write carries the version the view read, so
 * an original request committing afterwards makes it refused, never silently overwritten). A
 * `trash` is applied once the task reads in the trash and released once it reads past the
 * version sent (the deletion, checked against that version, can no longer commit). Anything
 * else stays open. A `copy` is never held.
 *
 * @param {Exclude<WriteKind, 'copy'>} kind - How the write settles.
 * @param {TaskReadBack | 'trashed' | null} read - The read, `trashed` or null when it failed.
 * @param {number} sent - The version the write was sent at.
 * @param {(read: TaskReadBack) => boolean} shows - Whether a read holds what the write sets.
 * @returns {HeldSettlement} What the read settles.
 */
function heldSettlement(
  kind: Exclude<WriteKind, 'copy'>,
  read: TaskReadBack | 'trashed' | null,
  sent: number,
  shows: (read: TaskReadBack) => boolean,
): HeldSettlement {
  if (read === null) return 'open';
  if (read === 'trashed') return kind === 'trash' ? 'applied' : 'released';
  if (movedPast(read, sent)) return kind === 'versioned' && shows(read) ? 'applied' : 'released';
  return kind === 'versioned' ? 'released' : 'open';
}

/**
 * Function actionShown
 *
 * @description
 * Whether a task read back holds what a bulk action sets.
 *
 * @param {TaskReadBack} read - The task as read back.
 * @param {TaskBulkAction} action - The action.
 * @returns {boolean} Whether it shows the action's target state.
 */
function actionShown(read: TaskReadBack, action: TaskBulkAction): boolean {
  const task: TaskSummary = read.task;
  switch (action.type) {
    case 'status':
      return (
        task.status === action.status &&
        (action.cancelReason === undefined || task.cancelReason === action.cancelReason) &&
        (action.status !== 'cancelled' ||
          !action.cancelNote ||
          read.cancelNote === action.cancelNote)
      );
    case 'priority':
      return task.priority === action.priority;
    case 'assign':
      return task.assigneeIds.includes(action.userId);
    case 'unassign':
      return !task.assigneeIds.includes(action.userId);
    case 'move':
      return task.listId === action.listId;
    case 'trash':
    case 'duplicate':
      return false;
  }
}

/**
 * Function fieldsShown
 *
 * @description
 * Whether a task read back holds every field a single-field write sets; a cleared custom field
 * is absent from the read.
 *
 * @param {TaskReadBack} read - The task as read back.
 * @param {TaskFieldChanges} changes - The written fields.
 * @returns {boolean} Whether it shows them.
 */
function fieldsShown(read: TaskReadBack, changes: TaskFieldChanges): boolean {
  const task: TaskSummary = read.task;
  return (
    (changes.name === undefined || task.name === changes.name) &&
    (changes.dueDate === undefined || task.due === changes.dueDate) &&
    (changes.startDate === undefined || task.start === changes.startDate) &&
    (changes.estimateMinutes === undefined || read.estimateMinutes === changes.estimateMinutes) &&
    Object.entries(changes.customFieldValues ?? {}).every(
      ([id, value]: [string, number | string | null]): boolean =>
        (read.customFieldValues[id] ?? null) === value,
    )
  );
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
 * What a single-field write shows on a task: the name and the dates. Without a start date in the
 * write, a new due date moves the start by the same days and a removed due date removes the
 * start, as the task service does; the estimate and custom fields are not part of a task summary
 * and show once read.
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
  } else if (changes.dueDate === null) {
    shown.start = null;
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
 * the task's last write (at once with reduced motion), and a refused or unsent task loses only
 * that write's patch; a confirmed patch applies until a read reaches the version the gateway
 * returned. The tasks are read again after an applied write, and after a refusal that may come
 * from a version the view has not read: a `412` of a single-field write, any refused chunk of a
 * bulk action (whose answer gives no reason). With expected versions (an `Undo`), a task known to
 * have changed since is not sent and is reported in `changed`. Every send checks the view, its
 * scope and its organization: once one changed, the rest is reported as not sent.
 *
 * A task without a certain outcome (no answer, a timeout, a `5xx`) keeps its pending patch and
 * holds the next writes of that task until its outcome is settled; a read of the view never
 * settles it. A `versioned` write (a single-field write, a bulk status, priority, assignee or
 * move) is sent again unchanged, at the same version, after each wait of `RESEND_DELAYS_MS`. A
 * success applied it. A refusal reads the task back (`ListTasksApi.readBack`): read at a version
 * past the one sent, the original request can no longer commit, so the write is applied when the
 * task holds what it sets (cancellation note included) and refused otherwise; any other answer
 * (a `408`, another refusal, no answer, a read at the version sent) leaves it uncertain and the
 * resends go on. A task a read back settled offers no `Undo` (absent from `before` and `after`):
 * a matching value does not prove this request wrote it. A deletion and a copy are never sent
 * again; a copy never holds its source and reads the view once `RECONCILE_DELAY_MS` later.
 * Whatever else stays uncertain is reported in `unknown`; from `RECONCILE_DELAY_MS` on, each such
 * task is read back until a read settles it (`heldSettlement`), and only then do its patch and
 * its hold go. A task released by a read still at the version sent is read again at
 * `FOLLOW_UP_READS_MS`, without holding its writes, to show a late commit of the original.
 *
 * Guarantee of a released `versioned` task: its next write is sent at the version the view read
 * (or the one a write returned), never at a version only a read back showed (except one version
 * past the one sent, holding the written values, which was this write). Every write carries that
 * version (`If-Match`, or the bulk selection's version), so an original request committing after
 * the release moves the task past it and the next write is refused (`412`) and reads the tasks
 * again, instead of overwriting what the original wrote.
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
      // Waits of the resends and reconciliations, ended early when the view goes or its scope
      // changes, so no write stays blocked behind a wait that no longer leads anywhere.
      const wakers: Set<() => void> = new Set<() => void>();
      const wakeAll: () => void = (): void => {
        for (const wake of [...wakers]) wake();
      };
      store._writeDestroyRef.onDestroy((): void => {
        for (const timer of timers) clearTimeout(timer);
        wakeAll();
      });
      const pause: (ms: number) => Promise<void> = (ms: number): Promise<void> =>
        new Promise<void>((resolve: () => void): void => {
          const wake: () => void = (): void => {
            clearTimeout(timer);
            timers.delete(timer);
            wakers.delete(wake);
            resolve();
          };
          const timer: ReturnType<typeof setTimeout> = setTimeout(wake, ms);
          timers.add(timer);
          wakers.add(wake);
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
      const dropPatches: (seq: number, keys: readonly string[]) => void = (
        seq: number,
        keys: readonly string[],
      ): void => {
        editPatches(keys, (patches: readonly TaskWritePatch[]) =>
          patches.filter((patch: TaskWritePatch): boolean => patch.seq !== seq),
        );
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
      // `read`: keys whose applied version comes from a read of the task rather than from the
      // write's answer, and may include changes by others: shown until a read reaches it, never a
      // version the next write is sent at.
      const record: (
        action: TaskBulkAction | null,
        seq: number,
        outcome: TaskBulkOutcome,
        before: Readonly<Partial<Record<string, ConfirmedTask>>>,
        skipped: readonly string[],
        read?: ReadonlySet<string>,
      ) => void = (
        action: TaskBulkAction | null,
        seq: number,
        outcome: TaskBulkOutcome,
        before: Readonly<Partial<Record<string, ConfirmedTask>>>,
        skipped: readonly string[],
        read: ReadonlySet<string> = new Set<string>(),
      ): void => {
        const returned: Map<string, number | null> = new Map<string, number | null>(
          outcome.done.map((entry: TaskBulkEntry): [string, number | null] => [
            entry.taskKey,
            entry.version,
          ]),
        );
        for (const [key, version] of returned) {
          if (version !== null && !read.has(key)) {
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
        // A task without a certain outcome keeps its pending patch: `hold` settles it from a
        // read of that task.
        dropPatches(seq, [
          ...[...outcome.failed, ...outcome.notSent].map(
            (item: TaskBulkSelection): string => item.taskKey,
          ),
          ...skipped,
        ]);
      };
      const readBack: (key: string) => Promise<TaskReadBack | 'trashed' | null> = async (
        key: string,
      ): Promise<TaskReadBack | 'trashed' | null> => {
        try {
          return await store._writeFields.readBack(key);
        } catch {
          return null;
        }
      };
      const readAll: (
        items: readonly TaskBulkSelection[],
      ) => Promise<(TaskReadBack | 'trashed' | null)[]> = async (
        items: readonly TaskBulkSelection[],
      ): Promise<(TaskReadBack | 'trashed' | null)[]> =>
        (
          await settleLimited(
            items,
            WRITE_CALLS,
            (item: TaskBulkSelection): Promise<TaskReadBack | 'trashed' | null> =>
              readBack(item.taskKey),
          )
        ).map((settled: PromiseSettledResult<TaskReadBack | 'trashed' | null>) =>
          settled.status === 'fulfilled' ? settled.value : null,
        );
      // Only a version past the one sent proves the original request can no longer commit; any
      // other refusal of a resend (a `408`, another `4xx`, a `5xx`, no answer) leaves it open and
      // the write is sent again on schedule.
      const resolveUncertain: (
        plan: WritePlan,
        sent: { readonly outcome: TaskBulkOutcome; readonly stale: boolean },
        current: () => boolean,
      ) => Promise<ResolvedWrite> = async (
        plan: WritePlan,
        sent: { readonly outcome: TaskBulkOutcome; readonly stale: boolean },
        current: () => boolean,
      ): Promise<ResolvedWrite> => {
        let affected: number = sent.outcome.affected;
        const done: TaskBulkEntry[] = [...sent.outcome.done];
        const failed: TaskBulkSelection[] = [...sent.outcome.failed];
        const byRead: Set<string> = new Set<string>();
        const read: Set<string> = new Set<string>();
        let unknown: readonly TaskBulkSelection[] = sent.outcome.unknown;
        let stale: boolean = sent.stale;
        for (const delay of RESEND_DELAYS_MS) {
          if (unknown.length === 0) break;
          await pause(delay);
          if (!current()) break;
          // The same write at the same versions: a first request that committed meanwhile
          // makes it refused (the version moved), never applied twice.
          const resent: TaskBulkOutcome = (await plan.send(unknown, current)).outcome;
          affected += resent.affected;
          done.push(...resent.done);
          unknown = [...resent.unknown, ...resent.notSent];
          if (resent.failed.length > 0) {
            stale = true;
            const reads: readonly (TaskReadBack | 'trashed' | null)[] = await readAll(
              resent.failed,
            );
            resent.failed.forEach((item: TaskBulkSelection, index: number): void => {
              const answer: TaskReadBack | 'trashed' | null = reads[index];
              const at: number = item.version ?? 0;
              if (!movedPast(answer, at)) {
                unknown = [...unknown, item];
              } else if (plan.shows(answer)) {
                affected++;
                done.push({
                  taskKey: item.taskKey,
                  version: answer.task.version,
                  newTaskKey: null,
                  trashEntryId: null,
                });
                // A matching value does not prove this request wrote it: no `Undo` is offered.
                // One version past the one sent, the task holds nothing else the view has not
                // read, so that version is the next write's.
                byRead.add(item.taskKey);
                if (answer.task.version !== at + 1) read.add(item.taskKey);
              } else {
                failed.push(item);
              }
            });
          }
          if (resent.notSent.length > 0) break;
        }
        return {
          outcome: { affected, done, failed, unknown, notSent: sent.outcome.notSent },
          stale,
          byRead,
          read,
        };
      };
      // Shows a write's patch as applied from a read of its task past the version it was sent at:
      // until a read of the view reaches that version. Only one version past it is a version the
      // next write may be sent at; further, the read may hold changes the view has not read.
      const applyRead: (
        seq: number,
        key: string,
        version: number | null,
        at: number,
        dropped?: TaskWritePatch,
      ) => void = (
        seq: number,
        key: string,
        version: number | null,
        at: number,
        dropped?: TaskWritePatch,
      ): void => {
        if (version !== null && version === at + 1) {
          confirmedVersions.set(key, Math.max(confirmedVersions.get(key) ?? 0, version));
        }
        const begun: number = source?.reads() ?? 0;
        editPatches([key], (patches: readonly TaskWritePatch[]) =>
          dropped
            ? [
                ...patches.filter((patch: TaskWritePatch): boolean => patch.seq !== seq),
                { ...dropped, pending: false, until: version, reads: begun },
              ].sort((a: TaskWritePatch, b: TaskWritePatch): number => a.seq - b.seq)
            : patches.map((patch: TaskWritePatch): TaskWritePatch =>
                patch.seq === seq
                  ? { ...patch, pending: false, until: version, reads: begun }
                  : patch,
              ),
        );
      };
      // A task released by a read still at the version sent: the original request may commit
      // later. It is read again at `FOLLOW_UP_READS_MS`, without holding its writes; a read past
      // that version shows the written values again when it holds them, and reads the view.
      const followUp: (
        seq: number,
        item: TaskBulkSelection,
        dropped: TaskWritePatch | undefined,
        plan: WritePlan,
        current: () => boolean,
      ) => Promise<void> = async (
        seq: number,
        item: TaskBulkSelection,
        dropped: TaskWritePatch | undefined,
        plan: WritePlan,
        current: () => boolean,
      ): Promise<void> => {
        const at: number = item.version ?? 0;
        let waited: number = 0;
        for (const after of FOLLOW_UP_READS_MS) {
          await pause(after - waited);
          waited = after;
          if (!current()) return;
          const answer: TaskReadBack | 'trashed' | null = await readBack(item.taskKey);
          if (!current()) return;
          if (answer === 'trashed') return;
          if (!movedPast(answer, at)) continue;
          if (dropped && plan.shows(answer)) {
            applyRead(seq, item.taskKey, answer.task.version, at, dropped);
          }
          source?.reload();
          return;
        }
      };
      // Settles the tasks a write left without a certain outcome, each from a read of that very
      // task (`ListTasksApi.readBack`), never from a read of the view, which may not contain it
      // (a subtask, a task past the first page), nor from elapsed time. A read that settles
      // nothing is retried later; leaving the view or changing its scope ends the wait.
      const hold: (
        seq: number,
        items: readonly TaskBulkSelection[],
        plan: WritePlan & { readonly kind: Exclude<WriteKind, 'copy'> },
        current: () => boolean,
        release: (keys: readonly string[]) => void,
      ) => Promise<void> = async (
        seq: number,
        items: readonly TaskBulkSelection[],
        plan: WritePlan & { readonly kind: Exclude<WriteKind, 'copy'> },
        current: () => boolean,
        release: (keys: readonly string[]) => void,
      ): Promise<void> => {
        let open: readonly TaskBulkSelection[] = items;
        for (let round: number = 0; open.length > 0; round++) {
          await pause(Math.min(RECONCILE_DELAY_MS * 2 ** round, HELD_READ_MAX_MS));
          if (!current()) break;
          const reads: readonly (TaskReadBack | 'trashed' | null)[] = await readAll(open);
          if (!current()) break;
          const still: TaskBulkSelection[] = [];
          open.forEach((item: TaskBulkSelection, index: number): void => {
            const answer: TaskReadBack | 'trashed' | null = reads[index];
            const at: number = item.version ?? 0;
            const settlement: HeldSettlement = heldSettlement(
              plan.kind,
              answer,
              at,
              (read: TaskReadBack): boolean => plan.shows(read),
            );
            if (settlement === 'open') {
              still.push(item);
              return;
            }
            if (settlement === 'applied') {
              applyRead(seq, item.taskKey, movedPast(answer, at) ? answer.task.version : null, at);
            } else {
              const dropped: TaskWritePatch | undefined = store
                ._patches()
                [item.taskKey]?.find((patch: TaskWritePatch): boolean => patch.seq === seq);
              dropPatches(seq, [item.taskKey]);
              if (answer !== 'trashed' && !movedPast(answer, at)) {
                void followUp(seq, item, dropped, plan, current);
              }
            }
            release([item.taskKey]);
          });
          if (still.length < open.length) source?.reload();
          open = still;
        }
        release(open.map((item: TaskBulkSelection): string => item.taskKey));
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
        // A write answered after the scope changed records nothing: `_resetWrites` forgot its
        // patches, and its versions belong to tasks the view no longer shows.
        const scoped: number = generation;
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

        // Each task of the write holds the next write of that task until it is released: once
        // its outcome is settled, which for a task without a certain outcome is only after a read
        // of the view begun once the write gave up.
        const earlier: readonly Promise<void>[] = keys.flatMap((key: string): Promise<void>[] => {
          const tail: Promise<void> | undefined = tails.get(key);
          return tail ? [tail] : [];
        });
        const releases: Map<string, () => void> = new Map<string, () => void>();
        for (const key of keys) {
          const tail: Promise<void> = new Promise<void>((resolve: () => void): void => {
            releases.set(key, resolve);
          });
          tails.set(key, tail);
          void tail.then((): void => {
            if (tails.get(key) === tail) tails.delete(key);
          });
        }
        const release: (released: readonly string[]) => void = (
          released: readonly string[],
        ): void => {
          for (const key of released) releases.get(key)?.();
        };

        const send: () => Promise<ViewTaskOutcome> = async (): Promise<ViewTaskOutcome> => {
          let held: readonly string[] = [];
          try {
            for (const key of keys) if (queued.get(key) === entry) queued.delete(key);
            // A newer status change took these tasks over: it sends them, and waits only for
            // this write to start.
            release([...entry.superseded]);
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
              if (generation === scoped) record(plan.action, seq, NO_OUTCOME, {}, skipped);
              return { ...NO_OUTCOME, changed };
            }
            const before: Readonly<Partial<Record<string, ConfirmedTask>>> = Object.fromEntries(
              live.map((task: TaskSummary): [string, ConfirmedTask] => [
                task.key,
                confirmedOf(task),
              ]),
            );
            const selection: TaskBulkSelection[] = live.map(
              (task: TaskSummary): TaskBulkSelection => ({
                taskKey: task.key,
                version: expected?.[task.key] ?? before[task.key]?.version ?? task.version,
              }),
            );
            let sent: { outcome: TaskBulkOutcome; stale: boolean } = await plan.send(
              selection,
              current,
            );
            let read: ReadonlySet<string> = new Set<string>();
            let byRead: ReadonlySet<string> = new Set<string>();
            if (
              sent.outcome.unknown.length > 0 &&
              plan.kind === 'versioned' &&
              generation === scoped
            ) {
              const resolved: ResolvedWrite = await resolveUncertain(plan, sent, current);
              sent = resolved;
              read = resolved.read;
              byRead = resolved.byRead;
            }
            const { outcome, stale }: { outcome: TaskBulkOutcome; stale: boolean } = sent;
            const after: Readonly<Partial<Record<string, number>>> = Object.fromEntries(
              outcome.done
                .filter((done: TaskBulkEntry): boolean => !byRead.has(done.taskKey))
                .map((done: TaskBulkEntry): [string, number] => {
                  const confirmed: ConfirmedTask | undefined = before[done.taskKey];
                  return [done.taskKey, done.version ?? (confirmed ? versionOf(confirmed) : 0)];
                }),
            );
            // A task a read settled is applied without an `Undo`: absent from what an `Undo`
            // puts back.
            const undoable: Readonly<Partial<Record<string, ConfirmedTask>>> = Object.fromEntries(
              Object.entries(before).filter(
                ([key]: [string, ConfirmedTask | undefined]) => !byRead.has(key),
              ),
            );
            if (store._writeDestroyRef.destroyed) {
              return { ...outcome, before: undoable, after, changed };
            }
            if (generation === scoped) record(plan.action, seq, outcome, before, skipped, read);
            if (current() && (outcome.done.length > 0 || stale)) source?.reload();
            const uncertain: readonly string[] = outcome.unknown.map(
              (item: TaskBulkSelection): string => item.taskKey,
            );
            const kind: WriteKind = plan.kind;
            if (uncertain.length > 0 && current() && kind !== 'copy') {
              held = uncertain;
              void hold(seq, outcome.unknown, { ...plan, kind }, current, release);
            } else if (generation === scoped) {
              dropPatches(seq, uncertain);
            }
            // A copy that may have been made: its source is released at once, and the view is
            // read once a little later so a created copy shows.
            if (uncertain.length > 0 && kind === 'copy' && current()) {
              void pause(RECONCILE_DELAY_MS).then((): void => {
                if (current()) source?.reload();
              });
            }
            return { ...outcome, before: undoable, after, changed };
          } finally {
            release(keys.filter((key: string): boolean => !held.includes(key)));
          }
        };
        return earlier.length > 0 ? Promise.all(earlier).then(send) : send();
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
          wakeAll();
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
              kind: kindOf(action),
              changesOf: (task: TaskSummary) => actionChangesOf(task, action),
              shows: (read: TaskReadBack): boolean => actionShown(read, action),
              send: async (
                selection: readonly TaskBulkSelection[],
                current: () => boolean,
              ): Promise<{ outcome: TaskBulkOutcome; stale: boolean }> => {
                const outcome: TaskBulkOutcome = await store._writeActions.bulk(
                  [...selection],
                  action,
                  current,
                );
                // `TaskActionsApi.bulk` does not say why a chunk was refused: any refusal may
                // come from a version the view has not read yet, so it reads the tasks again.
                return { outcome, stale: outcome.failed.length > 0 };
              },
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
              kind: 'versioned',
              changesOf: (shown: TaskSummary) => fieldChangesOf(shown, changes),
              shows: (read: TaskReadBack): boolean => fieldsShown(read, changes),
              send: async (
                selection: readonly TaskBulkSelection[],
                current: () => boolean,
              ): Promise<{ outcome: TaskBulkOutcome; stale: boolean }> => {
                const sent: TaskBulkSelection = selection[0];
                if (!current()) {
                  return {
                    outcome: { affected: 0, done: [], failed: [], unknown: [], notSent: [sent] },
                    stale: false,
                  };
                }
                const result: TaskFieldWriteResult = await store._writeFields.update(
                  sent.taskKey,
                  sent.version ?? task.version,
                  changes,
                );
                return {
                  outcome: fieldOutcomeOf(sent, result),
                  stale: result.kind === 'refused' && result.stale,
                };
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
