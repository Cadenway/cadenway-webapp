import { computed, inject, type Signal, type Type } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { CwToastService } from '@cadenway/ui/components/toast';
import {
  auditTime,
  catchError,
  EMPTY,
  filter,
  groupBy,
  map,
  mergeMap,
  type Observable,
  pipe,
  switchMap,
  tap,
} from 'rxjs';

import { hasProblemCode } from '@core/api';
import { type RealtimeChange, RealtimeConnection } from '@core/realtime';
import { WORKSPACE_CONTEXT } from '@features/workspace/ports/workspace-context';

import { TaskDetailApi } from '../../data-access/services/task-detail-api/task-detail-api.service';
import type { StatusOption } from '../../models/status-option/status-option.interface';
import type {
  TaskCommentPage,
  TaskDetail,
  TaskDetailField,
  TaskDetailList,
  TaskDetailPatch,
  TaskDetailPreview,
  TaskDetailSpace,
  TaskDetailTask,
  TaskReference,
  TaskReminder,
  TaskTrashEntry,
  TaskWatchers,
} from '../../models/task-detail/task-detail.interface';
import type { TaskSummary } from '../../models/task-summary/task-summary.interface';
import { TaskVersionConflict } from '../../models/task-write-error/task-write-error.model';
import { TaskDetailOpener } from '../../services/task-detail-opener/task-detail-opener.service';
import { defaultStatusOptions } from '../../utils/task-status/task-status.util';

/**
 * Constant NOTICE_WINDOW_MS
 *
 * @description
 * Pushed notices of one part are read again once per window: the socket hands the notices of
 * every watched room to every watch and names no task key, so a burst reads the part once.
 *
 * @type {number}
 */
export const NOTICE_WINDOW_MS: number = 300;

/**
 * Type TaskDetailPart
 *
 * @description
 * A part of the detail a pushed notice makes stale: the task with its parent and subtasks, the
 * comments, or the Git links (read by the development panel).
 *
 * @type {'task' | 'comments' | 'git'}
 */
export type TaskDetailPart = 'task' | 'comments' | 'git';

/**
 * Constant NOTICE_PARTS
 *
 * @description
 * The part each task room notice makes stale.
 *
 * @type {Readonly<Record<string, TaskDetailPart>>}
 */
const NOTICE_PARTS: Readonly<Record<string, TaskDetailPart>> = {
  'task.updated.v1': 'task',
  'task.status-changed.v1': 'task',
  'comment.created.v1': 'comments',
  'git.links-changed.v1': 'git',
};

/**
 * Type TaskDetailAction
 *
 * @description
 * A one-shot action of the header in progress.
 *
 * @type {'duplicate' | 'archive' | 'trash' | 'template'}
 */
export type TaskDetailAction = 'duplicate' | 'archive' | 'trash' | 'template';

/**
 * Interface PendingValue
 *
 * @description
 * A local value of one field, shown over the confirmed task until its write settles.
 */
interface PendingValue {
  // #region Properties
  /**
   * Property value
   *
   * @description
   * The value shown.
   *
   * @type {unknown}
   * @readonly
   */
  readonly value: unknown;

  /**
   * Property write
   *
   * @description
   * The write that sends it; a later write of the same field replaces it.
   *
   * @type {number}
   * @readonly
   */
  readonly write: number;
  // #endregion
}

/**
 * Interface TaskDetailState
 *
 * @description
 * The open task's detail and the progress of its reads and writes.
 */
interface TaskDetailState {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the open task, or null when the detail is closed.
   *
   * @type {string | null}
   * @readonly
   */
  readonly taskKey: string | null;

  /**
   * Property preview
   *
   * @description
   * What the opening screen showed of the task, for the header while it is read.
   *
   * @type {TaskDetailPreview | null}
   * @readonly
   */
  readonly preview: TaskDetailPreview | null;

  /**
   * Property detail
   *
   * @description
   * The detail as last confirmed by the gateway, or null before the first read.
   *
   * @type {TaskDetail | null}
   * @readonly
   */
  readonly detail: TaskDetail | null;

  /**
   * Property loading
   *
   * @description
   * Whether the detail is being read while none is shown (the skeleton).
   *
   * @type {boolean}
   * @readonly
   */
  readonly loading: boolean;

  /**
   * Property error
   *
   * @description
   * Why the detail could not be read (a typed route error), or null.
   *
   * @type {Error | null}
   * @readonly
   */
  readonly error: Error | null;

  /**
   * Property commentsLoading
   *
   * @description
   * Whether the first comment page is being read again.
   *
   * @type {boolean}
   * @readonly
   */
  readonly commentsLoading: boolean;

  /**
   * Property commentsFailed
   *
   * @description
   * Whether the last read of the comments failed.
   *
   * @type {boolean}
   * @readonly
   */
  readonly commentsFailed: boolean;

  /**
   * Property watchers
   *
   * @description
   * Who follows the task, or null until read.
   *
   * @type {TaskWatchers | null}
   * @readonly
   */
  readonly watchers: TaskWatchers | null;

  /**
   * Property watchersFailed
   *
   * @description
   * Whether the watchers could not be read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly watchersFailed: boolean;

  /**
   * Property watchPending
   *
   * @description
   * Whether a follow or unfollow is in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly watchPending: boolean;

  /**
   * Property reminder
   *
   * @description
   * The caller's pending reminder of the task, or null.
   *
   * @type {TaskReminder | null}
   * @readonly
   */
  readonly reminder: TaskReminder | null;

  /**
   * Property reminderFailed
   *
   * @description
   * Whether the reminder could not be read.
   *
   * @type {boolean}
   * @readonly
   */
  readonly reminderFailed: boolean;

  /**
   * Property reminderPending
   *
   * @description
   * Whether a reminder write is in flight.
   *
   * @type {boolean}
   * @readonly
   */
  readonly reminderPending: boolean;

  /**
   * Property action
   *
   * @description
   * The header action in progress, or null.
   *
   * @type {TaskDetailAction | null}
   * @readonly
   */
  readonly action: TaskDetailAction | null;

  /**
   * Property commentsRevision
   *
   * @description
   * Counts the pushed comment notices, so the comments tab reads its later pages again.
   *
   * @type {number}
   * @readonly
   */
  readonly commentsRevision: number;

