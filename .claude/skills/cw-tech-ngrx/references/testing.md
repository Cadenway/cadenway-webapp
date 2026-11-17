# Testing a SignalStore

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

See the [canonical spec](task-list-store-spec.md) for a worked example.
