---
name: cw-quality
description: Run the local quality gate, stopping at the first failure.
---

Run the gate yourself and report each step. No agent.

**With a spec filter**, pass the requested filter to `pnpm test --` as one argument.
Report the executed spec count. If zero specs ran, report that explicitly and do not mark the check as passing.

**Without an argument**, run in order and stop at the first failure: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:architecture`, `pnpm test:coverage`, `pnpm build`.

`pnpm build` matters even when tests are green: strict templates catch what specs do not. A script that does not exist yet is reported as **not available**. End with one line per step: PASS, FAIL, not run or not available.