  /**
   * Property gitRevision
   *
   * @description
   * Counts the pushed Git link notices, so the development panel reads its links again.
   *
   * @type {number}
   * @readonly
   */
  readonly gitRevision: number;

  /**
   * Property watchersRevision
   *
   * @description
   * Counts the follow changes made from the header, so the properties panel reads its Followers
   * row again.
   *
   * @type {number}
   * @readonly
   */
  readonly watchersRevision: number;

  /**
   * Property _pending
   *
   * @description
   * Local values of the fields whose writes have not settled, shown over the confirmed task.
   *
   * @type {Readonly<Partial<Record<TaskDetailField, PendingValue>>>}
   * @readonly
   */
  readonly _pending: Readonly<Partial<Record<TaskDetailField, PendingValue>>>;
  // #endregion
}

/**
 * Constant initialState
 *
 * @description
 * A closed detail.
 *
 * @type {TaskDetailState}
 */
const initialState: TaskDetailState = {
  taskKey: null,
  preview: null,
  detail: null,
  loading: false,
  error: null,
  commentsLoading: false,
  commentsFailed: false,
  watchers: null,
  watchersFailed: false,
  watchPending: false,
  reminder: null,
  reminderFailed: false,
  reminderPending: false,
  action: null,
  commentsRevision: 0,
  gitRevision: 0,
  watchersRevision: 0,
  _pending: {},
};

/**
 * Interface TaskDetailHeader
 *
 * @description
 * What the header shows before and after the detail is read: from the detail once read, else from
 * the opening screen's preview, else the key alone.
 */
export interface TaskDetailHeader {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Name of the task, empty when unknown.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Status shown, null when unknown.
   *
   * @type {TaskDetail['task']['status'] | null}
   * @readonly
   */
  readonly status: TaskDetail['task']['status'] | null;

  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone.
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestone: boolean;
  // #endregion
}

/**
 * Interface TaskDetailStoreInstance
 *
 * @description
 * The public API of the task detail store, shared by the header, the properties panel and the
 * tabs. Every field write goes through `update`; the other writes of a task (status, assignees,
 * labels, followers, approvers, votes, checklist) run through `write`, so one task's writes never
 * overlap and each goes against the newest confirmed version, and hand what they return to
 * `accept` or `acceptVersion`.
 */
export interface TaskDetailStoreInstance {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the open task, or null.
   *
   * @type {Signal<string | null>}
   * @readonly
   */
  readonly taskKey: Signal<string | null>;

  /**
   * Property loading
   *
   * @description
   * Whether the first read of the open task runs (the skeleton).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly loading: Signal<boolean>;

  /**
   * Property error
   *
   * @description
   * Why the detail could not be read: a typed route error (not found, deleted task, unavailable).
   *
   * @type {Signal<Error | null>}
   * @readonly
   */
  readonly error: Signal<Error | null>;

  /**
   * Property ready
   *
   * @description
   * Whether a detail is shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly ready: Signal<boolean>;

  /**
   * Property header
   *
   * @description
   * What the header shows, or null when the detail is closed.
   *
   * @type {Signal<TaskDetailHeader | null>}
   * @readonly
   */
  readonly header: Signal<TaskDetailHeader | null>;

  /**
   * Property hasPreview
   *
   * @description
   * Whether the header comes from the opening screen while no detail is shown.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly hasPreview: Signal<boolean>;

  /**
   * Property task
   *
   * @description
   * The task as shown: the confirmed task with the pending local values over it.
   *
   * @type {Signal<TaskDetailTask | null>}
   * @readonly
   */
  readonly task: Signal<TaskDetailTask | null>;

  /**
   * Property confirmedTask
   *
   * @description
   * The task as the gateway last confirmed it, without pending values (for undo snapshots).
   *
   * @type {Signal<TaskDetailTask | null>}
   * @readonly
   */
  readonly confirmedTask: Signal<TaskDetailTask | null>;

  /**
   * Property space
   *
   * @description
   * The task's space, or null.
   *
   * @type {Signal<TaskDetailSpace | null>}
   * @readonly
   */
  readonly space: Signal<TaskDetailSpace | null>;

  /**
   * Property statuses
   *
   * @description
   * The statuses with the space's labels (the defaults until the detail is read).
   *
   * @type {Signal<readonly StatusOption[]>}
   * @readonly
   */
  readonly statuses: Signal<readonly StatusOption[]>;

  /**
   * Property list
   *
   * @description
   * The task's list, or null.
   *
   * @type {Signal<TaskDetailList | null>}
   * @readonly
   */
  readonly list: Signal<TaskDetailList | null>;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the task.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canEdit: Signal<boolean>;

  /**
   * Property canComment
   *
   * @description
   * Whether the caller may comment (`edit` or `comment` on the list, `callerRole` of the
   * detail); false while the detail is not read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly canComment: Signal<boolean>;

  /**
   * Property parent
   *
   * @description
   * The parent of a subtask, or null.
   *
   * @type {Signal<TaskReference | null>}
   * @readonly
   */
  readonly parent: Signal<TaskReference | null>;

  /**
   * Property subtasks
   *
   * @description
   * The direct subtasks (25 at most).
   *
   * @type {Signal<readonly TaskSummary[]>}
   * @readonly
   */
  readonly subtasks: Signal<readonly TaskSummary[]>;

  /**
   * Property comments
   *
   * @description
   * The first page of comments, or null while it is missing.
   *
   * @type {Signal<TaskCommentPage | null>}
   * @readonly
   */
  readonly comments: Signal<TaskCommentPage | null>;

  /**
   * Property commentsFailed
   *
   * @description
   * Whether the comments are missing (partial detail or failed read): an inline error with
   * `Retry` (`reloadComments`).
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly commentsFailed: Signal<boolean>;

  /**
   * Property commentsLoading
   *
   * @description
   * Whether the comments are being read again.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly commentsLoading: Signal<boolean>;

  /**
   * Property partial
   *
   * @description
   * Parts the gateway could not read (`TaskDetail.partial`).
   *
   * @type {Signal<readonly string[]>}
   * @readonly
   */
  readonly partial: Signal<readonly string[]>;

  /**
   * Property pendingFields
   *
   * @description
   * Fields whose writes have not settled, for a per-field busy state.
   *
   * @type {Signal<readonly TaskDetailField[]>}
   * @readonly
   */
  readonly pendingFields: Signal<readonly TaskDetailField[]>;

