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
  organization column (`max-w-4xl`); packages O1 to O6 replace them. General (O1) and Security (O5) are built. Integrations and the Audit
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
| `ports/plan-seats`    | spaces    |

- `providers` publishes `provideOrganizationUsage()` (the shared `SubscriptionStore` and
  `PLAN_SEATS`, on `/:org`),
  `withPlanSummary()` (`sidebarFooter`, order 10), `withStorageBanner()` (`banners`, order 0),
  and for the settings shell routes `withOrganizationSettingsNavigation()` (`settingsNavigation`,
  order 10, the organization settings) and `withOrganizationSettingsLinks()`
  (`settingsNavigation`, order 20, the account settings).
- `ports/plan-seats` publishes `PLAN_SEATS` (`PlanSeatsPort`: `seats`, a signal of the plan key
  and the free seats, never below zero, or null while the `SubscriptionStore` shows no
  subscription, as for every role but owner), so other features reuse the one subscription read.
- `utils/plan-label` publishes `planName(plan)`: `Free`, `Team`, `Enterprise`, or the key
  itself for a later plan.

## Dependencies

- `@cadenway/api-client`: `BillingService.getBillingSubscription` and
  `AuthenticationPolicyService.getAuthenticationPolicy` / `updateAuthenticationPolicy` through
  `data-access/`.
- General section: `OrganizationsService` (`getCurrentOrganization`, `updateCurrentOrganization`)
  and the logo operations of `ProfileMediaService` (`getOrganizationLogo`,
  `startOrganizationLogoUpload`, `setOrganizationLogo`, `deleteOrganizationLogo`) through
  `data-access/services/organization-api`, plus Angular's `HttpClient` for the signed storage
  transfer only (never the API); `@cadenway/ui` `card`, `input`, `input-group`, `select`,
  `skeleton`, `spinner`, `textarea` and `toast`.
- Workspace's `ports/workspace-context`, `ports/workspace-refresh` (General) and
  `http/guards/organization-role`, Errors' `errors.routes`,
  `@shared/unsaved-changes`.
- `@cadenway/ui` (`banner`, `button`) and `@cadenway/icons`.
- Members section: `MembersService` (`listMembers`, `changeMemberRole`, `removeMember`) and
  `InvitationsService` (`listInvitations`, `inviteMembers`, `resendInvitation`, `revokeInvitation`)
  through `data-access/services/{members-api,invitations-api}`; Core's `RealtimeConnection.presences`
  (optional) for the presence dots and tabs; `@cadenway/ui` `alert-dialog`, `avatar`, `badge`,
  `dialog`, `empty`, `input-group`, `select`, `skeleton`, `table`, `tabs`, `textarea`, `toast` and
  `tooltip`.
- Quotas section: the shared `SubscriptionStore` (no request of its own); `@cadenway/ui` `button`,
  `card`, `empty`, `meter`, `skeleton` and `toast`.

- Billing section: `BillingService` (`listBillingInvoices`, `startBillingCheckout`) through
  `data-access/services/billing-api`; `@cadenway/ui` `button`, `empty`, `skeleton`, `table`,
  `toast` and `tooltip`.

## Invariants

- `SubscriptionStore` is provided once on `/:org` by `provideOrganizationUsage()` and shared by the
  plan line and the banner, so an owner's workspace sends one request. Billing answers an owner only,
  so nobody else sends it, and it is read again after an organization switch.
- A `403` or `404` shows nothing. Any other failure shows, in the plan line, `The plan could not be
loaded.` with `Retry`; the banner stays hidden until a retry succeeds.
- `SubscriptionStore.refresh()` reads the subscription again while the one shown stays (the
  quotas section, when it opens and before its export). It sends nothing for anyone but an owner
  or while the first read is under way, and shares a refresh under way only with the same
  organization. A generation of the subscription, moved by every read, `retry()`, `set()` (Billing's
  payment confirmation) and refresh, binds each refresh: its outcome is dropped once the
  subscription changed after it was sent, or the organization or the owner role did. A `403` or
  `404` clears the subscription shown for that organization (`current` null and `failed` false, as
  for a first read refused so, which hides the plan line, the banner and the quota alert) until a
  newer subscription; any other failure keeps it and sets `refreshFailed` until a newer one
  replaces it.
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
  It shows the initials. The logo shows in the General section only: the identity row needs a
  logo read shared with it, which no package of steps 7 and 8 brings; it is a follow-up.
