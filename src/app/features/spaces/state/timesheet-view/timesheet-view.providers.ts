import type { Provider } from '@angular/core';

import { TimesheetApi } from '../../data-access/services/timesheet-api/timesheet-api.service';
import { TimesheetViewStore } from './timesheet-view.store';

/**
 * Constant TIMESHEET_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `timesheet` route below `l/:listId`: the view's store and its data access
 * (`TimesheetApi`), so both die with the view. `spaces.routes.ts` only references this list; the
 * bricks' label providers are in the page's own `providers`.
 *
 * @type {Provider[]}
 */
export const TIMESHEET_VIEW_PROVIDERS: Provider[] = [TimesheetApi, TimesheetViewStore];
