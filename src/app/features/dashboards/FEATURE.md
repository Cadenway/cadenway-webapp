# Dashboards

## Purpose

The team dashboard (`App.dc.html` lines 1791-1892): the organization's counters, the completions
per week, the workload per person, the tasks per status and the late tasks, and its `Dashboards`
rail item (`dashboards.rail.label`). It owns that page, its read and that item only; the task
rows, the task menu, their writes and the task detail belong to Task, the list names to Spaces,
the shell and its slots to Workspace, the error states to Errors.

## Routes

`DASHBOARDS_ROUTES` mounts `DashboardPage` at `dashboards` below `/:org`, inside the application
shell, with the `Dashboards` route title (`dashboards.route.title`) and
`errorComponent: RouteErrorBoundary`. `?weeks=12` selects the longer period; any other value, or
none, is 8 weeks. The route provides Task's `TASK_ROW_ACTIONS_PROVIDERS` for the menu of the late
tasks.

## Public entry points

| Entry point         | Consumers |
| ------------------- | --------- |
| `dashboards.routes` | workspace |
| `providers`         | workspace |

`providers` publishes `withDashboardsRailItem()` (`railNavigation`, order 40, after Spaces): a
link to `/<slug>/dashboards` with the bar chart, filled and marked `aria-current="page"` while the
dashboard is shown, whatever its query parameters.

## Dependencies

- `@cadenway/api-client` through `data-access/services/dashboard-api` (`DashboardApi`):
  `TeamReportsService.getTeamDashboard` (`today`, the browser's `timeZone`, `weeks`;
  `cache: 'no-store'`, `PASSIVE_REQUEST` for a background refresh) and `MembersService.listMembers`
  (every role, read to its last page, 100 per page).
- Task's `.` entry: `TaskSummary`, `Person`, `personOf`, `TaskLine` (`late` variant), `TaskMenu`,
  `TaskCancelDialog`, `TASK_ROW_ACTIONS_PROVIDERS`, `TaskRowActionsStore`, `TaskDetailOpener`
  (`closed`, `changed`), `defaultStatusOptions`, `statusLabel`.
- Spaces' `ports/list-directory` (`LIST_DIRECTORY`, optional) for the list names and `Move to`.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the organization and the slug of
  the link.
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@core/api` (`PASSIVE_REQUEST`), `@core/realtime` (`RealtimeConnection.reconnected`, optional).
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `button`, `chart`, `context-menu`, `empty`, `meter`,
  `progress`, `skeleton`, `stat`, `status-icon`, `table`, `tabs`).

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`). It and the `Period` tabs stay
  while the rest shows its skeleton (`Loading the dashboard`, `dashboards.loading`).
- `DashboardStore` is page-scoped (`DashboardPage` providers). The first read, and a read of
  another period, are active requests. A failed read with no answer shown for the organization and
  the period throws from `loading`, so the route's error boundary renders the unavailable state;
  its `Retry` creates the page anew. Another period keeps the shown figures (`stale`, the stats'
  refreshing spinner, `aria-busy` on the chart) until it answers.
- Re-reads (gap G-R2, no organization-wide notice): on window focus, on the tab becoming visible,
  when a task detail closes or changed a task, on a realtime reconnection (once at the end of a
  300 ms burst), and when a write of the late rows' menu settles (`TaskRowActionsStore.changed`).
  They are passive and keep the shown dashboard when they fail. A refresh asked while a read runs
  is sent once that read settles.
- Another organization drops the shown dashboard and members at once; an answer for an
  organization or a period no longer current is never kept.
- Members that cannot be read leave their people `Unknown member` (`?`), never the page
  unavailable; they are read again on the next refresh.
- The late tasks are the contract's first ten (gap G-D1); when `lateCount` is larger, a
  `+N more late tasks` line counts the others. A list the sidebar's directory does not hold leaves
  the list cell blank (gap G-T1); the dashboard only returns tasks of live lists.
- The workload zones follow `App.dc.html` lines 6688-6698: above the threshold is `Overloaded`
  (grenat), from one task under it `High load` (balise). The meter's `max` is the threshold.
- Status words are the default ones (gap G-D2): a space's own names do not apply across spaces.
- The `TaskStatusChangesStore`, write lane and `TaskRowActionsStore` of the route die with the
  page (Task's invariants).

## Brick gaps (`@cadenway/ui` 0.10.0)

| Gap                     | What 0.10.0 lacks                                                | What the page does meanwhile                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS1 `cw-chart` emphasis | A per-category color: the lighter current week (`bg-chart-1/45`) | Every bar is `chart-1`; the tooltip and the announcement name the last week `W45 (current week)`, and the caption says the last bar is the current week, without `lighter` |
| DS1 `cw-chart` values   | Value labels on vertical bars (the peak and the current week)    | No label over the bars; the tooltip, the hidden table and the visible table give every value                                                                               |
| DS1 `cw-chart` table    | A visible table toggle                                           | The card's own ghost button swaps the chart for `table[cwTable]`                                                                                                           |
| DS3 `cw-stat-group`     | Responsive columns (2 × 2 below `lg` with inner borders)         | `cw-stat-group` stays the one card, switched to two columns below `lg` with `max-lg:` utilities on it and its `cw-stat` children (page layout, no brick copy)              |
| `cw-stat` value tone    | A colored value: the grenat `Late` count when above 0            | `sentiment="negative"` is set, which colors only a delta; the value stays foreground                                                                                       |
| `cw-meter` header       | A leading avatar and the note beside the name                    | The initials sit before the meter; the note shows under the track                                                                                                          |

## Copy not taken word for word from the mockup

| Ids                                                                                                                                                                             | Why                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboards.chart.week-label` (`W{week}`)                                                                                                                                       | The mockup writes `S45` in French only; English uses `W45`.                                                                              |
| `dashboards.chart.caption`                                                                                                                                                      | The mockup's caption mentions the lighter bar, which 0.10.0 cannot draw (DS1).                                                           |
| `dashboards.chart.current-week`                                                                                                                                                 | The mockup's bar text, `S45 (semaine en cours) : 3 tâches terminées`, reduced to the category the chart's tooltip and announcement take. |
| `dashboards.workload.caption`                                                                                                                                                   | The mockup's sentence, with the threshold as a placeholder.                                                                              |
| `dashboards.workload.empty`, `dashboards.status.empty`                                                                                                                          | The mockup always draws people and statuses.                                                                                             |
| `dashboards.late.more-one`, `dashboards.late.more-other`                                                                                                                        | Gap G-D1: the mockup lists every late task.                                                                                              |
| `dashboards.people.unknown`                                                                                                                                                     | The mockup names every person.                                                                                                           |
| `dashboards.late.delete-cancel`                                                                                                                                                 | The task menu's delete confirmation, as the list views word it.                                                                          |
| `dashboards.chart.empty`, `capacity`, `others`, `marker`; `dashboards.stats.up`, `down`, `flat`, `refreshing`, `goal-of`; `dashboards.workload.free`, `unmeasured`, `threshold` | The bricks' labels, in the Design System artifact's wording.                                                                             |
