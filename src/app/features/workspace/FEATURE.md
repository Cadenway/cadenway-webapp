# Workspace

## Purpose

The organization-scoped workspace under `/:org`: the session and slug guards, the context resolver,
the workspace context (user, organization, role, plan), the redirects of slug-less e-mail links, and
the mounting of the `app-shell` and `settings-shell` layouts with their slot bindings, and the shell
chrome no other feature owns: the organizations menu, the rail's theme button, the keyboard
shortcuts dialog, the settings shell's organization square and `Back to the application` link,
the role guard of the organization settings and the discard confirmation of unsaved settings. The screens inside belong to their own features; sign-in and organization choice
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
  guards rerun when the slug changes or context revalidation is requested. It is componentless:
  it provides `provideCadenwayIcons()`, Core's `provideCadenwayUiLabels()` (the English texts of
  the `@cadenway/ui` bricks every screen renders) and the workspace-wide services (the workspace runtime and
  context, Account's `providePresence()`, Organization's `provideOrganizationUsage()`,
  Onboarding's `provideOnboarding()` and Spaces' `provideSpacesNavigation()`), and its children
  mount the shells, in this order:
  - `account` and `organization` load `SettingsShell` and mount Account's `ACCOUNT_ROUTES` and
    Organization's `ORGANIZATION_ROUTES`. Their `data` names the settings navigation (`Settings`,
    `workspace.settings.account-navigation`; `Organization settings`,
    `workspace.settings.organization-navigation`) and titles the error boundary's unavailable state
    (`Could not load this section`, `workspace.settings.load-failed`). Each provides Account's
    `provideReauthentication()` and these settings shell contributions. `organization` also runs
    `organizationRoleGuard('member')`, so a guest never sees its frame (not even its 404), again on
    every recovery (`shouldRecheckOrganizationRole`):

    | Slot                 | `account`                                                                                                                                                                                             | `organization`                                                              |
    | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
    | `railNavigation`     | Workspace's organization square, Home's `Home`, Inbox's `Inbox`, My tasks' `My tasks`, Spaces' `Spaces`, Dashboards' `Dashboards`, Docs' `Documents`, Spaces' favorite spaces (`variant: 'settings'`) | Same                                                                        |
    | `railFooter`         | Search's `Search`, Workspace's theme button, Account's menu                                                                                                                                           | Same                                                                        |
    | `settingsNavigation` | Workspace's back link, Account's sections, Organization's section links                                                                                                                               | Workspace's back link, Organization's identity and sections, Account's link |
    | `overlays`           | Search's command palette, Workspace's shortcuts dialog, Task's create dialog and task detail, Account's reauthentication dialog                                                                       | Same                                                                        |

  - `''` loads `AppShell` with these contributions, and holds the screens of the other features.
    A new screen adds an empty-path `loadChildren` entry before `**` in this child's `children`:

    | Slot                   | Contributions, in order                                                                                                                                      |
    | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `banners`              | Organization's storage banner                                                                                                                                |
    | `organizationSwitcher` | Workspace's organizations menu                                                                                                                               |
    | `railNavigation`       | Home's `Home`, Inbox's `Inbox`, My tasks' `My tasks`, Spaces' `Spaces`, Dashboards' `Dashboards`, Goals' `Goals`, Docs' `Documents`, Spaces' favorite spaces |
    | `railFooter`           | Search's `Search`, Workspace's theme button, Account's menu                                                                                                  |
    | `sidebarHeader`        | Workspace's organization row, Search's `Search…` button                                                                                                      |
    | `sidebar`              | Spaces' favorites, spaces accordion and tips                                                                                                                 |
    | `sidebarFooter`        | Spaces' sprint progress, Organization's plan line, Spaces' `Trash` and `Archives`, `Keyboard shortcuts`                                                      |
    | `overlays`             | Search's command palette, Workspace's shortcuts dialog, Task's create dialog and task detail, Onboarding's `Getting started` checklist and assistant         |
    - `''` mounts `HOME_ROUTES`, then `SPACES_ROUTES` (`spaces/:spaceId`, `l/:listId`), then
      `TASK_ROUTES` (`t/:taskKey`), then `MY_TASKS_ROUTES` (`my-tasks`), `DASHBOARDS_ROUTES`
      (`dashboards`), `GOALS_ROUTES` (`goals`), `DOCS_ROUTES` (`docs`, `d/:docId`), `TRASH_ROUTES`
      (`trash`) and `ARCHIVES_ROUTES` (`archives`).
    - The rail lists the seven applications in the mockup's order (`App.dc.html` `railDefs`, lines
      6958-6966; orders 0 to 60), then the favorite spaces (order 90). The settings rails draw no
      `Goals`, as `Compte.dc.html` (line 1498) and `Organisation.dc.html` (line 1672) do not.
    - `**` mounts `ERRORS_ROUTES`, so an unknown address renders the 404 inside the application
      shell; an unknown settings section renders it inside the settings shell.

- Redirect targets owned by Auth: `/login?next=<url>` for a `401`, `/organizations` for an
  unknown slug, a refused switch (`organization.mfa-required`...) or an unavailable gateway.

