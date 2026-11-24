# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The application is being rebuilt from the mockup and the backend, following the routing, layout,
error and localization patterns below. Step 1 is in place:

- Core: runtime configuration, the API client transport and problem readers, theme, shortcuts, and
  route titles and focus. Realtime is rebuilt in step 3.
- Layouts: the auth, app and settings shells with their route-bound slots.
- Routing: `APP_ROUTES` mounts Auth, then Workspace, then the 404. Workspace owns the slug-less
  e-mail links and `/:org`, whose guards verify the session and switch the session to the
  organization the slug names, and whose resolver commits `WORKSPACE_CONTEXT`. `/:org` loads the
  app shell with the organization switcher, the Home skeleton and the 404 inside the shell.
- Errors: the router runs with `withErrorBoundaries` and `RouteErrorBoundary`, which renders the not
  found, access denied, deleted task and unavailable states; Retry runs the route again with a
  same-URL reload navigation (`errors.routes.spec.ts`).
- Auth is being rebuilt on the same patterns. The earlier Spaces and Task screens were removed; they
  are rebuilt in steps 4a and 5.

## Purpose and target structure

cadenway-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, NgRx SignalStore, `@cadenway/ui`, `@cadenway/api-client`. It talks only to `cadenway-api-gateway` (REST) and `cadenway-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads its required REST address and optional Realtime address from `public/config.json` at start-up.

```text
src/app/
├─ app.component.ts  app.component.html  app.component.spec.ts
├─ app.config.ts     app.routes.ts
├─ core/             # app-wide infrastructure, organized by concern
│  └─ config/
│     ├─ index.ts
│     └─ environment/ # source, validation, models and runtime config store
├─ features/         # auth, workspace, account, organization, spaces, task, intake, home,
│                    # my-tasks, inbox, search, onboarding, goals, docs, dashboards, trash,
│                    # archives and errors
├─ layouts/          # auth-layout, app-shell, settings-shell and their slots
└─ shared/           # generic non-visual helpers, when needed
```

## Architectural ownership

The application profile of the [Angular architecture checker](https://github.com/Cadenway/cadenway-tooling/tree/main/packages/angular-testing) checks authored source, file names and import boundaries using the application TypeScript config. Run `pnpm test:architecture` to run it on its own. Both `pnpm quality` and the CI quality gate run it.

- Business UI belongs to its owner under `features/`. `core` owns app-wide infrastructure (config, API client setup, realtime, theme and shortcuts). `layouts` owns shells and `shared` owns generic non-visual helpers.
- Pages orchestrate; presentational components only take inputs and emit outputs.
- Generic visual bricks belong to cadenway-design-system, never here.

## Boundaries

- `core` never imports a feature or a layout. Cross-feature imports use an entry and consumer declared in the owner's `FEATURE.md`.
- No `shared/ui`, no local copy of a `@cadenway/ui` brick, no other component library.
- No `HttpClient` to reach the API; no hand-built API URL.
- Signal Forms only: never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`.
- State is NgRx SignalStore (`@ngrx/signals`) only: never the global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`) or a third-party store extension, never `protectedState: false`; a store reaches the API through its feature's `data-access/`.
- `docs/maquette/` is a read-only reference copy of the mockup.

## Feature structure

```text
features/<feature>/
  FEATURE.md
  <feature>.routes.ts
  ui/{pages,components,tables,dataviews,forms,dialogs,sheets}/
  data-access/{services/<concern>,adapters}/
  state/<slice>/
  models/<concept>/
  ports/<port-name>/
  http/{guards,resolvers,interceptors}/
```

Create folders when they have code. Other feature concerns use `services/`, `access/`, `setup/`,
`navigation/`, `providers/`, `utils/`, `validators/`, `constants/` and `options/`. A nested
feature owns its workflow under `features/` with its own `FEATURE.md`.

- `APP_ROUTES` owns prefixes, redirects and lazy feature entries. The feature route file owns its
  layout, guards and scoped providers. A layout never imports a feature: it declares slots,
  and the feature root routes bind the features' `with<Thing>()` contributions to them (see Layouts
  and slots).
- Cross-boundary imports use `@app`, `@core`, `@features`, `@layouts`, `@shared` or `@env`.
  An app-wide concern publishes its supported symbols through its `index.ts`. Keep private relative
  imports within their concern. Features list entry points and consumers in a
  `| Entry point | Consumers |` table under `## Public entry points`.
- `shared` stays non-visual and may import published ports. Generated API DTOs stay within
  `data-access/`, where adapters map them to display models. App-wide client configuration lives
  in `core/api/client/`.
- Name files in kebab-case with role suffixes, such as `task-row.component.ts` and
  `task-list.store.ts`. Classes use PascalCase without a `Component` suffix. Page directories and
  classes end in `-page` and `Page`, and route constants follow `<FEATURE>_ROUTES`.
