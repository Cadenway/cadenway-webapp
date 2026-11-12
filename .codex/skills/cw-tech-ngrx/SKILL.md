---
name: cw-tech-ngrx
description: "Build, test or review NgRx SignalStore state in cadenway-webapp: store layout per feature, naming, where API calls and side effects go, computed signals, entities, testing and anti-patterns. Load it before writing or reviewing anything under a feature state/ folder."
---

# NgRx SignalStore for Cadenway

State management is **NgRx SignalStore** (`@ngrx/signals`); `@ngrx/operators` supplies
`tapResponse`; `@ngrx/eslint-plugin` enforces the type-checked `signals` rule set in `pnpm lint`,
next to the repository restrictions listed under "Enforced mechanically". Read the installed versions in `package.json`; read the documentation for that
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
| Private members | `_` prefix (state slices, props, methods) | `_pending`, `_undo` |
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
  changes of one step (a click, a response) in one `patchState` call.
- Keep derived data out of state: filters, grouping, counts and sort orders are `withComputed`.
  `withComputed` takes computed signals or plain functions (wrapped in `computed` for you).
- Share code between computed signals or methods of the same feature through a local helper in the
  factory, not by splitting into several features that reference each other.
- Dependencies: a default parameter of the `withMethods` factory when only methods use them
  (`withMethods((store, api = inject(TaskApi)) => ...)`); `withProps` when computed signals or
  hooks share them (`withProps(() => ({ _api: inject(TaskApi) }))`). `withProps` also holds
  observables and resources: anything that is not state.

## Canonical store

Reference implementation in the repository: `src/app/core/config/runtime-config-store.ts` (root
store, private slice, a computed that guards a missing value, an async method over its
`data-access/` source) and its spec, which fakes that source.

The example below is the feature pattern, to start from: entities, a debounced search whose failure
is a state flag with a retry, and the mockup's status rules (status shown at once, one pending
change per task settling 460 ms after the last click, a return to the saved status cancelling it,
sends of one task never overlapping, rollback on failure, Annuler with its own rollback). `TaskApi`,
`Task` and `StatusKey` are example names; the toast is a comment until `core/` provides it. The
example and its spec were compiled, linted and tested against the installed versions.

