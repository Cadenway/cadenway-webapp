import type { StatusKey } from '@cadenway/contracts';

/**
 * Interface ArchivedTaskItem
 *
 * @description
 * The root of an archived subtree of the `Tasks` tab (`App.dc.html` line 5494), as the gateway
 * reads it.
 */
export interface ArchivedTaskItem {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Task key (`CAD-430`), the one `unarchiveTask` takes.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property name
   *
   * @description
   * Task name.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property status
   *
   * @description
   * Its status, shown by the task detail while it is read after `Open`.
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

  /**
   * Property listId
   *
   * @description
   * Identifier of its list; restoring the task restores that list too when it is archived.
   *
   * @type {string}
   * @readonly
   */
  readonly listId: string;

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
   * Property listArchived
   *
   * @description
   * Whether its list is archived too, which the row says (`Archived list`) instead of its name.
   *
   * @type {boolean}
   * @readonly
   */
  readonly listArchived: boolean;

  /**
   * Property archivedAt
   *
   * @description
   * When it was archived, as an ISO 8601 instant.
   *
   * @type {string}
   * @readonly
   */
  readonly archivedAt: string;

  /**
   * Property archivedBy
   *
   * @description
   * Account id of the person who archived it, or null for another actor (an automation, a
   * service).
   *
   * @type {string | null}
   * @readonly
   */
  readonly archivedBy: string | null;
  // #endregion
}
