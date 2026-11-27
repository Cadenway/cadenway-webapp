/**
 * Class OnboardingWriteDroppedError
 *
 * @description
 * An onboarding write the store dropped for the organization it was meant for: the workspace
 * changed organization before it was sent or before its answer arrived, the organization pin
 * blocked it while the session was switching (`OrganizationSwitchPendingError`), or the gateway
 * refused it for another session organization (`412 organization.context-changed`). The write is
 * neither retried nor rolled back in the next organization, and is not the person's failure: show
 * no failure toast for it. `cause` holds the original failure, when there was one.
 */
export class OnboardingWriteDroppedError extends Error {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Identifies a dropped onboarding write.
   *
   * @param {unknown} [cause] - The original failure, if any.
   * @constructor
   */
  public constructor(cause?: unknown) {
    super('The onboarding write was dropped for a changed organization.', { cause });
    this.name = 'OnboardingWriteDroppedError';
  }
  // #endregion
}
