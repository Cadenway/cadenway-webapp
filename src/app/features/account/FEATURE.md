# Account

## Purpose

The account settings and their 5 sections, their settings navigation (the `My account` group of
the account settings and the `Profile and security` link of the organization settings), the
reauthentication every guarded operation of the settings goes through, and the account menu of
the application shell: the rail's account button with the person's presence, the `Status` and
`Theme` submenus, the links to the account sections and `Sign out`. It owns the person's own
presence port (`PRESENCE`). Sign-out itself belongs to Auth; the realtime connection belongs to
`core`; the settings shell and its back link belong to the layout and Workspace.

## Routes

Workspace mounts `ACCOUNT_ROUTES` below `/:org/account`, inside the settings shell. A componentless
parent provides the English texts of `cw-password-strength` and `cw-input-otp` to the sections.

| Path            | Page (`ui/pages/…`)                        | Title                  | Guards                               |
| --------------- | ------------------------------------------ | ---------------------- | ------------------------------------ |
| `''`            | redirects to `profile`                     |                        |                                      |
| `profile`       | `profile-page` (`ProfilePage`)             | `Profile`              | `canDeactivate: unsavedChangesGuard` |
| `security`      | `security-page` (`SecurityPage`)           | `Security and sign-in` | `canDeactivate: unsavedChangesGuard` |
| `notifications` | `notifications-page` (`NotificationsPage`) | `Notifications`        |                                      |
| `preferences`   | `preferences-page` (`PreferencesPage`)     | `Preferences`          |                                      |
| `api-tokens`    | `api-tokens-page` (`ApiTokensPage`)        | `API tokens`           | `canDeactivate: unsavedChangesGuard` |
| `**`            | Errors' `ERRORS_ROUTES` (404 in the shell) |                        |                                      |

- Each page is a stub (WP0 of steps 7 and 8) showing the mockup's section title in the account
  column (`max-w-3xl`); packages A1 to A5 replace them. The stubs read no data, so they have no
  loading, error or empty state yet.
- `notifications` is built (package A3): `NotificationsPage` reads the preferences through its
  page-scoped `NotificationPreferencesStore`, a view over the session-scoped
  `NotificationPreferencesSync`, shows the section skeleton while they load, and its failed read
  reaches the error boundary below.
- A failed primary read of a section renders the default error boundary in the shell, titled
  `Could not load this section` by the mounting route's `data`.
- `profile` (package A1) replaces its stub: the page provides `ProfileStore` and reads the
  account of the session, with the section skeleton while loading and the route's error boundary
  for a failed read.
- `api-tokens` (package A5) replaces its stub: the page provides `ApiTokensStore` and reads the
  person's tokens of the current organization, with the section skeleton while loading, the
  route's error boundary for a failed read and `No active token` for an empty list.
- `preferences` (package A4) replaces its stub: the page reads the account's language through
  the root-scoped `AccountLanguageSync`, with the section skeleton while loading and the route's
  error boundary for a failed read.

- `security` (package A2) replaces its stub: `SecurityPage` provides `SecurityStore`, reads the
  account, its two-step verification and its sessions at once, shows the section skeleton while
  loading and lets a failed read reach the error boundary. `unsavedChangesGuard` waits for a
  write on its way and keeps backup codes shown once.

## Public entry points

| Entry point        | Consumers    |
| ------------------ | ------------ |
| `account.routes`   | workspace    |
| `providers`        | workspace    |
| `ports/presence`   | inbox        |
| `reauthentication` | organization |

- `providers` publishes `withUserMenu()` (the `railFooter` contribution, order 20),
  `providePresence()`, which provides `PRESENCE` on the `/:org` route, and for the settings
  shell routes `withAccountSettingsNavigation()` (`settingsNavigation`, order 10, the account
  settings), `withAccountSettingsLink()` (`settingsNavigation`, order 20, the organization
  settings), `provideReauthentication()` and `withReauthenticationDialog()` (`overlays`, order 30).
- `reauthentication` publishes `ReauthenticationService` and `ReauthenticationCancelledError`.
  `run(operation)` calls a guarded operation; when it rejects with
  `403 auth.reauthentication-required`, the dialog asks for what `details.methods` lists (the
  authenticator code when it lists `authenticator-app`, otherwise the password; unknown methods are
  ignored), `AuthService.reauthenticate` opens the 10-minute window, and the operation runs once
  more, whose result or rejection `run` returns. Closing the dialog rejects with
  `ReauthenticationCancelledError`, which the caller shows nothing for. The service is provided by
  `provideReauthentication()` on the settings route, so the pages below it and the dialog share it.
- `ports/presence` publishes `PRESENCE` (`PresencePort`: `ownStatus`, `setPresence`) and
  `PresenceStatus` (re-exported from `@core/realtime`), the subset of `RealtimeConnection` the
  shell needs.

## Dependencies

