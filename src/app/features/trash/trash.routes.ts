import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';

/**
 * Constant TRASH_ROUTES
 *
 * @description
 * The trash below `/:org`, mounted by Workspace in the application shell; the sidebar footer and
 * Errors' `Open the trash` link to it. A failed primary read renders `RouteErrorBoundary` in place
 * of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const TRASH_ROUTES: Routes = [
  {
    path: 'trash',
    title: $localize`:@@trash.route.title:Trash`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/trash-page/trash-page.component')).TrashPage,
  },
];
