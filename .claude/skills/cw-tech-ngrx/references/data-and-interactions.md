# Store data and interactions

## API calls and side effects

- A store never imports `@cadenway/api-client` or `@angular/common/http` and never calls
  `fetch`, `XMLHttpRequest`, `WebSocket` or `EventSource`, even for a static file: it injects the
  feature's
  `data-access/` service (`withMethods((store, api = inject(TaskApi)) => ...)`) and holds the
  display models it returns. DTOs never reach state.
- Reading server data for a screen: Angular `resource()` / `rxResource()` backed by the
  data-access service, exposed through `withProps`, so pages keep loading (skeleton), error
  (error panel) and `reload()` (Réessayer). `@ngrx/signals/resource` (`extendResource`,
  `withPreviousValueOnLoading`, `withValueOnError`) is experimental: use it only where keeping the
  previous value while reloading is needed, and say so in the report.
- One-shot writes: `async` methods in `withMethods` awaiting the data-access service.
- Streams (debounced search, the Ctrl + K palette, bursts of clicks): `rxMethod` from
  `@ngrx/signals/rxjs-interop` with `tapResponse({ next, error, finalize })` from
  `@ngrx/operators` (the object form is the only one left in v22). Pick the flattening operator on
  purpose: `switchMap` for "latest wins", `concatMap` for ordered writes, `exhaustMap` to ignore
  repeats, `groupBy` + `mergeMap` to keep one stream per task. Read other store state inside the
  pipe through its signals (`store.query()`), not with `withLatestFrom`.
- A failed read is a state flag (`searchFailed`), never an emptied collection, with a retry method
  the page calls from Réessayer.
- Reacting to a signal without RxJS: `signalMethod` rather than an `effect()` that writes state.
- Call an `rxMethod` or `signalMethod` with a signal or an observable inside an injection context,
  or pass `{ injector }`: calling outside one without an injector is deprecated and will throw.
- `withHooks({ onInit })` runs in the injection context: start the loads the store owns there,
  with `takeUntilDestroyed()` for subscriptions.

## Cadenway interaction rules in a store

Load `cw-status-interactions` with this skill; the store is where those rules live.

- Optimistic change: keep the snapshot of what the change touches in a private slice, patch at once,
  call the data-access service, and on failure restore the snapshot and raise the error toast.
  The toast's Annuler restores the same snapshot and has its own rollback; drop the snapshot when
  the toast closes.
- Fast status clicks: one pending change per task in private state keyed by task id, shown at once;
  a new click replaces it; returning to the saved status drops it; the change settles 460 ms after
  the last click (`animateStatus` in `docs/maquette/source/App.dc.html`) and only that final
  status is sent; sends of one task never overlap. The [canonical store](task-list-store.md) implements all of it.
- Pushed realtime changes go through a store method that never overwrites a pending local edit.
- Form state stays in Signal Forms; a store receives the submitted value, not the field state.

## Entities

- Collections keyed by id: `withEntities<Task>()` from `@ngrx/signals/entities`, giving `entities`,
  `entityMap` and `ids`. Change them with the updaters inside `patchState` (`setAllEntities`,
  `upsertEntity`, `updateEntity`, `removeEntity`...).
- Ids that are not named `id`: `entityConfig({ entity: type<Goal>(), selectId: (g) => g.key })`.
- Private collection: `collection: '_draft'`.

## Events plugin

`@ngrx/signals/events` (`eventGroup`, `withReducer`, `withEventHandlers`, `injectDispatch`) fits
when several stores react to the same fact, for example one pushed realtime change applied by the
list, the board and the task detail. Default to plain methods; introducing events in a feature is
a decision to state in its `FEATURE.md`. Use scoped events when the flow must stay inside a feature.
