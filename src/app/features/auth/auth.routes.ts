import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { resolveWorkspaceAccess } from './http/resolvers/workspace-access.resolver';

/**
 * Constant AUTH_ROUTES
 *
 * @description
 * Entry screens for password sign-in, organization choice and the verified workspace.
 *
 * @type {Routes}
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'connexion',
    title: 'Connexion — Cadenway',
    loadComponent: () =>
      import('./ui/pages/sign-in-page/sign-in-page.component').then(
        (entry: { SignInPage: Type<unknown> }) => entry.SignInPage,
      ),
  },
  {
    path: 'organisations',
    title: 'Organisations — Cadenway',
    loadComponent: () =>
      import('./ui/pages/organization-choice-page/organization-choice-page.component').then(
        (entry: { OrganizationChoicePage: Type<unknown> }) => entry.OrganizationChoicePage,
      ),
  },
  {
    path: 'accueil',
    title: 'Accueil — Cadenway',
    resolve: { workspace: resolveWorkspaceAccess },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./ui/pages/workspace-entry-page/workspace-entry-page.component').then(
        (entry: { WorkspaceEntryPage: Type<unknown> }) => entry.WorkspaceEntryPage,
      ),
  },
];
