import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';
import { TASK_ROW_ACTIONS_PROVIDERS } from '@features/task';

/**
 * Constant DASHBOARDS_ROUTES
 *
 * @description
 * The team dashboard below `/:org`, mounted by Workspace in the application shell. `?weeks=12`
 * selects the longer period (the default is 8 weeks). A failed primary read renders
 * `RouteErrorBoundary` in place of the page, so the shell stays. The route provides Task's
 * `TASK_ROW_ACTIONS_PROVIDERS` for the menu of the late tasks, so its pending writes, holds and
 * toasts die with the page.
 *
 * @type {Routes}
 */
export const DASHBOARDS_ROUTES: Routes = [
  {
    path: 'dashboards',
    title: $localize`:@@dashboards.route.title:Dashboards`,
    errorComponent: RouteErrorBoundary,
    providers: TASK_ROW_ACTIONS_PROVIDERS,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/dashboard-page/dashboard-page.component')).DashboardPage,
  },
];
