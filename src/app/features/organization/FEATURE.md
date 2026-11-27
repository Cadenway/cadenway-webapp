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
| `general`      | `general-page` (`GeneralPage`)             | `Organization profile` | admin      | `canDeactivate: unsavedChangesGuard` |
| `members`      | `members-page` (`MembersPage`)             | `Members`              | member     |                                      |
| `billing`      | `billing-page` (`BillingPage`)             | `Billing`              | owner      |                                      |
| `quotas`       | `quotas-page` (`QuotasPage`)               | `Quotas and usage`     | owner      |                                      |
| `security`     | `security-page` (`SecurityPage`)           | `Security and SSO`     | admin      | `canDeactivate: unsavedChangesGuard` |
| `integrations` | `integrations-page` (`IntegrationsPage`)   | `Integrations`         | admin      |                                      |
| `audit-log`    | `audit-log-page` (`AuditLogPage`)          | `Audit log`            | admin      |                                      |
| `**`           | Errors' `ERRORS_ROUTES` (404 in the shell) |                        |            |                                      |

- A person below a section's least role is redirected to the first section, in the navigation's
  order, their role may open (`/<slug>/organization/general` for an administrator,
  `/<slug>/organization/members` for a member), and a guest to `/<slug>`. Workspace's
  `organizationRoleGuard('member')` on the frame sends a guest away before it renders. Each section
  route sets `runGuardsAndResolvers: shouldRecheckOrganizationRole`, so a workspace recovery that
  finds a lower role (an owner demoted while Billing is shown) redirects off the section.
- General is administrator only: every control on it writes, and `updateCurrentOrganization` and
  the logo are owner or administrator. The navigation already hides those sections; the guard covers deep links.
- Billing and Quotas are owner only because `billing.yaml` answers the owner only
  (`Organisation.dc.html` line 321); Quotas reads the same `getBillingSubscription`.
- Each page is a stub (WP0 of steps 7 and 8) showing the mockup's section title in the
  organization column (`max-w-4xl`); packages O1 to O6 replace them. Security (O5) is built. Integrations and the Audit
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

- `@cadenway/api-client`: `BillingService.getBillingSubscription` and
  `AuthenticationPolicyService.getAuthenticationPolicy` / `updateAuthenticationPolicy` through
  `data-access/`.
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
  and the least role of `ORGANIZATION_SECTIONS`; a group without any section is not rendered, its
  heading included (a guest gets no `Organization · <name>` group).
  The settings shell has no `cw-sidebar`, so the items are links styled as the mockup draws them,
  not `cwSidebarItem`, which requires one.
- `general` keeps unsaved edits through `unsavedChangesGuard`; its page asks with Workspace's
  `cw-discard-changes-dialog`. The stub has no form, so it never asks yet; package O1 reports its
  form's dirty state.
- A write the gateway guards with a recent authentication (`updateAuthenticationPolicy`, package
  O5) runs through Account's `ReauthenticationService` (`reauthentication` entry), which Workspace
  provides on the organization settings route with its dialog.
- Security shows only what the contract serves: the `Authentication policy` card with the two
  two-step switches and `Idle session timeout`. The SAML card, `Test connection`, `Enforce SSO`
  and the allowed sign-in methods (gap B13) are not rendered. The page-scoped
  `AuthenticationPolicyStore` reads the policy of the workspace organization (the primary read,
  keyed by its id, so a page reused for another organization reads and resets to that one's; a
  failure reaches the route's error boundary) and saves only the changed members from the version
  read (`If-Match`). A save is bound to the organization shown when it starts and to the page:
  after a switch or once the page is gone it sends nothing more, the retry after a
  reauthentication included, drops any late answer and toasts nothing. The card is a form with the
  `Unsaved changes` footer, `Cancel` and `Save`, where the mockup applies each control at once.
  The administrators' switch keeps its own choice; `everyone` shows it on and disabled without
  changing it, so turning `all members` on then off is clean, and the sent requirement is
  `everyone`, else `admins`, else `nobody`. A value a later contract adds shows nothing selected
  and is sent only once its control changes. A save of the timeout toasts the mockup's
  `Session policy updated` with the new timeout; a save of the two-step requirement alone toasts
  `Two-step verification policy updated`. A `412 request.version-mismatch` reads the policy again
  and toasts the conflict, a `409 auth.two-step-not-enabled` toasts why, any other refusal toasts
  the failure and keeps the edits. A closed reauthentication dialog and a
  `412 organization.context-changed` (or a switch in progress), which the workspace recovery
  handles, keep them silently. A recovery reruns the route on the same URL, which
  `unsavedChangesGuard` lets through without asking.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                                                                                          | Reason                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `organization.plan-summary.failed`                                                                                                                                                                            | The mockup draws no failed billing read.                                                               |
| `organization.retry`                                                                                                                                                                                          | `Retry` is the mockup's word, used for a new state.                                                    |
| `organization.navigation.plan`                                                                                                                                                                                | The identity row without the member count, for whoever may not read billing.                           |
| `organization.security.save-failed`, `organization.security.conflict`, `organization.security.conflict-text`, `organization.security.two-step-not-enabled`, `organization.security.two-step-not-enabled-text` | The mockup applies each control at once and draws no refused save.                                     |
| `organization.security.two-step-saved`                                                                                                                                                                        | The mockup's only policy toast names the session timeout; a two-step change alone needs its own title. |
