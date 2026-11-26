# Workspace

## Purpose

The organization-scoped workspace under `/:org`: the session and slug guards, the context resolver,
the workspace context (user, organization, role, plan), the redirects of slug-less e-mail links, and
the mounting of the `app-shell` and `settings-shell` layouts with their slot bindings, and the shell
chrome no other feature owns: the organizations menu, the rail's theme button and the keyboard
shortcuts dialog. The screens inside belong to their own features; sign-in and organization choice
belong to Auth.

## Routes

- `/home`, `/account`, `/account/:section` and `/org/:section` are the slug-less addresses of
  backend e-mails. A guard on a componentless route redirects each of them to the session's current
  organization: `/<slug>`, `/<slug>/account/profile`, `/<slug>/account/:section` and
  `/<slug>/organization/:section`, keeping the query parameters and the fragment.
- A slug that is a reserved first segment (`RESERVED_SLUGS` of `@core/routing`) is never opened
  or redirected to: `organizationGuard` and `slugRedirectGuard` send it to `/organizations`, so
  `/home` cannot redirect to itself while organization-service does not refuse such slugs yet.
- `/:org` runs `sessionGuard`, then `organizationGuard`, then `workspaceResolver`, with
  guards rerun when the slug changes or context revalidation is requested. It provides the workspace
  runtime, the workspace context, Account's `providePresence()` and every shell contribution, and
  loads `AppShell` with `provideCadenwayIcons()`:

  | Slot                   | Contributions, in order                                                                                 |
  | ---------------------- | ------------------------------------------------------------------------------------------------------- |
  | `banners`              | Organization's storage banner                                                                           |
  | `organizationSwitcher` | Workspace's organizations menu                                                                          |
  | `railNavigation`       | Home's `Home`, Inbox's `Inbox`, Spaces' `Spaces`                                                        |
  | `railFooter`           | Search's `Search`, Workspace's theme button, Account's menu                                             |
  | `sidebarHeader`        | Workspace's organization row, Search's `Search…` button                                                 |
  | `sidebar`              | Spaces' favorites, spaces accordion and tips                                                            |
  | `sidebarFooter`        | Spaces' sprint progress, Organization's plan line, Spaces' `Trash` and `Archives`, `Keyboard shortcuts` |
  | `overlays`             | Search's command palette, Workspace's shortcuts dialog, Task's create dialog and task detail            |
  - `''` mounts `HOME_ROUTES`, then `SPACES_ROUTES` (`spaces/:spaceId`, `l/:listId`), then
    `TASK_ROUTES` (`t/:taskKey`).
  - `**` mounts `ERRORS_ROUTES`, so an unknown address renders the 404 inside the shell.

- Redirect targets owned by Auth: `/login?next=<url>` for a `401`, `/organizations` for an
  unknown slug, a refused switch (`organization.mfa-required`...) or an unavailable gateway.

## Public entry points

| Entry point               | Consumers                                                        |
| ------------------------- | ---------------------------------------------------------------- |
| `workspace.routes`        | app                                                              |
| `ports/workspace-context` | home, errors, account, search, inbox, organization, spaces, task |

`ports/workspace-context` publishes `WORKSPACE_CONTEXT` (`WorkspaceContextPort`: `user`,
`organization`, `role` and `can(role)`) and the `WorkspaceUser`, `WorkspaceOrganization` and
`WorkspaceRole` models. It is provided only inside `/:org`; code that may run outside a workspace
injects it as optional.

## Dependencies

- `@cadenway/api-client`: `AuthService.getCurrentUser`, `OrganizationsService.getCurrentOrganization`
  (`cache: 'no-store'`), `listMyOrganizations` (every cursor page) and `switchOrganization`, and
  `RealtimeService.issueRealtimeTicket` for single-use connection tickets.
- Auth's `withSessionLock` (`@features/auth`), in exclusive mode around the organization switch.
- The `providers` entries of Account, Home, Inbox, Organization, Search, Spaces (including
  `provideSpacesNavigation()`) and Task, and Organization's `utils/plan-label`, bound on `/:org`.
