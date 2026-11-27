/**
 * Interface WorkspaceRefreshPort
 *
 * @description
 * Lets a feature that changed the current organization (its name, for one) ask the workspace to
 * verify it again, so `WORKSPACE_CONTEXT` and the shells show the change.
 */
export interface WorkspaceRefreshPort {
  // #region Methods
  /**
   * Method refresh
   *
   * @description
   * Reruns the `/:org` guards and resolver on the current address, as a workspace recovery does:
   * the person and the organization are read again and committed, and a transient failure keeps
   * the workspace as it is. While another navigation is under way it starts none and asks the next
   * navigation to verify the workspace instead, so it never cancels the person's navigation.
   *
   * @returns {Promise<void>} Resolves once the verification ended, or at once when it is left to
   * the next navigation; never rejects.
   */
  refresh(): Promise<void>;
  // #endregion
}