- `@cadenway/api-client`: `AuthService.reauthenticate` through `data-access/`.
- `@cadenway/api-client`: `NotificationPreferencesService.getNotificationPreferences` and
  `updateNotificationPreferences`, each after `AuthService.getCurrentUser` under Auth's
  `withSessionLock` (`notifications`), through `data-access/`; `@cadenway/ui` `card`,
  `checkbox`, `radio-group`, `skeleton`, `switch` and `table` for that section.
- Auth's `.` entry (`SignOut`, `withSessionLock`), Workspace's `ports/workspace-context`, Errors' `errors.routes`,
  `@core/api` (problem reader), `@core/realtime`, `@core/theme`, `@shared/unsaved-changes`.
- `@cadenway/ui` (`app-rail`, `avatar`, `button`, `dialog`, `input`, `input-otp`, `menu`,
  `password-strength`, `toast`) and `@cadenway/icons`.
- API tokens: `@cadenway/api-client` `ApiTokensService` (`listApiTokens`, `createApiToken`,
  `revokeApiToken`) through `data-access/`, and `@cadenway/ui` `alert-dialog`, `badge`,
  `checkbox`, `empty`, `field`, `input-group`, `select`, `skeleton` and `table`.
- Preferences: `@cadenway/api-client` `AuthService.getCurrentUser` and `updateCurrentUser`
  (`language`) under Auth's `withSessionLock`, through `data-access/`; `@core/locale`
  (`LocaleService`); `@cadenway/ui` `card`, `radio-group`, `select` and `skeleton`.

- Security: `@cadenway/api-client` `AuthService.getCurrentUser`, `AccountService.changePassword`,
  `TwoStepVerificationService` (read, disable, authenticator setup and confirmation, backup
  codes, security key registration, addition and removal) and `SessionsService`
  (`listSessions`, `revokeSession`, `revokeOtherSessions`), each after `getCurrentUser` under
  Auth's `withSessionLock`, through `data-access/`; `@simplewebauthn/browser` for the key
  ceremony; `@cadenway/ui` `alert`, `alert-dialog`, `badge`, `card`, `dialog`, `input`,
  `input-otp`, `password-strength` and `skeleton`.

- Profile: `AuthService` (`getCurrentUser`, whose first read of the page takes the workspace
  guard's answer of the same navigation when it is at most 2 s old through Core's
  `REUSE_READ_WITHIN_MS`, while every write checks the session afresh; `updateCurrentUser`),
  `AccountService`
  (`requestEmailChange`, `confirmEmailChange`, `scheduleAccountDeletion`), the avatar operations
  of `ProfileMediaService` (`getAvatar`, `startAvatarUpload`, `setAvatar`, `deleteAvatar`) and
  `OrganizationsService.listMyOrganizations`, through `data-access/`; Workspace's
  `ports/workspace-refresh`; Auth's `SignOut`; `@cadenway/ui` `alert`, `alert-dialog`, `card`,
  `combobox`, `dialog`, `input-group`, `input-otp`, `radio-group`, `skeleton` and `spinner`.

## Invariants

- `providePresence()` binds `PRESENCE` to the workspace's `RealtimeConnection` (provided by
  Workspace's runtime on `/:org`). `ownStatus` is null until the presence snapshot returns the
  saved preference or the person chooses a presence in this tab. Until then the rail button names the person only, the presence dots are hidden and `Status` checks nothing.
- Choosing a presence closes the menu and confirms with the toast `Status: <presence>` (`account.user-menu.status-toast`). When the
  gateway refuses it and `ownStatus` returns to the confirmed value, an error toast says so.
- When realtime is disabled (`status()` is `disabled`, no `realtimeUrl`), `Status` is disabled with
  `Unavailable` (`account.user-menu.status-unavailable`) and nothing is set or confirmed.
- The menu is a slot contribution acting as a container: it injects `WORKSPACE_CONTEXT`, `PRESENCE`,
  the router and the toasts; `PresenceDot` stays presentational.
- The rail's account button has no tooltip (mockup lines 63-66); its accessible name names the
  person and their presence. Its avatar's presence dot is ringed with the rail's canvas
  (`ring="canvas"`), the menu header's with the popover (`ring="popover"`, lines 66 and 95).
- `Status` and `Theme` show their current value in `cw-menu-item-value`, next to the submenu
  chevron (lines 106 and 121).
- The theme submenu drives `ThemeService`; the transition spreads from the account button.
- A refused sign-out keeps the page and shows an error toast.
- The account settings navigation lists the 5 sections in the mockup's order
  (`Compte.dc.html` lines 1455-1461); the current one carries `aria-current="page"`, the violet
  tint and the Fill icon (lines 1518-1524). The links wrap in rows below 768 px. The settings
  shell has no `cw-sidebar`, so the items are links styled as the mockup draws them, not
  `cwSidebarItem`, which requires one.
