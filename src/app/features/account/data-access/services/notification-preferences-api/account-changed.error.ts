/**
 * Class AccountChangedError
 *
 * @description
 * The browser session no longer belongs to the account a preferences request was made for: the
 * person signed out, or another account signed in. Nothing was sent for the request.
 */
export class AccountChangedError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @param {unknown} cause - The failure of the identity check, when it failed.
   * @constructor
   */
  public constructor(cause?: unknown) {
    super('The signed-in account changed.', { cause });
    this.name = 'AccountChangedError';
  }
  // #endregion
}
