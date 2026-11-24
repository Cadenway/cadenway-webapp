import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import { requireOrganization } from '@features/auth';

/**
 * Constant ERRORS_ROUTES
 *
 * @description
 * Protects the application fallback with the same access check as other workspace routes.
 *
 * @type {Routes}
 */
export const ERRORS_ROUTES: Routes = [
  {
    path: '',
    providers: provideCadenwayIcons(),
    canActivate: [requireOrganization],
    runGuardsAndResolvers: 'always',
    title: 'Page introuvable',
    loadComponent: () =>
      import('./ui/pages/not-found-page/not-found-page.component').then(
        (entry) => entry.NotFoundPage,
      ),
  },
];