- The reauthentication dialog submits with Submit enabled while invalid (the field error shows and
  the field takes focus), cannot be closed while its answer is checked, and keeps the reason of a
  refused answer: `Incorrect password.` (with the attempts left when known),
  `Incorrect or already used code.` (with the attempts left when known), the 15-minute lockout or
  an unavailable gateway, and takes focus back to the field; Confirm shows its spinner (`loading`)
  while the answer is checked and keeps focus. A `401` on `reauthenticate` cancels the waiting
  operations and opens `/login?next=<current address>`. A `403` with
  other methods (a password sent for an account with two-step verification) or
  `409 auth.two-step-not-enabled` switches what it asks for. Operations refused while it is open
  wait for the same confirmation.
- `profile` keeps unsaved edits through `unsavedChangesGuard`; its page asks with Workspace's
  `cw-discard-changes-dialog` while its form differs from the saved account (see Profile).
- API tokens, list: it follows the cursor and is read again after an organization switch; a
  cursor that does not end within 20 pages, or repeats, fails the read (error boundary and
  `Retry`) rather than show part of the list. The store keeps its own confirmed writes over the
  read list until a read issued after them lands, so neither a reload in progress (an A, B, A
  switch) nor an older read hides them, and a write never sends the page to the error boundary.
- API tokens, organization: a creation or a revocation acts in the organization the workspace
  showed when it started. Before each send, the retry after a reauthentication included, the
  store checks that the workspace still shows it and otherwise stops silently; the requests
  carry `If-Organization-Match` (`ORGANIZATION_PIN_OPERATIONS` lists the 3 operations), and a
  refusal of the pin (`412 organization.context-changed`, a switch in progress) stops silently
  too. A `404` counts as revoked only for `api-token.not-found` while the organization is
  unchanged.
- API tokens, creation: `Create the token` stays enabled while the form is invalid (blank name,
  more than 100 characters, no scope) and runs through `ReauthenticationService.run`; a closed
  reauthentication dialog creates nothing and shows nothing. The secret is held only in the
  store's memory, shown once read-only with `Copy the token`, never logged, persisted or put in
  a toast. Focus moves to it when the step appears; a backdrop click no longer closes the dialog
  then. The step stays on screen during the exit animation and the secret is cleared once the
  dialog has left. A creation whose answer is lost (no status, a timeout, a `5xx`) may have
  created the token: the list is read again; a new token of that name is highlighted, the dialog
  closes and a warning asks to revoke it, since its secret is gone; otherwise a warning says the
  token may not have been created. A refusal (`4xx`) shows the failure toast. The contract
  declares no `Idempotency-Key` for `createApiToken`, so none is sent. Leaving the page waits for
  a creation in progress (`unsavedChangesGuard`); once it settles the person leaves, unless it
  brought a secret, which keeps the page until `I have copied the token`; the browser asks before
  closing the tab meanwhile.
- API tokens, revocation: `Revoke` asks through `cw-alert-dialog`, typing the token's name. Once
  the row left and the confirmation closed, focus moves to the `Revoke` now at its place (or the
  one before it), or to the header's `Create a token` when no token is left.
- API tokens, wording: the last use reads in minutes, hours, then days up to 60, then a date. The
  expiry reads `In n days` up to 90 days (the longest day option), `In n years` when it falls on
  today's calendar date a whole number of years ahead (the `1 year` option), and a date
  otherwise; within 7 days it shows in grenat. Below 768 px the table becomes cards and keeps its
  explicit table, row, column header and cell roles; its header row stays for screen readers only
  (`sr-only`). Known gap: the API usage strip
  (`Compte.dc.html` lines 535-540) is hidden until billing counts API calls (B15).

