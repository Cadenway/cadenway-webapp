import type { ActivatedRouteSnapshot, CanDeactivateFn, RouterStateSnapshot } from '@angular/router';

import type { UnsavedChanges } from '../models/unsaved-changes.interface';

/**
 * Function unsavedChangesGuard
 *
 * @description
 * The `canDeactivate` guard of a settings page: it lets the navigation go while the page has no
 * unsaved changes, and otherwise waits for the page's `confirmDiscard()`, so `Keep editing`
 * cancels the navigation and `Discard` lets it go. A route without a component lets it go, and
 * so does one whose outlet shows the error component of a failed read, which holds no edits. A
 * navigation to the URL already shown lets it go without asking: it reruns the route (a workspace
 * recovery with `onSameUrlNavigation: 'reload'`, a `Retry`) and the router reuses the page, so its
 * edits are not lost and asking would offer a `Discard` that discards nothing.
 *
 * @param {UnsavedChanges | null} page - The routed page being left.
 * @param {ActivatedRouteSnapshot} _route - The route being left.
 * @param {RouterStateSnapshot} current - The router state shown now.
 * @param {RouterStateSnapshot} next - The router state the navigation goes to.
 * @returns {boolean | Promise<boolean>} Whether the navigation may leave the page.
 */
export const unsavedChangesGuard: CanDeactivateFn<UnsavedChanges> = (
  page: UnsavedChanges | null,
  _route: ActivatedRouteSnapshot,
  current: RouterStateSnapshot,
  next: RouterStateSnapshot,
): boolean | Promise<boolean> => {
  // The outlet holds the route's error component instead of the page after a failed read.
  if (typeof page?.hasUnsavedChanges !== 'function' || !page.hasUnsavedChanges()) return true;
  if (next.url === current.url) return true;
  return page.confirmDiscard();
};