  /**
   * Property watchers
   *
   * @description
   * Who follows the task, or null until read.
   *
   * @type {Signal<TaskWatchers | null>}
   * @readonly
   */
  readonly watchers: Signal<TaskWatchers | null>;

  /**
   * Property watchersFailed
   *
   * @description
   * Whether the watchers could not be read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly watchersFailed: Signal<boolean>;

  /**
   * Property watchPending
   *
   * @description
   * Whether a follow change is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly watchPending: Signal<boolean>;

  /**
   * Property reminder
   *
   * @description
   * The caller's pending reminder, or null.
   *
   * @type {Signal<TaskReminder | null>}
   * @readonly
   */
  readonly reminder: Signal<TaskReminder | null>;

  /**
   * Property reminderFailed
   *
   * @description
   * Whether the reminder could not be read.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly reminderFailed: Signal<boolean>;

  /**
   * Property reminderPending
   *
   * @description
   * Whether a reminder write is in flight.
   *
   * @type {Signal<boolean>}
   * @readonly
   */
  readonly reminderPending: Signal<boolean>;

  /**
   * Property action
   *
   * @description
   * The header action in progress, or null.
   *
   * @type {Signal<TaskDetailAction | null>}
   * @readonly
   */
  readonly action: Signal<TaskDetailAction | null>;

  /**
   * Property commentsRevision
   *
   * @description
   * Grows on each pushed comment notice.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly commentsRevision: Signal<number>;

  /**
   * Property gitRevision
   *
   * @description
   * Grows on each pushed Git link notice.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly gitRevision: Signal<number>;

  /**
   * Property watchersRevision
   *
   * @description
   * Grows on each follow change confirmed from the header.
   *
   * @type {Signal<number>}
   * @readonly
   */
  readonly watchersRevision: Signal<number>;
  // #endregion

  // #region Methods
  /**
   * Method open
   *
   * @description
   * Shows a task: a new key starts over (skeleton, header from the preview) and reads the detail,
   * the watchers and the reminder; the same key only takes the preview.
   *
   * @param {string} taskKey - Key of the task.
   * @param {TaskDetailPreview | null} preview - What the opening screen shows of it.
   */
  open(taskKey: string, preview: TaskDetailPreview | null): void;

  /**
   * Method close
   *
   * @description
   * Forgets the task; late answers are dropped.
   */
  close(): void;

  /**
   * Method reload
   *
   * @description
   * Reads the detail again (`Retry`, after a restore, after a conflict); the shown detail stays
   * until the answer, and pending local values stay over it.
   *
   * @returns {Promise<void>} Resolves once the read settled.
   */
  reload(): Promise<void>;

  /**
   * Method reloadComments
   *
   * @description
   * Reads the first comment page again (the inline `Retry` of a partial detail).
   *
   * @returns {Promise<void>} Resolves once the read settled.
   */
  reloadComments(): Promise<void>;

  /**
   * Method reloadWatchers
   *
   * @description
   * Reads the watchers again.
   *
   * @returns {Promise<void>} Resolves once the read settled.
   */
  reloadWatchers(): Promise<void>;

  /**
   * Method reloadReminder
   *
   * @description
   * Reads the caller's reminder again.
   *
   * @returns {Promise<void>} Resolves once the read settled.
   */
  reloadReminder(): Promise<void>;

  /**
   * Method isPending
   *
   * @description
   * Whether a field's write has not settled. Reactive.
   *
   * @param {TaskDetailField} field - The field.
   * @returns {boolean} Whether it is pending.
   */
  isPending(field: TaskDetailField): boolean;

  /**
   * Method update
   *
   * @description
   * Changes fields of the task optimistically: the values show at once, the write goes through
   * `write` (after the earlier writes of the task, with `If-Match` set to the newest confirmed
   * version). A success confirms the returned task; a `412` drops the local values, reads the
   * detail again before the next write and warns; any other failure drops them (the confirmed
   * values come back) and shows the failure toast. A later write of the same field keeps its own
   * value shown. A write still queued when another task opens is sent with its own task's key
   * and version.
   *
   * @param {TaskDetailPatch} patch - The changed fields.
   * @returns {Promise<boolean>} Whether the gateway saved the change.
   */
  update(patch: TaskDetailPatch): Promise<boolean>;

  /**
   * Method write
   *
   * @description
   * The one write path of a task in the detail: runs `send` after the earlier writes of the same
   * task (field patches, statuses, assignees, labels, followers, approvers, approval votes,
   * dependencies) and after any read the task waits for, with the newest confirmed version of
   * that task (`fallback` for a task the detail never confirmed, such as a subtask). `send`
   * adopts what its write returned (`accept` or `acceptVersion`) before it resolves, so the next
   * write goes against it. A `TaskVersionConflict` reads the task again, and the next write of
   * the task waits for that read; the error is rethrown to the caller.
   *
   * @param {string} key - Key of the task written.
   * @param {(version: number) => Promise<T>} send - Sends the write against a version.
   * @param {number} [fallback] - Version to use when the detail confirmed none of that task.
   * @returns {Promise<T>} What `send` resolved with.
   * @throws {Error} When no version of the task is known and no fallback is given.
   */
  write<T>(key: string, send: (version: number) => Promise<T>, fallback?: number): Promise<T>;

  /**
   * Method accept
   *
   * @description
   * Takes a task another write returned (assignees, labels, checklist...), when it is not older
   * than the confirmed one; the version of a task no longer shown is recorded for its next write.
   *
   * @param {TaskDetailTask} task - The task the gateway returned.
   */
  accept(task: TaskDetailTask): void;

  /**
   * Method acceptVersion
   *
   * @description
   * Takes a version a write reported without the whole task (an `ETag`, an approval's
   * `taskVersion`, a status write), with the fields that write is known to have changed. It is
   * adopted only when it follows the confirmed version (confirmed + 1): the write was then the
   * only change. Any other newer version means another change happened too, so the task is read
   * again and its next write waits for that read rather than writing against an unseen version.
   *
   * @param {number} version - The task's new version.
   * @param {Partial<TaskSummary>} [changes] - Fields that write set, shown with the version.
   * @param {string} [key] - Key of the task written, the open task by default.
   */
  acceptVersion(version: number, changes?: Partial<TaskSummary>, key?: string): void;

