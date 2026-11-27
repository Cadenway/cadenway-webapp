import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCwInputOtpLabels } from '@cadenway/ui/components/input-otp';
import { provideCwPasswordStrengthLabels } from '@cadenway/ui/components/password-strength';

import { unsavedChangesGuard } from '@shared/unsaved-changes';

/**
 * Constant ACCOUNT_ROUTES
 *
 * @description
 * The account settings sections, mounted by Workspace below `/:org/account` inside the settings
 * shell. `''` opens `profile`; `profile`, `security`, `notifications`, `preferences` and
 * `api-tokens` load their page, and `profile` keeps unsaved edits with `unsavedChangesGuard`. A
 * failed primary read renders the router's default error component, `RouteErrorBoundary`, in the
 * shell, titled by the `unavailableTitle` the mounting route sets. An unknown section renders the
 * 404 inside the shell. A componentless parent gives the sections the English texts of the
 * password strength meter and the one-time code field.
 *
 * @type {Routes}
 */
export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideCwInputOtpLabels(() => ({
        ariaLabel: $localize`:@@account.labels.code:One-time code`,
      })),
      provideCwPasswordStrengthLabels(() => ({
        meter: $localize`:@@account.labels.password-meter:Password strength`,
        levels: [
          $localize`:@@account.labels.password-level-0:Too short`,
          $localize`:@@account.labels.password-level-1:Weak`,
          $localize`:@@account.labels.password-level-2:Fair`,
          $localize`:@@account.labels.password-level-3:Good`,
          $localize`:@@account.labels.password-level-4:Excellent`,
        ],
        met: $localize`:@@account.labels.password-met:: met`,
        unmet: $localize`:@@account.labels.password-unmet:: not met`,
        minLength: (count: number): string =>
          $localize`:@@account.labels.password-min-length:${count}:count: characters minimum`,
        mixedCase: $localize`:@@account.labels.password-mixed-case:Upper and lower case`,
        digit: $localize`:@@account.labels.password-digit:At least one digit`,
        symbol: $localize`:@@account.labels.password-symbol:At least one symbol`,
      })),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        title: $localize`:@@account.route.profile:Profile`,
        canDeactivate: [unsavedChangesGuard],
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/profile-page/profile-page.component')).ProfilePage,
      },
      {
        path: 'security',
        title: $localize`:@@account.route.security:Security and sign-in`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/security-page/security-page.component')).SecurityPage,
      },
      {
        path: 'notifications',
        title: $localize`:@@account.route.notifications:Notifications`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/notifications-page/notifications-page.component'))
            .NotificationsPage,
      },
      {
        path: 'preferences',
        title: $localize`:@@account.route.preferences:Preferences`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/preferences-page/preferences-page.component')).PreferencesPage,
      },
      {
        path: 'api-tokens',
        title: $localize`:@@account.route.api-tokens:API tokens`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/api-tokens-page/api-tokens-page.component')).ApiTokensPage,
      },
      {
        path: '**',
        loadChildren: async (): Promise<Routes> =>
          (await import('@features/errors/errors.routes')).ERRORS_ROUTES,
      },
    ],
  },
];
