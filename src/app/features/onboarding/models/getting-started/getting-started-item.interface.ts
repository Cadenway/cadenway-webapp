/**
 * Type GettingStartedItemKey
 *
 * @description
 * An item of the `Getting started` checklist (`App.dc.html` lines 5304-5306), one per marker the
 * contract records: `task` (`Create your first task`, `firstTaskCreated`), `invite` (`Invite a
 * team member`, `invitationSent`) and `board` (`Try the Board view`, `boardTried`). The mockup's
 * reminder and mobile items have no marker (gaps G2 and G3) and are not shipped.
 *
 * @type {'task' | 'invite' | 'board'}
 */
export type GettingStartedItemKey = 'task' | 'invite' | 'board';

/**
 * Interface GettingStartedItem
 *
 * @description
 * One item of the checklist as the panel draws it.
 */
export interface GettingStartedItem {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * Which item it is; the panel names it.
   *
   * @type {GettingStartedItemKey}
   * @readonly
   */
  readonly key: GettingStartedItemKey;

  /**
   * Property done
   *
   * @description
   * Whether the gateway recorded its marker.
   *
   * @type {boolean}
   * @readonly
   */
  readonly done: boolean;
  // #endregion
}