- The navigation items and the account settings' links are filtered with `WORKSPACE_CONTEXT.can()`
  and the least role of `ORGANIZATION_SECTIONS`; a group without any section is not rendered, its
  heading included (a guest gets no `Organization · <name>` group).
  The settings shell has no `cw-sidebar`, so the items are links styled as the mockup draws them,
  not `cwSidebarItem`, which requires one.
- `general` keeps unsaved edits through `unsavedChangesGuard`; its page asks with Workspace's
  `cw-discard-changes-dialog` while its form differs from the saved organization (see General).
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

### General (`general`, package O1)

- `GeneralPage` provides the page-scoped `OrganizationProfileStore`. It shows only the `Identity`
  card the contract serves: the logo, `Name`, `Address` (the page host, then the slug),
  `Description (optional)` with its `N / 280` count of the trimmed text, `Website` and
  `Default language` (Français, English, Deutsch with their flags), and the `Unsaved changes`
  footer with `Cancel` and `Save`. The verified domains card (gap B10) and the danger zone,
  transfer and deletion (gap B12), are not rendered.
- The read of the current organization is the primary read, keyed by the workspace
  organization: a switch reads the next one; its failure reaches the route's error boundary. The
  logo image is a secondary read keyed by `<organization id>:<logo id>`, so a save that keeps the
  logo reads no image; a replaced read is aborted and shows nothing. Its object URL is revoked once
  another is shown, as soon as the organization has no logo, and with the page; without a logo,
  or when its image cannot be read, the tile shows the initials of the saved name.
- The draft is kept apart from the saved organization it started from. When a read brings a newer
  organization (the reread after a logo change or after a stale version), each field the person
  changed keeps their edit and every other field takes the new value; when someone else changed a
  field the person also changed, to another value, the conflict is toasted (instead of the logo's
  success); the comparison uses the draft as it is when the read settles, so an edit made while
  the write ran counts. The draft starts over only after a successful save, `Cancel`, or for
  another organization.
- A reread after a write (a logo change, a stale version, a save whose answer was lost) that
  fails never reaches the error boundary: the last confirmed organization and the draft stay,
  no success is toasted, and the card shows `The latest version of the organization could not
be loaded.` with `Retry`, until a read or a save confirms the organization (another
  organization forgets it).
- `Save` sends only what changed (names and addresses trimmed, an empty description or website
  as `null`) from the version read (`If-Match`). The form checks the contract's rules before
  sending (a name of 1 to 120 characters, a slug of 2 to 63 lowercase letters, digits and single
  dashes, a description of 280 characters at most, an absolute `https` or `http` website); an
  invalid submit shows the errors and focuses the first. `409 organization.slug-taken`,
  `422 organization.slug-reserved` and a `400 request.invalid` issue on a form field show on that
  field. `412 request.version-mismatch` reads the organization again, merges it into the draft and
  toasts the conflict; any other refusal toasts the failure and keeps the edits; a
  `412 organization.context-changed` (or a switch in progress) keeps them silently for the
  workspace recovery. A save whose answer is lost (no status, `408` or `5xx`) reads the
  organization again before reporting: when it holds the change the save counts as done (a
  committed new slug is followed), otherwise it is a failure.
- A successful save asks Workspace to verify the organization again (`WORKSPACE_REFRESH`), so the
  settings identity row and the shells show a new name. Once a save or a reread shows an address
  other than the workspace's, the page opens it: a navigation the person started meanwhile goes on
  when it leaves for another organization, or is redirected below the new address; otherwise the
  page moves itself to `/<new slug>/organization/general`, replacing the old address in the history
  and keeping the query, without asking to discard (the page and its draft stay). The `/:org`
  guards then verify and commit the organization again.
- The logo applies at once, as the mockup does: a PNG or SVG of 1 byte to 5 MiB is reserved
  (`Idempotency-Key`), sent to its signed destination with its fields first and no credentials,
  then published with `If-Match`; `Remove` deletes it with `If-Match`. A transfer that ends
  without an answer (status 0) publishes the same upload once before failing; a
  `409 media.upload-not-ready` fails. Each change then reads the organization again for its
  reference and version. Another file type, an empty or too large file and an image storage
  refuses (`media.unsupported-type`, `media.file-too-large`, `media.invalid-image`) toast why; a
  stale version reads the organization again. Once a change ended, the file input takes the focus.
- One write runs at a time: `Save` is disabled while a logo change runs; the logo actions stay
  focusable with `aria-disabled="true"` and do nothing while a save or a logo change runs. Every
  write is bound to the organization shown when it starts and to the page: after a switch or once
  the page is gone it sends nothing more, drops any late answer and toasts nothing. Leaving while a
  save is on its way never offers `Discard`: the page waits for it, then leaves once it is saved or
  asks once it is refused.
