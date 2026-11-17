---
description: "Run the local quality gate, stopping at the first failure."
argument-hint: "[optional spec glob]"
allowed-tools: Bash(pnpm format:check), Bash(pnpm test:lint), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test:architecture), Bash(pnpm test *), Bash(pnpm test:coverage), Bash(pnpm build)
---

Follow the [quality procedure](../../docs/development.md#full-local-quality-gate) from this checkout. Run and report the checks yourself.
With an argument, use the focused test procedure. Otherwise run the full gate in order.
