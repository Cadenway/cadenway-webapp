# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout has an Angular application shell and runtime configuration. The feature ownership documents define their intended responsibilities. The route table is currently empty.

## Purpose and target structure

cadenway-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, NgRx SignalStore, `@cadenway/ui`, `@cadenway/api-client`. It talks only to `cadenway-api-gateway` (REST) and `cadenway-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads the gateway addresses from `public/config.json` at start-up.

```text
src/app/
├─ app.component.ts  app.component.html  app.component.spec.ts
├─ app.config.ts     app.routes.ts
├─ core/             # app-wide infrastructure, organized by concern
│  └─ config/
│     ├─ index.ts
│     └─ environment/ # source, validation, models and runtime config store
├─ features/         # auth, account, organization, spaces, task, home, my-tasks,
│                    # goals, docs, dashboards, trash and archives
├─ layouts/          # application shells and their slots, when implemented
└─ shared/           # generic non-visual helpers, when needed
```

## Architectural ownership

The [Angular architecture checker](https://github.com/Cadenway/cadenway-tooling/tree/main/packages/angular-testing) verifies authored source, file names and import boundaries. Once the package is published, add `@cadenway/angular-testing` as a development dependency and commit the updated lockfile. Run `pnpm install --frozen-lockfile` and `pnpm test:architecture`, then add the latter to `pnpm quality` and the blocking CI job. Use the application profile with the application TypeScript config.

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
  layout, guards and scoped providers. A layout reads data via published ports and composes
  widgets from documented public feature entries.
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

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.
