# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

At the time this documentation was written, this checkout has no `package.json`, application source tree, or GitHub workflow files. The target architecture, scripts, and workflows in this guide must be created and verified during bootstrap.

The following architecture is the target recorded in [AGENTS.md](../AGENTS.md). Paths and integrations are design boundaries, not evidence that files or services already exist.

## Purpose and target structure

cadenway-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, NgRx SignalStore, `@cadenway/ui`, `@cadenway/api-client`. It talks only to `cadenway-api-gateway` (REST) and `cadenway-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads the gateway addresses from `public/config.json` at start-up.

```text
src/app/
├─ core/          ← shell, rail, sidebar, Ctrl + K palette, toasts, shortcuts, session, api client setup, realtime
├─ auth/          ← sign-in, sign-up, MFA, codes, password, sign-out, organization choice
├─ home/  my-tasks/  spaces/ (list-page, views/, space-overview)  task/ (task-detail, task-create, shared/)
├─ goals/  docs/  dashboards/  trash/  archives/
├─ account/       ← 5 sections
└─ organization/  ← 7 sections
```

## Architectural ownership

- Business UI belongs to the owning feature folder; `core` is app-wide infrastructure only (shell, config, API client setup, realtime, theme, shortcuts).
- Pages orchestrate; presentational components only take inputs and emit outputs.
- Generic visual bricks belong to cadenway-design-system, never here.

## Boundaries

- `core` never imports a feature; features import each other only through entries declared in the owner's `FEATURE.md`.
- No `shared/ui`, no local copy of a `@cadenway/ui` brick, no other component library.
- No `HttpClient` to reach the API; no hand-built API URL.
- Signal Forms only: never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`.
- State is NgRx SignalStore (`@ngrx/signals`) only: never the global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`) or a third-party store extension, never `protectedState: false`; a store reaches the API through its feature's `data-access/`.
- `docs/maquette/` is a read-only reference copy of the mockup.

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.
