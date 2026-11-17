---
paths:
  - 'src/app/**/state/**'
  - 'src/app/**/*.store.ts'
  - 'src/app/**/*.store.spec.ts'
---

# State

Load `cw-tech-ngrx` before writing or reviewing a store. Read its task reference for store
layout, data and interactions, or testing.

- Apply the SignalStore boundary in `AGENTS.md`. ESLint and the edit guard enforce it.
- Follow the skill for naming, provider scope, protected state, computed values, data access and
  retry. For signal reactions use `signalMethod` or `rxMethod`. Keep `effect()` out of the store.
- Apply the store interaction reference for optimistic rollback, undo and fast status clicks.
  Update the label and icon immediately.
- When changing a task's status, remember the confirmed status before updating the displayed
  label and icon. If the write fails, restore that confirmed status and show the failure toast.
  Clear the failed pending change so the user can try again.
- Use the skill's scoped store reset and testing rules. Use `unprotected()` only to arrange state
  in a spec.
