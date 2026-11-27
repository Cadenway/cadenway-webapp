# Trash

## Purpose

The trash (`App.dc.html` lines 1965-1997): the deleted tasks the caller may restore or purge for
good. It owns that page only; its `Trash` link and count in the sidebar footer belong to Spaces, the
task detail to Task, the shell and its slots to Workspace.

This step is a foundation: the route and a page that renders its title (`trash.header.title`) only.
The entries, `Restore`, the purge and `Empty the trash` come with its step 6 page package.

## Routes

`TRASH_ROUTES` mounts `TrashPage` at `trash` below `/:org`, inside the application shell, with the
`Trash` route title (`trash.route.title`) and `errorComponent: RouteErrorBoundary`. Spaces' sidebar
footer and Errors' `Open the trash` link to it.

## Public entry points

| Entry point    | Consumers |
| -------------- | --------- |
| `trash.routes` | workspace |

## Dependencies

- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- A failure of the page's primary read renders `RouteErrorBoundary` in place of the page, so the
  shell stays.
