# Spaces

## Purpose

The list page, the views of a space and the space overview.

## Routes

- `/espaces` lists the spaces visible in the current organization.
- `/espaces/:spaceId/listes` lists the visible lists of that space.
- `/espaces/:spaceId/listes/:listId` reads a list or sprint and its tasks.
- All three routes use the application's authenticated organization boundary. Collections use the
  opaque `cursor` supplied by the generated client.

## Public entry points

| Entry point     | Consumers |
| --------------- | --------- |
| `spaces.routes` | app       |

## Dependencies

- The generated Spaces, Lists and Task Queries clients read the current organization.
- The auth feature's organization guard protects every navigator route.
- Task links use the task feature's `/taches/:taskKey` route.

## Invariants

- An unavailable request is distinct from a successfully loaded empty collection.
- A list deep link must match the list's actual space before its tasks are read. Archived lists are
  omitted from this view.
- The navigator keeps no organization-specific cache across route changes.