```ts
import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  concatMap,
  debounce,
  debounceTime,
  EMPTY,
  from,
  groupBy,
  mergeMap,
  pipe,
  switchMap,
  tap,
  timer,
} from 'rxjs';

import { TaskApi } from '../data-access/services/task-api';
import type { StatusKey, Task } from '../models/task';

/** From the mockup (`App.dc.html`, `animateStatus`): a status change settles 460 ms after the last click. */
const STATUS_SETTLE_MS = 460;

interface StatusRequest {
  readonly id: string;
  readonly status: StatusKey;
  /** An undo is sent at once and leaves no new snapshot. */
  readonly undo: boolean;
}

interface TaskListState {
  readonly query: string;
  readonly isLoading: boolean;
  readonly searchFailed: boolean;
  readonly selectedIds: readonly string[];
  /** Status shown at once for a click that has not settled: one pending change per task. */
  readonly _pending: Readonly<Record<string, StatusKey>>;
  /** Status before the last sent change, kept while the toast offers Annuler. */
  readonly _undo: Readonly<Record<string, StatusKey>>;
}

const initialState: TaskListState = {
  query: '',
  isLoading: false,
  searchFailed: false,
  selectedIds: [],
  _pending: {},
  _undo: {},
};

/** Pure helper shared by several updaters: the record without one task. */
function omitTask<T>(record: Readonly<Record<string, T>>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

export const TaskListStore = signalStore(
  withEntities<Task>(),
  withState(initialState),
  withComputed(({ entities, _pending, selectedIds }) => {
    // Shared by the computed signals below: tasks as shown, pending clicks applied.
    const tasks = (): Task[] => {
      const pending = _pending();
      return entities().map((task) =>
        Object.hasOwn(pending, task.id) ? { ...task, status: pending[task.id] } : task,
      );
    };
    return {
      tasks,
      selectedCount: () => selectedIds().length,
      doneCount: () => tasks().filter((task) => task.status === 'done').length,
    };
  }),
  // The dependency goes in the `withMethods` factory because only methods use it; use `withProps`
  // when computed signals or hooks share it.
  withMethods((store, api = inject(TaskApi)) => {
    const search = rxMethod<string>(
      pipe(
        debounceTime(300),
        tap((query) => {
          patchState(store, { query, isLoading: true, searchFailed: false });
        }),
        switchMap((query) =>
          api.search(query).pipe(
            tapResponse({
              next: (tasks) => {
                patchState(store, setAllEntities(tasks), { isLoading: false });
              },
              // Keep the last tasks: the page shows the error panel with Réessayer.
              error: () => {
                patchState(store, { isLoading: false, searchFailed: true });
              },
            }),
          ),
        ),
      ),
    );

    const commit = ({ id, status, undo }: StatusRequest) => {
      const pending = store._pending();
      // A later click replaced this one, or a return to the saved status cancelled it.
      if (!Object.hasOwn(pending, id) || pending[id] !== status) return EMPTY;
      if (!Object.hasOwn(store.entityMap(), id)) return EMPTY;
      const saved = store.entityMap()[id].status;
      const undoBefore = store._undo();
      patchState(store, updateEntity({ id, changes: { status } }), ({ _pending, _undo }) => ({
        _pending: omitTask(_pending, id),
        _undo: undo ? omitTask(_undo, id) : { ..._undo, [id]: saved },
      }));
      return from(api.changeStatus(id, status)).pipe(
        tapResponse({
          next: () => {
            // The server confirmed the status already shown.
          },
          error: () => {
            patchState(store, updateEntity({ id, changes: { status: saved } }), ({ _undo }) => ({
              _undo: Object.hasOwn(undoBefore, id)
                ? { ..._undo, [id]: undoBefore[id] }
                : omitTask(_undo, id),
            }));
            // Raise the error toast here once core/ provides the toast service.
          },
        }),
      );
    };

    // Per task: only the last click of a burst is sent, and sends never overlap.
    const send = rxMethod<StatusRequest>(
      pipe(
        groupBy((request) => request.id),
        mergeMap((requests) =>
          requests.pipe(
            debounce((request) => timer(request.undo ? 0 : STATUS_SETTLE_MS)),
            concatMap(commit),
          ),
        ),
      ),
    );

    return {
      select(ids: readonly string[]): void {
        patchState(store, { selectedIds: ids });
      },
      search,
      /** Réessayer on the error panel. */
      retrySearch(): void {
        search(store.query());
      },
      changeStatus(id: string, status: StatusKey): void {
        if (!Object.hasOwn(store.entityMap(), id)) return;
        if (store.entityMap()[id].status === status) {
          // Back to the saved status: the pending change is cancelled.
          patchState(store, ({ _pending }) => ({ _pending: omitTask(_pending, id) }));
          return;
        }
        patchState(store, ({ _pending }) => ({ _pending: { ..._pending, [id]: status } }));
        send({ id, status, undo: false });
      },
      /** The toast's Annuler: restores the status the last change replaced. */
      undo(id: string): void {
        const snapshots = store._undo();
        if (!Object.hasOwn(snapshots, id)) return;
        const status = snapshots[id];
        patchState(store, ({ _pending }) => ({ _pending: { ..._pending, [id]: status } }));
        send({ id, status, undo: true });
      },
      /** Called when the toast closes: Annuler is no longer offered. */
      forgetUndo(id: string): void {
        patchState(store, ({ _undo }) => ({ _undo: omitTask(_undo, id) }));
      },
    };
  }),
);
```

Its spec:

