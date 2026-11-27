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
| `security`      | `security-page` (`SecurityPage`)           | `Security and sign-in` |                                      |
| `notifications` | `notifications-page` (`NotificationsPage`) | `Notifications`        |                                      |
| `preferences`   | `preferences-page` (`PreferencesPage`)     | `Preferences`          |                                      |
| `api-tokens`    | `api-tokens-page` (`ApiTokensPage`)        | `API tokens`           |                                      |
| `**`            | Errors' `ERRORS_ROUTES` (404 in the shell) |                        |                                      |

- Each page is a stub (WP0 of steps 7 and 8) showing the mockup's section title in the account
  column (`max-w-3xl`); packages A1 to A5 replace them. The stubs read no data, so they have no
  loading, error or empty state yet.
- A failed primary read of a section renders the default error boundary in the shell, titled
  `Could not load this section` by the mounting route's `data`.
- `api-tokens` (package A5) replaces its stub: the page provides `ApiTokensStore` and reads the
  person's tokens of the current organization, with the section skeleton while loading, the
  route's error boundary for a failed read and `No active token` for an empty list.

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
- Auth's `.` entry (`SignOut`), Workspace's `ports/workspace-context`, Errors' `errors.routes`,
  `@core/api` (problem reader), `@core/realtime`, `@core/theme`, `@shared/unsaved-changes`.
- `@cadenway/ui` (`app-rail`, `avatar`, `button`, `dialog`, `input`, `input-otp`, `menu`,
  `password-strength`, `toast`) and `@cadenway/icons`.
- API tokens: `@cadenway/api-client` `ApiTokensService` (`listApiTokens`, `createApiToken`,
  `revokeApiToken`) through `data-access/`, and `@cadenway/ui` `alert-dialog`, `badge`,
  `checkbox`, `empty`, `field`, `input-group`, `select`, `skeleton` and `table`.

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
  person and their presence.
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
  `cw-discard-changes-dialog`. The stub has no form, so it never asks yet; package A1 reports its
  form's dirty state.
- API tokens, list: it follows the cursor and is read again after an organization switch; a
  cursor that does not end within 20 pages, or repeats, fails the read (error boundary and
  `Retry`) rather than show part of the list. The store then keeps it in step with its own
  writes, so a write never sends the page to the error boundary.
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
  dialog has left.
- API tokens, revocation: `Revoke` asks through `cw-alert-dialog`, typing the token's name. Once
  the row left and the confirmation closed, focus moves to the `Revoke` now at its place (or the
  one before it), or to the header's `Create a token` when no token is left.
- API tokens, wording: the last use reads in minutes, hours, then days up to 60, then a date. The
  expiry reads `In n days` up to 90 days (the longest day option), `In n years` when it falls on
  today's calendar date a whole number of years ahead (the `1 year` option), and a date
  otherwise; within 7 days it shows in grenat. Below 768 px the table becomes cards and keeps its
  explicit table, row, column header and cell roles. Known gap: the API usage strip
  (`Compte.dc.html` lines 535-540) is hidden until billing counts API calls (B15).
- Known gap: the mockup's `Set a status message` item and the status message under the header are left out,
  since the backend has no status message yet.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                                                                                              | Reason                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `account.user-menu.label-no-status`                                                                                                                                                                               | The mockup always knows the presence; here it is unknown until the snapshot or a local choice. |
| `account.user-menu.status-unavailable`                                                                                                                                                                            | The mockup has no state without realtime.                                                      |
| `account.user-menu.status-failed`, `account.user-menu.status-failed-text`                                                                                                                                         | The mockup draws no refused presence.                                                          |
| `account.user-menu.sign-out-failed`, `account.user-menu.sign-out-failed-text`                                                                                                                                     | The mockup draws no refused sign-out.                                                          |
| `account.reauthentication.*`                                                                                                                                                                                      | The mockup draws no reauthentication dialog (`auth.yaml` "Recent authentication").             |
| `account.labels.*`                                                                                                                                                                                                | Texts of the password strength and one-time code bricks, worded as Auth's.                     |
| `account.api-tokens.name-required`, `account.api-tokens.name-too-long`, `account.api-tokens.scopes-required`                                                                                                      | The mockup disables `Create the token` instead of showing field errors.                        |
| `account.api-tokens.create-failed`, `account.api-tokens.create-failed-text`, `account.api-tokens.revoke-failed`, `account.api-tokens.revoke-failed-text`                                                          | The mockup draws no refused creation or revocation.                                            |
| `account.api-tokens.revoke-label`                                                                                                                                                                                 | Accessible name of each row's `Revoke`, naming its token.                                      |
| `account.api-tokens.used-days`, `account.api-tokens.expires-days`, `account.api-tokens.expires-years`, `account.api-tokens.used-minutes`, `account.api-tokens.used-hours`                                         | The mockup shows fixed samples; the singular and generic forms follow its wording.             |
| `account.user-menu.avatar-unknown`, `account.user-menu.avatar-online`, `account.user-menu.avatar-away`, `account.user-menu.avatar-dnd`, `account.user-menu.avatar-invisible`, `account.user-menu.avatar-disabled` | Texts of the avatar brick, taken from its defaults.                                            |
