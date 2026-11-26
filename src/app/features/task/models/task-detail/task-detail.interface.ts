import type { CancelReason, PriorityKey, Recurrence, StatusKey } from '@cadenway/contracts';

import type { StatusOption } from '../status-option/status-option.interface';
import type { TaskSummary } from '../task-summary/task-summary.interface';

/**
 * Interface TaskChecklistItem
 *
 * @description
 * One item of a task's checklist, in the order it was added.
 */
export interface TaskChecklistItem {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the item, for its own routes.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property text
   *
   * @description
   * Text of the item, 300 characters at most.
   *
   * @type {string}
   * @readonly
   */
  readonly text: string;

  /**
   * Property done
   *
   * @description
   * Whether the item is ticked.
   *
   * @type {boolean}
   * @readonly
   */
  readonly done: boolean;
  // #endregion
}

/**
 * Interface TaskActor
 *
 * @description
 * Who made a change: a person (`user`, `id` is the account), an automation, Git or a service.
 */
export interface TaskActor {
  // #region Properties
  /**
   * Property type
   *
   * @description
   * `user`, `automation`, `git` or `system`; an unknown type is shown as is.
   *
   * @type {string}
   * @readonly
   */
  readonly type: string;

  /**
   * Property id
   *
   * @description
   * The account for a person, else the name of the automation or service.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;
  // #endregion
}

/**
 * Interface TaskDetailTask
 *
 * @description
 * The task the detail shows: its summary plus what only the detail reads (description, checklist
 * items, cancellation note, estimate, creation and archive). `version` is the `If-Match`
 * precondition of every write.
 */
export interface TaskDetailTask extends TaskSummary {
  // #region Properties
  /**
   * Property description
   *
   * @description
   * Markdown description, or null when there is none.
   *
   * @type {string | null}
   * @readonly
   */
  readonly description: string | null;

  /**
   * Property cancelNote
   *
   * @description
   * Details of a cancellation, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly cancelNote: string | null;

  /**
   * Property estimateMinutes
   *
   * @description
   * Estimate in whole minutes, or null.
   *
   * @type {number | null}
   * @readonly
   */
  readonly estimateMinutes: number | null;

  /**
   * Property checklistItems
   *
   * @description
   * Items of the checklist, in the order they were added.
   *
   * @type {readonly TaskChecklistItem[]}
   * @readonly
   */
  readonly checklistItems: readonly TaskChecklistItem[];

  /**
   * Property createdAt
   *
   * @description
   * When the task was created (ISO instant).
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property createdBy
   *
   * @description
   * Who created the task.
   *
   * @type {TaskActor}
   * @readonly
   */
  readonly createdBy: TaskActor;

  /**
   * Property updatedAt
   *
   * @description
   * When the task last changed (ISO instant).
   *
   * @type {string}
   * @readonly
   */
  readonly updatedAt: string;

  /**
   * Property archivedAt
   *
   * @description
   * When the task was archived, or null for a live task.
   *
   * @type {string | null}
   * @readonly
   */
  readonly archivedAt: string | null;
  // #endregion
}

/**
 * Interface TaskDetailSpace
 *
 * @description
 * The space of the task, with the statuses as it names and hides them.
 */
export interface TaskDetailSpace {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the space.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the space.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property statuses
   *
   * @description
   * The ten statuses with the space's labels, in workflow order.
   *
   * @type {readonly StatusOption[]}
   * @readonly
   */
  readonly statuses: readonly StatusOption[];
  // #endregion
}

/**
 * Interface TaskDetailList
 *
 * @description
 * The list of the task and the caller's role on it.
 */
export interface TaskDetailList {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the list or sprint.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceId
   *
   * @description
   * Space of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property canEdit
   *
   * @description
   * Whether the caller may change the task: `edit` on the list, or no role reported (the rule
   * before grants existed).
   *
   * @type {boolean}
   * @readonly
   */
  readonly canEdit: boolean;
  // #endregion
}

/**
 * Interface TaskReference
 *
 * @description
 * A task named by another one (the parent of a subtask), with its name and status as they are now.
 */
export interface TaskReference {
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
   * Status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;
  // #endregion
}

/**
 * Interface TaskComment
 *
 * @description
 * A live comment of the task timeline.
 */
export interface TaskComment {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the comment.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property author
   *
   * @description
   * Who wrote it.
   *
   * @type {TaskActor}
   * @readonly
   */
  readonly author: TaskActor;

