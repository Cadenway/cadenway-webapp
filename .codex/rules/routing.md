---
paths:
  - 'src/app/**/*.routes.ts'
  - 'src/app/**/guards/**'
  - 'src/app/**/resolvers/**'
---

# Routing

- `app.routes.ts`: prefixes, redirects and lazy `loadChildren` feature entries only.
- One `<feature>.routes.ts` per feature, exporting one `<FEATURE>_ROUTES` constant with its children
  written inline. The same constant may be mounted in several places (the 404 under the root and under
  the workspace).
- Paths are English, lowercase kebab-case; parameters are camelCase ids (`:taskKey`). Keep the mockup's
  shareable forms (`/:org/t/:taskKey`, `/:org/l/:listId`, `/:org/d/:docId`) and the paths backend e-mails
  link to (`/login/code`, `/forgot`, `/reset`, `/invite/:invitationId`, `/home`, `/account`, `/org/:section`).
- A feature's root route mounts its layout (`loadComponent` from `@layouts/<layout>`) and binds the
  layout slots with `provide<Layout>Slots({ ... })` and the features' `with<Thing>()` contributions.
  Only root route files import `@layouts/*`.
- Parameters, query parameters and `data` reach pages as signal inputs (`withComponentInputBinding()`,
  `paramsInheritanceStrategy: 'always'`). Set path-only inputs to `undefined` in `data` so a query
  parameter cannot stand in for them.
- Guards and resolvers are functional, under `http/guards/<name>/` and `http/resolvers/<name>/`, and
  redirect with a `UrlTree` or a `RedirectCommand`. A resolver fills the owning store and reuses its
  guard's result instead of fetching twice. A parameterized guard is a factory
  (`organizationRoleGuard('admin')`). Settings forms use the unsaved-changes `canDeactivate` guard.
- A SignalStore shared by a route subtree is provided in that route's `providers`, in the owning
  feature's routes; never `providedIn: 'root'` for page state.
- Errors: the router runs with `withErrorBoundaries({ defaultErrorComponent })` (developer preview in
  Angular 22.3). Page and view routes set `errorComponent`, so the shell and the page header stay while
  the content is replaced by the mockup's state: 404, deleted task (with Restore), access denied (with a
  request form) or load failure (with Retry).
