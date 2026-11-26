import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createFormViewStore
 *
 * @description
 * Creates the `Form` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createFormViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant FormViewStore
 *
 * @description
 * The state of the `Form` view (`l/:listId/form`), route-scoped through
 * `FORM_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createFormViewStore>}
 */
export const FormViewStore: ReturnType<typeof createFormViewStore> = createFormViewStore();
