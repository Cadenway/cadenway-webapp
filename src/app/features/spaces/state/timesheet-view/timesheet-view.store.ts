import type { Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';

/**
 * Function createTimesheetViewStore
 *
 * @description
 * Creates the `Timesheet` view's store, empty until the view's package fills it.
 *
 * @returns {Type<object>} Injectable store constructor.
 */
function createTimesheetViewStore(): Type<object> {
  return signalStore(withState({}));
}

/**
 * Constant TimesheetViewStore
 *
 * @description
 * The state of the `Timesheet` view (`l/:listId/timesheet`), route-scoped through
 * `TIMESHEET_VIEW_PROVIDERS`. A stub: the view's package owns this file and replaces it.
 *
 * @type {ReturnType<typeof createTimesheetViewStore>}
 */
export const TimesheetViewStore: ReturnType<typeof createTimesheetViewStore> =
  createTimesheetViewStore();
