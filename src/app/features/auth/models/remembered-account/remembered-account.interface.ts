/**
 * Interface RememberedAccount
 *
 * @description
 * An account this browser signed in with, offered again on the signed-out screen. Only the name
 * and the address are kept; no secret is ever stored.
 */
export interface RememberedAccount {
  // #region Properties
  /**
   * Property name
   *
   * @description
   * Full name of the account.
   *
   * @type {string}
   * @readonly
   */
  readonly name: string;

  /**
   * Property email
   *
   * @description
   * Address of the account, compared without regard to case.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;
  // #endregion
}
