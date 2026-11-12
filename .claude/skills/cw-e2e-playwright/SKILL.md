---
name: cw-e2e-playwright
description: "How to run Cadenway end-to-end scenarios locally against the Docker Compose stack, with evidence. Load it before writing or running an e2e scenario."
---

# Playwright

1. Start the stack: `docker compose -f compose.yaml -f compose.local.yaml --profile core up -d` in
   `../cadenway-ops/compose` (read-only reference from here: run it, do not edit it).
2. Start the app with `pnpm start` (or reuse a running one).
3. `pnpm e2e <spec>`; traces and screenshots of failures stay in `test-results/`.