- Place a unit spec, mock, fixture or harness directly beside its subject. Use
  `<subject>.spec.ts` and keep `testing/` folders out of the source and test trees. Browser
  scenarios live in `tests/e2e/`.

## Routing

- `APP_ROUTES` holds prefixes, redirects and `loadChildren` entries only. Each feature has exactly
  one `<feature>.routes.ts` with one `<FEATURE>_ROUTES` constant; a constant may be mounted twice (the
  404 under the root and under the workspace).
- Paths are English. Public entries belong to `auth` (`/login`, `/login/code`, `/signup`, `/forgot`,
  `/reset`, `/invite/:invitationId`, `/organizations`, `/auth/federated/continue`) and to `intake`
  (`/f/:publicKey`). The `workspace` feature owns `/:org` (the organization slug), its session and slug
  guards, the context resolver, and the redirects of slug-less e-mail links (`/home`, `/account`,
  `/account/:section`, `/org/:section`). Every fixed first segment is a reserved organization slug,
  listed once in `RESERVED_SLUGS` (`@core/routing`, checked against the route tables by
  `app.routes.spec.ts`); the application never navigates to `/<slug>` for one of them, and the
  organization service will refuse them. The other features mount below it: `/:org/t/:taskKey`, `/:org/l/:listId/<view>`,
  `/:org/d/:docId`, `/:org/account/:section`, `/:org/organization/:section`.
- `provideRouter(APP_ROUTES, withComponentInputBinding(), withAutoCleanupInjectors(), withRouterConfig({ paramsInheritanceStrategy:
'always' }), withErrorBoundaries({ defaultErrorComponent, onError }))`: parameters, query parameters
  and `data` reach pages as signal inputs.
- Guards and resolvers are functional and live in `http/`. A resolver fills the owning store and
  publishes it through a port (`WORKSPACE_CONTEXT`); pages read the port, not a resolved input.

## Layouts and slots

Layouts never import features. Features fill them in three ways:

1. **Route-bound slots.** A layout declares one `InjectionToken<readonly SlotContribution[]>` per slot
   (`slots/*.slot.ts`) and a `provide<Layout>Slots({ ... })` factory in `providers/`, published as its
   own entry so the layout stays in its lazy chunk. A feature publishes `with<Thing>()` factories in its
   `providers/`. The feature's root route binds them. The layout injects each slot as optional, sorts
   by `order`, and renders with `NgComponentOutlet`.
2. **Page-to-shell services** in `core/`: breadcrumb, page actions (a `TemplateRef` registered with
   `connect()`), page tabs and page selection.
3. **Typed route `data`** (`satisfies`): `skeleton`, `mobileTitle`, `breadcrumb`.

## Errors and loading

- Reads use `rxResource` in the store's `withProps`. A page's primary read that fails (its resource loader rejects) is caught by the route's error
  boundary: `errorComponent` replaces the page content with the typed state, which is not found,
  access denied (with an access request), deleted task (with Restore) or unavailable (with Retry,
  `Réessayer` in French, which runs the route again). A secondary or partial read (a shell widget,
  a popover, `TaskDetail.partial`) keeps an inline error whose Retry calls its `reload()`. Guards and
  resolvers never reach the boundary: they redirect with a `UrlTree` or a `RedirectCommand`.
  Page and view routes set `errorComponent`, so the shell and the page header stay.
- Writes are store methods with optimistic updates, `If-Match` versions and undo toasts. A feature that
  drives its feedback toasts through `@ngrx/signals/events` records that decision in its `FEATURE.md`.
- `withErrorBoundaries` is a developer preview in Angular 22.3; its retry and reset behavior is
  covered by route specs.

## Localization

- `@angular/localize`, with English as the source locale. Every string uses `$localize` or `i18n` and
  carries a stable `@@feature.area.key` id. `src/locale/messages.fr.xlf` holds the mockup's French
  wording, word for word, and missing translations fail the build.
- Bricks with their own text receive English source labels from `core/locale` through their labels
  providers. Route titles use `$localize` and go through the application `TitleStrategy`.

## Design-system follow-ups

Generic gaps met while building the shell (step 3). Each is a request to cadenway-design-system,
then an exact `@cadenway/ui` or `@cadenway/icons` bump here; until then the feature works around it.

- `cw-popover` needs a 384 px size without padding: the inbox popover of `App.dc.html` is `w-96`
  with edge-to-edge rows, and it uses the padded 320 px `lg` size meanwhile.
- `cw-avatar` needs the do-not-disturb (garnet dot with a bar) and invisible presence states: the
  account menu draws its own presence dot over the avatar meanwhile.
- `@cadenway/icons` lacks the Fill variant of the tray icon (`phosphorTrayFill`): the active inbox
  rail item keeps `phosphorTrayBold`.

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.
