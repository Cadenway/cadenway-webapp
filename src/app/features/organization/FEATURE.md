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
- Members section: `MembersService` (`listMembers`, `changeMemberRole`, `removeMember`) and
  `InvitationsService` (`listInvitations`, `inviteMembers`, `resendInvitation`, `revokeInvitation`)
  through `data-access/services/{members-api,invitations-api}`; Core's `RealtimeConnection.presences`
  (optional) for the presence dots and tabs; `@cadenway/ui` `alert-dialog`, `avatar`, `badge`,
  `dialog`, `empty`, `input-group`, `select`, `skeleton`, `table`, `tabs`, `textarea`, `toast` and
  `tooltip`.

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
  `everyone`, else `admins`, else `nobody`. A two-step requirement a later contract adds is not
  shown as `nobody`: a note says the current rule cannot be shown, both switches stay disabled
  until `Choose a new rule`, and only then is the requirement sent (`nobody` if both stay off). A
  timeout a later contract adds shows nothing selected and is sent only once another option is
  picked. Leaving while a change is on its way to the gateway, which may still apply it, never
  offers `Discard`: the page waits for it, then leaves once it is saved or asks once it is
  refused. A save waiting only for the reauthentication dialog sent nothing, so `Discard` is
  offered at once and cancels it. A save of the timeout toasts the mockup's
  `Session policy updated` with the new timeout; a save of the two-step requirement alone toasts
  `Two-step verification policy updated`. A `412 request.version-mismatch` reads the policy again
  and toasts the conflict, a `409 auth.two-step-not-enabled` toasts why, any other refusal toasts
  the failure and keeps the edits. A closed reauthentication dialog and a
  `412 organization.context-changed` (or a switch in progress), which the workspace recovery
  handles, keep them silently. A recovery reruns the route on the same URL, which
  `unsavedChangesGuard` lets through without asking.

### Members (`members`, package O2)

- `MembersPage` provides the page-scoped `MembersStore` and `InvitationsStore`. Everyone from a
  member up reads the list; the owner and administrators (`can('admin')`) also change roles,
  remove members (after `Remove <name> from the organization?`), invite, and see `Two-step`
  and `Pending invitations`, which the API answers them only. A member gets a read-only table. The
  owner's row and the person's own row are never editable.
- Both stores follow the workspace organization: a switch resets the filters, the pages, the
  writes and the section skeleton (the next organization's first read failing reaches the error
  boundary), and a write that settles after it changes nothing and shows no toast. The page binds
  the invite dialog and the removal confirmation to the organization they were opened for: a
  switch closes and empties them, and a submission for another organization sends nothing.
- `MembersStore` subscribes to `RealtimeConnection.presenceChanges` for its lifetime, which starts
  the connection on a direct visit; the presence dots and tabs read `presences`. A presence tab's
  page that live changes leave without rows goes back to the last page with rows.
- Search and the role tabs go to `listMembers` (`Administrators` is `role=owner,admin`), 8 per page
  by cursor; the store keeps the cursor of each page reached for `Previous`. The search is sent
  250 ms after the last keystroke; `Clear filters` drops a search still waiting. A presence tab,
  which the API does not offer, reads every member of the role tab once (pages of 100, at most
  2,000, with a notice when the limit is reached), then searches and pages them in the browser
  against the live presence; an absent member is offline. The role tab counts come from `counts`,
  whatever the filters. While a read is under way the counts, the summary and the range keep
  their last values, and the rows of the same view stay.
- The first read shows the section skeleton; its failure throws into the route's error boundary
  (`Could not load this section`, Retry runs the route again). A later failed read shows the
  same panel in place with `Retry`; a completed read without rows shows `No member matches`, with
  `Clear filters` when filtered. A failed invitations read keeps an inline error with `Retry`.
  The invitations list reads every page.
- Role changes, removals, resends and cancellations are optimistic: the row changes at once and
  is marked busy while sent (the role select keeps its focus); a refusal restores the confirmed
  state with the failure toast. A confirmed write is applied to every read issued before it
  settled, until a read issued after it lands, so an in-flight read cannot bring the old state
  back. The current view is read again when its answer cannot hold the write: the member is not
  on it, a role change moved them out of the role tab, or a removal on a cursor page (whose later
  cursors are dropped). A removal that empties a page opens the previous one once that read
  settles. The focus moves to the next row's remove button, or to the search when no row is left.
- A role change sends `If-Match: "<version>"`; `412 request.version-mismatch` reads the view again
  with a warning. A resend or a cancellation answered `409 invitation.answered` or
  `invitation.revoked` drops the row and reads the list again. The server has no undo, so the
  removal and cancellation toasts have none. A confirmed role change or removal reads the
  subscription again for the owner's free seats.
