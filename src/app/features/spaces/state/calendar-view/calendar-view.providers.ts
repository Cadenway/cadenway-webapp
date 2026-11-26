import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { CalendarViewStore } from './calendar-view.store';

/**
 * Constant CALENDAR_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `calendar` route below `l/:listId`: the view's store and Task's
 * `TaskStatusChangesStore`, so pending status changes die with the view. The
 * view's package adds what its route subtree shares here (stores, data-access services);
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const CALENDAR_VIEW_PROVIDERS: Provider[] = [TaskStatusChangesStore, CalendarViewStore];
