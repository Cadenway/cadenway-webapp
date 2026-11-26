import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createBoardViewStore
 *
 * @description
 * Creates the `Board` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createBoardViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant BoardViewStore
 *
 * @description
 * The state of the `Board` view (`l/:listId/board`), route-scoped through
 * `BOARD_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createBoardViewStore>}
 */
export const BoardViewStore: ReturnType<typeof createBoardViewStore> = createBoardViewStore();
