import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createCalendarViewStore
 *
 * @description
 * Creates the `Calendar` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createCalendarViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant CalendarViewStore
 *
 * @description
 * The state of the `Calendar` view (`l/:listId/calendar`), route-scoped through
 * `CALENDAR_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createCalendarViewStore>}
 */
export const CalendarViewStore: ReturnType<typeof createCalendarViewStore> =
  createCalendarViewStore();