- `notifications` (`Compte.dc.html` lines 355-403): the `Events` matrix (7 events × in the app,
  email, mobile, each box named `<event> in the app | by email | on mobile`), `Email summary`
  and `Do not disturb`. Every change shows at once and saves with no Save and no success toast.
  The mention hint names the display name, or the first name without one, as a mention does.
  Below 768 px the matrix becomes cards (the mockup's `.cw-cards` rule), each box followed by its
  channel's name as a `label` of the box, so tapping the name toggles it.
- `NotificationPreferencesSync` (`services/notification-preferences-sync`, root-scoped
  `@Service()`) holds the notification preferences for the browser session: the newest confirmed
  preferences, the pending changes and the write queue, shared by every instance of the page.
  `NotificationPreferencesStore` (page-scoped on `NotificationsPage`) is a view over it, bound
  to `WORKSPACE_CONTEXT`'s user: its read starts from the sync's confirmed preferences while
  writes are pending, so a reopened page shows the pending choices, and the writes still queued
  when the page closes are sent.
  - Binding another account resets the sync: unsent changes are dropped and late answers are
    ignored. Each read and write first checks the session's account (`getCurrentUser`) under the
    exclusive or shared session lock that sign-in and sign-out take; a session held by another
    account or none (`401`) stops the sync the same way, so nothing is sent to another account
    and no `412` is retried there.
  - Writes run in the order of the changes, one at a time, each a merge patch of one setting
    with `If-Match` on the newest confirmed version; a later change of a setting replaces a
    pending one, and a setting turned back to its confirmed value sends nothing.
  - `412 request.version-mismatch` adopts the preferences read again as the confirmed ones and
    resends the setting once against them, unless they already hold it.
  - A write without a known outcome (no answer, a timeout, a `5xx`) reads the preferences again:
    when they hold the change it counts as saved; otherwise the write itself is resent once
    against the version read, since the first one may still land after that read (a `412` on
    the resend is settled by a last read).
  - Only a refused write, or a resend that still fails, restores the confirmed value of its
    setting (unless it was changed again since) and shows `Could not save`, replacing the
    previous failure toast; when the outcome stays unknown, the next write reads first.
- Known gap: the mockup's `Set a status message` item and the status message under the header are left out,
  since the backend has no status message yet.
- `preferences` (`Compte.dc.html` lines 405-505): the `Theme` cards drive `ThemeService` at once,
  the transition spreading from the chosen card, and stay per device. `Language` is the account's
  (`updateCurrentUser` with `If-Match` on the account version, after the same account check under
  the session lock as the notification preferences).
  - `AccountLanguageSync` (`services/account-language-sync`, root-scoped `@Service()`, bound to
    `WORKSPACE_CONTEXT`'s user through the page's read) holds the confirmed language, the latest
    pick and the save run, so a save outlives the page: once confirmed, the application reloads
    in the pick's locale with `LocaleService.use` (`?lang=`) when that locale is not the one shown
    (German and Spanish show English), even after the page closed, and otherwise confirms with
    `Preference saved`. Binding another account, or a session held by another account or none,
    resets it silently. Each run belongs to its binding and writes for that binding's account
    only, so a pick on a new account is saved even while the old account's run is still pending.
  - Picks save one at a time, the latest winning, with `If-Match` on the confirmed version.
  - A write without a known outcome may still land, so no read settles it, whatever it shows: the
    state turns uncertain and is fenced. The account is read for its current version and the
    latest pick is sent again with `If-Match` on it, even when the read already shows it, so a
    late earlier write fails on its stale version. A fencing write refused with `412` reads and
    fences again, at most 3 attempts, after 2, 4 and 8 s when the previous one got no answer; a
    first write refused with `412` is fenced the same way. Only a `2xx` on a fencing write
    settles the state; otherwise a neutral `Could not confirm the language` note with `Retry`
    shows, and the cached language is never taken as confirmed.
  - Only a first write refused for certain (a `4xx` other than `412`, while the state is certain)
    puts the confirmed language back with `Could not save`; when an earlier pick of the same run
    was saved, that pick's locale is applied.
  - Known gaps: the date format, the week start and the `Display and accessibility` card are
    hidden until the account stores them (B9); the application does not apply the account's
    language on load.

### Profile (`profile`, package A1)

- `ProfilePage` provides the page-scoped `ProfileStore` and shows the parts the contract serves
  (`Compte.dc.html` lines 139-265): `Photo`, `Personal information`, `Status and availability`
  and `Delete my account`. The status message, its icon, its suggestions and `Clear after`
  (lines 226-258, gap B3) are not rendered.
- The read of the account is the primary read, keyed by `WORKSPACE_CONTEXT`'s user; its failure
  reaches the route's error boundary. It checks, under Auth's shared session lock, that the
  session still holds that account; so do the photo and the organizations reads. The photo is a
  secondary read keyed by `<account id>:<avatar id>`; its object URL is revoked once replaced, as
  soon as the account has no photo, and with the page; without a photo, or when its image cannot
  be read, the round tile shows the initials of the saved name, and a failed read shows
  `The photo could not be loaded.` with `Retry`, which reads it again.
- The draft is kept apart from the saved account it started from. When a read brings a newer
  account (after a photo change, a stale version, a confirmed address), each field the person
  changed keeps their edit and every other field takes the new value; a field someone else
  changed to another value toasts the conflict (instead of the photo's success). The draft starts
  over only after a successful save, `Cancel`, or for another account. A reread after a write that
  fails never reaches the error boundary: the last confirmed account and the draft stay, and an
  alert says the profile could not be refreshed, with `Retry`.
- `Save` sends only what changed (the name trimmed, an empty display name or job title as `null`)
  from the version read (`If-Match`). The form checks the contract's rules first (a name of 1 to
  120 characters, a display name of 60 at most, a job title of 120 at most, a time zone); an
  invalid submit shows the errors and focuses the first. A `400 request.invalid` issue on a field
  shows on it; `412 request.version-mismatch` reads the account again, merges and toasts the
  conflict. A successful save, like a confirmed address, asks Workspace to verify the person again
  (`WORKSPACE_REFRESH`), so the shell shows the new name.
- A write whose answer is lost (no status, `408`, `5xx`: a save, the photo's publication or
  removal, the address confirmation) may still land after a first reread, so the account is read
  at once, then 2, 4 and 8 s later, and the write counts as done once the account holds it. For
  the photo that is the reference this write sets, never another one a concurrent change brought:
  a publication sets the reserved upload's id, which the contract reuses for the published asset
  (`ProfileMediaId`), and a removal sets none. When none of the rereads holds it, the outcome stays
  unconfirmed: a save keeps the draft unsaved with `Your change could not be confirmed.`, a photo
  change and an address confirmation toast that they could not be confirmed; nothing reports a
  failure. When no reread succeeds, the refresh alert shows.
- `Time zone` is a searchable `cw-combobox` of every IANA zone the browser knows (plus the saved
  one, and `UTC`, which some browsers leave out), each labelled with its current offset as the
  mockup writes it (`Europe/Paris (UTC+1)`).
  The address shows read-only with a static `Verified` badge: the contract has no verification
  flag, and an unverified address cannot sign in.
- The photo applies at once: a PNG, JPEG or WebP of 1 byte to 5 MiB is reserved
  (`Idempotency-Key`), sent to its signed destination with its fields first, then published with
  `If-Match`; a transfer that ends without telling its outcome (no status, `408`, `5xx`) publishes
  the same upload once before failing. `Remove` deletes it with `If-Match`. Each change then reads the account again. Other
  types, an empty or too large file and an image storage refuses toast why; once a change ended,
  the file input takes the focus.
- One write runs at a time (a save, a photo change, the deletion). Every write is bound to the
  account shown when it starts and to the page: once either changes it sends nothing more and
  drops any late answer. The data access also checks, under the exclusive session lock, that the
  session still holds the account before each write (`AccountChangedError` otherwise). Leaving
  while a save or a photo change is on its way waits for it (a photo change the page left would be
  dropped), then leaves once nothing is unsaved or asks otherwise.
- `Status and availability`: four radio cards (`Active`, `Do not disturb`, `Away`, `Invisible`)
  follow `PRESENCE.ownStatus` (nothing checked while unknown). A pick applies at once and toasts
  `Status: <presence>`. `PRESENCE` reports no acknowledgement of the gateway, so a refusal is
  inferred: only when `ownStatus` returns to the presence before a pick made on this page within
  10 s does an error toast say the gateway refused it; any other change, or one after that window
  (another tab, the presence snapshot), ends the watch silently. While realtime is off the cards
  are disabled with a hint.
- `Change the address` opens `EmailChangeDialog` (lines 593-635), two steps with their bars. The
  address is checked as the mockup does (format, not the current address), then the code request
  runs through `ReauthenticationService` (a closed reauthentication keeps the step). The gateway's
  refusals show on the field: the current address, an address another account uses (kept until
  it changes) and a throttled address; a throttled address the dialog's code already went to
  shows the second step again, counting down to the gateway's `details.resendAvailableAt`. The second step takes the 3 + 3 code, counts down to the
  gateway's `resendAvailableAt` before `Resend the code` (which asks again for the same address),
  and goes back with `Use another address`. A wrong or expired code shows on the field; an address
  taken meanwhile goes back to the first step with that error. Closing the dialog forgets the code
  typed.
- `Delete the account` first reads the person's organizations (every page; a failed read toasts
  and opens nothing), then asks through `cw-alert-dialog`: `You will leave <n> organizations.` and
  `<names> must first have another owner.` for those owned, typing the saved name. The deletion
  runs through the reauthentication. Only the gateway's answer decides it: a deletion whose answer
  is lost stays unconfirmed, without a reread, since it may still commit after any reread and a
  session that no longer reads the account (`401 auth.session-expired`) may have ended for another
  reason. The confirmation closes and a warning says how to know: a scheduled deletion ends this
  session and sends an email, and signing in again cancels it. Once scheduled, the page lets the
  navigation go without asking and signs out through Auth's `SignOut`, which opens the signed-out screen (`/logged-out?reason=signed-out`,
  and when the sign-out request fails, `SignOut.leaveLocally()` forgets the person's device data
  and opens it all the same, the gateway having ended the session already).
  `409 account.organization-owner` closes the
  confirmation and toasts the organizations to hand over, named from `details.organizationIds`.
  The mockup's count of the API tokens revoked (line 1543) is left out: tokens are listed per
  organization, so the page cannot count them all.
