import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';
import { TASK_ROW_ACTIONS_PROVIDERS } from '@features/task';

/**
 * Constant MY_TASKS_ROUTES
 *
 * @description
 * The `My tasks` screen below `/:org`, mounted by Workspace in the application shell. `?tab=closed`
 * selects its second tab (the default is `open`). The route provides Task's
 * `TASK_ROW_ACTIONS_PROVIDERS`, so the task menu's writes, their pending values and their toasts
 * live and die with the screen. A failed primary read renders `RouteErrorBoundary` in place of the
 * page, so the shell stays.
 *
 * @type {Routes}
 */
export const MY_TASKS_ROUTES: Routes = [
  {
    path: 'my-tasks',
    title: $localize`:@@my-tasks.route.title:My tasks`,
    errorComponent: RouteErrorBoundary,
    providers: [TASK_ROW_ACTIONS_PROVIDERS],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/my-tasks-page/my-tasks-page.component')).MyTasksPage,
  },
];
