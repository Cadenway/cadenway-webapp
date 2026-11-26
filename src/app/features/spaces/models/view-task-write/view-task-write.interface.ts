import type { StatusKey } from '@cadenway/contracts';

import type {
  TaskBulkAction,
  TaskBulkOutcome,
  TaskBulkSelection,
  TaskSummary,
} from '@features/task';

/**
 * Interface ConfirmedTask
 *
 * @description
 * A task as the gateway last confirmed it when an action of the view was sent: the values its
 * `Undo` puts back and the version that action was sent with.
 */
export interface ConfirmedTask extends TaskSummary {
  // #region Properties
  /**
   * Property cancelNote
   *
   * @description
   * The note of the task's cancellation when this view recorded it, null when there is none or
   * it is not known (task summaries carry no note).
   *
   * @type {string | null}
   * @readonly
   */
  readonly cancelNote: string | null;
  // #endregion
}

/**
 * Interface ViewTaskOutcome
 *
 * @description
 * What a write of a task view ended with, and each sent task as confirmed just before it was
 * sent. A task whose queued status change a newer one replaced is in no list: the newer change
 * reports it.
 */
export interface ViewTaskOutcome extends TaskBulkOutcome {
  // #region Properties
  /**
   * Property before
   *
   * @description
   * The sent tasks as confirmed before the write, by key.
   *
   * @type {Readonly<Partial<Record<string, ConfirmedTask>>>}
   * @readonly
   */
  readonly before: Readonly<Partial<Record<string, ConfirmedTask>>>;

  /**
   * Property after
   *
   * @description
   * The version each applied task stood at once the write was answered, by key: the version an
   * `Undo` of this write expects the task to still be at.
   *
   * @type {Readonly<Partial<Record<string, number>>>}
   * @readonly
   */
  readonly after: Readonly<Partial<Record<string, number>>>;

  /**
   * Property changed
   *
   * @description
   * Tasks not sent because they changed since the version the write expected, each at its
   * newest known version; empty for a write sent without expected versions.
   *
   * @type {readonly TaskBulkSelection[]}
   * @readonly
   */
  readonly changed: readonly TaskBulkSelection[];
  // #endregion
}

/**
 * Interface TaskFieldChanges
 *
 * @description
 * The single-field writes of a task view (`updateTask` with `If-Match`): a reschedule (calendar,
 * Gantt), an estimate, a name or custom field values (sheet). A date is `YYYY-MM-DD`; null
 * clears the field. Without `startDate`, a new `dueDate` moves the start with it and keeps the
 * duration (gateway rule). `customFieldValues` is merged by the gateway; a null value clears that
 * field.
 */
export interface TaskFieldChanges {
  // #region Properties
  /**
   * Property dueDate
   *
   * @description
   * New due date, or null to remove it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly dueDate?: string | null;

  /**
   * Property startDate
   *
   * @description
   * New start date, or null to remove it.
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly startDate?: string | null;

  /**
   * Property estimateMinutes
   *
   * @description
   * New estimate in minutes, or null to remove it.
   *
   * @type {number | null | undefined}
   * @readonly
   */
  readonly estimateMinutes?: number | null;

  /**
   * Property name
   *
   * @description
   * New name, trimmed by the caller.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly name?: string;

  /**
   * Property customFieldValues
   *
   * @description
   * Custom field values by field id: a number, a text, or null to clear the field.
   *
   * @type {Readonly<Record<string, number | string | null>> | undefined}
   * @readonly
   */
  readonly customFieldValues?: Readonly<Record<string, number | string | null>>;
  // #endregion
}

/**
 * Type TaskFieldWriteResult
 *
 * @description
 * The answer of one single-field write: applied at a version (null when the gateway returned
 * none), refused (a `4xx`; `stale` for a `412` other than an organization change: the task
 * changed since the version sent, so the view reads it again), or without a certain outcome (no
 * answer, or a `5xx`).
 *
 * @type {{ kind: 'done'; version: number | null } | { kind: 'refused'; stale: boolean } | { kind: 'unknown' }}
 */
export type TaskFieldWriteResult =
  | { readonly kind: 'done'; readonly version: number | null }
  | { readonly kind: 'refused'; readonly stale: boolean }
  | { readonly kind: 'unknown' };

