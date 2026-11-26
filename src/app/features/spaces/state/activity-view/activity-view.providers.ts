import type { Provider } from '@angular/core';

import { ListActivityApi } from '../../data-access/services/list-activity-api/list-activity-api.service';
import { ActivityViewStore } from './activity-view.store';

/**
 * Constant ACTIVITY_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `activity` route below `l/:listId`: the view's store and the reads of the
 * activity log it uses. `spaces.routes.ts` only references this list. Brick label providers go in
 * the page's own `providers`.
 *
 * @type {Provider[]}
 */
export const ACTIVITY_VIEW_PROVIDERS: Provider[] = [ListActivityApi, ActivityViewStore];
