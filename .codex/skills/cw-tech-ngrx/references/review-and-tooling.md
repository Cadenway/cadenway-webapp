# Store review and tooling

## Enforced mechanically

| Check | Runs in | Refuses |
| --- | --- | --- |
| `@ngrx/eslint-plugin` `signalsTypeChecked` | `pnpm lint` | `protectedState: false`, an array at the root of `withState` or `signalState`, an uncalled `type`, a custom feature with input but no generic |
| `no-restricted-imports`, `no-restricted-syntax` | `pnpm lint`, every `.ts` file | static and dynamic imports of the global Store family and third-party store extensions |
| `@typescript-eslint/no-restricted-imports` | `pnpm lint`, store files (`state/**`, `*.store.ts`) | `@cadenway/api-client`, `@angular/common/http`, `effect`, `withLatestFrom`, `rxjs/operators` |
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
2. File, store, state type and member names follow the [naming table](store-structure.md#naming); private members use `_`.
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
   failure rolls back with the error toast, Undo restores the snapshot, a refused undo keeps
   Undo, the snapshot is dropped when the toast closes; a pushed change never overwrites a
   pending edit.
9. Loading, error and empty states reach the page: an error is a state flag (not an empty list),
   with a retry method for Retry.
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
