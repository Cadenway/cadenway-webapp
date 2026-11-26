import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { BoardViewStore } from './board-view.store';

/**
 * Constant BOARD_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `board` route below `l/:listId`: the view's store and Task's
 * `TaskStatusChangesStore`, so pending status changes die with the view. The
 * view's package adds what its route subtree shares here (stores, data-access services);
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const BOARD_VIEW_PROVIDERS: Provider[] = [TaskStatusChangesStore, BoardViewStore];
