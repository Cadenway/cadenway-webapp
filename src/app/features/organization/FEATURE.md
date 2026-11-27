# Organization

## Purpose

The organization settings and their 7 sections with the least role of each, their settings
navigation (the identity row and `Organization` group of the organization settings, and the
`Organization · <name>` links of the account settings), and the shell's hints about the organization's plan
and usage: the `Team plan · 18 / 25 seats` line of the sidebar footer (`organization.plan-summary.label`) and
the `Storage nearly full` banner (`organization.storage-banner.title`). The organizations menu belongs to Workspace; billing is served by Billing.

## Routes

Workspace mounts `ORGANIZATION_ROUTES` below `/:org/organization`, inside the settings shell. Each
section has `organizationSectionGuard(<section>)` (`http/guards/organization-section/`): Workspace's
`organizationRoleGuard` with the section's least role from `ORGANIZATION_SECTIONS`
(`constants/organization-sections/`) and `ORGANIZATION_SECTION_FALLBACKS`.

| Path           | Page (`ui/pages/…`)                        | Title                  | Least role | Other guards                         |
| -------------- | ------------------------------------------ | ---------------------- | ---------- | ------------------------------------ |
| `''`           | redirects to `general`                     |                        |            |                                      |
| `general`      | `general-page` (`GeneralPage`)             | `Organization profile` | member     | `canDeactivate: unsavedChangesGuard` |
| `members`      | `members-page` (`MembersPage`)             | `Members`              | member     |                                      |
| `billing`      | `billing-page` (`BillingPage`)             | `Billing`              | owner      |                                      |
| `quotas`       | `quotas-page` (`QuotasPage`)               | `Quotas and usage`     | owner      |                                      |
| `security`     | `security-page` (`SecurityPage`)           | `Security and SSO`     | admin      |                                      |
| `integrations` | `integrations-page` (`IntegrationsPage`)   | `Integrations`         | admin      |                                      |
| `audit-log`    | `audit-log-page` (`AuditLogPage`)          | `Audit log`            | admin      |                                      |
| `**`           | Errors' `ERRORS_ROUTES` (404 in the shell) |                        |            |                                      |

- A person below a section's least role is redirected to the first section, in the navigation's
  order, their role may open (`/<slug>/organization/general` for a member or an administrator), and
  a guest to `/<slug>`. The navigation already hides those sections; the guard covers deep links.
- Billing and Quotas are owner only because `billing.yaml` answers the owner only
  (`Organisation.dc.html` line 321); Quotas reads the same `getBillingSubscription`.
- Each page is a stub (WP0 of steps 7 and 8) showing the mockup's section title in the
  organization column (`max-w-4xl`); packages O1 to O6 replace them. Integrations and the Audit
  log stay stubs until their backends exist (B7, B11). The stubs read no data, so they have no
  loading, error or empty state yet.
- A failed primary read of a section renders the default error boundary in the shell, titled
  `Could not load this section` by the mounting route's `data`.

## Public entry points

| Entry point           | Consumers |
| --------------------- | --------- |
| `organization.routes` | workspace |
| `providers`           | workspace |
| `utils/plan-label`    | workspace |

- `providers` publishes `provideOrganizationUsage()` (the shared `SubscriptionStore`, on `/:org`),
  `withPlanSummary()` (`sidebarFooter`, order 10), `withStorageBanner()` (`banners`, order 0),
  and for the settings shell routes `withOrganizationSettingsNavigation()` (`settingsNavigation`,
  order 10, the organization settings) and `withOrganizationSettingsLinks()`
  (`settingsNavigation`, order 20, the account settings).
- `utils/plan-label` publishes `planName(plan)`: `Free`, `Team`, `Enterprise`, or the key
  itself for a later plan.

## Dependencies

- `@cadenway/api-client`: `BillingService.getBillingSubscription` through `data-access/`.
- Workspace's `ports/workspace-context` and `http/guards/organization-role`, Errors' `errors.routes`,
  `@shared/unsaved-changes`.
- `@cadenway/ui` (`banner`, `button`) and `@cadenway/icons`.

## Invariants

- `SubscriptionStore` is provided once on `/:org` by `provideOrganizationUsage()` and shared by the
  plan line and the banner, so an owner's workspace sends one request. Billing answers an owner only,
  so nobody else sends it, and it is read again after an organization switch.
- A `403` or `404` shows nothing. Any other failure shows, in the plan line, `The plan could not be
loaded.` with `Retry`; the banner stays hidden until a retry succeeds.
- The banner shows from 90 % of the storage quota, in gigabytes of 10^9 bytes. `Later` and the
  close button hide it for the tab's session and the organization (`sessionStorage`,
  `cadenway-storage-banner-dismissed:<organizationId>`). `Manage quotas` opens
  `/<slug>/organization/quotas`.
- Billing requests carry the workspace organization pin (see Core).
- `SubscriptionStore.quotaCritical` holds while the seats or the storage use at least 90 % of
  their limit (the mockup's critical zone, `Organisation.dc.html` lines 1636-1647). The
  `Quotas and usage` item then carries the red `Critical quota` alert. Only an owner reads the
  subscription, so only an owner, who alone sees that item, gets the alert.
- The identity row reads `<plan> plan · <n> members` with the subscription's used seats, as the
  mockup's `orgSubtitle` does (line 1738), and `<plan> plan` for whoever may not read billing.
  It shows the initials; the logo comes with O1.
- The navigation items and the account settings' links are filtered with `WORKSPACE_CONTEXT.can()`
  and the least role of `ORGANIZATION_SECTIONS`; a guest gets no `Organization · <name>` group.
  The settings shell has no `cw-sidebar`, so the items are links styled as the mockup draws them,
  not `cwSidebarItem`, which requires one.
- `general` keeps unsaved edits through `unsavedChangesGuard`; its page asks with Workspace's
  `cw-discard-changes-dialog`. The stub has no form, so it never asks yet; package O1 reports its
  form's dirty state.
- A write the gateway guards with a recent authentication (`updateAuthenticationPolicy`, package
  O5) runs through Account's `ReauthenticationService` (`reauthentication` entry), which Workspace
  provides on the organization settings route with its dialog.

## Copy not taken word for word from the mockup

| Unit                               | Reason                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `organization.plan-summary.failed` | The mockup draws no failed billing read.                                     |
| `organization.retry`               | `Retry` is the mockup's word, used for a new state.                          |
| `organization.navigation.plan`     | The identity row without the member count, for whoever may not read billing. |
