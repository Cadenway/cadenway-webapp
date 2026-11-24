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
  `PresenceStatus` (`online`, `away`, `do-not-disturb`, `invisible`), the subset of
  `RealtimeConnection` (`@core/realtime`) the shell needs.

## Dependencies

- Auth's `.` entry (`SignOut`), Workspace's `ports/workspace-context`, `@core/theme`.
- `@cadenway/ui` (`app-rail`, `avatar`, `menu`, `toast`) and `@cadenway/icons`.

## Invariants

- `providePresence()` binds the in-memory `LocalPresence` (starting at `online`, forgotten with the
  workspace, not sent to anyone) until the realtime connection is bound to `PRESENCE` with
  `{ provide: PRESENCE, useExisting: RealtimeConnection }`.
- Choosing a presence closes the menu and confirms with the toast « Statut : <presence> ».
- The theme submenu drives `ThemeService`; the transition spreads from the account button.
- A refused sign-out keeps the page and shows an error toast.
- Known gap: « Définir un message de statut » and the status message under the header are left out,
  since the backend has no status message yet.

## Copy not taken word for word from the mockup

| Unit                                                                          | Reason                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------- |
| `account.user-menu.sign-out-failed`, `account.user-menu.sign-out-failed-text` | The mockup draws no refused sign-out.        |
| `account.user-menu.avatar-*`                                                  | The avatar brick's texts, not in the mockup. |
