import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import { resolveWorkspaceAccess } from './http/resolvers/workspace-access.resolver';

/**
 * Constant AUTH_ROUTES
 *
 * @description
 * Entry screens for sign-in, provider continuation, organization choice and the verified workspace.
 *
 * @type {Routes}
 */
export const AUTH_ROUTES: Routes = [
  {
    path: 'connexion',
    providers: provideCadenwayIcons(),
    title: 'Connexion',
    data: { federatedContinuation: false },
    loadComponent: () =>
      import('./ui/pages/sign-in-page/sign-in-page.component').then(
        (entry: { SignInPage: Type<unknown> }) => entry.SignInPage,
      ),
  },
  {
    path: 'auth/federated/continue',
    providers: provideCadenwayIcons(),
    title: 'Connexion SSO',
    data: { federatedContinuation: true },
    loadComponent: () =>
      import('./ui/pages/sign-in-page/sign-in-page.component').then(
        (entry: { SignInPage: Type<unknown> }) => entry.SignInPage,
      ),
  },
  {
    path: 'organisations',
    providers: provideCadenwayIcons(),
    title: 'Organisations',
    loadComponent: () =>
      import('./ui/pages/organization-choice-page/organization-choice-page.component').then(
        (entry: { OrganizationChoicePage: Type<unknown> }) => entry.OrganizationChoicePage,
      ),
  },
  {
    path: 'accueil',
    providers: provideCadenwayIcons(),
    title: 'Accueil',
    resolve: { workspace: resolveWorkspaceAccess },
    runGuardsAndResolvers: 'always',
    loadComponent: () =>
      import('./ui/pages/workspace-entry-page/workspace-entry-page.component').then(
        (entry: { WorkspaceEntryPage: Type<unknown> }) => entry.WorkspaceEntryPage,
      ),
  },
];
