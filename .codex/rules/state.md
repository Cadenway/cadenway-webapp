---
paths:
  - 'src/app/**/state/**'
---

# State

- Signals; follow the state approach already established in the codebase.
- Optimistic changes keep an undo snapshot and roll back on failure with a toast.
- Status changes: label and icon update at once; one pending change per task; the final status of a
  burst is the only one sent; going back to the saved status cancels the pending one.