```ts
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { setAllEntities } from '@ngrx/signals/entities';
import { unprotected } from '@ngrx/signals/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskApi } from '../data-access/services/task-api';
import type { Task } from '../models/task';
import { TaskListStore } from './task-list-store';

const tasks: Task[] = [{ id: 't1', title: 'Maquette', status: 'todo' }];

function setup(api: Partial<TaskApi>) {
  TestBed.configureTestingModule({
    providers: [TaskListStore, { provide: TaskApi, useValue: api }],
  });
  const store = TestBed.inject(TaskListStore);
  patchState(unprotected(store), setAllEntities(tasks));
  return store;
}

const statusOf = (store: ReturnType<typeof setup>) => store.tasks()[0].status;

describe('TaskListStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows each click at once and sends only the final status of a burst', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });

    store.changeStatus('t1', 'in-progress');
    store.changeStatus('t1', 'done');

    expect(statusOf(store)).toBe('done');
    expect(changeStatus).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(changeStatus).toHaveBeenCalledExactlyOnceWith('t1', 'done');
    expect(store.doneCount()).toBe(1);
  });

  it('cancels the pending change when the saved status is clicked again', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });

    store.changeStatus('t1', 'done');
    store.changeStatus('t1', 'todo');
    await vi.runAllTimersAsync();

    expect(changeStatus).not.toHaveBeenCalled();
    expect(statusOf(store)).toBe('todo');
  });

  it('rolls back when the API refuses the change', async () => {
    const store = setup({ changeStatus: vi.fn(() => Promise.reject(new Error('500'))) });

    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    expect(statusOf(store)).toBe('todo');
  });

  it('undo sends the saved status at once', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.undo('t1');
    await vi.runAllTimersAsync();

    expect(statusOf(store)).toBe('todo');
    expect(changeStatus).toHaveBeenLastCalledWith('t1', 'todo');
  });

  it('a refused undo restores the changed status and keeps Annuler available', async () => {
    const changeStatus = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue();
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.undo('t1');
    await vi.runAllTimersAsync();
    expect(statusOf(store)).toBe('done');

    store.undo('t1');
    await vi.runAllTimersAsync();
    expect(statusOf(store)).toBe('todo');
  });

  it('offers no undo once the toast has closed', async () => {
    const changeStatus = vi.fn(() => Promise.resolve());
    const store = setup({ changeStatus });
    store.changeStatus('t1', 'done');
    await vi.runAllTimersAsync();

    store.forgetUndo('t1');
    store.undo('t1');
    await vi.runAllTimersAsync();

    expect(changeStatus).toHaveBeenCalledOnce();
    expect(statusOf(store)).toBe('done');
  });

  it('keeps the tasks and flags the failure when the search fails, then retries', async () => {
    const search = vi
      .fn<TaskApi['search']>()
      .mockReturnValueOnce(throwError(() => new Error('500')))
      .mockReturnValue(of([{ id: 't2', title: 'Sprint 14', status: 'todo' }]));
    const store = setup({ search });

    store.search('sprint');
    await vi.runAllTimersAsync();
    expect(store.searchFailed()).toBe(true);
    expect(store.tasks()).toEqual(tasks);

    store.retrySearch();
    await vi.runAllTimersAsync();
    expect(search).toHaveBeenLastCalledWith('sprint');
    expect(store.searchFailed()).toBe(false);
    expect(store.tasks().map((task) => task.id)).toEqual(['t2']);
  });
});
```

## Providing a store

| Scope | How | Use for |
| --- | --- | --- |
| Route | `providers: [TaskListStore]` on the feature route | state of a page: open list, filters, selection |
| Component | `providers: [TaskCreateStore]` in the page or overlay | state that dies with a dialog or panel |
| Root | `signalStore({ providedIn: 'root' }, ...)` | app-wide state only, in `core/` (session, organization, toasts) |

- A root store outlives navigation: one holding user or organization data is reset on sign-out
  and on organization change; one holding neither (the runtime configuration) is not.
- Among components, only pages (and overlays acting as pages) inject a store; providers,
  initializers and factories in `core/` may inject root stores. Presentational components take
  `input()` values and emit `output()` events; they never inject a store.

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
  status is sent; sends of one task never overlap. The canonical store implements all of it.
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
- Delays (debounce, the 460 ms settle): `vi.useFakeTimers()` in `beforeEach`, then
  `await vi.runAllTimersAsync()`; restore with `vi.useRealTimers()`.