## Public entry points

| Entry point                         | Consumers                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `workspace.routes`                  | app                                                                                                             |
| `ports/workspace-context`           | home, errors, account, search, inbox, organization, spaces, task, my-tasks, dashboards, goals, docs, onboarding |
| `http/guards/organization-role`     | organization                                                                                                    |
| `ui/dialogs/discard-changes-dialog` | account, organization                                                                                           |
| `ports/workspace-refresh`           | organization, account                                                                                           |

`ports/workspace-context` publishes `WORKSPACE_CONTEXT` (`WorkspaceContextPort`: `user`,
`organization`, `role` and `can(role)`) and the `WorkspaceUser`, `WorkspaceOrganization` and
`WorkspaceRole` models. It is provided only inside `/:org`; code that may run outside a workspace
injects it as optional.

`http/guards/organization-role` publishes `organizationRoleGuard(least, fallbacks?)`,
`shouldRecheckOrganizationRole` (the `runGuardsAndResolvers` of a guarded route: the slug changes, or
a workspace recovery navigation reverifies the role) and the `OrganizationRoleFallback` model. It lets a route below `/:org` open for a role at least `least`
(the order of `can()`), and otherwise redirects with a `UrlTree` to the first fallback the role
meets, below `/<slug>`, or else to `/<slug>`.

`ports/workspace-refresh` publishes `WORKSPACE_REFRESH` (`WorkspaceRefreshPort`: `refresh()`),
provided only inside `/:org` by `provideWorkspaceRuntime()`. It asks the workspace to verify the
person and the organization again after a feature changed the organization (Organization's
General section after a save): a same-address navigation marked as a workspace recovery, so the
`/:org` guards and resolver rerun, a transient failure keeps the workspace, and
`unsavedChangesGuard` lets it through without asking. While another navigation is under way it
starts none and leaves the request to the next navigation, so it never cancels the person's.

`ui/dialogs/discard-changes-dialog` publishes `DiscardChangesDialog` (`cw-discard-changes-dialog`):
`ask()` opens `Discard unsaved changes?` with `Keep editing` and `Discard` and resolves the
answer, for a settings page's `confirmDiscard()` (`@shared/unsaved-changes`).

## Dependencies

- `@cadenway/api-client`: `AuthService.getCurrentUser`, `OrganizationsService.getCurrentOrganization`
  (`cache: 'no-store'`), `listMyOrganizations` (every cursor page) and `switchOrganization`, and
  `RealtimeService.issueRealtimeTicket` for single-use connection tickets.
- Auth's `withSessionLock` (`@features/auth`), in exclusive mode around the organization switch.
- The `providers` entries of Account, Dashboards, Docs, Goals, Home, Inbox, My tasks,
  Onboarding (`provideOnboarding()`, `withGettingStarted()` and `withOnboardingWizard()`, in the
  application shell only), Organization, Search, Spaces (including `provideSpacesNavigation()`)
  and Task, and
  Organization's `utils/plan-label`, bound on `/:org`.
- The routes of Spaces, Task, My tasks, Dashboards, Goals, Docs, Trash and Archives, mounted under
  `/:org`.
- `@core/shortcuts` (`?`) and `@core/theme`.
- Account's `account.routes` and Organization's `organization.routes`, mounted in the settings
  shell, and Errors' `.` entry (`RouteErrorData`).
- `@layouts/app-shell`, `@layouts/app-shell/providers`, `@layouts/settings-shell` and
  `@layouts/settings-shell/providers` for the shells and their slots.
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `button`, `dialog`, `kbd`, `menu`, `skeleton`) and
  `@cadenway/icons`.

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
  it (a cancelled or redirected switch confirms nothing). The settings entries open `/<slug>/organization/general|members|billing`, each shown only to the
  roles its section lets in (`Organization settings` for administrators, `Members and invitations`
  for members, `Billing and quotas` for the owner), and `Create or join an organization` opens `/organizations`.
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
- The organization guard records the router navigation that verified the organization.
  `organizationRoleGuard` runs before `workspaceResolver` commits the context, so it checks the
  role verified during its own navigation, or else the committed role (a navigation between
  sections, where the `/:org` guards do not run again). A role verified by a cancelled navigation
  is never used.
- The settings shell's organization square (`withOrganizationHomeItem()`, rail order -10) and
  `Back to the application` (`withBackToApp()`, navigation order 0) open `/<slug>`: the mockup
  opens the spaces screen, which has no index route yet.
- `DiscardChangesDialog` answers false on `Keep editing`, Escape, a new question and its own
  destruction, so an unsaved-changes guard never waits forever.

## Copy not taken word for word from the mockup

| Unit                                                                               | Reason                                                                      |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `workspace.organization-menu.failed`, `workspace.retry`                            | The mockup draws no failed organizations read.                              |
| `workspace.organization-menu.role-admin`, `workspace.organization-menu.role-guest` | Roles the mockup's menu does not list, worded as in `Organisation.dc.html`. |
| `workspace.settings.discard-*`                                                     | The mockup draws no discard confirmation.                                   |
