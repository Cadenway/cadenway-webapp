---
paths:
  - 'src/**/*.spec.ts'
---

# Tests

- Vitest with the Angular testing utilities; specs next to their subject.
- Locate by role, accessible name or `data-testid`; never by a class.
- Fake `@cadenway/api-client` at its boundary; fixtures from the mockup (Atelier Nord, Sprint 14).
- Use `cw-web-testing` for SignalStore and component test setup.
- Test the observable result where a regression can occur. In a page spec, distinguish a completed
  empty list from a failed load and verify that `Réessayer` requests another load. In a store spec,
  reject an optimistic status write and assert that the public view restores the confirmed status.
- Follow the [focused test procedure](../../docs/development.md#full-local-quality-gate) and count
  the tests actually run. Report zero tests as unverified.
