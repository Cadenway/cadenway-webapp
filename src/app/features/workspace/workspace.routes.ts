import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import { providePresence, withUserMenu } from '@features/account/providers';
import { withHomeRailItem } from '@features/home/providers';
import { withInbox } from '@features/inbox/providers';
import {
  provideOrganizationUsage,
  withPlanSummary,
  withStorageBanner,
} from '@features/organization/providers';
import {
  withCommandPalette,
  withSearchButton,
  withSearchRailItem,
} from '@features/search/providers';
import {
  provideSpacesNavigation,
  withSidebarFooterLinks,
  withSpacesRailItem,
  withSpacesSidebar,
  withSprintProgress,
} from '@features/spaces/providers';
import { withTaskCreate, withTaskDetail } from '@features/task/providers';
import type { AppShell } from '@layouts/app-shell';
import { provideAppShellSlots } from '@layouts/app-shell/providers';

import { organizationGuard } from './http/guards/organization/organization.guard';
import { sessionGuard } from './http/guards/session/session.guard';
import { slugRedirectGuard } from './http/guards/slug-redirect/slug-redirect.guard';
import { workspaceResolver } from './http/resolvers/workspace/workspace.resolver';
import {
  withOrganizationRow,
  withOrganizationSwitcher,
} from './providers/organization-switcher/organization-switcher.provider';
import {
  withShortcutsButton,
  withShortcutsDialog,
  withThemeRailItem,
} from './providers/shell/shell.provider';
import { provideWorkspaceContext } from './providers/workspace-context/workspace-context.provider';
import {
  provideWorkspaceRuntime,
  shouldRevalidateWorkspace,
} from './providers/workspace-runtime/workspace-runtime.provider';

/**
 * Constant WORKSPACE_ROUTES
 *
 * @description
 * The organization-scoped workspace. The slug-less addresses of backend e-mails redirect to the
 * session's current organization first. Then `/:org` verifies the session and the slug (switching
 * the session to another organization of the caller when needed), commits the workspace context,
 * and mounts the application shell with its slot contributions; the screens of the other features
 * mount below it, and an unknown address below a slug renders the 404 inside the shell.
 *
 * @type {Routes}
 */
export const WORKSPACE_ROUTES: Routes = [
  { path: 'home', canActivate: [slugRedirectGuard([])], children: [] },
  { path: 'account', canActivate: [slugRedirectGuard(['account', 'profile'])], children: [] },
  {
    path: 'account/:section',
    canActivate: [slugRedirectGuard(['account', ':section'])],
    children: [],
  },
  {
    path: 'org/:section',
    canActivate: [slugRedirectGuard(['organization', ':section'])],
    children: [],
  },
  {
    path: ':org',
    canActivate: [sessionGuard, organizationGuard],
    resolve: { workspaceContext: workspaceResolver },
    runGuardsAndResolvers: shouldRevalidateWorkspace,
    providers: [
      provideCadenwayIcons(),
      provideWorkspaceContext(),
      ...provideWorkspaceRuntime(),
      providePresence(),
      provideOrganizationUsage(),
      provideSpacesNavigation(),
      provideAppShellSlots({
        banners: [withStorageBanner()],
        organizationSwitcher: [withOrganizationSwitcher()],
        railNavigation: [withHomeRailItem(), withInbox(), withSpacesRailItem()],
        railFooter: [withSearchRailItem(), withThemeRailItem(), withUserMenu()],
        sidebarHeader: [withOrganizationRow(), withSearchButton()],
        sidebar: [withSpacesSidebar()],
        sidebarFooter: [
          withSprintProgress(),
          withPlanSummary(),
          withSidebarFooterLinks(),
          withShortcutsButton(),
        ],
        overlays: [withCommandPalette(), withShortcutsDialog(), withTaskCreate(), withTaskDetail()],
      }),
    ],
    loadComponent: async (): Promise<Type<AppShell>> =>
      (await import('@layouts/app-shell')).AppShell,
    children: [
      {
        path: '',
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/home/home.routes')).HOME_ROUTES,
      },
      {
        path: '',
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/spaces/spaces.routes')).SPACES_ROUTES,
      },
      {
        path: '',
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/task/task.routes')).TASK_ROUTES,
      },
      {
        path: '**',
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/errors/errors.routes')).ERRORS_ROUTES,
      },
    ],
  },
];
