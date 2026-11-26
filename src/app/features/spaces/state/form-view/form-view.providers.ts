import type { Provider } from '@angular/core';

import { FormViewStore } from './form-view.store';

/**
 * Constant FORM_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `form` route below `l/:listId`: the view's store. The
 * view's package adds what its route subtree shares here (stores, data-access services);
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const FORM_VIEW_PROVIDERS: Provider[] = [FormViewStore];
