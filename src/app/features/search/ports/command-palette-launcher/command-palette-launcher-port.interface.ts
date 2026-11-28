/**
 * Interface CommandPaletteLauncherPort
 *
 * @description
 * Lets another feature open the command palette of the enclosing shell, as the rail's `Search`
 * item does (the 404's `Search`).
 */
export interface CommandPaletteLauncherPort {
  // #region Methods
  /**
   * Method open
   *
   * @description
   * Opens the command palette, unless another shell overlay is open; an open palette stays open.
   */
  open(): void;
  // #endregion
}
