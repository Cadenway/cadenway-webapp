import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { taskLinkResolver } from './http/resolvers/task-link/task-link.resolver';

/**
 * Constant TASK_ROUTES
 *
 * @description
 * The task screens below `/:org`. `t/:taskKey` is the shareable deep link of a task: its resolver
 * reads the task and redirects to its list with `?task=<KEY>` (the list opens the task there). A
 * task it cannot read renders, at the task's address, the error boundary's not-found, deleted-task
 * or unavailable state through `TaskLinkPage`; the resolver runs again on every navigation to the
 * address, so `Retry` and `Restore the task` read the task again. The task detail comes in step 5.
 *
 * @type {Routes}
 */
export const TASK_ROUTES: Routes = [
  {
    path: 't/:taskKey',
    runGuardsAndResolvers: 'always',
    resolve: { failure: taskLinkResolver },
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/task-link-page/task-link-page.component')).TaskLinkPage,
  },
];
