/**
 * Type AccountSectionPath
 *
 * @description
 * Path segment of an account settings section below `/<slug>/account`.
 *
 * @type {'profile' | 'security' | 'notifications' | 'preferences' | 'api-tokens'}
 */
export type AccountSectionPath =
  'profile' | 'security' | 'notifications' | 'preferences' | 'api-tokens';

/**
 * Interface AccountSection
 *
 * @description
 * An item of the account settings navigation (mockup `Compte.dc.html` lines 1455-1461).
 */
export interface AccountSection {
  // #region Properties
  /**
   * Property path
   *
   * @description
   * Segment below `/<slug>/account`.
   *
   * @type {AccountSectionPath}
   * @readonly
   */
  readonly path: AccountSectionPath;

  /**
   * Property label
   *
   * @description
   * Localized label of the item.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property icon
   *
   * @description
   * Phosphor icon of the item, Bold weight.
   *
   * @type {string}
   * @readonly
   */
  readonly icon: string;

  /**
   * Property activeIcon
   *
   * @description
   * Phosphor icon of the current item, Fill weight.
   *
   * @type {string}
   * @readonly
   */
  readonly activeIcon: string;
  // #endregion
}
