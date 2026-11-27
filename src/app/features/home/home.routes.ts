import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { TASK_ROW_ACTIONS_PROVIDERS } from '@features/task';

/**
 * Constant HOME_ROUTES
 *
 * @description
 * The home screen, mounted at the root of a workspace (`/:org`). The route provides Task's
 * `TASK_ROW_ACTIONS_PROVIDERS`, so the task menu's writes, their pending values and their toasts
 * live and die with the screen. A failed primary read renders the router's default error
 * component (`RouteErrorBoundary`) in place of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: $localize`:@@home.route.title:Home`,
    providers: [TASK_ROW_ACTIONS_PROVIDERS],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/home-page/home-page.component')).HomePage,
  },
];
