# Spaces

## Purpose

The list page, the views of a space and the space overview.

## Routes

- `/espaces` lists the spaces visible in the current organization.
- `/espaces/:spaceId/listes` lists the visible lists of that space.
- `/espaces/:spaceId/listes/:listId` reads a list or sprint and its tasks. The
  `?vue=tableau` option opens its status board and keeps the same header.
- All three routes use the application's authenticated organization boundary. Collections use the
  opaque `cursor` supplied by the generated client.

## Public entry points

| Entry point     | Consumers |
| --------------- | --------- |
| `spaces.routes` | app       |

## Dependencies

- The generated Spaces, Lists and Task Queries clients read the current organization.
  The generated Task client writes status changes with the observed version and expected organization.
- The auth feature verifies an active organization before every navigator route loads.
  Board operations share its session lock with organization switching.
- Task links use the task feature's `/taches/:taskKey` route.

## Invariants

- An unavailable request is distinct from a successfully loaded empty collection.
- A list deep link must match the list's actual space before its tasks are read. Archived lists are
  omitted from this view.
- The navigator keeps no organization-specific cache across route changes.
- The board uses a page-scoped `SprintBoardStore`. It reads only the initially populated visible
  groups and caps each group's rendered page at twelve cards. Pagination is per status.
- Cross-column drag and the keyboard status selector share one pending write per task. The
  precondition is the task's last confirmed version. Undo uses the version returned by that write.
  A version conflict rolls back and reloads the board. An organization mismatch discards the
  pending changes and the previous board and asks the caller to choose their organization.
- Hidden statuses are excluded. Cancelled and completed groups are read-only on the board.
  The cancellation reason and recurring successor belong to their separate workflows. Sorting
  inside a column follows the API's creation order.
