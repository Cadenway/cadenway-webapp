---
paths:
  - 'src/app/**/state/**'
  - 'src/app/**/*-store.ts'
  - 'src/app/**/*-store.spec.ts'
---

# State

Load the `cw-tech-ngrx` skill before writing or reviewing a store.

- NgRx SignalStore (`@ngrx/signals`) only: no global Store family, no third-party store extension.
  ESLint and the edit guard refuse them.
- One store per concept, `<Concept>Store` in `<concept>-store.ts`, functional `signalStore(...)`;
  provided at the narrowest scope (component, route, then root for app-wide state in `core/`).
- State stays protected (never `protectedState: false`); private members take the `_` prefix;
  `withState` takes a record, never an array at the root.
- Derived values are `withComputed`, never copied into state; no `effect()` in a store: react with
  `signalMethod` or `rxMethod`.
- A store calls its feature's `data-access/` service, never `@cadenway/api-client` or HTTP, and holds
  display models, never DTOs. `rxMethod` API calls use `tapResponse` from `@ngrx/operators`.
- Optimistic changes keep an undo snapshot and roll back on failure with a toast.
- Status changes: label and icon update at once; one pending change per task; the final status of a
  burst is the only one sent; going back to the saved status cancels the pending one.
- Specs: `TestBed`, data-access faked, public API only; `unprotected()` arranges state in specs only.
