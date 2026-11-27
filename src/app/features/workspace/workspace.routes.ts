import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';

import {
  providePresence,
  provideReauthentication,
  withAccountSettingsLink,
  withAccountSettingsNavigation,
  withReauthenticationDialog,
  withUserMenu,
} from '@features/account/providers';
import type { RouteErrorData } from '@features/errors';
import { withHomeRailItem } from '@features/home/providers';
import { withInbox } from '@features/inbox/providers';
import {
  provideOrganizationUsage,
  withOrganizationSettingsLinks,
  withOrganizationSettingsNavigation,
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
import type { SettingsShell, SettingsShellRouteData } from '@layouts/settings-shell';
import { provideSettingsShellSlots } from '@layouts/settings-shell/providers';

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
import { withBackToApp, withOrganizationHomeItem } from './providers/settings/settings.provider';
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
 * the session to another organization of the caller when needed), commits the workspace context
 * and provides the workspace-wide services; it renders no component itself. Below it, `account`
 * and `organization` mount the settings shell with their slot contributions and the Account and
 * Organization sections, and the `''` child mounts the application shell with its slot
 * contributions and the screens of the other features. An unknown address below a slug renders
 * the 404 inside the application shell, an unknown settings section inside the settings shell.
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
    ],
    children: [
      {
        path: 'account',
        data: {
          settingsNavigationLabel: $localize`:@@workspace.settings.account-navigation:Settings`,
          unavailableTitle: $localize`:@@workspace.settings.load-failed:Could not load this section`,
        } satisfies SettingsShellRouteData & RouteErrorData,
        providers: [
          provideReauthentication(),
          provideSettingsShellSlots({
            railNavigation: [
              withOrganizationHomeItem(),
              withHomeRailItem(),
              withInbox(),
              withSpacesRailItem(),
            ],
            railFooter: [withSearchRailItem(), withThemeRailItem(), withUserMenu()],
            settingsNavigation: [
              withBackToApp(),
              withAccountSettingsNavigation(),
              withOrganizationSettingsLinks(),
            ],
            overlays: [withCommandPalette(), withShortcutsDialog(), withReauthenticationDialog()],
          }),
        ],
        loadComponent: async (): Promise<Type<SettingsShell>> =>
          (await import('@layouts/settings-shell')).SettingsShell,
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/account/account.routes')).ACCOUNT_ROUTES,
      },
      {
        path: 'organization',
        data: {
          settingsNavigationLabel: $localize`:@@workspace.settings.organization-navigation:Organization settings`,
          unavailableTitle: $localize`:@@workspace.settings.load-failed:Could not load this section`,
        } satisfies SettingsShellRouteData & RouteErrorData,
        providers: [
          provideReauthentication(),
          provideSettingsShellSlots({
            railNavigation: [
              withOrganizationHomeItem(),
              withHomeRailItem(),
              withInbox(),
              withSpacesRailItem(),
            ],
            railFooter: [withSearchRailItem(), withThemeRailItem(), withUserMenu()],
            settingsNavigation: [
              withBackToApp(),
              withOrganizationSettingsNavigation(),
              withAccountSettingsLink(),
            ],
            overlays: [withCommandPalette(), withShortcutsDialog(), withReauthenticationDialog()],
          }),
        ],
        loadComponent: async (): Promise<Type<SettingsShell>> =>
          (await import('@layouts/settings-shell')).SettingsShell,
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/organization/organization.routes')).ORGANIZATION_ROUTES,
      },
      {
        path: '',
        providers: [
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
            overlays: [
              withCommandPalette(),
              withShortcutsDialog(),
              withTaskCreate(),
              withTaskDetail(),
            ],
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
    ],
  },
];