  /**
   * Method toggleWatch
   *
   * @description
   * Follows the task, or stops following it, at once, through `write`; a confirmed change counts
   * `watchersRevision`, a refusal puts the watchers back.
   *
   * @returns {Promise<void>} Resolves once the write settled.
   */
  toggleWatch(): Promise<void>;

  /**
   * Method setReminder
   *
   * @description
   * Sets the caller's reminder of the task (replacing a previous one) with the given note.
   *
   * @param {Date} at - When to remind.
   * @param {string} when - How the header says it (`Tomorrow, 9 h`), for the toast.
   * @param {string} note - Its note.
   * @returns {Promise<boolean>} Whether it was recorded.
   */
  setReminder(at: Date, when: string, note: string): Promise<boolean>;

  /**
   * Method saveReminderNote
   *
   * @description
   * Saves the note of the pending reminder, when there is one.
   *
   * @param {string} note - The note.
   * @returns {Promise<void>} Resolves once saved.
   */
  saveReminderNote(note: string): Promise<void>;

  /**
   * Method deleteReminder
   *
   * @description
   * Removes the caller's reminder of the task.
   *
   * @returns {Promise<void>} Resolves once removed.
   */
  deleteReminder(): Promise<void>;

  /**
   * Method duplicate
   *
   * @description
   * Copies the task in its list; the toast's `Open` opens the copy. A retry of a failed copy of
   * the same task at the same version sends the same `Idempotency-Key`, so it never copies twice.
   *
   * @returns {Promise<void>} Resolves once copied.
   */
  duplicate(): Promise<void>;

  /**
   * Method archive
   *
   * @description
   * Archives the task with its subtasks; the toast's `Undo` restores them.
   *
   * @returns {Promise<boolean>} Whether it was archived (the detail then closes).
   */
  archive(): Promise<boolean>;

  /**
   * Method trash
   *
   * @description
   * Moves the task and its subtasks to the trash; the toast's `Undo` restores the entry.
   *
   * @returns {Promise<boolean>} Whether it was deleted (the detail then closes).
   */
  trash(): Promise<boolean>;

  /**
   * Method saveTemplate
   *
   * @description
   * Saves the task as a template of its space.
   *
   * @returns {Promise<void>} Resolves once saved.
   */
  saveTemplate(): Promise<void>;

  /**
   * Method moveTo
   *
   * @description
   * Moves the task, with its subtasks, to another list.
   *
   * @param {{ readonly id: string; readonly name: string }} list - The destination.
   * @returns {Promise<boolean>} Whether it moved.
   */
  moveTo(list: { readonly id: string; readonly name: string }): Promise<boolean>;

  /**
   * Method attachTo
   *
   * @description
   * Makes the task a subtask of another one; the toast's `Undo` puts the previous parent back,
   * on that task even once another one is shown (the shown task then stays as it is).
   *
   * @param {{ readonly key: string; readonly name: string }} parent - The new parent.
   * @returns {Promise<boolean>} Whether it was attached.
   */
  attachTo(parent: { readonly key: string; readonly name: string }): Promise<boolean>;

  /**
   * Method detach
   *
   * @description
   * Makes a subtask a top-level task again; the toast's `Undo` attaches it back, on that task
   * even once another one is shown.
   *
   * @returns {Promise<boolean>} Whether it was detached.
   */
  detach(): Promise<boolean>;
  // #endregion
}

/**
 * Function refusalText
 *
 * @description
 * What a refused parent change says: the depth and size limits of subtasks (`App.dc.html`
 * lines 2272-2302), or nothing for another refusal.
 *
 * @param {unknown} error - The failure.
 * @returns {string | null} The explanation, or null.
 */
function refusalText(error: unknown): string | null {
  if (hasProblemCode(error, 'task.subtask-depth-exceeded')) {
    return $localize`:@@task.detail.limit-depth:Maximum level reached: 3 levels (task, subtask, sub-subtask). Use the checklist to go into more detail.`;
  }
  if (hasProblemCode(error, 'task.subtask-limit-reached')) {
    return $localize`:@@task.detail.limit-count:25 subtasks at most: split into several tasks instead.`;
  }
  return null;
}

/**
 * Function createTaskDetailStore
 *
 * @description
 * Builds the task detail store.
 *
 * @returns {Type<TaskDetailStoreInstance>} Injectable store constructor.
 */
