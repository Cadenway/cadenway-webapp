import type { CanDeactivateFn } from '@angular/router';

import type { UnsavedChanges } from '../models/unsaved-changes.interface';

/**
 * Function unsavedChangesGuard
 *
 * @description
 * The `canDeactivate` guard of a settings page: it lets the navigation go while the page has no
 * unsaved changes, and otherwise waits for the page's `confirmDiscard()`, so `Keep editing`
 * cancels the navigation and `Discard` lets it go. A route without a component lets it go.
 *
 * @param {UnsavedChanges | null} page - The routed page being left.
 * @returns {boolean | Promise<boolean>} Whether the navigation may leave the page.
 */
export const unsavedChangesGuard: CanDeactivateFn<UnsavedChanges> = (
  page: UnsavedChanges | null,
): boolean | Promise<boolean> => {
  if (!page?.hasUnsavedChanges()) return true;
  return page.confirmDiscard();
};
