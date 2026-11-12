---
name: cw-tech-ngrx
description: "Build, test or review NgRx SignalStore state in cadenway-webapp: store layout per feature, naming, where API calls and side effects go, computed signals, entities, testing and anti-patterns. Load it before writing or reviewing anything under a feature state/ folder."
---

# NgRx SignalStore for Cadenway

State management is **NgRx SignalStore** (`@ngrx/signals`); `@ngrx/operators` supplies
`tapResponse`; `@ngrx/eslint-plugin` enforces the `signals` (type-checked) and `operators` rule
sets in `pnpm lint`. Read the installed versions in `package.json`; read the documentation for that
major only.

The global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`,
`@ngrx/component-store`, `@ngrx/router-store`, `@ngrx/data`) is not installed and is not to be
added: SignalStore covers feature state, entities and, through the Events plugin, a Flux-style flow.
A third-party SignalStore extension (`@angular-architects/ngrx-toolkit`, `@ngrx-toolkit/*`,
`ngrx-traits`) is an architecture decision, not a builder's call.

## Layout

```text
<feature>/
├─ data-access/services/<concern>.ts   ← the only callers of @cadenway/api-client; return display models
├─ models/<concept>.ts                 ← display models the store holds
└─ state/
   ├─ <concept>-store.ts               ← one signalStore per concept the screen manages
   ├─ <concept>-store.spec.ts
   └─ <concept>-updaters.ts            ← optional: pure state updaters shared by several methods
```

- One store per concept (`TaskListStore`, `TaskDetailStore`, `SpaceSidebarStore`), not one per
  feature and never one for the whole application. For entity collections the NgRx team
  recommends a dedicated store per entity type.
- A store belongs to its feature. Another feature reaches it only through an entry declared in the
  owner's `FEATURE.md`; `core` never imports a feature store.
- Lift a store, or a custom feature built with `signalStoreFeature`, only when a real second
  consumer appears (placement follows usage locality).

## Naming

| Element | Convention | Example |
| --- | --- | --- |
| File | `<concept>-store.ts`, kebab-case | `task-list-store.ts` |
| Store | PascalCase, `Store` suffix (the noun names what it is) | `TaskListStore` |
| State type and initial state | `<Concept>State`, `initialState` | `TaskListState` |
| Store type, only when needed | `export type TaskListStore = InstanceType<typeof TaskListStore>;` | |
| Computed signals | nouns or adjectives | `visibleTasks`, `selectedCount`, `isEmpty` |
| Methods | imperative verbs | `select`, `changeStatus`, `undo`, `load` |
| Private members | `_` prefix (state slices, props, methods) | `_pending`, `_snapshot` |
| Custom feature | `with<Concern>` | `withRequestStatus` |
| Events, when the plugin is used | `eventGroup` with source `'[Feature Source]'` | `'[Task List] Status Changed'` |

## Writing a store

- Functional style: `signalStore(...)` with `withState`, `withComputed`, `withProps`,
  `withMethods`, `withHooks`, in that order. The NgRx team recommends it over the class-based style.
- `withState` takes a record: never an array at the root (`withState<{ ids: string[] }>`, not
  `withState<string[]>`). Lint rule `@ngrx/with-state-no-arrays-at-root-level`.
- State stays protected (the default). Never `{ protectedState: false }`; lint rule
  `@ngrx/prefer-protected-state`. Components change state only through store methods.
- Update with `patchState` and new references; never mutate an object read from state. Group the
  changes of one user action in one `patchState` call.
- Keep derived data out of state: filters, grouping, counts and sort orders are `withComputed`.
  `withComputed` takes computed signals or plain functions (wrapped in `computed` for you).
- Share code between computed signals or methods of the same feature through a local helper in the
  factory, not by splitting into several features that reference each other.
- `withProps` holds dependencies (`inject(...)`), observables and resources: anything that is
  not state.

## Canonical store

Reference implementation in the repository: `src/app/core/config/runtime-config-store.ts` (root
store, private slice, a computed that guards a missing value, an async method) and its spec.

The example below shows the feature pattern: entities, a debounced search with `rxMethod`, an
optimistic status change with rollback and undo, and a pure updater shared by several methods.
`TaskApi`, `Task` and `StatusKey` are example names. The fast-click rule (one pending change per
task, final status only) adds a per-task pending slice on top of this snapshot. The example was
compiled, linted and tested against the installed versions.

```ts
import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap } from 'rxjs';

import { TaskApi } from '../data-access/services/task-api';
import type { StatusKey, Task } from '../models/task';

interface TaskListState {
  readonly query: string;
  readonly isLoading: boolean;
  readonly selectedIds: readonly string[];
  /** Status of each task before its unconfirmed change: the undo and rollback snapshot. */
  readonly _saved: Readonly<Record<string, StatusKey>>;
}

const initialState: TaskListState = { query: '', isLoading: false, selectedIds: [], _saved: {} };

/** Pure updater, shared by several methods: drops the snapshot of one task. */
function dropSnapshot(id: string): (state: TaskListState) => Partial<TaskListState> {
  return ({ _saved }) => ({
    _saved: Object.fromEntries(Object.entries(_saved).filter(([key]) => key !== id)),
  });
}