- Spaces' `spaces.routes` and Task's `task.routes`, mounted under `/:org`.
- `@core/shortcuts` (`?`) and `@core/theme`.
- `@layouts/app-shell` and `@layouts/app-shell/providers` for the shell and its slots.
- `@cadenway/ui` (`app-rail`, `button`, `dialog`, `kbd`, `menu`, `skeleton`) and `@cadenway/icons`.

## Invariants

- `WorkspaceContextStore` is route-scoped on `/:org` and published as `WORKSPACE_CONTEXT`. The
  guards verify the person and the organization of each navigation that changes the slug; the
  resolver commits them without reading the gateway again, so a navigation cancelled after a guard
  never changes what the shell shows. Leaving `/:org` destroys the store.
- The URL slug and the session's current organization agree before anything below `/:org` is
  created: the guard reads the current organization, looks the slug up and switches the session
  inside one exclusive browser session lock (`WorkspaceSession.exclusive`). A recovery switch is
  deferred if its navigation is superseded or the tab leaves the foreground before dispatch. Once
  dispatched, a switch completes even if navigation is cancelled; the store only takes the organization
  when the guard answers.
- `WorkspaceContextStore` is destroyed with its route (`withAutoCleanupInjectors`).
- The organizations menu provides `OrganizationMenuStore`, which reads every page of
  `listMyOrganizations` the first time the menu opens, with skeletons and an inline `Retry`.
  Choosing another organization navigates to `/<slug>`, whose guard switches the session; once the
  navigation succeeds with that organization committed, the toast `Organization: <name>` confirms
  it (a cancelled or redirected switch confirms nothing). The settings entries open `/<slug>/organization/general|members|billing` (the 404 until the
  organization settings step) and `Create or join an organization` opens `/organizations`.
- `ShortcutsHelp` (root) only holds whether the shortcuts dialog is open; `?` opens it outside fields
  through `ShortcutsService`, for as long as the shell lives.
- The same menu opens from the rail square (desktop only) and from the sidebar header's
  organization row (`withOrganizationRow()`: Cadenway mark, name, `<host>/<slug>` from the page
  address, caret), the phone entry point. The shell's collapse button ends that row. Each trigger
  provides its own `OrganizationMenuStore`.
- Every shell contribution is a container that injects `WORKSPACE_CONTEXT` itself (none takes it as
  an input). `ShortcutsHelp` and Search's `CommandPalette` go through `ShellOverlay`
  (`@shared/layout-slot`), so the shortcuts dialog and the palette never open over each other.
- The route runtime supplies the workspace organization and fresh tickets to the shared realtime
  connection. The gateway notice envelope does not name the delivering room: changes are broadcast
  to every active watch, whose consumer filters or refetches. A later contract should add the room.
- The resolver sets `OrganizationPin` after committing the verified context, before child resolvers;
  route destruction clears it. A `412 organization.context-changed` from the current pin revision
  marks the context stale and fences passive requests until the next verified commit; a response from
  an older revision is ignored. While the document is visible and focused, recovery reruns guards and
  the resolver immediately or after an in-progress navigation. Otherwise it waits for focus or
  visibility. The guard checks that the recovery navigation is current and that the tab is focused and
  visible immediately before a recovery switch. Transient read or switch failures cancel recovery
  without leaving the workspace; recovery retries with bounded backoff. Definitive access failures
  keep their redirects. Query-only navigation does not trigger revalidation. The guard's uncached current organization read skips the pin so it can discover and
  switch the session under the lock. Before a session switch the guard fences pinned requests locally
  until the resolver commits the new pin.
- A session holds one current organization across tabs. A hidden or unfocused tab does not switch it
  back after a mismatch; returning to that tab can revalidate its workspace. Each committed workspace
  switch reconnects its realtime client.
- Guards and the resolver never reach the error boundary: they redirect with a `UrlTree` or a
  `RedirectCommand`.
- The `settings-shell` binding comes with the account and organization settings steps.

## Copy not taken word for word from the mockup

| Unit                                                                               | Reason                                                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `workspace.organization-menu.failed`, `workspace.retry`                            | The mockup draws no failed organizations read.                              |
| `workspace.organization-menu.role-admin`, `workspace.organization-menu.role-guest` | Roles the mockup's menu does not list, worded as in `Organisation.dc.html`. |