- Below 768 px the fields and the status cards take one column; the photo row, the address row
  and the footer wrap.

### Security (`security`, package A2)

- `security` (`Compte.dc.html` lines 267-353, dialogs 578-591, 637-693) shows the `Password`
  card, `TwoStepCard` and `SessionsList`. The `Sign-in providers` card is not rendered: the
  contract has no linked providers yet (gap B8). Sessions show the address only: the contract
  derives no place from it.
- `SecurityStore` (page-scoped on `SecurityPage`) reads the section as one primary read keyed
  by `WORKSPACE_CONTEXT`'s user, so a page reused for another account reads that one's. Its
  writes run one at a time through `ReauthenticationService.run`; each is bound to the account
  shown when it starts and to the page: once either changes, nothing more is sent (the retry
  after a reauthentication included), the answer is dropped and nothing is toasted.
  `SecurityApi` also checks the session's account (`getCurrentUser`) under the session lock
  before every read and write, so nothing reaches another account signed in from another tab.
  A confirmed write applies its answer to the read: the password date, two-step verification
  on or off, the keys, the backup codes left, the sessions. A key or session already gone
  (`404`) counts as removed.
- A write whose answer was lost (no status, `408`, `5xx`) may have been applied, or may still
  be, so it is never sent again: the section is read again as a secondary read (never through
  the error boundary) at once, then 2, 4 and 8 seconds later (`SECURITY_REREAD_DELAYS`), until a
  read shows the write; each read that answers replaces the one shown. A newer password date
  means the password changed; two-step verification now on means the setup committed, its codes
  unseen; now off means it was turned off; a newer generation date means the codes were
  replaced unseen; the key or session gone means it was removed; a key not shown before means
  it was registered; no other session left means they were closed. When no read shows it, the
  write is unconfirmed, never failed: a warning says so and stays until closed, with
  `Generate new codes` when backup codes may have changed (also when they were replaced
  unseen); the password dialog closes so the old current password is not sent again. A failure
  before the write was sent (the session lock, the account check, the start of a key
  registration) is a plain failure, with no read again.
