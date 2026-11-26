# Organization

## Purpose

The organization settings and their 7 sections, and the shell's hints about the organization's plan
and usage: the `Team plan · 18 / 25 seats` line of the sidebar footer (`organization.plan-summary.label`) and
the `Storage nearly full` banner (`organization.storage-banner.title`). The organizations menu belongs to Workspace; billing is served by Billing.

## Routes

None yet: the organization sections (`/:org/organization/:section`) come with the organization
settings step. Until then the shell's links open the 404 inside the shell.

## Public entry points

| Entry point        | Consumers |
| ------------------ | --------- |
| `providers`        | workspace |
| `utils/plan-label` | workspace |

- `providers` publishes `provideOrganizationUsage()` (the shared `SubscriptionStore`, on `/:org`),
  `withPlanSummary()` (`sidebarFooter`, order 10) and `withStorageBanner()` (`banners`, order 0).
- `utils/plan-label` publishes `planName(plan)`: `Free`, `Team`, `Enterprise`, or the key
  itself for a later plan.

## Dependencies

- `@cadenway/api-client`: `BillingService.getBillingSubscription` through `data-access/`.
- Workspace's `ports/workspace-context`.
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

## Copy not taken word for word from the mockup

| Unit                               | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| `organization.plan-summary.failed` | The mockup draws no failed billing read.            |
| `organization.retry`               | `Retry` is the mockup's word, used for a new state. |
