# Organization

## Purpose

The organization settings and their 7 sections, and the shell's hints about the organization's plan
and usage: the « Plan Équipe · 18 / 25 sièges » line of the sidebar footer and the « Stockage presque
plein » banner. The organizations menu belongs to Workspace; billing is served by Billing.

## Routes

None yet: the organization sections (`/:org/organization/:section`) come with the organization
settings step. Until then the shell's links open the 404 inside the shell.

## Public entry points

| Entry point        | Consumers |
| ------------------ | --------- |
| `providers`        | workspace |
| `utils/plan-label` | workspace |

- `providers` publishes `withPlanSummary()` (`sidebarFooter`, order 10) and `withStorageBanner()`
  (`banners`, order 0).
- `utils/plan-label` publishes `planName(plan)`: « Gratuit », « Équipe », « Entreprise », or the key
  itself for a later plan.

## Dependencies

- `@cadenway/api-client`: `BillingService.getBillingSubscription` through `data-access/`.
- Workspace's `ports/workspace-context`.
- `@cadenway/ui` (`banner`, `button`) and `@cadenway/icons`.

## Invariants

- `SubscriptionStore` is provided by each widget. Billing answers an owner only, so the request is
  sent for an owner only and read again after an organization switch; for anyone else, before the
  answer and after a failure, the widgets show nothing, since both are secondary hints.
- The banner shows from 90 % of the storage quota, in gigabytes of 10^9 bytes. « Plus tard » and the
  close button hide it for the tab's session and the organization (`sessionStorage`,
  `cadenway-storage-banner-dismissed:<organizationId>`). « Gérer les quotas » opens
  `/<slug>/organization/quotas`.
