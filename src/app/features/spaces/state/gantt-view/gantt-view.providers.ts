import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { GanttViewStore } from './gantt-view.store';

/**
 * Constant GANTT_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `gantt` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; `ListTasksApi` (so it reads the workspace-scoped
 * user for `me`) and `ListTasksStore`, the flat reader of every task of the list with the view's
 * query; and `GanttViewStore`, the scale, period and folded groups. `spaces.routes.ts` only
 * references this list. Brick label providers go in the page's own `providers`.
 *
 * @type {Provider[]}
 */
export const GANTT_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  ListTasksApi,
  ListTasksStore,
  GanttViewStore,
];
