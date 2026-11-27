# Goals

## Purpose

The goals of the current quarter (`App.dc.html` lines 1571-1637): the goals, their key results and
their forms, and the `Goals` rail item (`goals.rail.label`). It owns that page and that item only;
the space names and rights belong to Spaces, the task detail to Task, the shell and its slots to
Workspace.

This step is a foundation: the route, the rail item and a page that renders its title
(`goals.header.title`) only. The rest comes with its step 6 page package.

## Routes

`GOALS_ROUTES` mounts `GoalsPage` at `goals` below `/:org`, inside the application shell, with the
`Goals` route title (`goals.route.title`) and `errorComponent: RouteErrorBoundary`.

## Public entry points

| Entry point    | Consumers |
| -------------- | --------- |
| `goals.routes` | workspace |
| `providers`    | workspace |

`providers` publishes `withGoalsRailItem()` (`railNavigation`, order 50, after Dashboards): a
link to `/<slug>/goals` with the target, marked `aria-current="page"` while the goals are shown,
whatever the query parameters. The target keeps its Bold weight in both states, as the mockup draws
it (`App.dc.html` line 6964). The settings shells do not bind it: `Compte.dc.html` and
`Organisation.dc.html` draw no `Goals` in their rail.

## Dependencies

- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the slug of the link.
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`app-rail`).

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- A failure of the page's primary read renders `RouteErrorBoundary` in place of the page, so the
  shell stays.
