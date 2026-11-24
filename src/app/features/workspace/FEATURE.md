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
  `runGuardsAndResolvers: 'pathParamsChange'`. It provides the workspace context, Account's
  `providePresence()` and every shell contribution, and loads `AppShell` with
  `provideCadenwayIcons()`:

  | Slot                   | Contributions, in order                                           |
  | ---------------------- | ----------------------------------------------------------------- |
  | `banners`              | Organization's storage banner                                     |
  | `organizationSwitcher` | Workspace's organizations menu                                    |
  | `railNavigation`       | Home's « Accueil », Inbox's « Boîte de réception »                |
  | `railFooter`           | Search's « Rechercher », Workspace's theme button, Account's menu |
  | `sidebarHeader`        | Search's « Rechercher… » button                                   |
  | `sidebarFooter`        | Organization's plan line, Workspace's « Raccourcis clavier »      |
  | `overlays`             | Search's command palette, Workspace's shortcuts dialog            |
  - `''` mounts `HOME_ROUTES`.
  - `**` mounts `ERRORS_ROUTES`, so an unknown address renders the 404 inside the shell.

- Redirect targets owned by Auth: `/login?next=<url>` for a `401`, `/organizations` for an
  unknown slug, a refused switch (`organization.mfa-required`...) or an unavailable gateway.

## Public entry points

| Entry point               | Consumers                                          |
| ------------------------- | -------------------------------------------------- |
| `workspace.routes`        | app                                                |
| `ports/workspace-context` | home, errors, account, search, inbox, organization |

`ports/workspace-context` publishes `WORKSPACE_CONTEXT` (`WorkspaceContextPort`: `user`,
`organization`, `role` and `can(role)`) and the `WorkspaceUser`, `WorkspaceOrganization` and
`WorkspaceRole` models. It is provided only inside `/:org`; code that may run outside a workspace
injects it as optional.

## Dependencies

- `@cadenway/api-client`: `AuthService.getCurrentUser`, `OrganizationsService.getCurrentOrganization`
  (`cache: 'no-store'`), `listMyOrganizations` (every cursor page) and `switchOrganization`.
- Auth's `withSessionLock` (`@features/auth`), in exclusive mode around the organization switch.
- The `providers` entries of Account, Home, Inbox, Organization and Search, and Organization's
  `utils/plan-label`, bound on `/:org`.
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
  inside one exclusive browser session lock (`WorkspaceSession.exclusive`). Once granted, the
  sequence runs to its end even if the navigation is cancelled, so the session is never left half
  switched; the store only takes the organization when the guard answers.
- `WorkspaceContextStore` is destroyed with its route (`withAutoCleanupInjectors`).
- Known gap, for step 3: requests below `/:org` do not yet pin the organization with
  `If-Organization-Match`, and a `412 organization.context-changed` (another tab switched the
  session meanwhile) is not handled; the guard's check only holds at navigation time.
- The organizations menu provides `OrganizationMenuStore`, which reads every page of
  `listMyOrganizations` the first time the menu opens, with skeletons and an inline « Réessayer ».
  Choosing another organization navigates to `/<slug>`, whose guard switches the session; the
  settings entries open `/<slug>/organization/general|members|billing` (the 404 until the
  organization settings step) and « Créer ou rejoindre une organisation » opens `/organizations`.
- `ShortcutsHelp` (root) only holds whether the shortcuts dialog is open; `?` opens it outside fields
  through `ShortcutsService`, for as long as the shell lives.
- Known gap: the sidebar header's organization row of the mockup (name, host, caret) is not built;
  the rail square opens the same menu.
- Guards and the resolver never reach the error boundary: they redirect with a `UrlTree` or a
  `RedirectCommand`.
- The `settings-shell` binding comes with the account and organization settings steps.
