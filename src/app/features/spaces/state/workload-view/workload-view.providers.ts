import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListTasksApi } from '../../data-access/services/list-tasks-api/list-tasks-api.service';
import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { WorkloadViewStore } from './workload-view.store';

/**
 * Constant WORKLOAD_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `workload` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; `ListTasksApi`, provided here so it reads the
 * workspace-scoped user (the root instance cannot see `WORKSPACE_CONTEXT`); the list's task
 * reader (`ListTasksStore`), whose tasks back the chips' menu and writes; and the view's store, which reads the workload.
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const WORKLOAD_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  ListTasksApi,
  ListTasksStore,
  WorkloadViewStore,
];
