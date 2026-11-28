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
  (`closed`, `changed`), `TaskMenuPeopleState`, `defaultStatusOptions`, `statusLabel`.
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
- Each organization change drops the kept dashboard, also after switching away and back (A, B,
  then A again), so only a read made since the switch shows and its failure reaches the error
  boundary; the members of another organization are never shown, and an answer for an
  organization or a period no longer current is never kept.
- The page never waits for the members: their people read `Unknown member` (`?`) until the
  members answer, then their names. A members read that fails, or runs again, never brings the
  skeleton back nor makes the page unavailable; a failed one is read again on the next refresh,
  and the task menu's `Assign` shows it loading or failed (`peopleState`), its `Retry` reading
  them again (`retryPeople`).
  A dashboard naming user ids the members do not hold (a new assignee) reads the members again,
  once per new set of ids in the organization, so a former member never causes a loop.
- The late rows keep the dashboard's read copy of each task (`LateTaskRow.source`) beside the
  copy they draw. The menu remembers the key of the row it opened on and looks the read copy up
  when an item runs; every write, `displayedTask` and `displayedStatus` take that read copy, so a
  write started over a pending one, then its `Undo`, only put back a confirmed value.
- After a confirmed deletion the focus goes to the row that took the deleted one's place, else
  the one before it, else the `Late` heading (above the empty state); a refused deletion shows
  the row again, which takes the focus.
- The late tasks are the contract's first ten (gap G-D1); when `lateCount` is larger, a
  `+N more late tasks` line counts the others. A list the sidebar's directory does not hold leaves
  the list cell blank (gap G-T1); the dashboard only returns tasks of live lists.
- The workload zones follow `App.dc.html` lines 6688-6698: above the threshold is `Overloaded`
  (grenat), from one task under it `High load` (balise). The meter's `max` is the threshold.
- Status words are the default ones (gap G-D2): a space's own names do not apply across spaces.
- The `TaskStatusChangesStore`, write lane and `TaskRowActionsStore` of the route die with the
  page (Task's invariants).

## Brick gaps (`@cadenway/ui` 0.13.0)

| Gap                  | What 0.13.0 lacks                                                                           | What the page does meanwhile                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS1 `cw-chart` table | A visible table toggle                                                                      | The card's own ghost button swaps the chart for `table[cwTable]`                                                                                              |
| DS3 `cw-stat-group`  | Responsive columns (2 × 2 below `lg` with inner borders)                                    | `cw-stat-group` stays the one card, switched to two columns below `lg` with `max-lg:` utilities on it and its `cw-stat` children (page layout, no brick copy) |
| `cw-stat` value tone | A colored value: the grenat `Late` count when above 0                                       | `sentiment="negative"` is set, which colors only a delta; the value stays foreground                                                                          |
| `cw-meter` header    | A leading avatar and the note beside the name                                               | The initials sit before the meter; the note shows under the track                                                                                             |
| `cw-meter` value     | `aria-valuenow` is not clamped to `max`: an overloaded person reads `7` over a `max` of `6` | Nothing: the visible fill is full and `aria-valuetext` reads `7 / 6`; the clamp belongs in the brick                                                          |

## Copy not taken word for word from the mockup

| Ids                                                                                                                                                                             | Why                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboards.chart.week-label` (`W{week}`)                                                                                                                                       | The mockup writes `S45` in French only; English uses `W45`.                                                                              |
| `dashboards.chart.current-week`                                                                                                                                                 | The mockup's bar text, `S45 (semaine en cours) : 3 tâches terminées`, reduced to the category the chart's tooltip and announcement take. |
| `dashboards.workload.caption`                                                                                                                                                   | The mockup's sentence, with the threshold as a placeholder.                                                                              |
| `dashboards.workload.empty`, `dashboards.status.empty`                                                                                                                          | The mockup always draws people and statuses.                                                                                             |
| `dashboards.late.more-one`, `dashboards.late.more-other`                                                                                                                        | Gap G-D1: the mockup lists every late task.                                                                                              |
| `dashboards.people.unknown`                                                                                                                                                     | The mockup names every person.                                                                                                           |
| `dashboards.late.delete-cancel`                                                                                                                                                 | The task menu's delete confirmation, as the list views word it.                                                                          |
| `dashboards.chart.empty`, `capacity`, `others`, `marker`; `dashboards.stats.up`, `down`, `flat`, `refreshing`, `goal-of`; `dashboards.workload.free`, `unmeasured`, `threshold` | The bricks' labels, in the Design System artifact's wording.                                                                             |