- A default language a later contract adds shows `Choose a language` and is sent only once another
  option is picked.
- Below 768 px the fields take one column, the logo row and the footer wrap.

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

### Quotas (`quotas`, package O4)

- `QuotasPage` reads the shared `SubscriptionStore` and shows only what `getBillingSubscription`
  serves: the title, `Export usage (CSV)` and the `<plan> plan limits` card with `Seats`
  (`<used> / <limit>`, `<n> free seats. Guests do not take a seat.`), `Storage` (attachments only,
  `<used> GB / <limit> GB` in gigabytes of 10^9 bytes, with the free room, the room left before
  refusal, or the refusal beyond the limit) and `Guests` (the count and its note, without a gauge:
  the contract states no guest limit). The cycle dates, the stat tiles, the API calls, automations
  and webhooks meters (gap B15), the storage split card with `See files`, `Increase the quota` and
  the largest files dialog (gap B16), and the alerts and overage card are not rendered.
- A meter is high (balise) from 80 % of its limit and critical (grenat) from 90 %, the share the
  navigation's `Critical quota` alert uses (`quotaZone`, `ui/components/quota-meters`); the page
  forces that zone on `cw-meter`, whose own critical zone starts at 95 %. The mockup's 80 % mark on
  each gauge is not drawn: `cw-meter` draws a mark only as a capacity whose overrun it colors and
  counts, so the card keeps the `alert threshold at 80%` legend without the mark glyph.
- The store outlives the page, so the page calls `SubscriptionStore.refresh()` when it opens over
  figures read earlier. The section skeleton shows until the first answer; a failed read (not a
  `403` or `404`) shows the section's error panel in place, whose `Retry` calls
  `SubscriptionStore.retry()`; a reread keeps the meters shown; a failed refresh keeps them with the
  note `The latest usage could not be loaded. The figures shown may be out of date.` and its own
  `Retry`, which refreshes again. A `403` or `404`, on the first read or on a refresh, shows
  nothing (the figures go), and the workspace recovery leaves the section.
- The export is built in the browser from the rows shown (`utils/usage-csv`): `Section`, `Metric`,
  `Value`, `Limit`, `Usage or change`, one row per meter (storage in gigabytes, guests without a
  limit or share, a share above 100 % written as it is while the gauge stops at its end), with a
  UTF-8 byte order mark and CRLF rows, as the mockup's file. The figures are refreshed first; when
  that fails nothing is written and the refresh note shows. Numbers use
  the locale's decimal separator without grouping; the cells are separated by `;` where that
  separator is a comma (French) and by `,` otherwise. The file is `<slug>-usage-<yyyy>-<mm>.csv`
  for the current month; `Export ready` with `<file> downloaded.`, or `Export not possible`, toasts
  the outcome.
- Below 768 px the header wraps the export button under the title.

### Billing (`billing`, package O3)

- `BillingPage` provides the page-scoped `InvoicesStore` and `BillingCheckoutStore` and reads the
  plan from the shared `SubscriptionStore`. It shows only what the contract serves: the plan card
  (`<plan> plan`, `<used> / <limit>` seats and `<n> available`), the invoices, and on the Free plan
  `Upgrade to the Team plan`. The billing contract has no subscription status, so none shows. The
  plan catalog (`Change plan`), the downgrade, `Manage seats`, the interval badge, the price and
  renewal, the next invoice, the payment method, the billing details and the Stripe customer portal
  (gap B14) are not rendered.
- The section skeleton shows until the organization's first invoices page and its plan answered.
  The first invoices read is the primary read: its failure reaches the route's error boundary,
  whose `Retry` runs the route again and recreates the page's stores. A failed plan read (the
  shared store outlives the page) shows the section's error panel in the plan area with `Retry`,
  which reads the subscription again; a later failed invoices page shows it in place of the table.
  A completed read without invoices shows `No invoices yet`.
