import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createGanttViewStore
 *
 * @description
 * Creates the `Gantt` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createGanttViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant GanttViewStore
 *
 * @description
 * The state of the `Gantt` view (`l/:listId/gantt`), route-scoped through
 * `GANTT_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createGanttViewStore>}
 */
export const GanttViewStore: ReturnType<typeof createGanttViewStore> = createGanttViewStore();
