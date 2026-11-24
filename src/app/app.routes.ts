import type { Routes } from '@angular/router';

/**
 * Constant APP_ROUTES
 *
 * @description
 * Route table containing prefixes, redirects and lazy feature entries. Auth's fixed public
 * addresses come first, then the workspace (its slug-less e-mail links and `/:org`), then the 404.
 *
 * @type {Routes}
 */
export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: '',
    loadChildren: () =>
      import('@features/auth/auth.routes').then(
        (entry: { AUTH_ROUTES: Routes }) => entry.AUTH_ROUTES,
      ),
  },
  {
    path: '',
    loadChildren: () =>
      import('@features/workspace/workspace.routes').then(
        (entry: { WORKSPACE_ROUTES: Routes }) => entry.WORKSPACE_ROUTES,
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
