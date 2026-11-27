import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';

/**
 * Constant GOALS_ROUTES
 *
 * @description
 * The goals of the current quarter below `/:org`, mounted by Workspace in the application shell.
 * A failed primary read renders `RouteErrorBoundary` in place of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const GOALS_ROUTES: Routes = [
  {
    path: 'goals',
    title: $localize`:@@goals.route.title:Goals`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/goals-page/goals-page.component')).GoalsPage,
  },
];
