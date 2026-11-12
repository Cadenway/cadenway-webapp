---
name: wp-web-testing
description: "How to test Waypoint web components, state and services with Vitest and Angular testing utilities, with mockup fixtures. Load it before writing a spec."
---

# Web testing

- `pnpm test --include <glob ending in .spec.ts>`.
- Render with the testing utilities; locate by role and name; interact with user events.
- Fake the api-client per test; assert loading, success, error and retry.
