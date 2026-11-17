---
name: cw-tech-ngrx
description: "Build, test, or review NgRx SignalStore state in cadenway-webapp. Load before changing or reviewing a feature store."
---

# NgRx SignalStore for Cadenway

Follow the checkout's state rule. Read the installed NgRx versions in `package.json` and use
documentation for that major.

- Use `@ngrx/signals` with protected state. The global Store family is forbidden, and a third-party
  SignalStore extension requires an architecture decision.
- Use one store per concept in the owning feature at the narrowest scope. Only pages and overlays
  acting as pages inject stores among components. Reset app-wide stores holding user or
  organization data on sign-out and organization change.
- Use a record as state, immutable updates with one `patchState` per step, and `withComputed` for
  derived values. Use `signalMethod` or `rxMethod` for signal reactions.
- Use the feature's data-access service and store its display models. Keep load failure, retry and a
  successful empty result distinct. Use `tapResponse` for `rxMethod` API calls.
- Preserve optimistic rollback, undo and pending edits. For status changes, only the final click
  in a 460 ms burst sends; returning to the saved status cancels it and sends for one task
  never overlap.

## Read by task

| When the task touches | Read |
| --- | --- |
| Store layout, naming, construction or provider scope | [Store structure and scope](references/store-structure.md) |
| API calls, side effects, optimistic status, undo, realtime, forms, entities or events | [Store data and interactions](references/data-and-interactions.md) |
| Store or component specs | [Testing a SignalStore](references/testing.md) |
| Store review, enforcement details or upstream documentation | [Review checklist, tooling and references](references/review-and-tooling.md) |
| A worked example of debounced reads, entities or optimistic status | [Canonical store](references/task-list-store.md) |
| Worked tests of that pattern | [Canonical spec](references/task-list-store-spec.md) |
