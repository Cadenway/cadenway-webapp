import type { StatusKey } from '@cadenway/contracts';

/**
 * Type TrashActorKind
 *
 * @description
 * Who deleted an entry: a person (`user`, named from the member directory), an automation rule
 * (`automation`), or another actor the page does not name (`other`: the Git integration, a
 * service, or a type a later contract adds).
 *
 * @type {'user' | 'automation' | 'other'}
 */
export type TrashActorKind = 'user' | 'automation' | 'other';

/**
 * Interface TrashActor
 *
 * @description
 * The author of a deletion, as the trash row names it.
 */
export interface TrashActor {
  // #region Properties
  /**
   * Property kind
   *
   * @description
   * What kind of actor deleted the entry.
   *
   * @type {TrashActorKind}
   * @readonly
   */
  readonly kind: TrashActorKind;

  /**
   * Property id
   *
   * @description
   * Account id of a person, or the identifier of another actor.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;
  // #endregion
}

/**
 * Interface TrashEntry
 *
 * @description
 * One element of the trash (`App.dc.html` lines 1982-1991): a deleted task with the subtasks
 * deleted with it, which come back or are erased together.
 */
export interface TrashEntry {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Identifier of the trash entry, which `Restore` and `Delete forever` act on.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property taskKey
   *
   * @description
   * Key of the deleted task (`CAD-452`).
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property taskName
   *
   * @description
   * Name of the deleted task.
   *
   * @type {string}
   * @readonly
   */
  readonly taskName: string;

  /**
   * Property status
   *
   * @description
   * Status the task had when it was deleted.
   *
   * @type {StatusKey}
   * @readonly
   */
  readonly status: StatusKey;

  /**
   * Property parentKey
   *
   * @description
   * Key of the parent the task had when it was deleted, or null for a top-level task.
   *
   * @type {string | null}
   * @readonly
   */
  readonly parentKey: string | null;

  /**
   * Property subtaskCount
   *
   * @description
   * Subtasks deleted with it, at every level.
   *
   * @type {number}
   * @readonly
   */
  readonly subtaskCount: number;

  /**
   * Property listName
   *
   * @description
   * Name of its list as it is now.
   *
   * @type {string}
   * @readonly
   */
  readonly listName: string;

  /**
   * Property listDeleted
   *
   * @description
   * Whether its list is deleted too (`Deleted list` replaces the name); restoring the entry
   * brings the list back.
   *
   * @type {boolean}
   * @readonly
   */
  readonly listDeleted: boolean;

  /**
   * Property trashedAt
   *
   * @description
   * When the task was deleted, as ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly trashedAt: string;

  /**
   * Property trashedBy
   *
   * @description
   * Who deleted it.
   *
   * @type {TrashActor}
   * @readonly
   */
  readonly trashedBy: TrashActor;

  /**
   * Property purgeAt
   *
   * @description
   * When the entry is erased for good, 30 days after `trashedAt`, as ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly purgeAt: string;
  // #endregion
}
