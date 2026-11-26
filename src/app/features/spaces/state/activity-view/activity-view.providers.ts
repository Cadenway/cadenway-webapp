import type { Provider } from '@angular/core';

import { ActivityViewStore } from './activity-view.store';

/**
 * Constant ACTIVITY_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `activity` route below `l/:listId`: the view's store. The
 * view's package adds what its route subtree shares here (stores, data-access services);
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const ACTIVITY_VIEW_PROVIDERS: Provider[] = [ActivityViewStore];
