import type { Routes } from '@angular/router';

import { requireOrganization, resolveOrganizationId } from '@features/auth';

/**
 * Constant SPACES_ROUTES
 *
 * @description
 * The authenticated Spaces entry and its deep links to lists and tasks.
 *
 * @type {Routes}
 */
export const SPACES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [requireOrganization],
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'spaces' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
  {
    path: ':spaceId/listes',
    pathMatch: 'full',
    canActivate: [requireOrganization],
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'lists' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
  {
    path: ':spaceId/listes/:listId',
    resolve: { organizationId: resolveOrganizationId },
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'tasks' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
];
