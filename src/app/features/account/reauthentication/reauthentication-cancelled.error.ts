/**
 * Class ReauthenticationCancelledError
 *
 * @description
 * What `ReauthenticationService.run()` rejects with when the person closes the reauthentication
 * dialog instead of confirming: the operation was not repeated, and the caller shows nothing
 * more (no failure toast).
 */
export class ReauthenticationCancelledError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Names the error.
   *
   * @constructor
   */
  public constructor() {
    super('The person cancelled the reauthentication.');
    this.name = 'ReauthenticationCancelledError';
  }
  // #endregion
}
