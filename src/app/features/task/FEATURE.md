# Task

## Purpose

Task detail, task creation and the task components shared by other features.

## Routes

The authenticated application mounts `/taches/:taskKey`. The route binds the key to the
organization verified at navigation.

## Public entry points

| Entry point   | Consumers |
| ------------- | --------- |
| `task.routes` | app       |

## Dependencies

- Published `@cadenway/api-client` Tasks and Trash operations and the app-wide API configuration.
- The Auth feature's organization resolver and browser session lock.
- Published `@cadenway/ui` for the task status, loading, and error controls.

## Invariants

- The page scopes `TaskDetailStore` to the page instance and resets it when the task key or routed
  organization changes.
- Only an active task on a list that grants `edit` offers status controls. Status choices use
  the space's visible labels and predefined milestones. Cancellation with a reason belongs
  to a separate confirmation flow.
- The optimistic status settles after 460 milliseconds, with at most one write in flight.
  Writes name the current task version in `If-Match`. A rejected write restores the confirmed
  status and a version conflict reloads the task before the next selection.
- Detail reads and writes recheck the active organization under the same browser lock used
  by session changes. If it differs, the detail is invalidated. A sent write holds the lock until
  it settles, including when navigation discards its result.
- Only a `task.trashed` response with a verified entry UUID can offer to restore a task. The
  restore call uses that entry UUID and lets the Gateway enforce current permissions. The page
  reloads the original task key so a restored descendant can open directly.
- Partial comments failures remain local to the comments section.