- Leaving waits for a write on its way (`sending`, which lasts until its result is settled, the
  reread of a lost answer included; not a write waiting only for the reauthentication dialog),
  then for the page's own generation or confirmation to receive its codes, then leaves unless
  backup codes show; the browser asks before closing the tab meanwhile.
- Once a removed key or a revoked session left and the confirmation closed, focus moves to the
  `Remove` or `Revoke` now at its place (or the one before it), otherwise to `Add a key` or the
  two-step card's button, or to `Sign out the others` (the sessions card's title when it is
  disabled).
- Secrets: passwords live in the password form only and are cleared at each opening and once
  the dialog has left; the authenticator key and the backup codes are returned by the store to
  the page, held in page signals while their dialog shows, and forgotten once it has left.
  None reaches the store's state, a toast or a log; the `otpauth` address is not kept.
- Password: `Change password` stays enabled while the form is invalid (no current password,
  fewer than 12 characters, `The two passwords do not match.`); the strength meter is advisory,
  since the contract sets no composition rule. `auth.password-incorrect` (with the attempts
  left), `auth.account-locked`, `auth.password-too-short` and `auth.password-compromised` show
  under their field until it changes; another failure toasts and keeps the dialog.
- Two-step verification: the design system has no QR code brick, so the setup's step 1 shows
  the key only, grouped by 4, with `Copy the key` (copied without spaces). Step 3 shows the
  first backup codes with `Copy` and `Download`; a reconfiguration, which keeps the codes,
  closes the dialog with its own toast. A refused code stays inline until the code changes; an
  expired setup closes the dialog. While an organization requires two-step verification,
  `Turn off` is disabled and described by the requirement line; the workspace organization is
  named, other organizations are counted. `Turn off`, `Remove` and both session revocations ask
  through one `cw-alert-dialog`. Requirements, primary methods and device types a later contract
  adds are shown without a role, without `primary method` and as an unknown device.
- Security keys need WebAuthn to be added: without it (`browserSupportsWebAuthn()`), only
  `Add a key` is left out, so registered keys stay listed and removable, and the row shows only
  when keys exist. `Add a key` asks for the name the contract requires (not drawn by the
  mockup), then the gateway's options, the browser's prompt and the registration; a closed
  prompt keeps the name dialog silently.
- Backup codes download as `cadenway-backup-codes.txt` (`cadenway-codes-de-secours.txt` in
  French) with the mockup's header naming the account and the generation date, through a
  temporary object URL revoked a second later.
- Below 768 px the rows wrap (`flex-wrap`), as the mockup draws them; dialogs take the brick's
  phone width.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                                                                                                                                                                                                                   | Reason                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `account.user-menu.label-no-status`                                                                                                                                                                                                                                                                                                    | The mockup always knows the presence; here it is unknown until the snapshot or a local choice. |
| `account.user-menu.status-unavailable`                                                                                                                                                                                                                                                                                                 | The mockup has no state without realtime.                                                      |
| `account.user-menu.status-failed`, `account.user-menu.status-failed-text`                                                                                                                                                                                                                                                              | The mockup draws no refused presence.                                                          |
| `account.user-menu.sign-out-failed`, `account.user-menu.sign-out-failed-text`                                                                                                                                                                                                                                                          | The mockup draws no refused sign-out.                                                          |
| `account.reauthentication.*`                                                                                                                                                                                                                                                                                                           | The mockup draws no reauthentication dialog (`auth.yaml` "Recent authentication").             |
| `account.labels.*`                                                                                                                                                                                                                                                                                                                     | Texts of the password strength and one-time code bricks, worded as Auth's.                     |
| `account.api-tokens.name-required`, `account.api-tokens.name-too-long`, `account.api-tokens.scopes-required`                                                                                                                                                                                                                           | The mockup disables `Create the token` instead of showing field errors.                        |
| `account.api-tokens.create-failed`, `account.api-tokens.create-failed-text`, `account.api-tokens.create-unknown`, `account.api-tokens.create-unknown-text`, `account.api-tokens.created-without-secret`, `account.api-tokens.created-without-secret-text`, `account.api-tokens.revoke-failed`, `account.api-tokens.revoke-failed-text` | The mockup draws no refused creation or revocation.                                            |
| `account.api-tokens.revoke-label`                                                                                                                                                                                                                                                                                                      | Accessible name of each row's `Revoke`, naming its token.                                      |
| `account.api-tokens.used-days`, `account.api-tokens.expires-days`, `account.api-tokens.expires-years`, `account.api-tokens.used-minutes`, `account.api-tokens.used-hours`                                                                                                                                                              | The mockup shows fixed samples; the singular and generic forms follow its wording.             |
| `account.user-menu.avatar-unknown`, `account.user-menu.avatar-online`, `account.user-menu.avatar-away`, `account.user-menu.avatar-dnd`, `account.user-menu.avatar-invisible`, `account.user-menu.avatar-disabled`                                                                                                                      | Texts of the avatar brick, taken from its defaults.                                            |

