# Archives

## Purpose

The archives (`App.dc.html` lines 1999-2022): the archived lists and tasks the caller may restore.
It owns that page only; its `Archives` link and count in the sidebar footer belong to Spaces, the
task detail to Task, the shell and its slots to Workspace.

This step is a foundation: the route and a page that renders its title (`archives.header.title`)
only. The tabs, the archived lists and tasks and `Restore` come with its step 6 page package.

## Routes

`ARCHIVES_ROUTES` mounts `ArchivesPage` at `archives` below `/:org`, inside the application shell,
with the `Archives` route title (`archives.route.title`) and `errorComponent: RouteErrorBoundary`.
`?tab=tasks` selects the second tab; the default is `lists`. Spaces' sidebar footer links to it.

## Public entry points

| Entry point       | Consumers |
| ----------------- | --------- |
| `archives.routes` | workspace |

## Dependencies

- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- A failure of the page's primary read renders `RouteErrorBoundary` in place of the page, so the
  shell stays.