/**
 * Interface ViewTaskWriteSource
 *
 * @description
 * What a reader store composing `withViewTaskWrites` lends the writes: the tasks it read, its
 * read count, its scope and its reload. Connected once, in the reader's `onInit`.
 */
export interface ViewTaskWriteSource {
  // #region Methods
  /**
   * Method taskOf
   *
   * @description
   * The task of a key as last read by the view (subtasks included), or undefined.
   *
   * @param {string} key - Task key.
   * @returns {TaskSummary | undefined} The task.
   */
  taskOf(key: string): TaskSummary | undefined;

  /**
   * Method reads
   *
   * @description
   * Reads of the view's tasks begun so far; a confirmed write without a returned version gives
   * way to the next read begun after it.
   *
   * @returns {number} The count.
   */
  reads(): number;

  /**
   * Method scope
   *
   * @description
   * Organization and list the view shows (any string that changes with them), null before the
   * first read; a write never starts once it changed.
   *
   * @returns {string | null} The scope.
   */
  scope(): string | null;

  /**
   * Method reload
   *
   * @description
   * Reads the view's tasks again in place, after a write that may have changed something.
   */
  reload(): void;

  /**
   * Method filed
   *
   * @description
   * The tasks whose changes the view now files (groups) 460 ms after their last write, for their
   * entry motion; never called with reduced motion.
   *
   * @param {readonly string[]} keys - The task keys.
   */
  filed(keys: readonly string[]): void;
  // #endregion
}

/**
 * Interface ViewTaskWriter
 *
 * @description
 * The writes a task view offers its menu and its toasts (`VIEW_TASK_WRITER`): the reader store of
 * the view, composing `withViewTaskWrites`.
 */
export interface ViewTaskWriter {
  // #region Methods
  /**
   * Method act
   *
   * @description
   * Applies an action to tasks shown by the view (`TaskActionsApi.bulk`), serialized per task,
   * shown at once and rolled back when refused; with `expected` (an `Undo`), a task changed since
   * is not sent. The promise never rejects.
   *
   * @param {readonly TaskSummary[]} tasks - The tasks, as shown.
   * @param {TaskBulkAction} action - The action.
   * @param {Readonly<Partial<Record<string, number>>>} [expected] - The version each task must
   * still be at.
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
   * Writes fields of one task (`updateTask` with `If-Match`), in the same per-task order as
   * `act`, shown at once (name and dates) and rolled back when refused. The promise never
   * rejects.
   *
   * @param {TaskSummary} task - The task, as shown.
   * @param {TaskFieldChanges} changes - The fields.
   * @param {Readonly<Partial<Record<string, number>>>} [expected] - The version the task must
   * still be at.
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
   * @returns {Promise<readonly string[]>} The keys whose reminder was recorded.
   */
  remind(taskKeys: readonly string[], at: Date): Promise<readonly string[]>;

  /**
   * Method restore
   *
   * @description
   * Takes deleted tasks out of the trash, four calls at a time, then reads the view again.
   *
   * @param {readonly string[]} entryIds - The trash entries.
   * @returns {Promise<boolean>} Whether every entry came back.
   */
  restore(entryIds: readonly string[]): Promise<boolean>;

  /**
   * Method reload
   *
   * @description
   * Reads the view's tasks again in place.
   */
  reload(): void;

  /**
   * Method shownStatus
   *
   * @description
   * The status a task shows in the view, a pending change or an optimistic write included.
   *
   * @param {TaskSummary} task - The task.
   * @returns {StatusKey} The status.
   */
  shownStatus(task: TaskSummary): StatusKey;
  // #endregion
}

/**
 * Interface MoveTarget
 *
 * @description
 * A list tasks may move to (`Move to` of the task menu and the selection bar), with its icon,
 * its tone and its space.
 */
export interface MoveTarget {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * Destination list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property name
   *
   * @description
   * List name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceName
   *
   * @description
   * Its space's name.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property icon
   *
   * @description
   * Icon of the list (its own, the sprint's lightning or the bullets).
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property tone
   *
   * @description
   * Text class of the list's color, `text-muted-foreground` for grey.
   *
   * @type {string}
   * @readonly
   */
  readonly tone: string;
  // #endregion
}
