import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { organizationSectionGuard } from './http/guards/organization-section/organization-section.guard';

/**
 * Constant ORGANIZATION_ROUTES
 *
 * @description
 * The organization settings sections, mounted by Workspace below `/:org/organization` inside the
 * settings shell. `''` opens `general`; `general`, `members`, `billing`, `quotas`, `security`,
 * `integrations` and `audit-log` load their page behind `organizationSectionGuard`, which lets
 * the least role of `ORGANIZATION_SECTIONS` in (owner for Billing and Quotas, administrator for
 * Security, Integrations and the Audit log, member for General and Members) and sends anyone else
 * to the first section their role may open, or to `/<slug>` for a guest. `general` keeps unsaved
 * edits with `unsavedChangesGuard`. A failed primary read renders the router's default error
 * component, `RouteErrorBoundary`, in the shell, titled by the `unavailableTitle` the mounting
 * route sets. An unknown section renders the 404 inside the shell.
 *
 * @type {Routes}
 */
export const ORGANIZATION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'general' },
  {
    path: 'general',
    title: $localize`:@@organization.route.general:Organization profile`,
    canActivate: [organizationSectionGuard('general')],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/general-page/general-page.component')).GeneralPage,
  },
  {
    path: 'members',
    title: $localize`:@@organization.route.members:Members`,
    canActivate: [organizationSectionGuard('members')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/members-page/members-page.component')).MembersPage,
  },
  {
    path: 'billing',
    title: $localize`:@@organization.route.billing:Billing`,
    canActivate: [organizationSectionGuard('billing')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/billing-page/billing-page.component')).BillingPage,
  },
  {
    path: 'quotas',
    title: $localize`:@@organization.route.quotas:Quotas and usage`,
    canActivate: [organizationSectionGuard('quotas')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/quotas-page/quotas-page.component')).QuotasPage,
  },
  {
    path: 'security',
    title: $localize`:@@organization.route.security:Security and SSO`,
    canActivate: [organizationSectionGuard('security')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/security-page/security-page.component')).SecurityPage,
  },
  {
    path: 'integrations',
    title: $localize`:@@organization.route.integrations:Integrations`,
    canActivate: [organizationSectionGuard('integrations')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/integrations-page/integrations-page.component')).IntegrationsPage,
  },
  {
    path: 'audit-log',
    title: $localize`:@@organization.route.audit-log:Audit log`,
    canActivate: [organizationSectionGuard('audit-log')],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/audit-log-page/audit-log-page.component')).AuditLogPage,
  },
  {
    path: '**',
    loadChildren: async (): Promise<Routes> =>
      (await import('@features/errors/errors.routes')).ERRORS_ROUTES,
  },
];
