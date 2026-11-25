# Account

## Purpose

The account settings and their 5 sections, and the account menu of the application shell: the
rail's account button with the person's presence, the « Statut » and « Thème » submenus, the links
to the account sections and « Se déconnecter ». It owns the person's own presence port (`PRESENCE`).
Sign-out itself belongs to Auth; the realtime connection belongs to `core`.

## Routes

None yet: the account sections (`/:org/account/:section`) come with the account settings step.
Until then the menu's links open the 404 inside the shell.

## Public entry points

| Entry point      | Consumers |
| ---------------- | --------- |
| `providers`      | workspace |
| `ports/presence` | inbox     |

- `providers` publishes `withUserMenu()` (the `railFooter` contribution, order 20) and
  `providePresence()`, which provides `PRESENCE` on the `/:org` route.
- `ports/presence` publishes `PRESENCE` (`PresencePort`: `ownStatus`, `setPresence`) and
  `PresenceStatus` (re-exported from `@core/realtime`), the subset of `RealtimeConnection` the
  shell needs.

## Dependencies

- Auth's `.` entry (`SignOut`), Workspace's `ports/workspace-context`, `@core/realtime`,
  `@core/theme`.
- `@cadenway/ui` (`app-rail`, `avatar`, `menu`, `toast`) and `@cadenway/icons`.

## Invariants

- `providePresence()` binds `PRESENCE` to the workspace's `RealtimeConnection` (provided by
  Workspace's runtime on `/:org`). `ownStatus` is null until the presence snapshot returns the saved preference or the person chooses
  a presence in this tab: until then the
  rail button names the person only, the presence dots are hidden and « Statut » checks nothing.
- Choosing a presence closes the menu and confirms with the toast « Statut : <presence> ». When the
  gateway refuses it and `ownStatus` returns to the confirmed value, an error toast says so.
- When realtime is disabled (`status()` is `disabled`, no `realtimeUrl`), « Statut » is disabled with
  « Indisponible » and nothing is set or confirmed.
- The menu is a slot contribution acting as a container: it injects `WORKSPACE_CONTEXT`, `PRESENCE`,
  the router and the toasts; `PresenceDot` stays presentational.
- The theme submenu drives `ThemeService`; the transition spreads from the account button.
- A refused sign-out keeps the page and shows an error toast.
- Known gap: « Définir un message de statut » and the status message under the header are left out,
  since the backend has no status message yet.

## Copy not taken word for word from the mockup

| Unit                                                                                                                                        | Reason                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `account.user-menu.label-no-status`                                                                                                         | The mockup always knows the presence; here it is unknown until the snapshot or a local choice. |
| `account.user-menu.status-unavailable`                                                                                                      | The mockup has no state without realtime.                                                      |
| `account.user-menu.status-failed`, `account.user-menu.status-failed-text`                                                                   | The mockup draws no refused presence.                                                          |
| `account.user-menu.sign-out-failed`, `account.user-menu.sign-out-failed-text`                                                               | The mockup draws no refused sign-out.                                                          |
| `account.user-menu.avatar-unknown`, `account.user-menu.avatar-online`, `account.user-menu.avatar-away`, `account.user-menu.avatar-disabled` | Texts of the avatar brick, taken from its French defaults.                                     |
