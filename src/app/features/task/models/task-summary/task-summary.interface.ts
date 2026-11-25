import type { CancelReason, PriorityKey, Recurrence, StatusKey } from '@cadenway/contracts';

/**
 * Interface TaskProgress
 *
 * @description
 * How much of a set of items is closed: the subtasks of a task or the entries of its checklist.
 */
export interface TaskProgress {
  // #region Properties
  /**
   * Property closed
   *
   * @description
   * Items closed: subtasks in a closed status, or checked checklist entries.
   *
   * @type {number}
   * @readonly
   */
  readonly closed: number;

  /**
   * Property total
   *
   * @description
   * Every item, closed or not.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;
  // #endregion
}

/**
 * Interface TaskSummary
 *
 * @description
 * A task as a row, a card or a picker shows it (mockup `App.dc.html`, list row cells near line
 * 660). The gateway identifies a task by its key, so `id` is that key; `version` is the write
 * precondition every change sends as `If-Match`.
 */
export interface TaskSummary {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Stable identity of the task in collections; the gateway has no other id than the key.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property key
   *
   * @description
   * Key shown to people and used in addresses (`CAD-482`).
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Name of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Saved status, as the gateway last returned it.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property cancelReason
   *
   * @description
   * Why the task was cancelled, only while its status is `cancelled`.
   *
   * @type {CancelReason | null}
   * @readonly
   */
  readonly cancelReason: CancelReason | null;

  /**
   * Property priority
   *
   * @description
   * Priority of the task.
   *
   * @type {PriorityKey}
   * @readonly
   */
  readonly priority: PriorityKey;

  /**
   * Property assigneeIds
   *
   * @description
   * User ids of the assignees, in the gateway's order.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly assigneeIds: readonly string[];

  /**
   * Property due
   *
   * @description
   * Due date as an ISO calendar date (`2026-11-12`), or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly due: string | null;

  /**
   * Property start
   *
   * @description
   * Start date as an ISO calendar date, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly start: string | null;

  /**
   * Property labels
   *
   * @description
   * Names of the labels of the task.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly labels: readonly string[];

  /**
   * Property subtasks
   *
   * @description
   * Subtasks closed among all of them.
   *
   * @type {TaskProgress}
   * @readonly
   */
  readonly subtasks: TaskProgress;

  /**
   * Property checklist
   *
   * @description
   * Checklist entries checked among all of them.
   *
   * @type {TaskProgress}
   * @readonly
   */
  readonly checklist: TaskProgress;

  /**
   * Property comments
   *
   * @description
   * Number of comments, or null while the task summaries of the gateway do not carry it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly comments: number | null;

  /**
   * Property parentKey
   *
   * @description
   * Key of the parent task of a subtask, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly parentKey: string | null;

  /**
   * Property milestone
   *
   * @description
   * Whether the task is a milestone: a diamond icon and four statuses only.
   *
   * @type {boolean}
   * @readonly
   */
  readonly milestone: boolean;

  /**
   * Property recurrence
   *
   * @description
   * How the task repeats; `none` when it does not.
   *
   * @type {Recurrence}
   * @readonly
   */
  readonly recurrence: Recurrence;

  /**
   * Property listId
   *
   * @description
   * List that holds the task.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property spaceId
   *
   * @description
   * Space of that list, whose statuses the task uses.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property version
   *
   * @description
   * Write version of the task, sent as `If-Match` with the next change.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}
