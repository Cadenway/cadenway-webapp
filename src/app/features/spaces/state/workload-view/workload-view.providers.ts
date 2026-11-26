import type { Provider } from '@angular/core';

import { TaskStatusChangesStore } from '@features/task';

import { ListTasksStore } from '../list-tasks/list-tasks.store';
import { WorkloadViewStore } from './workload-view.store';

/**
 * Constant WORKLOAD_VIEW_PROVIDERS
 *
 * @description
 * The providers of the `workload` route below `l/:listId`: Task's `TaskStatusChangesStore`, so
 * pending status changes die with the view; the list's task reader (`ListTasksStore`), whose
 * tasks back the chips' menu and writes; and the view's store, which reads the workload.
 * `spaces.routes.ts` only references this list. Brick label providers go in the page's own
 * `providers`.
 *
 * @type {Provider[]}
 */
export const WORKLOAD_VIEW_PROVIDERS: Provider[] = [
  TaskStatusChangesStore,
  ListTasksStore,
  WorkloadViewStore,
];