function createTaskDetailStore(): Type<TaskDetailStoreInstance> {
  return signalStore(
    withState(initialState),
    withProps(() => ({
      _api: inject(TaskDetailApi),
      _toasts: inject(CwToastService),
      _opener: inject(TaskDetailOpener),
      _workspace: inject(WORKSPACE_CONTEXT),
      _realtime: inject(RealtimeConnection, { optional: true }),
    })),
    withComputed((store) => {
      const task: Signal<TaskDetailTask | null> = computed((): TaskDetailTask | null => {
        const confirmed: TaskDetailTask | null = store.detail()?.task ?? null;
        if (!confirmed) return null;
        const pending: Readonly<Partial<Record<TaskDetailField, PendingValue>>> = store._pending();
        const fields: TaskDetailField[] = Object.keys(pending) as TaskDetailField[];
        if (fields.length === 0) return confirmed;
        const shown: Record<string, unknown> = { ...confirmed };
        for (const field of fields) shown[field] = pending[field]?.value;
        return shown as unknown as TaskDetailTask;
      });
      return {
        task,
        confirmedTask: computed((): TaskDetailTask | null => store.detail()?.task ?? null),
        ready: computed((): boolean => store.detail() !== null),
        hasPreview: computed((): boolean => store.detail() === null && store.preview() !== null),
        header: computed((): TaskDetailHeader | null => {
          const key: string | null = store.taskKey();
          if (key === null) return null;
          const shown: TaskDetailTask | null = task();
          if (shown) {
            return {
              key: shown.key,
              name: shown.name,
              status: shown.status,
              milestone: shown.milestone,
            };
          }
          const preview: TaskDetailPreview | null = store.preview();
          return preview ? { ...preview } : { key, name: '', status: null, milestone: false };
        }),
        space: computed((): TaskDetailSpace | null => store.detail()?.space ?? null),
        statuses: computed(
          (): readonly StatusOption[] => store.detail()?.space.statuses ?? defaultStatusOptions(),
        ),
        list: computed((): TaskDetailList | null => store.detail()?.list ?? null),
        canEdit: computed((): boolean => store.detail()?.list.canEdit ?? false),
        canComment: computed((): boolean => store.detail()?.list.canComment ?? false),
        parent: computed((): TaskReference | null => store.detail()?.parent ?? null),
        subtasks: computed((): readonly TaskSummary[] => store.detail()?.subtasks ?? []),
        comments: computed((): TaskCommentPage | null => store.detail()?.comments ?? null),
        partial: computed((): readonly string[] => store.detail()?.partial ?? []),
        pendingFields: computed(
          (): readonly TaskDetailField[] => Object.keys(store._pending()) as TaskDetailField[],
        ),
        commentsFailed: computed((): boolean => {
          const detail: TaskDetail | null = store.detail();
          return detail !== null && detail.comments === null && !store.commentsLoading()
            ? true
            : store.commentsFailed();
        }),
      };
    }),
    withMethods((store) => {
      let readToken: number = 0;
      let writeCount: number = 0;
      let detailRead: Promise<void> | null = null;
      let duplication: { key: string; version: number; idempotencyKey: string } | null = null;
      const noteWrites: {
        queue: Promise<void>;
        latest: number;
        pending: number;
        reminderId: string | null;
        confirmed: TaskReminder | null;
      } = { queue: Promise.resolve(), latest: 0, pending: 0, reminderId: null, confirmed: null };
      const lanes: Map<string, Promise<void>> = new Map<string, Promise<void>>();
      const versions: Map<string, number> = new Map<string, number>();
      const reconciling: Map<string, Promise<void>> = new Map<string, Promise<void>>();
      const current: (key: string) => boolean = (key: string): boolean => {
        return store.taskKey() === key;
      };
      const keyOf: () => string | null = (): string | null => {
        return store.taskKey();
      };

      const record: (key: string, version: number) => void = (
        key: string,
        version: number,
      ): void => {
        if (version > (versions.get(key) ?? 0)) versions.set(key, version);
      };

      const knownVersion: (key: string) => number | undefined = (
        key: string,
      ): number | undefined => {
        const detail: TaskDetail | null = store.detail();
        return current(key) && detail?.task.key === key ? detail.task.version : versions.get(key);
      };

      const confirm: (task: TaskDetailTask) => void = (task: TaskDetailTask): void => {
        record(task.key, task.version);
        const detail: TaskDetail | null = store.detail();
        if (detail?.task.key !== task.key || task.version < detail.task.version) return;
        patchState(store, { detail: { ...detail, task } });
      };

      const clearPending: (fields: readonly TaskDetailField[], write: number) => void = (
        fields: readonly TaskDetailField[],
        write: number,
      ): void => {
        const pending: Readonly<Partial<Record<TaskDetailField, PendingValue>>> = store._pending();
        const kept: [string, PendingValue | undefined][] = Object.entries(pending).filter(
          ([field, value]: [string, PendingValue | undefined]): boolean =>
            !(fields.includes(field as TaskDetailField) && value?.write === write),
        );
        if (kept.length !== Object.keys(pending).length) {
          patchState(store, { _pending: Object.fromEntries(kept) });
        }
      };

      const loadDetail: (key: string, initial: boolean) => Promise<void> = async (
        key: string,
        initial: boolean,
      ): Promise<void> => {
        const token: number = ++readToken;
        if (initial) patchState(store, { loading: true, error: null });
        try {
          const detail: TaskDetail = await store._api.read(key);
          record(detail.task.key, detail.task.version);
          if (token !== readToken || !current(key)) return;
          const shown: TaskDetail | null = store.detail();
          const task: TaskDetailTask =
            shown?.task.key === detail.task.key && shown.task.version > detail.task.version
              ? shown.task
              : detail.task;
          patchState(store, {
            detail: { ...detail, task },
            loading: false,
            error: null,
            commentsFailed: false,
          });
        } catch (error: unknown) {
          if (token !== readToken || !current(key)) return;
          if (store.detail() && !initial) {
            patchState(store, { loading: false });
            return;
          }
          patchState(store, {
            loading: false,
            detail: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      };

      const readDetail: (key: string, initial: boolean) => Promise<void> = (
        key: string,
        initial: boolean,
      ): Promise<void> => {
        const run: Promise<void> = loadDetail(key, initial).finally((): void => {
          if (detailRead === run) detailRead = null;
        });
        detailRead = run;
        return run;
      };

      const reconcile: (key: string) => Promise<void> = (key: string): Promise<void> => {
        const running: Promise<void> | undefined = reconciling.get(key);
        if (running) return running;
        const run: Promise<void> = (async (): Promise<void> => {
          try {
            if (current(key) && store.detail()) {
              await readDetail(key, false);
              while (detailRead !== null && current(key)) await detailRead;
            } else {
              const detail: TaskDetail = await store._api.read(key);
              record(detail.task.key, detail.task.version);
            }
          } catch {
            // The next write goes against the version known; a new 412 reads again.
          } finally {
            reconciling.delete(key);
          }
        })();
        reconciling.set(key, run);
        return run;
      };

      const write: <T>(
        key: string,
        sendWrite: (version: number) => Promise<T>,
        fallback?: number,
      ) => Promise<T> = <T>(
        key: string,
        sendWrite: (version: number) => Promise<T>,
        fallback?: number,
      ): Promise<T> => {
        const before: Promise<void> = lanes.get(key) ?? Promise.resolve();
        const run: Promise<T> = before.then(async (): Promise<T> => {
          const read: Promise<void> | undefined = reconciling.get(key);
          if (read) await read;
          const shown: boolean = current(key) && store.detail()?.task.key === key;
          const known: number | undefined = knownVersion(key);
          const version: number | undefined = shown
            ? known
            : known === undefined
              ? fallback
              : Math.max(known, fallback ?? 0);
          if (version === undefined) throw new Error(`No confirmed version of ${key}.`);
          try {
            return await sendWrite(version);
          } catch (error: unknown) {
            if (error instanceof TaskVersionConflict) void reconcile(key);
            throw error;
          }
        });
        const settled: Promise<void> = run.then(
          (): void => undefined,
          (): void => undefined,
        );
        lanes.set(key, settled);
        void settled.then((): void => {
          if (lanes.get(key) === settled) lanes.delete(key);
        });
        return run;
      };

      const acceptVersion: (version: number, changes: Partial<TaskSummary>, key: string) => void = (
        version: number,
        changes: Partial<TaskSummary>,
        key: string,
      ): void => {
        const known: number | undefined = knownVersion(key);
        if (known === undefined || version <= known) return;
        if (version !== known + 1) {
          void reconcile(key);
          return;
        }
        record(key, version);
        const detail: TaskDetail | null = store.detail();
        if (current(key) && detail?.task.key === key) {
          patchState(store, {
            detail: { ...detail, task: { ...detail.task, ...changes, version } },
          });
        }
      };

      const readComments: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        patchState(store, { commentsLoading: true });
        try {
          const page: TaskCommentPage = await store._api.readComments(key);
          const detail: TaskDetail | null = store.detail();
          if (!current(key) || !detail) return;
          patchState(store, {
            detail: {
              ...detail,
              comments: page,
              partial: detail.partial.filter((part: string): boolean => part !== 'comments'),
            },
            commentsLoading: false,
            commentsFailed: false,
          });
        } catch {
          if (current(key)) patchState(store, { commentsLoading: false, commentsFailed: true });
        }
      };

      const readWatchers: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        try {
          const watchers: TaskWatchers = await store._api.watchers(key);
          if (current(key)) patchState(store, { watchers, watchersFailed: false });
        } catch {
          if (current(key)) patchState(store, { watchersFailed: true });
        }
      };

      const readReminder: (key: string) => Promise<void> = async (key: string): Promise<void> => {
        try {
          const reminder: TaskReminder | null = await store._api.reminder(key);
          if (current(key)) patchState(store, { reminder, reminderFailed: false });
        } catch {
          if (current(key)) patchState(store, { reminderFailed: true });
        }
      };

      const failed: (title?: string, description?: string | null) => void = (
        title?: string,
        description?: string | null,
      ): void => {
        store._toasts.error(title ?? $localize`:@@task.detail.failed:Could not save the change`, {
          description:
            description ??
            $localize`:@@task.detail.failed-text:The server did not answer. Try again in a moment.`,
        });
      };

      const conflicted: (key: string) => void = (key: string): void => {
        store._toasts.warning($localize`:@@task.detail.conflict:${key}:key: changed elsewhere`, {
          description: $localize`:@@task.detail.conflict-text:Its latest version is shown.`,
        });
      };

      const send: (key: string, patch: TaskDetailPatch) => Promise<boolean> = async (
        key: string,
        patch: TaskDetailPatch,
      ): Promise<boolean> => {
        const fields: TaskDetailField[] = (Object.keys(patch) as TaskDetailField[]).filter(
          (field: TaskDetailField): boolean => patch[field] !== undefined,
        );
        if (fields.length === 0) return false;
        const shown: boolean = current(key) && store.detail()?.task.key === key;
        if (!shown && knownVersion(key) === undefined) return false;
        const id: number = ++writeCount;
        if (shown) {
          const pending: Partial<Record<TaskDetailField, PendingValue>> = { ...store._pending() };
          for (const field of fields) pending[field] = { value: patch[field], write: id };
          patchState(store, { _pending: pending });
        }
        try {
          await write(key, async (version: number): Promise<void> => {
            confirm(await store._api.update(key, version, patch));
          });
          clearPending(fields, id);
          if (current(key) && (fields.includes('parentKey') || fields.includes('listId'))) {
            void readDetail(key, false);
          }
          return true;
        } catch (error: unknown) {
          clearPending(fields, id);
          if (error instanceof TaskVersionConflict) conflicted(key);
          else failed(undefined, refusalText(error));
          return false;
        }
      };

      return {
        open(taskKey: string, preview: TaskDetailPreview | null): void {
          if (store.taskKey() === taskKey) {
            if (preview) patchState(store, { preview });
            return;
          }
          readToken++;
          patchState(store, { ...initialState, taskKey, preview, loading: true });
          void readDetail(taskKey, true);
          void readWatchers(taskKey);
          void readReminder(taskKey);
        },

        close(): void {
          readToken++;
          patchState(store, initialState);
        },

        async reload(): Promise<void> {
          const key: string | null = keyOf();
          if (key === null) return;
          await readDetail(key, store.detail() === null);
        },

        async reloadComments(): Promise<void> {
          const key: string | null = keyOf();
          if (key !== null) await readComments(key);
        },

        async reloadWatchers(): Promise<void> {
          const key: string | null = keyOf();
          if (key !== null) await readWatchers(key);
        },

        async reloadReminder(): Promise<void> {
          const key: string | null = keyOf();
          if (key !== null) await readReminder(key);
        },

        isPending(field: TaskDetailField): boolean {
          return store._pending()[field] !== undefined;
        },

        update(patch: TaskDetailPatch): Promise<boolean> {
          const key: string | null = keyOf();
          return key === null ? Promise.resolve(false) : send(key, patch);
        },

        write,

        accept(task: TaskDetailTask): void {
          confirm(task);
        },

        acceptVersion(version: number, changes?: Partial<TaskSummary>, key?: string): void {
          const target: string | null = key ?? keyOf();
          if (target !== null) acceptVersion(version, changes ?? {}, target);
        },

        async toggleWatch(): Promise<void> {
          const key: string | null = keyOf();
          const before: TaskWatchers | null = store.watchers();
          if (key === null || !before || store.watchPending()) return;
          const following: boolean = !before.following;
          patchState(store, {
            watchPending: true,
            watchers: { following, total: Math.max(0, before.total + (following ? 1 : -1)) },
          });
          try {
            await write(
              key,
              async (): Promise<void> => {
                const version: number | null = await store._api.follow(
                  key,
                  store._workspace.user().id,
                  following,
                );
                if (version !== null) acceptVersion(version, {}, key);
                else void reconcile(key);
              },
              0,
            );
            if (!current(key)) return;
            patchState(store, {
              watchPending: false,
              watchersRevision: store.watchersRevision() + 1,
            });
            if (following) {
              store._toasts.show($localize`:@@task.detail.watching:You follow ${key}:key:`, {
                description: $localize`:@@task.detail.watching-text:Comments and changes will reach your inbox.`,
              });
            } else {
              store._toasts.show(
                $localize`:@@task.detail.unwatched:You no longer follow ${key}:key:`,
                {
                  description: $localize`:@@task.detail.unwatched-text:You will no longer receive its notifications.`,
                },
              );
            }
          } catch {
            if (!current(key)) return;
            patchState(store, { watchPending: false, watchers: before });
            failed($localize`:@@task.detail.watch-failed:Could not change who follows the task`);
          }
        },

        async setReminder(at: Date, when: string, note: string): Promise<boolean> {
          const key: string | null = keyOf();
          if (key === null || store.reminderPending()) return false;
          patchState(store, { reminderPending: true });
          try {
            const reminder: TaskReminder = await store._api.setReminder(key, at, note);
            if (!current(key)) return true;
            patchState(store, { reminder, reminderPending: false, reminderFailed: false });
            store._toasts.show($localize`:@@task.detail.reminder-set:Reminder set`, {
              description: $localize`:@@task.detail.reminder-set-text:${when}:when: · ${key}:key:`,
            });
            return true;
          } catch {
            if (current(key)) patchState(store, { reminderPending: false });
            failed($localize`:@@task.detail.reminder-failed:Could not set the reminder`);
            return false;
          }
        },

        saveReminderNote(note: string): Promise<void> {
          const key: string | null = keyOf();
          const reminder: TaskReminder | null = store.reminder();
          if (key === null || !reminder || reminder.note === note) return Promise.resolve();
          if (noteWrites.reminderId !== reminder.id || noteWrites.pending === 0) {
            noteWrites.reminderId = reminder.id;
            noteWrites.confirmed = reminder;
          }
          const turn: number = ++noteWrites.latest;
          noteWrites.pending++;
          patchState(store, { reminder: { ...reminder, note } });
          const shownHere: () => boolean = (): boolean =>
            current(key) && store.reminder()?.id === reminder.id;
          const run: Promise<void> = noteWrites.queue.then(async (): Promise<void> => {
            if (turn !== noteWrites.latest) return;
            try {
              const saved: TaskReminder = await store._api.saveReminderNote(reminder.id, note);
              if (noteWrites.reminderId === reminder.id) noteWrites.confirmed = saved;
              if (turn === noteWrites.latest && shownHere()) patchState(store, { reminder: saved });
            } catch {
              if (turn !== noteWrites.latest) return;
              const confirmed: TaskReminder | null = noteWrites.confirmed;
              if (confirmed && shownHere()) patchState(store, { reminder: confirmed });
              failed($localize`:@@task.detail.reminder-note-failed:Could not save the note`);
            }
          });
          noteWrites.queue = run.finally((): void => {
            noteWrites.pending--;
          });
          return run;
        },

        async deleteReminder(): Promise<void> {
          const key: string | null = keyOf();
          const reminder: TaskReminder | null = store.reminder();
          if (key === null || !reminder || store.reminderPending()) return;
          patchState(store, { reminder: null, reminderPending: true });
          try {
            await store._api.deleteReminder(reminder.id);
            if (current(key)) patchState(store, { reminderPending: false });
            store._toasts.show($localize`:@@task.detail.reminder-deleted:Reminder deleted`, {
              description: key,
            });
          } catch {
            if (current(key)) patchState(store, { reminder, reminderPending: false });
            failed($localize`:@@task.detail.reminder-delete-failed:Could not delete the reminder`);
          }
        },

        async duplicate(): Promise<void> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.confirmedTask();
          if (key === null || !task || store.action() !== null) return;
          patchState(store, { action: 'duplicate' });
          try {
            const copy: TaskDetailTask = await write(
              key,
              async (version: number): Promise<TaskDetailTask> => {
                const attempt: { key: string; version: number; idempotencyKey: string } =
                  duplication?.key === key && duplication.version === version
                    ? duplication
                    : { key, version, idempotencyKey: crypto.randomUUID() };
                duplication = attempt;
                const made: TaskDetailTask = await store._api.duplicate(
                  attempt.key,
                  attempt.version,
                  attempt.idempotencyKey,
                );
                if (duplication === attempt) duplication = null;
                return made;
              },
            );
            store._toasts.show($localize`:@@task.detail.duplicated:Task duplicated`, {
              description: $localize`:@@task.detail.duplicated-text:${copy.key}:key: · ${copy.name}:name:`,
              action: {
                label: $localize`:@@task.detail.open:Open`,
                run: (): void => {
                  void store._opener.open(copy.key, {
                    key: copy.key,
                    name: copy.name,
                    status: copy.status,
                    milestone: copy.milestone,
                  });
                },
              },
            });
          } catch (error: unknown) {
            if (error instanceof TaskVersionConflict) {
              if (current(key)) conflicted(key);
            } else {
              failed(
                $localize`:@@task.detail.duplicate-failed:Could not duplicate the task`,
                refusalText(error),
              );
            }
          } finally {
            if (current(key)) patchState(store, { action: null });
          }
        },

        async archive(): Promise<boolean> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.confirmedTask();
          if (key === null || !task || store.action() !== null) return false;
          patchState(store, { action: 'archive' });
          try {
            await write(key, (version: number): Promise<void> => store._api.archive(key, version));
            store._toasts.show($localize`:@@task.detail.archived:${key}:key: archived`, {
              description: $localize`:@@task.detail.archived-text:Find it in the Archives, at the bottom of the sidebar.`,
              undo: (): void => {
                store._api.unarchive(key).then(
                  (): void => {
                    store._opener.notifyChanged(key);
                  },
                  (): void => {
                    failed($localize`:@@task.detail.unarchive-failed:Could not restore the task`);
                  },
                );
              },
            });
            return true;
          } catch (error: unknown) {
            if (error instanceof TaskVersionConflict) {
              if (current(key)) conflicted(key);
            } else {
              failed($localize`:@@task.detail.archive-failed:Could not archive the task`);
            }
            return false;
          } finally {
            if (current(key)) patchState(store, { action: null });
          }
        },

        async trash(): Promise<boolean> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.confirmedTask();
          if (key === null || !task || store.action() !== null) return false;
          patchState(store, { action: 'trash' });
          try {
            const entry: TaskTrashEntry = await write(
              key,
              (version: number): Promise<TaskTrashEntry> => store._api.trash(key, version),
            );
            const kept: string = $localize`:@@task.detail.trashed-kept:Kept 30 days in the trash.`;
            const description: string =
              entry.subtaskCount === 0
                ? kept
                : entry.subtaskCount === 1
                  ? $localize`:@@task.detail.trashed-with-one:With 1 subtask. ${kept}:kept:`
                  : $localize`:@@task.detail.trashed-with-many:With ${entry.subtaskCount}:count: subtasks. ${kept}:kept:`;
            store._toasts.show($localize`:@@task.detail.trashed:${key}:key: deleted`, {
              description,
              undo: (): void => {
                store._api.restore(entry.id).then(
                  (): void => {
                    store._opener.notifyChanged(key);
                  },
                  (): void => {
                    failed($localize`:@@task.detail.restore-failed:Could not restore the task`);
                  },
                );
              },
            });
            return true;
          } catch (error: unknown) {
            if (error instanceof TaskVersionConflict) {
              if (current(key)) conflicted(key);
            } else {
              failed($localize`:@@task.detail.trash-failed:Could not delete the task`);
            }
            return false;
          } finally {
            if (current(key)) patchState(store, { action: null });
          }
        },

        async saveTemplate(): Promise<void> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.confirmedTask();
          if (key === null || !task || store.action() !== null) return;
          patchState(store, { action: 'template' });
          try {
            await store._api.saveTemplate(task.spaceId, key);
            store._toasts.show($localize`:@@task.detail.template-saved:Template saved`, {
              description: $localize`:@@task.detail.template-saved-text:“${task.name}:name:” is offered when creating a task.`,
            });
          } catch {
            failed($localize`:@@task.detail.template-failed:Could not save the template`);
          } finally {
            if (current(key)) patchState(store, { action: null });
          }
        },

        async moveTo(list: { readonly id: string; readonly name: string }): Promise<boolean> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.task();
          if (key === null || !task || task.listId === list.id) return false;
          const moved: boolean = await send(key, { listId: list.id });
          if (moved) {
            store._toasts.show($localize`:@@task.detail.moved:${key}:key: moved`, {
              description: $localize`:@@task.detail.moved-text:To ${list.name}:list:.`,
            });
          }
          return moved;
        },

        async attachTo(parent: { readonly key: string; readonly name: string }): Promise<boolean> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.task();
          if (key === null || !task || task.parentKey === parent.key) return false;
          const previous: string | null = task.parentKey;
          const attached: boolean = await send(key, { parentKey: parent.key });
          if (attached) {
            store._toasts.show(
              $localize`:@@task.detail.attached:${key}:key: attached to ${parent.key}:parent:`,
              {
                description: $localize`:@@task.detail.attached-text:It is now a subtask of “${parent.name}:name:”.`,
                undo: (): void => {
                  void send(key, { parentKey: previous });
                },
              },
            );
          }
          return attached;
        },

        async detach(): Promise<boolean> {
          const key: string | null = keyOf();
          const task: TaskDetailTask | null = store.task();
          if (key === null || task?.parentKey == null) return false;
          const previous: string = task.parentKey;
          const detached: boolean = await send(key, { parentKey: null });
          if (detached) {
            store._toasts.show($localize`:@@task.detail.detached:${key}:key: detached`, {
              description: $localize`:@@task.detail.detached-text:It is a top-level task again.`,
              undo: (): void => {
                void send(key, { parentKey: previous });
              },
            });
          }
          return detached;
        },

        _refresh(part: TaskDetailPart): void {
          const key: string | null = keyOf();
          if (key === null || !store.detail()) return;
          if (part === 'task') void readDetail(key, false);
          else if (part === 'comments') {
            patchState(store, { commentsRevision: store.commentsRevision() + 1 });
            void readComments(key);
          } else patchState(store, { gitRevision: store.gitRevision() + 1 });
        },
      };
    }),
    withMethods((store) => ({
      _watch: rxMethod<string | null>(
        pipe(
          switchMap((taskKey: string | null): Observable<TaskDetailPart> => {
            const realtime: RealtimeConnection | null = store._realtime;
            if (taskKey === null || !realtime) return EMPTY;
            return realtime.watch({ kind: 'task', taskKey }).pipe(
              catchError((): Observable<RealtimeChange> => EMPTY),
              map(
                (notice: RealtimeChange): TaskDetailPart | undefined => NOTICE_PARTS[notice.type],
              ),
              filter(
                (part: TaskDetailPart | undefined): part is TaskDetailPart => part !== undefined,
              ),
              groupBy((part: TaskDetailPart): TaskDetailPart => part),
              mergeMap((parts: Observable<TaskDetailPart>): Observable<TaskDetailPart> =>
                parts.pipe(auditTime(NOTICE_WINDOW_MS)),
              ),
            );
          }),
          tap((part: TaskDetailPart): void => {
            store._refresh(part);
          }),
        ),
      ),
    })),
    withHooks({
      onInit(store): void {
        store._watch(store.taskKey);
      },
    }),
  );
}

