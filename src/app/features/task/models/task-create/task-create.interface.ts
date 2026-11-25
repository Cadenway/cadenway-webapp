import type { CancelReason, PriorityKey, StatusKey } from '@cadenway/contracts';

import type { StatusOption } from '../status-option/status-option.interface';

/**
 * Interface TaskCreateOptions
 *
 * @description
 * What a caller presets when it opens the task create dialog: the « + » of a group gives its
 * status, priority or assignee, a calendar day its due date, a task its key for a new subtask.
 * Everything is optional.
 */
export interface TaskCreateOptions {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * Destination list; the first list the person sees by default.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly listId?: string;

  /**
   * Property status
   *
   * @description
   * Initial status; `todo` by default.
   *
   * @type {StatusKey | undefined}
   * @readonly
   */
  readonly status?: StatusKey;

  /**
   * Property due
   *
   * @description
   * Initial due date as an ISO calendar date.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly due?: string;

  /**
   * Property parentKey
   *
   * @description
   * Key of the task the new task becomes a subtask of; it is then created in the parent's list.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly parentKey?: string;

  /**
   * Property priority
   *
   * @description
   * Initial priority; `moyenne` by default.
   *
   * @type {PriorityKey | undefined}
   * @readonly
   */
  readonly priority?: PriorityKey;

  /**
   * Property assigneeIds
   *
   * @description
   * Initial assignees (account ids); the signed-in user by default, an empty array for nobody
   * (the « Non assignées » group).
   *
   * @type {readonly string[] | undefined}
   * @readonly
   */
  readonly assigneeIds?: readonly string[];
  // #endregion
}

/**
 * Interface ListDestination
 *
 * @description
 * A list the dialog can create a task in (« dans » Produit › Sprint 14).
 */
export interface ListDestination {
  // #region Properties
  /**
   * Property listId
   *
   * @description
   * Id of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property listName
   *
   * @description
   * Name of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;

  /**
   * Property spaceId
   *
   * @description
   * Id of the space of the list.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property spaceName
   *
   * @description
   * Name of that space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceName: string;

  /**
   * Property sprintEnd
   *
   * @description
   * Last day of the sprint when the list is one, as an ISO calendar date, for « Fin du sprint ».
   *
   * @type {string | null}
   * @readonly
   */
  readonly sprintEnd: string | null;
  // #endregion
}

/**
 * Interface SpaceSetup
 *
 * @description
 * What the dialog needs from the destination's space: its statuses and the next task key.
 */
export interface SpaceSetup {
  // #region Properties
  /**
   * Property spaceId
   *
   * @description
   * Id of the space.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property nextKey
   *
   * @description
   * Key the next task created in the space will take (`CAD-495`).
   *
   * @type {string}
   * @readonly
   */
  readonly nextKey: string;

  /**
   * Property statuses
   *
   * @description
   * Statuses of the space in workflow order, hidden ones included.
   *
   * @type {readonly StatusOption[]}
   * @readonly
   */
  readonly statuses: readonly StatusOption[];
  // #endregion
}

/**
 * Interface TaskTemplateOption
 *
 * @description
 * A template saved in the space, which fills the dialog when chosen.
 */
export interface TaskTemplateOption {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the template.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * Name of the template in the menu.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property title
   *
   * @description
   * Name it gives a new task whose name is still empty.
   *
   * @type {string}
   * @readonly
   */
  readonly title: string;

  /**
   * Property description
   *
   * @description
   * Description it fills in.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property priority
   *
   * @description
   * Priority it sets.
   *
   * @type {PriorityKey}
   * @readonly
   */
  readonly priority: PriorityKey;

  /**
   * Property labels
   *
   * @description
   * Labels it sets.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly labels: readonly string[];

  /**
   * Property checklist
   *
   * @description
   * Checklist entries the task is created with.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly checklist: readonly string[];

  /**
   * Property subtasks
   *
   * @description
   * Names of the subtasks it drafts.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly subtasks: readonly string[];
  // #endregion
}

/**
 * Interface TaskDraft
 *
 * @description
 * The submitted content of the create dialog, as the data access sends it.
 */
export interface TaskDraft {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Trimmed, non-empty name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property description
   *
   * @description
   * Trimmed description, or an empty string for none.
   *
   * @type {string}
   * @readonly
   */
  readonly description: string;

  /**
   * Property status
   *
   * @description
   * Initial status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property cancelReason
   *
   * @description
   * Reason given when the initial status is `cancelled`, otherwise null.
   *
   * @type {CancelReason | null}
   * @readonly
   */
  readonly cancelReason: CancelReason | null;

  /**
   * Property cancelNote
   *
   * @description
   * Optional note given with that reason.
   *
   * @type {string}
   * @readonly
   */
  readonly cancelNote: string;

  /**
   * Property priority
   *
   * @description
   * Priority.
   *
   * @type {PriorityKey}
   * @readonly
   */
  readonly priority: PriorityKey;

  /**
   * Property assigneeIds
   *
   * @description
   * User ids of the assignees.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly assigneeIds: readonly string[];

  /**
   * Property due
   *
   * @description
   * Due date as an ISO calendar date, or null.
   *
   * @type {string | null}
   * @readonly
   */
  readonly due: string | null;

  /**
   * Property labels
   *
   * @description
   * Label names.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly labels: readonly string[];

  /**
   * Property subtasks
   *
   * @description
   * Names of the subtasks created with the task.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly subtasks: readonly string[];

  /**
   * Property checklist
   *
   * @description
   * Checklist entries created with the task, from a template.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly checklist: readonly string[];
  // #endregion
}

/**
 * Interface CreatedTask
 *
 * @description
 * A task the dialog created, as its toast and the lists that refresh after it need it.
 */
export interface CreatedTask {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Key of the new task.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property listId
   *
   * @description
   * List that received it.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

  /**
   * Property status
   *
   * @description
   * Its status.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property subtasks
   *
   * @description
   * Number of subtasks created with it.
   *
   * @type {number}
   * @readonly
   */
  readonly subtasks: number;
  // #endregion
}
