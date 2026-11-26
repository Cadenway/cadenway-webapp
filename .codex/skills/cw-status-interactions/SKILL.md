---
name: cw-status-interactions
description: "The mockup rules for status changes, fast clicks, toasts with undo, confirmations and the cancel-reason dialog. Load it whenever a component changes data visibly."
---

# Status and feedback interactions

- Status change: icon and label update at once; the row joins its new group 460 ms later when the
  view groups by status.
- Fast clicks: one pending change per task; a new click replaces it; returning to the saved status
  cancels it; automations and the log see only the final status.
- Cancelling asks a reason (Duplicate, Will not be done, Out of scope, Obsolete) and an optional note.
- Toasts: 6 s, title, description, Undo (restores the snapshot) or Open.
- Deletion: confirmation; trash 30 days with subtasks; sensitive deletions type the name.
