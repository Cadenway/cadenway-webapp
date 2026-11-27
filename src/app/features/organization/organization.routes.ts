import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { unsavedChangesGuard } from '@shared/unsaved-changes';

import { shouldRecheckOrganizationRole } from '@features/workspace/http/guards/organization-role';

import { organizationSectionGuard } from './http/guards/organization-section/organization-section.guard';

/**
 * Constant ORGANIZATION_ROUTES
 *
 * @description
 * The organization settings sections, mounted by Workspace below `/:org/organization` inside the
 * settings shell. `''` opens `general`; `general`, `members`, `billing`, `quotas`, `security`,
 * `integrations` and `audit-log` load their page behind `organizationSectionGuard`, which lets
 * the least role of `ORGANIZATION_SECTIONS` in (owner for Billing and Quotas, administrator for
 * General, Security, Integrations and the Audit log, member for Members) and sends anyone else to
 * the first section their role may open, or to `/<slug>` for a guest. The guards run again on
 * every workspace recovery (`shouldRecheckOrganizationRole`), so a demoted person leaves a
 * section they may no longer open. `general` keeps unsaved
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
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    canDeactivate: [unsavedChangesGuard],
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/general-page/general-page.component')).GeneralPage,
  },
  {
    path: 'members',
    title: $localize`:@@organization.route.members:Members`,
    canActivate: [organizationSectionGuard('members')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/members-page/members-page.component')).MembersPage,
  },
  {
    path: 'billing',
    title: $localize`:@@organization.route.billing:Billing`,
    canActivate: [organizationSectionGuard('billing')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/billing-page/billing-page.component')).BillingPage,
  },
  {
    path: 'quotas',
    title: $localize`:@@organization.route.quotas:Quotas and usage`,
    canActivate: [organizationSectionGuard('quotas')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/quotas-page/quotas-page.component')).QuotasPage,
  },
  {
    path: 'security',
    title: $localize`:@@organization.route.security:Security and SSO`,
    canActivate: [organizationSectionGuard('security')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/security-page/security-page.component')).SecurityPage,
  },
  {
    path: 'integrations',
    title: $localize`:@@organization.route.integrations:Integrations`,
    canActivate: [organizationSectionGuard('integrations')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/integrations-page/integrations-page.component')).IntegrationsPage,
  },
  {
    path: 'audit-log',
    title: $localize`:@@organization.route.audit-log:Audit log`,
    canActivate: [organizationSectionGuard('audit-log')],
    runGuardsAndResolvers: shouldRecheckOrganizationRole,
    loadComponent: async (): Promise<Type<unknown>> =>
      (await import('./ui/pages/audit-log-page/audit-log-page.component')).AuditLogPage,
  },
  {
    path: '**',
    loadChildren: async (): Promise<Routes> =>
      (await import('@features/errors/errors.routes')).ERRORS_ROUTES,
  },
];
