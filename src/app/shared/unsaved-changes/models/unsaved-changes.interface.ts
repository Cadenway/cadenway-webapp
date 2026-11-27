/**
 * Interface UnsavedChanges
 *
 * @description
 * What a routed settings page implements so `unsavedChangesGuard` can keep its edits: whether a
 * form holds changes that are not saved, and a confirmation the page shows before they are lost.
 */
export interface UnsavedChanges {
  // #region Methods
  /**
   * Method hasUnsavedChanges
   *
   * @description
   * Whether leaving now would lose edits the person made and did not save.
   *
   * @returns {boolean} True while a form of the page is dirty.
   */
  hasUnsavedChanges(): boolean;

  /**
   * Method confirmDiscard
   *
   * @description
   * Asks the person whether to discard the edits, through the page's own confirmation dialog.
   *
   * @returns {Promise<boolean>} Resolves true to leave and discard, false to keep editing.
   */
  confirmDiscard(): Promise<boolean>;
  // #endregion
}
