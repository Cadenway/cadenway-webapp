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
- `notifications` is built (package A3): `NotificationsPage` reads the preferences through its
  page-scoped `NotificationPreferencesStore`, shows the section skeleton while they load, and its
  failed read reaches the error boundary below.
- A failed primary read of a section renders the default error boundary in the shell, titled
  `Could not load this section` by the mounting route's `data`.

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
  `updateNotificationPreferences` (`notifications`) through `data-access/`; `@cadenway/ui`
  `card`, `checkbox`, `radio-group`, `skeleton`, `switch` and `table` for that section.
- Auth's `.` entry (`SignOut`), Workspace's `ports/workspace-context`, Errors' `errors.routes`,
  `@core/api` (problem reader), `@core/realtime`, `@core/theme`, `@shared/unsaved-changes`.
- `@cadenway/ui` (`app-rail`, `avatar`, `button`, `dialog`, `input`, `input-otp`, `menu`,
  `password-strength`, `toast`) and `@cadenway/icons`.

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
- `notifications` (`Compte.dc.html` lines 355-403): the `Events` matrix (7 events × in the app,
  email, mobile, each box named `<event> in the app | by email | on mobile`), `Email summary`
  and `Do not disturb`. Every change shows at once and saves with no Save and no success toast:
  `NotificationPreferencesStore` (page-scoped on `NotificationsPage`) queues the writes, one after
  the other, each a merge patch of that one setting with `If-Match` on the version the previous
  write recorded; a later change of the same setting replaces a pending one, and a setting turned
  back to its confirmed value sends nothing. On `412 request.version-mismatch` the data access
  reads the preferences again and resends the setting once. A refusal restores the confirmed
  value of that setting (unless it was changed again since) and shows `Could not save`; a new
  failure replaces the previous toast. A write without a known outcome (no answer, a timeout, a
  `5xx`) reads the preferences again: when they hold the change it counts as saved, otherwise it
  is restored as a refusal, and the queued changes are compared with what was read (when that
  read fails, the next write reads first). The confirmed preferences live in the store, outside
  the read's resource, so the writes still queued when the page closes are sent. The mention hint
  names the display name, or the first name without one, as a mention does. Below 768 px the
  matrix becomes cards (the mockup's `.cw-cards` rule), each box followed by its channel's name
  as a `label` of the box, so tapping the name toggles it.
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
| `account.notifications.save-failed`, `account.notifications.save-failed-text`                                                                                                                                     | The mockup draws no refused save; the section saves at once.                                   |
| `account.user-menu.avatar-unknown`, `account.user-menu.avatar-online`, `account.user-menu.avatar-away`, `account.user-menu.avatar-dnd`, `account.user-menu.avatar-invisible`, `account.user-menu.avatar-disabled` | Texts of the avatar brick, taken from its defaults.                                            |
