/**
 * Interface ArchivedListItem
 *
 * @description
 * An archived list or sprint of the `Lists` tab (`App.dc.html` line 5481), as the gateway reads it.
 */
export interface ArchivedListItem {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * List identifier, the one `unarchiveList` takes.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property name
   *
   * @description
   * List name (`Sprint 13`).
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property spaceId
   *
   * @description
   * Identifier of its space, which stays live; Spaces' space directory names it.
   *
   * @type {string}
   * @readonly
   */
  readonly spaceId: string;

  /**
   * Property sprint
   *
   * @description
   * Whether the list is a sprint, drawn with the lightning icon and restored as `Sprint restored`.
   *
   * @type {boolean}
   * @readonly
   */
  readonly sprint: boolean;

  /**
   * Property taskCount
   *
   * @description
   * Its top-level tasks, subtasks left out.
   *
   * @type {number}
   * @readonly
   */
  readonly taskCount: number;

  /**
   * Property archivedAt
   *
   * @description
   * When it was archived, as an ISO 8601 instant, or null when the gateway did not say.
   *
   * @type {string | null}
   * @readonly
   */
  readonly archivedAt: string | null;

  /**
   * Property archivedBy
   *
   * @description
   * Account id of the person who archived it, or null for another actor (an automation, a
   * service) or when the gateway did not say.
   *
   * @type {string | null}
   * @readonly
   */
  readonly archivedBy: string | null;

  /**
   * Property restorable
   *
   * @description
   * Whether the caller may restore it: `edit` on the list, or no role sent by the gateway (read
   * as `edit`, as Spaces does). The gateway still answers `403` when the role does not allow it.
   *
   * @type {boolean}
   * @readonly
   */
  readonly restorable: boolean;
  // #endregion
}
