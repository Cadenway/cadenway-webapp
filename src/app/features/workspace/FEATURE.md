# Workspace

## Purpose

The organization-scoped workspace under `/:org`: the session and slug guards, the context resolver,
the workspace context (user, organization, role, plan), the redirects of slug-less e-mail links, and
the mounting of the `app-shell` and `settings-shell` layouts with their slot bindings. The screens
inside belong to their own features; sign-in and organization choice belong to Auth.

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
  runtime, workspace context and the
  `organizationSwitcher` contribution, and loads `AppShell` with `provideCadenwayIcons()`.
  - `''` mounts `HOME_ROUTES`.
  - `**` mounts `ERRORS_ROUTES`, so an unknown address renders the 404 inside the shell.
- Redirect targets owned by Auth: `/login?next=<url>` for a `401`, `/organizations` for an
  unknown slug, a refused switch (`organization.mfa-required`...) or an unavailable gateway.

## Public entry points

| Entry point               | Consumers    |
| ------------------------- | ------------ |
| `workspace.routes`        | app          |
| `ports/workspace-context` | home, errors |

`ports/workspace-context` publishes `WORKSPACE_CONTEXT` (`WorkspaceContextPort`: `user`,
`organization`, `role` and `can(role)`) and the `WorkspaceUser`, `WorkspaceOrganization` and
`WorkspaceRole` models. It is provided only inside `/:org`; code that may run outside a workspace
injects it as optional.

## Dependencies

- `@cadenway/api-client`: `AuthService.getCurrentUser`, `OrganizationsService.getCurrentOrganization`
  (`cache: 'no-store'`), `listMyOrganizations` (every cursor page) and `switchOrganization`, and
  `RealtimeService.issueRealtimeTicket` for single-use connection tickets.
- Auth's `withSessionLock` (`@features/auth`), in exclusive mode around the organization switch.
- `@layouts/app-shell` and `@layouts/app-shell/providers` for the shell and its slots.
- `@cadenway/ui` (`app-rail`) and `@cadenway/icons`.

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
- The route runtime supplies the workspace organization and fresh tickets to the shared realtime
  connection. The gateway notice envelope does not name the delivering room: changes are broadcast
  to every active watch, whose consumer filters or refetches. A later contract should add the room.
- The resolver sets `OrganizationPin` after committing the verified context, before child resolvers;
  route destruction clears it. A `412 organization.context-changed` requests one same-URL guard and
  resolver rerun. Query-only navigation does not trigger revalidation. The guard's uncached current
  organization read skips the pin so it can discover and switch the session under the lock. Before
  a session switch the guard fences pinned requests locally until the resolver commits the new pin.
- A session holds one current organization across tabs. Tabs on different organizations can take
  turns switching the session; each committed workspace switch reconnects its realtime client.
- The organization switcher links to `/organizations`; the organization menu of the mockup comes
  with the organization settings.
- Guards and the resolver never reach the error boundary: they redirect with a `UrlTree` or a
  `RedirectCommand`.
- The `settings-shell` binding comes with the account and organization settings steps.
