---
paths:
  - 'src/**/*.spec.ts'
---

# Tests

- Vitest with the Angular testing utilities; specs next to their subject.
- Locate by role, accessible name or `data-testid`; never by a class.
- Fake `@cadenway/api-client` at its boundary; fixtures from the mockup (Atelier Nord, Sprint 14).
- A SignalStore is tested through `TestBed` and its public API, with its data-access service faked;
  a component spec provides a plain object of signals and `vi.fn()` methods in place of the store.
