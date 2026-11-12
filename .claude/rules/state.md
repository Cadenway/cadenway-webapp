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
- A store calls its feature's `data-access/` service, never `@cadenway/api-client`, HTTP or
  `fetch`, and holds display models, never DTOs. `rxMethod` API calls use `tapResponse` from
  `@ngrx/operators`. A failed read is a state flag with a retry method, never an emptied list.
- Optimistic changes keep an undo snapshot and roll back on failure with a toast; a refused undo
  rolls back too; the snapshot is dropped when the toast closes.
- Status changes: label and icon update at once; one pending change per task, settling 460 ms after
  the last click; the final status of a burst is the only one sent; going back to the saved status
  cancels the pending one; sends of one task never overlap.
- A root store holding user or organization data is reset on sign-out and organization change.
- Specs: `TestBed`, data-access faked, public API only; `unprotected()` arranges state in specs only.
