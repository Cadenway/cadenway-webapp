# Store structure and scope

## Layout

```text
<feature>/
├─ data-access/services/<concern>.ts   ← the only callers of @cadenway/api-client; return display models
├─ models/<concept>.ts                 ← display models the store holds
└─ state/
   ├─ <concept>.store.ts               ← one signalStore per concept the screen manages
   ├─ <concept>.store.spec.ts
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
| File | `<concept>.store.ts`, kebab-case | `task-list.store.ts` |
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
