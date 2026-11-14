---
name: cw-web-testing
description: "How to test Cadenway web components, state and services with Vitest and Angular testing utilities, with mockup fixtures. Load it before writing a spec."
---

# Web testing

- `pnpm test --include <glob ending in .spec.ts>`.
- Render with the testing utilities; locate by role and name; interact with user events.
- Fake the api-client per test; assert loading, success, error and retry.
- SignalStores: `TestBed.inject`, data-access service faked, public API only; component specs
  provide a plain object of signals and `vi.fn()` in place of the store (`cw-tech-ngrx`).
