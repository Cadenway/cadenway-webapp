import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListActivityApi } from '../../data-access/services/list-activity-api/list-activity-api.service';
import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { ActivityViewStore } from './activity-view.store';

/**
 * Constant ACTIVITY_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `activity` route below `l/:listId`: the view's store and the reads of the
 * activity log it uses, and, for the task menu of the chips, the flat reader of the list's tasks
 * (`ListTasksStore`, with `ListTasksApi`) and Task's `TaskStatusChangesStore`, which its writes
 * compose. `spaces.routes.ts` only references this list. Brick label providers go in the page's
 * own `providers`.
 *
 * @type {Provider[]}
 */
export const ACTIVITY_VIEW_PROVIDERS: Provider[] = [
  ListActivityApi,
  ActivityViewStore,
  TaskStatusChangesStore,
  ListTasksApi,
  ListTasksStore,
];
