/**
 * Type FavoriteKind
 *
 * @description
 * What a favorite points to.
 *
 * @type {'space' | 'list' | 'saved-view'}
 */
export type FavoriteKind = 'space' | 'list' | 'saved-view';

/**
 * Interface Favorite
 *
 * @description
 * A private favorite of the caller in the current organization.
 */
export interface Favorite {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Favorite identifier, used to remove it.
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property kind
   *
   * @description
   * Target kind.
   *
   * @type {FavoriteKind}
   * @readonly
   */
  readonly kind: FavoriteKind;

  /**
   * Property targetId
   *
   * @description
   * Space, list or saved view identifier.
   *
   * @type {string}
   * @readonly
   */
  readonly targetId: string;

  /**
   * Property name
   *
   * @description
   * Current name of the target.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property listId
   *
   * @description
   * List of a saved view, or null for another kind.
   *
   * @type {string | null}
   * @readonly
   */
  readonly listId: string | null;
  // #endregion
}
