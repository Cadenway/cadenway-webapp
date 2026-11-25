/**
 * Interface BulkSelection
 *
 * @description
 * A selected task, with the version the rows show so a stale selection is refused.
 */
export interface BulkSelection {
  // #region Properties
  /**
   * Property taskKey
   *
   * @description
   * Task key.
   *
   * @type {string}
   * @readonly
   */
  readonly taskKey: string;

  /**
   * Property version
   *
   * @description
   * Expected task version, or absent to skip the check.
   *
   * @type {number | undefined}
   * @readonly
   */
  readonly version?: number;
  // #endregion
}

/**
 * Type BulkAction
 *
 * @description
 * The actions of the selection bar: « Marquer terminé », « Assigner », « Déplacer vers… » and
 * « Supprimer » (to the trash).
 *
 * @type {{ readonly type: 'done' } | { readonly type: 'assign'; readonly userId: string } | { readonly type: 'move'; readonly listId: string } | { readonly type: 'trash' }}
 */
export type BulkAction =
  | { readonly type: 'done' }
  | { readonly type: 'assign'; readonly userId: string }
  | { readonly type: 'move'; readonly listId: string }
  | { readonly type: 'trash' };