  /**
   * Property body
   *
   * @description
   * Markdown source, unchanged.
   *
   * @type {string}
   * @readonly
   */
  readonly body: string;

  /**
   * Property createdAt
   *
   * @description
   * When it was written (ISO instant).
   *
   * @type {string}
   * @readonly
   */
  readonly createdAt: string;

  /**
   * Property editedAt
   *
   * @description
   * When it was last edited, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly editedAt: string | null;

  /**
   * Property version
   *
   * @description
   * Version of the comment, the `If-Match` of its own writes.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;

  /**
   * Property replyToCommentId
   *
   * @description
   * The comment it answers, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly replyToCommentId: string | null;
  // #endregion
}

/**
 * Interface TaskCommentPage
 *
 * @description
 * A page of comments, oldest first.
 */
export interface TaskCommentPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The comments of the page.
   *
   * @type {readonly TaskComment[]}
   * @readonly
   */
  readonly items: readonly TaskComment[];

  /**
   * Property total
   *
   * @description
   * Live comments of the task across every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page, or null on the last one.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;
  // #endregion
}

/**
 * Interface TaskDetail
 *
 * @description
 * What the task detail shows, composed by the gateway (`getTaskDetail`). `partial` names the parts
 * the gateway could not read (`comments` today), whose sections show an inline error; the rest is
 * complete.
 */
export interface TaskDetail {
  // #region Properties
  /**
   * Property task
   *
   * @description
   * The task, as last confirmed by the gateway.
   *
   * @type {TaskDetailTask}
   * @readonly
   */
  readonly task: TaskDetailTask;

  /**
   * Property space
   *
   * @description
   * Its space with the statuses.
   *
   * @type {TaskDetailSpace}
   * @readonly
   */
  readonly space: TaskDetailSpace;

  /**
   * Property list
   *
   * @description
   * Its list and the caller's role.
   *
   * @type {TaskDetailList}
   * @readonly
   */
  readonly list: TaskDetailList;

  /**
   * Property parent
   *
   * @description
   * The parent of a subtask, or null for a top-level task.
   *
   * @type {TaskReference | null}
   * @readonly
   */
  readonly parent: TaskReference | null;

  /**
   * Property subtasks
   *
   * @description
   * The direct subtasks, 25 at most, in creation order.
   *
   * @type {readonly TaskSummary[]}
   * @readonly
   */
  readonly subtasks: readonly TaskSummary[];

  /**
   * Property comments
   *
   * @description
   * First page of comments, or null when that part could not be read.
   *
   * @type {TaskCommentPage | null}
   * @readonly
   */
  readonly comments: TaskCommentPage | null;

  /**
   * Property partial
   *
   * @description
   * Parts the gateway could not read (`comments`, later `attachments` or `development`).
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly partial: readonly string[];
  // #endregion
}

/**
 * Interface TaskDetailPatch
 *
 * @description
 * The fields a detail write changes, as JSON Merge Patch members named like `TaskDetailTask`
 * (`due` and `start` are the dates). Assignees, labels and the checklist are collections with
 * their own routes and never go through this patch.
 */
export interface TaskDetailPatch {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * New name, trimmed and not blank.
   *
   * @type {string | undefined}
   */
  name?: string;

  /**
   * Property description
   *
   * @description
   * New Markdown description; null removes it.
   *
   * @type {string | null | undefined}
   */
  description?: string | null;

  /**
   * Property status
   *
   * @description
   * New status; `cancelled` needs `cancelReason`.
   *
   * @type {StatusKey | undefined}
   */
  status?: StatusKey;

  /**
   * Property cancelReason
   *
   * @description
   * Reason of a cancellation.
   *
   * @type {CancelReason | null | undefined}
   */
  cancelReason?: CancelReason | null;

  /**
   * Property cancelNote
   *
   * @description
   * Details of a cancellation; blank or null clears it.
   *
   * @type {string | null | undefined}
   */
  cancelNote?: string | null;