/**
 * Constant TaskDetailStore
 *
 * @description
 * The open task of the detail dialog, provided by the dialog so its state dies with it. It reads
 * the detail aggregate (the skeleton shows while none is shown; a failure is the typed route
 * error the dialog renders), the watchers and the caller's reminder; keeps the confirmed task and
 * its version; shows pending local values over it (`update`, rolled back on failure, `412` reads
 * again and warns); is the one write path of each task (`write`: the writes of one task go one
 * after the other, each against its newest confirmed version, after a `412` or a version that
 * skipped one only once the task was read again; a write queued when another task opens is still
 * sent with its own key and version; `TASK_WRITE_LANE` hands it to the status changes); and
 * watches the task's realtime room while a
 * task is open: a task update or status change reads the detail again, a new comment reads the
 * first comment page, a Git link change counts `gitRevision`; each part at most once per
 * `NOTICE_WINDOW_MS`, never over a pending local value. The socket names no task key and hands
 * every watched room's notices to every watch, so a notice of another task also reads again.
 * The header's actions (follow, reminder, duplicate, archive, trash, template, move, attach,
 * detach) are its methods, with their toasts.
 *
 * @type {Type<TaskDetailStoreInstance>}
 */
export const TaskDetailStore: Type<TaskDetailStoreInstance> = createTaskDetailStore();