| Unit                                                                                                                                                                                                              | Reason                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `account.user-menu.label-no-status`                                                                                                                                                                               | The mockup always knows the presence; here it is unknown until the snapshot or a local choice. |
| `account.user-menu.status-unavailable`                                                                                                                                                                            | The mockup has no state without realtime.                                                      |
| `account.user-menu.status-failed`, `account.user-menu.status-failed-text`                                                                                                                                         | The mockup draws no refused presence.                                                          |
| `account.user-menu.sign-out-failed`, `account.user-menu.sign-out-failed-text`                                                                                                                                     | The mockup draws no refused sign-out.                                                          |
| `account.reauthentication.*`                                                                                                                                                                                      | The mockup draws no reauthentication dialog (`auth.yaml` "Recent authentication").             |
| `account.labels.*`                                                                                                                                                                                                | Texts of the password strength and one-time code bricks, worded as Auth's.                     |
| `account.notifications.save-failed`, `account.notifications.save-failed-text`                                                                                                                                     | The mockup draws no refused save; the section saves at once.                                   |
| `account.preferences.lead`, `account.preferences.saved-text`                                                                                                                                                      | The theme stays per device and the accessibility settings are hidden (B9).                     |
| `account.preferences.language-unknown`, `account.preferences.save-failed`, `account.preferences.save-failed-text`                                                                                                 | The mockup draws no unknown language and no refused save.                                      |
| `account.preferences.unconfirmed`, `account.preferences.unconfirmed-text`, `account.preferences.unconfirmed-retry`                                                                                                | The mockup draws no save whose outcome stays unknown.                                          |
| `account.user-menu.avatar-unknown`, `account.user-menu.avatar-online`, `account.user-menu.avatar-away`, `account.user-menu.avatar-dnd`, `account.user-menu.avatar-invisible`, `account.user-menu.avatar-disabled` | Texts of the avatar brick, taken from its defaults.                                            |

Profile section (`account.profile.*`):

| Unit                                                                                                                                                                            | Reason                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `name-required`, `name-too-long`, `display-name-too-long`, `job-title-too-long`, `time-zone-invalid`                                                                            | The mockup checks no field.                                                                                                   |
| `time-zone-placeholder`, `time-zone-search`, `time-zone-empty`, `time-zone-results`                                                                                             | Texts of the combobox brick; the mockup's select has 4 options and no search.                                                 |
| `save-failed`, `save-failed-text`, `conflict`, `conflict-text`, `photo-conflict-text`                                                                                           | The mockup draws no refused or overtaken save.                                                                                |
| `photo-too-large`, `photo-too-large-text`, `photo-invalid`, `photo-invalid-text`, `photo-failed`, `photo-failed-text`                                                           | Limits of the contract (`profile-media.yaml`); the mockup draws no refused upload.                                            |
| `refresh-failed`, `refresh-retry`                                                                                                                                               | The mockup draws no failed reread after a write.                                                                              |
| `status-failed`, `status-failed-text`, `status-unavailable`                                                                                                                     | The mockup draws no refused presence and no state without realtime.                                                           |
| `save-unconfirmed`, `photo-unconfirmed`, `photo-unconfirmed-text`, `email-change-unconfirmed`, `email-change-unconfirmed-text`, `delete-unconfirmed`, `delete-unconfirmed-text` | The mockup draws no write whose answer was lost.                                                                              |
| `photo-load-failed`, `photo-retry`                                                                                                                                              | The mockup draws no failed read of the photo; `Retry` is the mockup's word.                                                   |
| `email-taken`, `email-throttled`, `code-required`, `code-wrong`, `code-send-failed`, `code-send-failed-text`, `email-change-failed`, `email-change-failed-text`                 | Refusals of the contract (`auth.yaml`); `code-wrong` is Auth's wording of the same refusal, `email-throttled` the contract's. |
| `email-back`                                                                                                                                                                    | The mockup's line 626 wording, with an English source distinct from `email-change`.                                           |
| `delete-leave-one`, `delete-owner-other`                                                                                                                                        | The mockup's sentences for one organization left and several owned.                                                           |
| `delete-check-failed`, `delete-check-failed-text`, `delete-owner-failed`, `delete-owner-failed-text`, `delete-owner-failed-any`, `delete-failed`, `delete-failed-text`          | The mockup draws no refused deletion.                                                                                         |
| `delete-confirm-label`                                                                                                                                                          | The brick shows the name after its label, so the end of the mockup's label (line 750) is left out.                            |
| `loading`                                                                                                                                                                       | The mockup's skeleton label (`Compte.dc.html` line 83), with this id.                                                         |

