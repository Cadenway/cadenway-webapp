---
paths:
  - 'src/app/features/spaces/ui/**'
---

# Space views

- Views share the list header, filters, grouping and selection; switching view never changes data.
- Drag and drop (board, calendar, workload) uses the CDK; every data-changing drop shows a toast with
  Annuler.
- The sheet edits with the keyboard (arrows, Enter or F2, Tab, Escape); the status shows before the name.
- Long lists are virtualized; groups collapse (Annulé collapsed by default).