- Component specs replace the store with a plain object of signals and `vi.fn()` methods provided
  in its place.
- Cover the Cadenway rules: rollback and toast on failure, undo and a refused undo, the last click
  of a burst being the only call, a return to the saved status sending nothing, a pushed change not
  overwriting a pending edit, a failed read setting its flag and retrying.

## Enforced mechanically

| Check | Runs in | Refuses |
| --- | --- | --- |
| `@ngrx/eslint-plugin` `signalsTypeChecked` | `pnpm lint` | `protectedState: false`, an array at the root of `withState` or `signalState`, an uncalled `type`, a custom feature with input but no generic |
| `no-restricted-imports`, `no-restricted-syntax` | `pnpm lint`, every `.ts` file | static and dynamic imports of the global Store family and third-party store extensions |
| `@typescript-eslint/no-restricted-imports` | `pnpm lint`, store files (`state/**`, `*-store.ts`) | `@cadenway/api-client`, `@angular/common/http`, `effect`, `withLatestFrom`, `rxjs/operators` |
| `no-restricted-globals` | `pnpm lint`, store files | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` |
| `@typescript-eslint/no-restricted-imports` | `pnpm lint`, non-spec files under `src/` | `@ngrx/signals/testing` |
| `guard.mjs` | agent edits under `src/` through `Write`, `Edit`, `MultiEdit` (Claude Code) and `apply_patch` (Codex) | static, side-effect and dynamic imports or `require` of the global Store family and third-party store extensions, `protectedState: false` |
| TypeScript | `pnpm typecheck` | `patchState` on a store from outside it, a `_` member read from outside |

- Shell writes (`sed -i`, heredocs, `Set-Content`) bypass the guard; `pnpm lint` still catches them.
- The plugin's `operators` rule set is not enabled: its only rule matches inside `createEffect`,
  which comes from the banned `@ngrx/effects`.
- A lint or guard refusal is the rule speaking: change the design, never disable the rule.

## Review checklist

1. SignalStore only; no global Store, effects, devtools or third-party extension.
2. File, store, state type and member names follow the naming table; private members use `_`.
3. Provided at the narrowest scope. A root store holds app-wide state only; one holding user or
   organization data is reset on sign-out and organization change.
4. Among components, only pages (and overlays acting as pages) inject a store; providers and
   initializers in `core/` may inject root stores. Presentational components get inputs and emit
   outputs.
5. State protected; one `patchState` per step (a click, a response); new references, no mutation.
6. Derived values in `withComputed`; no `effect()` writing state.
7. Network only through the feature's `data-access/` service, never `fetch` or the api-client from
   the store; display models only in state; `rxMethod` calls use `tapResponse` and a deliberate
   flattening operator.
8. Optimistic changes: the status shows at once, one pending change per task settles 460 ms after
   the last click, a return to the saved status cancels it, sends of one task never overlap, a
   failure rolls back with the error toast, Annuler restores the snapshot, a refused undo keeps
   Annuler, the snapshot is dropped when the toast closes; a pushed change never overwrites a
   pending edit.
9. Loading, error and empty states reach the page: an error is a state flag (not an empty list),
   with a retry method for Réessayer.
10. Spec next to the store: `TestBed`, data-access faked, typed fixtures, fake timers for delays,
    public API, the rules of item 8 covered; `unprotected` only to arrange.
11. `FEATURE.md` lists the store and its scope, and the invariants a reader would get wrong (for
    example a root store that is never reset).

## Anti-patterns

- Adding the global Store, effects, store-devtools or a third-party store extension.
- `protectedState: false`, or `patchState` on a store from a component.
- Calling `@cadenway/api-client` or `HttpClient` from a store; DTOs in state.
- Derived values copied into state; `effect()` used to keep two signals in sync.
- An array at the root of `withState` or `signalState`.
- A store injected by a presentational component, or a feature store imported by `core`.
- A root store for page state, or a root store never reset on sign-out.
- One store for a whole feature or the whole app; stores calling each other in cycles.
- Mutating state, or several `patchState` calls for one step (a click, a response).
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