- `listBillingInvoices` is read 10 per page by cursor, newest first; the store keeps the cursor of
  each page reached for `Previous`. The reads are keyed by the workspace organization: a switch
  starts at the next organization's first page, never with a cursor of the last one, and shows the
  section skeleton again, even back to an organization answered before, whose first read is then
  again the primary read. Once the person moved between pages, the pagination stays while the
  page opened is read, and the focus moves to the table's caption (`Invoices`), since the pressed
  button is disabled meanwhile. The period names its months in UTC (`November 2026`, `March 2026 –
February 2027`; the contract's end is the start of the next period) and the amount uses the
  currency's own decimals, both in `LOCALE_ID`. A status a later contract adds shows its key. A
  PDF or Checkout address that is not HTTPS is dropped at the boundary; the PDF opens in a new tab.
- A checkout is bound to the organization shown when it starts and to the page: after a switch,
  or once the page is gone, its answer opens nothing and toasts nothing, and the organization pin
  refuses it at the gateway for another session organization. One checkout runs at a time. A
  retry after an unknown outcome (no answer, `5xx`, `429`, `409 idempotency.request-in-progress`)
  sends the same `Idempotency-Key`, so Billing replays the session it may have created; a definite
  refusal drops the key. `409 billing.subscription-active` reads the subscription again. The
  Checkout opens in the same tab through `CHECKOUT_REDIRECT` (`state/billing-checkout`), which
  specs replace.
- Billing keeps a Checkout open for two hours and answers `409 billing.checkout-in-progress` to
  another key meanwhile, so the key outlives the page: `sessionStorage`
  (`cadenway-billing-checkout-key`) holds `{ organizationId, slug, userId, key, createdAt }`, which
  survives the same-tab round trip to Stripe. A checkout of the same person and organization
  within two hours sends that key again, so coming back from a cancelled Checkout replays the open
  session. A definite refusal, `?checkout=success` and two hours drop it; a key of another person
  or organization is never sent. A browser that refuses the storage keeps the key for the page
  only. Follow-up (contract first, `cadenway-api-contracts` then Billing): the two-hour lifetime
  is Billing's behaviour, not yet stated in `startBillingCheckout`; once the contract states it
  (or answers the session's expiry), `CHECKOUT_KEY_LIFETIME_MS` follows it.
- Stripe returns to Billing's configured `BILLING_STRIPE_CHECKOUT_SUCCESS_URL` and
  `BILLING_STRIPE_CHECKOUT_CANCEL_URL`, which carry no organization. The page expects
  `/org/billing?checkout=success` and `/org/billing?checkout=cancel`, which Workspace's slug
  redirect sends to the session's organization, which another tab may have switched. So a
  successful return is matched against the key record: for the organization shown it toasts once,
  removes the parameter and starts the confirmation; for another organization of the same
  person, the page opens `/<recorded slug>/organization/billing?checkout=success` once, where
  the organization guard checks the membership and switches the session; with no record, another
  person's or an expired one, it toasts `This payment was for another organization` and removes
  the parameter. The key is never cleared nor a payment confirmed for an organization other than
  the one shown. A cancelled return toasts and removes the parameter.
- Settlement is asynchronous: after the successful return the page reads the subscription again
  2, 4 and 8 s later (`CHECKOUT_CONFIRM_DELAYS_MS`) until the plan is no longer Free, writing each
  answer into the shared `SubscriptionStore`. Meanwhile `Upgrade` is withheld and
  `Confirming the payment…` shows; a plan still Free after the last read shows
  `The payment is not confirmed yet` with `Retry`, which reads it once more. The wait is
  recorded per organization in `sessionStorage` (`cadenway-billing-payment-pending:<id>`,
  `{ since, unconfirmed }`) until a paid plan is observed or one hour passes, so a reload, a
  visit to another section or a switch back resumes it: the reads, or the note with `Retry`, and
  `Upgrade` stays withheld. A paid plan observed, by these reads or in the shared store, ends the
  wait and reloads the invoices once. The confirmation is bound to its organization and page.
- The page's toasts are dismissed when it is left or the organization changes.
- Below 768 px the invoices become cards (header hidden, number full width, link right) and the
  upgrade button wraps under the plan title.

## Copy not taken word for word from the mockup

| Unit                               | Reason                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `organization.plan-summary.failed` | The mockup draws no failed billing read.                                     |
| `organization.retry`               | `Retry` is the mockup's word, used for a new state.                          |
| `organization.navigation.plan`     | The identity row without the member count, for whoever may not read billing. |

General section (`organization.general.*`):

| Unit                                                                                                            | Reason                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `name-required`, `name-too-long`, `slug-invalid`, `description-too-long`, `website-invalid`, `language-invalid` | The mockup checks no field.                                                             |
| `slug-taken`, `slug-reserved`                                                                                   | Copy of the contract's problems (`organizations.yaml`); the mockup refuses no address.  |
| `conflict`, `conflict-text`, `logo-conflict-text`, `save-failed`                                                | The mockup draws no refused or overtaken save.                                          |
| `language-fr`, `language-de`                                                                                    | Autonyms, the same in every catalog: the English source keeps `Français` and `Deutsch`. |
| `logo-too-large`, `logo-too-large-text`, `logo-invalid`, `logo-invalid-text`, `logo-failed`, `logo-failed-text` | Limits of the contract (`profile-media.yaml`); the mockup draws no refused upload.      |
| `logo-removed-text`                                                                                             | The organization's own initials rather than the mockup's fixed `AN`.                    |
| `refresh-failed`, `refresh-retry`                                                                               | The mockup draws no failed reread after a write.                                        |
| `language-unknown`                                                                                              | A language a later contract adds needs its own state.                                   |
| `loading`                                                                                                       | The mockup's `Chargement de la section` (`Organisation.dc.html` line 74), with this id. |

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

Quotas section (`organization.quotas.*`):

| Unit                                                                          | Reason                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `seats-note-one`                                                              | Singular form of the mockup's plural free seats note.                                       |
| `storage-value`, `storage-note`, `storage-note-high`, `storage-note-critical` | The mockup's texts with the contract's limit in place of its fixed 100 GB.                  |
| `loading`, `failed-title`, `failed-text`, `retry`                             | The mockup's section states (`Organisation.dc.html` lines 73-128), with this section's ids. |
| `meter-free`, `meter-unmeasured`, `meter-threshold`                           | Texts of the `cw-meter` brick, never shown here; the French keeps the brick's defaults.     |
| `refresh-failed`, `refresh-retry`                                             | The mockup draws no failed reread of figures already shown.                                 |

| Unit                                                                                                                                                                                                          | Reason                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `organization.plan-summary.failed`                                                                                                                                                                            | The mockup draws no failed billing read.                                                                          |
| `organization.retry`                                                                                                                                                                                          | `Retry` is the mockup's word, used for a new state.                                                               |
| `organization.navigation.plan`                                                                                                                                                                                | The identity row without the member count, for whoever may not read billing.                                      |
| `organization.security.save-failed`, `organization.security.conflict`, `organization.security.conflict-text`, `organization.security.two-step-not-enabled`, `organization.security.two-step-not-enabled-text` | The mockup applies each control at once and draws no refused save.                                                |
| `organization.security.two-step-saved`                                                                                                                                                                        | The mockup's only policy toast names the session timeout; a two-step change alone needs its own title.            |
| `organization.security.two-step-unknown`, `organization.security.two-step-unknown-choose`                                                                                                                     | The mockup knows only `nobody`, `admins` and `everyone`; a requirement a later contract adds needs its own state. |

Billing section (`organization.billing.*`):

| Unit                                                                                                                                            | Reason                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`                                                                                                                                   | The mockup's subtitle without the payment method, which is not shown, and `de l’organisation <name>` for any name (the mockup elides `d'Atelier Nord`). |
| `upgrade`                                                                                                                                       | The mockup draws the Team plan as current; the upgrade from Free has no button there.                                                                   |
| `seats-free-one`                                                                                                                                | Singular form of the mockup's `<n> disponibles`.                                                                                                        |
| `status-open`, `status-uncollectible`, `status-void`                                                                                            | The mockup draws paid invoices only; the contract has four statuses.                                                                                    |
| `empty-title`, `empty-text`                                                                                                                     | The mockup draws no organization without invoices.                                                                                                      |
| `pagination`, `previous`, `next`                                                                                                                | The mockup's four invoices fit one page.                                                                                                                |
| `plan-loading`, `plan-failed`                                                                                                                   | The mockup draws no plan read apart from the section.                                                                                                   |
| `loading`, `failed-title`, `failed-text`, `retry`                                                                                               | The mockup's section states (`Organisation.dc.html` lines 73-128), with this section's ids.                                                             |
| `already-subscribed`, `already-subscribed-text`, `checkout-in-progress`, `checkout-in-progress-text`, `checkout-failed`, `checkout-failed-text` | The mockup draws no refused checkout.                                                                                                                   |
| `checkout-success`, `checkout-success-text`, `checkout-cancelled`, `checkout-cancelled-text`                                                    | The mockup draws no return from the payment provider.                                                                                                   |
| `confirming`, `unconfirmed`, `unconfirmed-text`                                                                                                 | The mockup draws no payment awaiting Billing's confirmation.                                                                                            |
| `checkout-elsewhere`, `checkout-elsewhere-text`                                                                                                 | The mockup draws no return from the payment provider for another organization.                                                                          |
