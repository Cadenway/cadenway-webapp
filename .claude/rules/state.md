---
paths:
  - 'src/app/**/state/**'
---

# State

- NgRx SignalStore (`@ngrx/signals`): one store per concept in `<concept>-store.ts`, protected
  state, derived values as computed signals, API calls through the feature's `data-access/`
  service. Load the `cw-tech-ngrx` skill. No global Store, effects or third-party store extension.
- Optimistic changes keep an undo snapshot and roll back on failure with a toast.
- Status changes: label and icon update at once; one pending change per task; the final status of a
  burst is the only one sent; going back to the saved status cancels the pending one.
