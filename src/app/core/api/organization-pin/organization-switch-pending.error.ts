/**
 * Class OrganizationSwitchPendingError
 *
 * @description
 * A pinned request was blocked locally while the session organization was changing.
 */
export class OrganizationSwitchPendingError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Identifies a local workspace switch fence rejection.
   *
   * @constructor
   */
  public constructor() {
    super('The workspace organization is changing.');
  }
  // #endregion
}