- `<n> free seats` (summary) and `<n> seats available on the <plan> plan.` (dialog) show to the
  owner only, who alone reads billing (gap Q1); the invite dialog then refuses more members than
  free seats. The last-activity column (gap M1) and the invitation link card (B12) are left out.
- Invite splits the addresses on spaces, commas and semicolons, keeps each once, and checks them as
  the contract does (zod's `email()`, 254 characters at most); it refuses an invalid one, none, or
  more than 50, then reads the invitations again. A `400` whose `details.issues[].path` is
  `emails.<n>` names those addresses on the field until they change or the dialog opens again. The toast counts the addresses invited and
  those skipped (already a member or invited). The dialog stays open on a refusal.
- Counts pick their singular or plural text with `Intl.PluralRules($localize.locale)`, so French
  reads `0 membre` as the mockup does.
- Screen readers hear a row's presence as `Status: Active | Away | Do not disturb | Offline`
  (`Organisation.dc.html` line 1843), then the name once; the avatar is hidden from them.
- Below 768 px both tables become cards (header hidden, member cell full width, actions right)
  and the remove button stays visible; the search takes the full width and the toolbar wraps.

## Copy not taken word for word from the mockup

| Unit                               | Reason                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `organization.plan-summary.failed` | The mockup draws no failed billing read.                                     |
| `organization.retry`               | `Retry` is the mockup's word, used for a new state.                          |
| `organization.navigation.plan`     | The identity row without the member count, for whoever may not read billing. |

Members section (`organization.members.*`):

| Unit                                                                                                                                                                                                    | Reason                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `role-failed`, `role-failed-seats`, `remove-failed`, `resend-failed`, `resend-failed-limit`, `cancel-failed`, `invite-failed`, `invite-failed-limit`                                                    | The mockup draws no refused write.                                                           |
| `role-stale`, `role-stale-text`, `invitation-closed`                                                                                                                                                    | The mockup draws no write overtaken by another person's.                                     |
| `resend-throttled`                                                                                                                                                                                      | Copy of the contract (`resendInvitation`); the mockup draws no throttled resend.             |
| `invite-none`, `invite-skipped`, `invite-skipped-one`                                                                                                                                                   | The mockup draws no address already a member or invited.                                     |
| `invite-invalid`, `invite-required`, `invite-too-many`, `invite-no-seats`                                                                                                                               | The mockup disables `Invite`; the forms rule keeps it enabled and shows an error.            |
| `invite-seats-one`, `invite-valid-one`, `invite-only-one`, `invite-left-one`, `invite-sent-one`, `summary-member`, `summary-guest`, `summary-seat`, `summary-invitation`, `range-one`, `expires-in-one` | Singular forms of the mockup's `plural()` texts, with the count.                             |
| `expires-in`, `expired-on`                                                                                                                                                                              | The mockup's fixed texts with the dates of the contract.                                     |
| `invitations-failed`                                                                                                                                                                                    | The mockup draws no failed invitations read.                                                 |
| `presence-truncated`                                                                                                                                                                                    | The mockup filters its 22 members; the read stops at 2,000.                                  |
| `loading`, `failed-title`, `failed-text`, `retry`                                                                                                                                                       | The mockup's section states (`Organisation.dc.html` lines 73-128), with this section's ids.  |
| `remove-text`                                                                                                                                                                                           | `de <organization>` rather than the mockup's `d’Atelier Nord`, for any name.                 |
| `invite-placeholder`                                                                                                                                                                                    | English source with `example.com`; the French keeps the mockup's `exemple.fr`.               |
| `avatar-*`, `alert-*`, `dialog-close`, `select-*`                                                                                                                                                       | Texts of the bricks (the avatar's title, hidden from screen readers); the mockup draws none. |

| Unit                                                                                                                                                                                                          | Reason                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `organization.plan-summary.failed`                                                                                                                                                                            | The mockup draws no failed billing read.                                                                          |
| `organization.retry`                                                                                                                                                                                          | `Retry` is the mockup's word, used for a new state.                                                               |
| `organization.navigation.plan`                                                                                                                                                                                | The identity row without the member count, for whoever may not read billing.                                      |
| `organization.security.save-failed`, `organization.security.conflict`, `organization.security.conflict-text`, `organization.security.two-step-not-enabled`, `organization.security.two-step-not-enabled-text` | The mockup applies each control at once and draws no refused save.                                                |
| `organization.security.two-step-saved`                                                                                                                                                                        | The mockup's only policy toast names the session timeout; a two-step change alone needs its own title.            |
| `organization.security.two-step-unknown`, `organization.security.two-step-unknown-choose`                                                                                                                     | The mockup knows only `nobody`, `admins` and `everyone`; a requirement a later contract adds needs its own state. |
