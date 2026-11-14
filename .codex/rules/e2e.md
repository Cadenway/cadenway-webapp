---
paths:
  - 'tests/e2e/**'
---

# End-to-end tests

- Playwright against the local stack started from cadenway-ops (`--profile core`).
- One scenario per mockup flow; assert what the user sees.
- Never stop a service or a dev server you did not start.
