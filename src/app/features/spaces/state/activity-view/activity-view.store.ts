import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createActivityViewStore
 *
 * @description
 * Creates the `Activity` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createActivityViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant ActivityViewStore
 *
 * @description
 * The state of the `Activity` view (`l/:listId/activity`), route-scoped through
 * `ACTIVITY_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createActivityViewStore>}
 */
export const ActivityViewStore: ReturnType<typeof createActivityViewStore> =
  createActivityViewStore();