Security section (`account.security.*`):

| Unit                                                                                                                                                                                                                                                                                                                   | Reason                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `keys-list`, `key-added-used`, `key-added-unused`, `key-remove`, `key-remove-label`, `remove-key-title`, `remove-key-description`, `key-removed`, `key-removed-text`, `key-remove-failed`                                                                                                                              | The mockup draws no list of keys and no removal; the contract has both.                                               |
| `key-name-title`, `key-name-description`, `key-name-label`, `key-name-placeholder`, `key-name-required`, `key-name-too-long`                                                                                                                                                                                           | The contract requires a key name the mockup does not ask for (`auth.yaml` "Nom de la clé").                           |
| `key-failed`, `key-refused`, `key-expired`, `key-limit`                                                                                                                                                                                                                                                                | The mockup draws no refused key.                                                                                      |
| `keys-summary` (`=0`, `=1`)                                                                                                                                                                                                                                                                                            | Singular and empty forms of the mockup's `N clés : …`.                                                                |
| `session-active-minutes`, `session-active-days` (`=1`), `sessions-timeout-*`                                                                                                                                                                                                                                           | The mockup shows fixed samples; the other units follow its wording.                                                   |
| `sessions-empty`, `session-unknown-device`, `session-revoke-label`                                                                                                                                                                                                                                                     | States and accessible names the mockup does not draw.                                                                 |
| `sessions-closed-one`, `session-revoke-failed`, `sessions-close-failed`                                                                                                                                                                                                                                                | Singular form, and refusals the mockup does not draw.                                                                 |
| `two-step-required-everyone`, `two-step-required-unknown`, `two-step-required-others`                                                                                                                                                                                                                                  | The mockup knows only the workspace organization's requirement for administrators.                                    |
| `app-configured`                                                                                                                                                                                                                                                                                                       | The mockup's line without ` · méthode principale`, for another primary method.                                        |
| `setup-key-hint`                                                                                                                                                                                                                                                                                                       | No QR code brick yet: the setup shows the key only, so the mockup's `Scannez ce code…` does not apply.                |
| `setup-code-invalid`, `setup-code-required`, `setup-expired`, `setup-expired-text`, `setup-failed`, `setup-confirm-failed`                                                                                                                                                                                             | The mockup draws no refused or expired setup.                                                                         |
| `app-replaced`, `app-replaced-text`                                                                                                                                                                                                                                                                                    | The mockup draws no reconfiguration, which keeps the backup codes.                                                    |
| `backup-download`                                                                                                                                                                                                                                                                                                      | The mockup offers no download at the setup's step 3; the codes must be saved there too.                               |
| `backup-dialog-description` (`=0`, `=1`)                                                                                                                                                                                                                                                                               | Singular and generic forms of `Les 7 codes précédents ne fonctionnent plus.`                                          |
| `codes-failed`, `password-failed`, `two-step-disable-failed`, `try-again`                                                                                                                                                                                                                                              | The mockup draws no failed write.                                                                                     |
| `codes-file`                                                                                                                                                                                                                                                                                                           | English source file name; the French one is the mockup's.                                                             |
| `password-current-required`, `password-too-short`, `password-compromised`, `password-incorrect`, `password-incorrect-attempts`, `password-locked`                                                                                                                                                                      | The mockup disables `Modifier le mot de passe` and draws no refusal; the wording follows the reauthentication dialog. |
| `disable-title`, `disable-description`, `disable-confirm`, `two-step-disabled`, `two-step-disabled-text`, `two-step-still-required`, `two-step-still-required-text`                                                                                                                                                    | The mockup turns two-step verification off with no confirmation, toast or refusal.                                    |
| `password-unconfirmed`, `password-unconfirmed-text`, `setup-unconfirmed`, `setup-unconfirmed-text`, `two-step-enabled-unseen`, `two-step-enabled-unseen-text`, `codes-unseen`, `codes-unseen-text`, `codes-unconfirmed`, `codes-unconfirmed-text`, `two-step-disable-unconfirmed`, `two-step-disable-unconfirmed-text` | The mockup draws no lost answer; these warnings follow the read again of the section.                                 |
| `key-unconfirmed`, `key-unconfirmed-text`, `key-remove-unconfirmed`, `key-remove-unconfirmed-text`, `session-revoke-unconfirmed`, `session-revoke-unconfirmed-text`, `sessions-close-unconfirmed`, `sessions-close-unconfirmed-text`                                                                                   | The mockup draws no lost answer; these neutral warnings follow the reads again of the section.                        |
