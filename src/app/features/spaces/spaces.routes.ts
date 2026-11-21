import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

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
    providers: provideCadenwayIcons(),
    pathMatch: 'full',
    canActivate: [requireOrganization],
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'spaces' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
  {
    path: ':spaceId/listes',
    providers: provideCadenwayIcons(),
    pathMatch: 'full',
    canActivate: [requireOrganization],
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'lists' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
  {
    path: ':spaceId/listes/:listId',
    providers: provideCadenwayIcons(),
    resolve: { organizationId: resolveOrganizationId },
    runGuardsAndResolvers: 'always',
    data: { pageKind: 'tasks' },
    loadComponent: () =>
      import('./ui/pages/spaces-page/spaces-page.component').then((page) => page.SpacesPage),
  },
];
