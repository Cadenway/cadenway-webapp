import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { BoardViewStore } from './board-view.store';

/**
 * Constant BOARD_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `board` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; `ListTasksApi`, provided here so it reads the
 * workspace-scoped user; the flat reader `ListTasksStore`, whose tasks the board files into its
 * status columns; and the view's `BoardViewStore`. `spaces.routes.ts` only references this list.
 * The kanban's labels go in the page's own `providers`.
 *
 * @type {Provider[]}
 */
export const BOARD_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  ListTasksApi,
  ListTasksStore,
  BoardViewStore,
];