export const TaskListStore = signalStore(
  withEntities<Task>(),
  withState(initialState),
  withComputed(({ entities, selectedIds }) => ({
    selectedCount: () => selectedIds().length,
    doneCount: () => entities().filter((task) => task.status === 'done').length,
  })),
  withMethods((store, api = inject(TaskApi)) => ({
    select(ids: readonly string[]): void {
      patchState(store, { selectedIds: ids });
    },
    search: rxMethod<string>(
      pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((query) => {
          patchState(store, { query, isLoading: true });
        }),
        switchMap((query) =>
          api.search(query).pipe(
            tapResponse({
              next: (tasks) => {
                patchState(store, setAllEntities(tasks));
              },
              error: () => {
                patchState(store, setAllEntities<Task>([]));
              },
              finalize: () => {
                patchState(store, { isLoading: false });
              },
            }),
          ),
        ),
      ),
    ),
    async changeStatus(id: string, status: StatusKey): Promise<void> {
      if (!(id in store.entityMap())) return;
      const previous = store.entityMap()[id].status;
      patchState(store, updateEntity({ id, changes: { status } }), ({ _saved }) => ({
        _saved: { ..._saved, [id]: previous },
      }));
      try {
        await api.changeStatus(id, status);
      } catch {
        patchState(store, updateEntity({ id, changes: { status: previous } }), dropSnapshot(id));
        // Raise the error toast here once core/ provides the toast service.
      }
    },
    /** The toast's Annuler: restores the snapshot and sends it. */
    async undo(id: string): Promise<void> {
      if (!(id in store._saved())) return;
      const status = store._saved()[id];
      patchState(store, updateEntity({ id, changes: { status } }), dropSnapshot(id));
      await api.changeStatus(id, status);
    },
  })),
);
```

Its spec:

```ts
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { setAllEntities } from '@ngrx/signals/entities';
import { unprotected } from '@ngrx/signals/testing';
import { describe, expect, it, vi } from 'vitest';

import { TaskApi } from '../data-access/services/task-api';
import type { Task } from '../models/task';
import { TaskListStore } from './task-list-store';

const tasks: Task[] = [{ id: 't1', title: 'Maquette', status: 'todo' }];

function setup(changeStatus: () => Promise<void>) {
  TestBed.configureTestingModule({
    providers: [TaskListStore, { provide: TaskApi, useValue: { changeStatus } }],
  });
  const store = TestBed.inject(TaskListStore);
  patchState(unprotected(store), setAllEntities(tasks));
  return store;
}

