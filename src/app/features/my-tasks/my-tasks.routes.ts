import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';

/**
 * Constant MY_TASKS_ROUTES
 *
 * @description
 * The `My tasks` screen below `/:org`, mounted by Workspace in the application shell. `?tab=closed`
 * selects its second tab (the default is `open`). A failed primary read renders
 * `RouteErrorBoundary` in place of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const MY_TASKS_ROUTES: Routes = [
  {
    path: 'my-tasks',
    title: $localize`:@@my-tasks.route.title:My tasks`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/my-tasks-page/my-tasks-page.component')).MyTasksPage,
  },
];
