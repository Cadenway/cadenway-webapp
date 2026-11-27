import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { RouteErrorBoundary } from '@features/errors';

/**
 * Constant ARCHIVES_ROUTES
 *
 * @description
 * The archives below `/:org`, mounted by Workspace in the application shell; the sidebar footer
 * links to it. `?tab=tasks` selects its second tab (the default is `lists`). A failed primary read
 * renders `RouteErrorBoundary` in place of the page, so the shell stays.
 *
 * @type {Routes}
 */
export const ARCHIVES_ROUTES: Routes = [
  {
    path: 'archives',
    title: $localize`:@@archives.route.title:Archives`,
    errorComponent: RouteErrorBoundary,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/archives-page/archives-page.component')).ArchivesPage,
  },
];
