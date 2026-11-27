# My tasks

## Purpose

The `My tasks` screen (`App.dc.html` lines 1749-1789): every task assigned to the caller, across
spaces, and its `My tasks` rail item (`my-tasks.rail.label`). It owns that page and that item only;
the task rows, the task menu and the task detail belong to Task, the list names to Spaces, the shell
and its slots to Workspace.

This step is a foundation: the route, the rail item and a page that renders its title
(`my-tasks.header.title`) only. The tabs, the groups and the rows come with its step 6 page package.

## Routes

`MY_TASKS_ROUTES` mounts `MyTasksPage` at `my-tasks` below `/:org`, inside the application shell,
with the `My tasks` route title (`my-tasks.route.title`) and `errorComponent: RouteErrorBoundary`.
`?tab=closed` selects the second tab; the default is `open`.

## Public entry points

| Entry point       | Consumers |
| ----------------- | --------- |
| `my-tasks.routes` | workspace |
| `providers`       | workspace |

`providers` publishes `withMyTasksRailItem()` (`railNavigation`, order 20, between Inbox and
Spaces): a link to `/<slug>/my-tasks` with the check square, filled and marked
`aria-current="page"` while the screen is shown, whatever its query parameters.

## Dependencies

- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the slug of the link.
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`app-rail`).

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- The rail item reads the router's `isActive` signal instead of `RouterLinkActive`, which removes
  `aria-current` on each of its updates (a query-only navigation such as `?task=` included).
- A failure of the page's primary read renders `RouteErrorBoundary` in place of the page, so the
  shell stays.