  /**
   * Property priority
   *
   * @description
   * New priority.
   *
   * @type {PriorityKey | undefined}
   */
  priority?: PriorityKey;

  /**
   * Property due
   *
   * @description
   * New due date (calendar date); null removes it, and the start moves with it.
   *
   * @type {string | null | undefined}
   */
  due?: string | null;

  /**
   * Property start
   *
   * @description
   * New start date (calendar date); null removes it.
   *
   * @type {string | null | undefined}
   */
  start?: string | null;

  /**
   * Property estimateMinutes
   *
   * @description
   * New estimate in minutes; null removes it.
   *
   * @type {number | null | undefined}
   */
  estimateMinutes?: number | null;

  /**
   * Property listId
   *
   * @description
   * List to move the task to, with its subtasks.
   *
   * @type {string | undefined}
   */
  listId?: string;

  /**
   * Property parentKey
   *
   * @description
   * Task to attach this one to; null detaches it.
   *
   * @type {string | null | undefined}
   */
  parentKey?: string | null;

  /**
   * Property milestone
   *
   * @description
   * Whether the task becomes or stops being a milestone.
   *
   * @type {boolean | undefined}
   */
  milestone?: boolean;

  /**
   * Property recurrence
   *
   * @description
   * New recurrence.
   *
   * @type {Recurrence | undefined}
   */
  recurrence?: Recurrence;
  // #endregion
}

/**
 * Type TaskDetailField
 *
 * @description
 * A field a detail write changes, the key of the per-field pending map.
 *
 * @type {keyof TaskDetailPatch}
 */
export type TaskDetailField = keyof TaskDetailPatch;

/**
 * Interface TaskDetailPreview
 *
 * @description
 * What the screen that opens a task already knows of it (a list row), shown in the header while
 * the detail is read.
 */
export interface TaskDetailPreview {
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
   * Status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

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
 * Interface TaskWatchers
 *
 * @description
 * Who follows the task: their count and whether the caller does.
 */
export interface TaskWatchers {
  // #region Properties
  /**
   * Property total
   *
   * @description
   * Effective watchers of the task.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property following
   *
   * @description
   * Whether the caller follows the task.
   *
   * @type {boolean}
   * @readonly
   */
  readonly following: boolean;
  // #endregion
}

/**
 * Interface TaskReminder
 *
 * @description
 * The caller's one pending reminder of the task.
 */
export interface TaskReminder {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the reminder, for its note and its deletion.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property at
   *
   * @description
   * When it fires (ISO instant).
   *
   * @type {string}
   * @readonly
   */
  readonly at: string;

  /**
   * Property note
   *
   * @description
   * Note of the reminder, empty when there is none.
   *
   * @type {string}
   * @readonly
   */
  readonly note: string;

  /**
   * Property fired
   *
   * @description
   * Whether it already fired (late: shown in the grenat tone).
   *
   * @type {boolean}
   * @readonly
   */
  readonly fired: boolean;
  // #endregion
}

/**
 * Interface TaskTrashEntry
 *
 * @description
 * What a deletion put in the trash, so that `Undo` restores it.
 */
export interface TaskTrashEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * The trash entry.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property subtaskCount
   *
   * @description
   * Subtasks deleted with the task, at every level.
   *
   * @type {number}
   * @readonly
   */
  readonly subtaskCount: number;
  // #endregion
}

/**
 * Interface TaskParentCandidate
 *
 * @description
 * A task the open one may become a subtask of, with what the depth and size limits need.
 */
export interface TaskParentCandidate {
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
   * Status of the task.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property sameList
   *
   * @description
   * Whether it is in the open task's list (shown first).
   *
   * @type {boolean}
   * @readonly
   */
  readonly sameList: boolean;

  /**
   * Property parentKey
   *
   * @description
   * Its own parent, null for a top-level task, undefined when unknown (a search hit).
   *
   * @type {string | null | undefined}
   * @readonly
   */
  readonly parentKey?: string | null;

  /**
   * Property children
   *
   * @description
   * Its direct subtasks, undefined when unknown (a search hit).
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly children?: number;
  // #endregion
}
