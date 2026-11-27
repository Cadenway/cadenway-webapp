# Dashboards

## Purpose

The team dashboard (`App.dc.html` lines 1791-1892): the organization's counters, the completions
per week, the workload per person, the tasks per status and the late tasks, and its `Dashboards`
rail item (`dashboards.rail.label`). It owns that page and that item only; the task rows and the task
detail belong to Task, the list names to Spaces, the shell and its slots to Workspace.

This step is a foundation: the route, the rail item and a page that renders its title
(`Team dashboard`, `dashboards.header.title`) only. The rest comes with its step 6 page package.

## Routes

`DASHBOARDS_ROUTES` mounts `DashboardPage` at `dashboards` below `/:org`, inside the application
shell, with the `Dashboards` route title (`dashboards.route.title`) and
`errorComponent: RouteErrorBoundary`. `?weeks=12` selects the longer period; the default is 8 weeks.

## Public entry points

| Entry point         | Consumers |
| ------------------- | --------- |
| `dashboards.routes` | workspace |
| `providers`         | workspace |

`providers` publishes `withDashboardsRailItem()` (`railNavigation`, order 40, after Spaces): a
link to `/<slug>/dashboards` with the bar chart, filled and marked `aria-current="page"` while the
dashboard is shown, whatever its query parameters.

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
