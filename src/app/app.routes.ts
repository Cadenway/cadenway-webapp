import type { Routes } from '@angular/router';

/**
 * Constant APP_ROUTES
 *
 * @description
 * Route table containing prefixes, redirects and lazy feature entries.
 *
 * @type {Routes}
 */
export const APP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'connexion',
    pathMatch: 'full',
  },
  {
    path: '',
    loadChildren: () =>
      import('@features/auth/auth.routes').then(
        (entry: { AUTH_ROUTES: Routes }) => entry.AUTH_ROUTES,
      ),
  },
  {
    path: 'espaces',
    loadChildren: () =>
      import('@features/spaces/spaces.routes').then(
        (entry: { SPACES_ROUTES: Routes }) => entry.SPACES_ROUTES,
      ),
  },
  {
    path: 'taches',
    loadChildren: () =>
      import('@features/task/task.routes').then(
        (entry: { TASK_ROUTES: Routes }) => entry.TASK_ROUTES,
      ),
  },
  {
    path: '**',
    loadChildren: () =>
      import('@features/errors/errors.routes').then(
        (entry: { ERRORS_ROUTES: Routes }) => entry.ERRORS_ROUTES,
      ),
  },
];
