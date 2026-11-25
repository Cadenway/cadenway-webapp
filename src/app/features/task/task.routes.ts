import type { Routes } from '@angular/router';

import { taskLinkResolver } from './http/resolvers/task-link/task-link.resolver';

/**
 * Constant TASK_ROUTES
 *
 * @description
 * The task screens below `/:org`. `t/:taskKey` is the shareable deep link of a task: its resolver
 * reads the task and redirects to its list with `?task=<KEY>` (the list opens the task there), or
 * renders the workspace's 404 at the same address when the task cannot be read. The route has no
 * component: it never renders, it only redirects. The task detail comes in step 5.
 *
 * @type {Routes}
 */
export const TASK_ROUTES: Routes = [
  {
    path: 't/:taskKey',
    resolve: { redirect: taskLinkResolver },
    children: [],
  },
];