describe('TaskListStore', () => {
  it('changes the status at once and keeps it when the API accepts', async () => {
    const store = setup(vi.fn(() => Promise.resolve()));
    const change = store.changeStatus('t1', 'done');
    expect(store.entityMap()['t1'].status).toBe('done');
    await change;
    expect(store.doneCount()).toBe(1);
  });

  it('rolls back when the API refuses', async () => {
    const store = setup(vi.fn(() => Promise.reject(new Error('500'))));
    await store.changeStatus('t1', 'done');
    expect(store.entityMap()['t1'].status).toBe('todo');
  });

  it('undo restores the saved status and sends it', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup(changeStatus);
    await store.changeStatus('t1', 'done');
    await store.undo('t1');
    expect(store.entityMap()['t1'].status).toBe('todo');
    expect(changeStatus).toHaveBeenLastCalledWith('t1', 'todo');
  });
});
```

## Providing a store

| Scope | How | Use for |
| --- | --- | --- |
| Route | `providers: [TaskListStore]` on the feature route | state of a page: open list, filters, selection |
| Component | `providers: [TaskCreateStore]` in the page or overlay | state that dies with a dialog or panel |
| Root | `signalStore({ providedIn: 'root' }, ...)` | app-wide state only, in `core/` (session, organization, toasts) |

- A root store outlives navigation: reset it on sign-out and on organization change.
- Only pages (and overlays acting as pages) inject a store. Presentational components take
  `input()` values and emit `output()` events; they never inject a store.

## API calls and side effects

- A store never imports `@cadenway/api-client` or `HttpClient`: it injects the feature's
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
  repeats.
- Reacting to a signal without RxJS: `signalMethod` rather than an `effect()` that writes state.
- Call an `rxMethod` or `signalMethod` with a signal or an observable inside an injection context,
  or pass `{ injector }`: calling outside one without an injector is deprecated and will throw.
- `withHooks({ onInit })` runs in the injection context: start the loads the store owns there,
  with `takeUntilDestroyed()` for subscriptions.

## Cadenway interaction rules in a store

Load `cw-status-interactions` with this skill; the store is where those rules live.

- Optimistic change: keep the snapshot of what the change touches in a private slice, patch at once,
  call the data-access service, and on failure restore the snapshot and raise the error toast.
  The toast's Annuler restores the same snapshot.
- Fast status clicks: one pending change per task in private state keyed by task id; a new click
  replaces it; returning to the saved status drops it; only the final status of the burst is sent.
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

## Testing

Load `cw-web-testing`; specs run with Vitest through `pnpm test --include <feature>/state`.

- Instantiate with `TestBed`: `TestBed.inject(Store)` for a root store, otherwise provide it in
  `TestBed.configureTestingModule({ providers: [Store, ...] })`. Never `new`: `rxMethod`,
  `signalMethod` and `inject()` need the injection context.
- Fake the data-access service with `{ provide: TaskApi, useValue: fake }`; no network, no
  api-client in a store spec. Type fixtures with the model (`const tasks: Task[] = ...`): entity
  updaters otherwise infer literal types and the spec does not compile.
- Test the public API only: initial state, computed values and the effect of methods. Do not spy on
  the store's own methods; extract complex logic into a service and fake that.
- Arrange state the public API cannot reach with `patchState(unprotected(store), ...)` from
  `@ngrx/signals/testing`; never to assert.
- A method called with a signal: wait for the effect (`TestBed.tick()` or `await expect.poll(...)`).
- Component specs replace the store with a plain object of signals and `vi.fn()` methods provided
  in its place.
- Cover the Cadenway rules: rollback and toast on failure, undo, the last click of a burst being the
  only call, a pushed change not overwriting a pending edit.

## Enforced mechanically

| Check | Runs in | Refuses |
| --- | --- | --- |
| `@ngrx/eslint-plugin` `signalsTypeChecked` | `pnpm lint` | `protectedState: false`, an array at the root of `withState` or `signalState`, an uncalled `type`, a custom feature with input but no generic |
| `@ngrx/eslint-plugin` `operators` | `pnpm lint` | `withLatestFrom` where `concatLatestFrom` belongs |
| `no-restricted-imports` | `pnpm lint`, all files | the global Store family and third-party store extensions |
| `@typescript-eslint/no-restricted-imports` | `pnpm lint`, store files (`state/**`, `*-store.ts`) | `@cadenway/api-client`, `@angular/common/http`, `effect` |
| `@typescript-eslint/no-restricted-imports` | `pnpm lint`, non-spec files | `@ngrx/signals/testing` |
| `guard.mjs` | every agent edit under `src/` | the global Store family, third-party store extensions, `protectedState: false` |
| TypeScript | `pnpm typecheck` | `patchState` on a store from outside it, a `_` member read from outside |

A lint or guard refusal is the rule speaking: change the design, never disable the rule.

## Review checklist

1. SignalStore only; no global Store, effects, devtools or third-party extension.
2. File, store, state type and member names follow the naming table; private members use `_`.
3. Provided at the narrowest scope; a root store holds app-wide state only and is reset on sign-out
   and organization change.
4. Injected only by pages; presentational components get inputs and emit outputs.
5. State protected; one `patchState` per user action; new references, no mutation.
6. Derived values in `withComputed`; no `effect()` writing state.
7. API through the feature's `data-access/` service; display models only in state; `rxMethod`
   calls use `tapResponse` and a deliberate flattening operator.
8. Optimistic changes snapshot, roll back with the error toast and support Annuler; the fast-click
   rule holds; a pushed change never overwrites a pending edit.
9. Loading, error and empty states reach the page (skeleton, error panel with Réessayer, empty
   state).
10. Spec next to the store: `TestBed`, data-access faked, typed fixtures, public API, the rules of
    item 8 covered; `unprotected` only to arrange.
11. `FEATURE.md` lists the store and its scope.

## Anti-patterns

- Adding the global Store, effects, store-devtools or a third-party store extension.
- `protectedState: false`, or `patchState` on a store from a component.
- Calling `@cadenway/api-client` or `HttpClient` from a store; DTOs in state.
- Derived values copied into state; `effect()` used to keep two signals in sync.
- An array at the root of `withState` or `signalState`.
- A store injected by a presentational component, or a feature store imported by `core`.
- A root store for page state, or a root store never reset on sign-out.
- One store for a whole feature or the whole app; stores calling each other in cycles.
- Mutating state, or several `patchState` calls for one user action.
- `rxMethod` / `signalMethod` invoked with a signal outside an injection context without an injector.
- Field state of a form mirrored into a store.

## References

- SignalStore: https://ngrx.io/guide/signals/signal-store
- RxJS integration: https://ngrx.io/guide/signals/rxjs-integration
- Entities: https://ngrx.io/guide/signals/signal-store/entity-management
- Events: https://ngrx.io/guide/signals/signal-store/events
- Testing: https://ngrx.io/guide/signals/signal-store/testing
- Resource extensions: https://ngrx.io/guide/signals/resource-extensions
- ESLint plugin: https://ngrx.io/guide/eslint-plugin
- The page sources live in `projects/www/src/app/pages/guide/` of https://github.com/ngrx/platform
  when the site does not render for a text fetch.
- NgRx publishes no MCP server (checked on 2026-11-12: nothing in `ngrx/platform` or under the
  `@ngrx` npm scope). The project's `angular` MCP (`ng mcp`) searches angular.dev, not ngrx.io. Do
  not add a community NgRx MCP server.
