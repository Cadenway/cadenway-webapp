import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideCadenwayIcons } from '@cadenway/icons';
import { provideCwInputOtpLabels } from '@cadenway/ui/components/input-otp';
import { provideCwPasswordStrengthLabels } from '@cadenway/ui/components/password-strength';
import { provideAuthLayoutSlots } from '@layouts/auth-layout/providers';

import { openInvitation } from './http/guards/invitation/invitation.guard';
import { requireSession } from './http/guards/session/session.guard';
import {
  withHostName,
  withLegalLinks,
  withThemeToggle,
} from './providers/auth-layout-slots/auth-layout-slots.provider';
import { AuthFlowStore } from './state/auth-flow/auth-flow.store';

/**
 * Constant AUTH_ROUTES
 *
 * @description
 * The public entry screens, mounted at `''` by `APP_ROUTES`. The root route loads the sign-in
 * frame (`AuthLayout`), binds its header host name and theme button and its footer legal links, provides the icons,
 * the English labels of the code and password-strength bricks, and the `AuthFlowStore` the
 * screens share. A path none of the children matches falls through to the next application
 * route (the workspace under `/:org`). Paths are the ones e-mails and the gateway link to.
 *
 * @type {Routes}
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideCadenwayIcons(),
      provideAuthLayoutSlots({
        headerActions: [withHostName(), withThemeToggle()],
        footerLinks: [withLegalLinks()],
      }),
      provideCwInputOtpLabels(() => ({
        ariaLabel: $localize`:@@auth.code.aria-label:One-time code`,
      })),
      provideCwPasswordStrengthLabels(() => ({
        meter: $localize`:@@auth.password.meter:Password strength`,
        levels: [
          $localize`:@@auth.password.level-0:Too short`,
          $localize`:@@auth.password.level-1:Weak`,
          $localize`:@@auth.password.level-2:Fair`,
          $localize`:@@auth.password.level-3:Good`,
          $localize`:@@auth.password.level-4:Excellent`,
        ],
        met: $localize`:@@auth.password.met:: met`,
        unmet: $localize`:@@auth.password.unmet:: not met`,
        minLength: (count: number): string =>
          $localize`:@@auth.password.min-length:${count}:count: characters minimum`,
        mixedCase: $localize`:@@auth.password.mixed-case:Upper and lower case`,
        digit: $localize`:@@auth.password.digit:At least one digit`,
        symbol: $localize`:@@auth.password.symbol:At least one symbol`,
      })),
      AuthFlowStore,
    ],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('@layouts/auth-layout')).AuthLayout,
    children: [
      {
        path: 'login',
        title: $localize`:@@auth.login.title:Sign in`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/login-page/login-page.component')).LoginPage,
      },
      {
        path: 'login/sso',
        title: $localize`:@@auth.sso.title:SSO sign-in`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/sso-page/sso-page.component')).SsoPage,
      },
      {
        path: 'login/code',
        title: $localize`:@@auth.code-sign-in.title:One-time code`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/code-sign-in-page/code-sign-in-page.component')).CodeSignInPage,
      },
      {
        path: 'login/two-step',
        title: $localize`:@@auth.two-step.title:Two-step verification`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/two-step-page/two-step-page.component')).TwoStepPage,
      },
      {
        path: 'signup',
        title: $localize`:@@auth.signup.title:Sign up`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/signup-page/signup-page.component')).SignupPage,
      },
      {
        path: 'signup/verify',
        title: $localize`:@@auth.signup-verify.title:One-time code`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/signup-verify-page/signup-verify-page.component'))
            .SignupVerifyPage,
      },
      {
        path: 'forgot',
        title: $localize`:@@auth.forgot.title:Forgot password`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/forgot-page/forgot-page.component')).ForgotPage,
      },
      {
        path: 'reset',
        title: $localize`:@@auth.reset.title:New password`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/reset-page/reset-page.component')).ResetPage,
      },
      {
        path: 'logged-out',
        title: $localize`:@@auth.logged-out.route-title:Signed out`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/logged-out-page/logged-out-page.component')).LoggedOutPage,
      },
      {
        path: 'organizations',
        title: $localize`:@@auth.organizations.title:Organizations`,
        canActivate: [requireSession],
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/organizations-page/organizations-page.component'))
            .OrganizationsPage,
      },
      {
        path: 'organizations/new',
        title: $localize`:@@auth.organization-create.title:Organizations`,
        canActivate: [requireSession],
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/organization-create-page/organization-create-page.component'))
            .OrganizationCreatePage,
      },
      {
        path: 'invite/:invitationId',
        canActivate: [openInvitation],
        children: [],
      },
      {
        path: 'auth/federated/continue',
        title: $localize`:@@auth.federated.title:Signing in`,
        loadComponent: async (): Promise<Type<unknown>> =>
          (await import('./ui/pages/federated-continue-page/federated-continue-page.component'))
            .FederatedContinuePage,
      },
    ],
  },
];
