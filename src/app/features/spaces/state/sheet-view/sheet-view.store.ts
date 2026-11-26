import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createSheetViewStore
 *
 * @description
 * Creates the `Sheet` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createSheetViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant SheetViewStore
 *
 * @description
 * The state of the `Sheet` view (`l/:listId/sheet`), route-scoped through
 * `SHEET_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createSheetViewStore>}
 */
export const SheetViewStore: ReturnType<typeof createSheetViewStore> = createSheetViewStore();
