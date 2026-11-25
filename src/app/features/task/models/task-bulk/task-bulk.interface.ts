import type { CancelReason, PriorityKey, StatusKey } from '@cadenway/contracts';

/**
 * Type TaskBulkAction
 *
 * @description
 * One action applied at once to selected tasks (`executeBulkTaskAction`): a status (with its
 * cancellation reason for `cancelled`), a priority, an assignee added or removed, a destination
 * list, the trash or a copy.
 *
 * @type {object}
 */
export type TaskBulkAction =
  | {
      readonly type: 'status';
      readonly status: StatusKey;
      readonly cancelReason?: CancelReason;
      readonly cancelNote?: string | null;
    }
  | { readonly type: 'priority'; readonly priority: PriorityKey }
  | { readonly type: 'assign'; readonly userId: string }
  | { readonly type: 'unassign'; readonly userId: string }
  | { readonly type: 'move'; readonly listId: string }
  | { readonly type: 'trash' }
  | { readonly type: 'duplicate' };

/**
 * Interface TaskBulkSelection
 *
 * @description
 * One selected task and the version it is shown at.
 */
export interface TaskBulkSelection {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property version
   *
   * @description
   * Version the action was decided on, checked before any change; absent to apply the action to
   * the task as it is.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly version?: number;
  // #endregion
}

/**
 * Interface TaskBulkEntry
 *
 * @description
 * What the gateway did to one selected task.
 */
export interface TaskBulkEntry {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Key of the selected task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property version
   *
   * @description
   * Version of the task after the action, when the action changed it.
   *
   * @type {number | null}
   * @readonly
   */
  readonly version: number | null;

  /**
   * Property newTaskKey
   *
   * @description
   * Key of the copy, for `duplicate`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly newTaskKey: string | null;

  /**
   * Property trashEntryId
   *
   * @description
   * Trash entry holding the task, for `trash`; « Annuler » restores it.
   *
   * @type {string | null}
   * @readonly
   */
  readonly trashEntryId: string | null;
  // #endregion
}

/**
 * Interface TaskBulkOutcome
 *
 * @description
 * What a bulk action sent in chunks ended with. Each chunk is atomic: its tasks are all in `done`
 * or all in `failed` (refused), `unknown` (no certain answer) or `notSent` (stopped before it).
 */
export interface TaskBulkOutcome {
  // #region Properties
  /**
   * Property affected
   *
   * @description
   * Task rows the gateway changed, subtrees, successors and copies included.
   *
   * @type {number}
   * @readonly
   */
  readonly affected: number;

  /**
   * Property done
   *
   * @description
   * The applied tasks, with their results.
   *
   * @type {readonly TaskBulkEntry[]}
   * @readonly
   */
  readonly done: readonly TaskBulkEntry[];

  /**
   * Property failed
   *
   * @description
   * Tasks of refused chunks, unchanged.
   *
   * @type {readonly TaskBulkSelection[]}
   * @readonly
   */
  readonly failed: readonly TaskBulkSelection[];

  /**
   * Property unknown
   *
   * @description
   * Tasks of a chunk without a certain answer, even after its retry.
   *
   * @type {readonly TaskBulkSelection[]}
   * @readonly
   */
  readonly unknown: readonly TaskBulkSelection[];

  /**
   * Property notSent
   *
   * @description
   * Tasks never sent: the organization or the page changed, or an earlier chunk had no certain
   * answer.
   *
   * @type {readonly TaskBulkSelection[]}
   * @readonly
   */
  readonly notSent: readonly TaskBulkSelection[];
  // #endregion
}
