# Goals

## Purpose

The goals of the current quarter (`App.dc.html` lines 1571-1637): the statistics strip, the goals
with their health and progress, their key results, the goal and key result forms, the deletion
confirmation, and the `Goals` rail item (`goals.rail.label`). It owns that page and that item only;
the space names and rights belong to Spaces, the task detail and the people helpers to Task, the
members' names to the organization's member list (read here through `MembersService`), the shell
and its slots to Workspace.

## Routes

`GOALS_ROUTES` mounts `GoalsPage` at `goals` below `/:org`, inside the application shell, with the
`Goals` route title (`goals.route.title`) and `errorComponent: RouteErrorBoundary`. The quarter is
the current calendar quarter of the browser's day; the mockup has no quarter switcher.

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

- `@cadenway/api-client` through `data-access/services/goals-api`: `GoalsService` (`listGoals`,
  `getGoal`, `createGoal`, `deleteGoal`, `createGoalResult`, `updateGoalResult`,
  `deleteGoalResult`), `MembersService.listMembers` (owners and their names) and
  `TasksService.getTask` (milestone due dates, gap G-G1).
- Spaces' `ports/space-directory` (`SPACE_DIRECTORY`, the spaces and the caller's `callerRole`) and
  `ports/list-directory` (`LIST_DIRECTORY`, the list names, gap G-G2), both optional.
- Task's `.` entry: `TaskDetailOpener` (a milestone opens its task; `closed` and `changed` read the
  goals again), `personOf` and `Person`.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the organization, the role, the
  caller and the slug.
- Core's `@core/api` (`PASSIVE_REQUEST`, `readProblem`, `hasProblemCode`,
  `OrganizationSwitchPendingError`) and `@core/realtime` (`RealtimeConnection.reconnected`,
  optional).
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`accordion`, `alert-dialog`, `app-rail`, `button`, `checkbox`, `empty`, `input`,
  `progress`, `select`, `skeleton`, `stat`, `toast`, `toggle-group`).

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`); it takes the focus after a
  deletion. The rail item reads the router's `isActive` signal instead of `RouterLinkActive`, which
  removes `aria-current` on each of its updates.
- `GoalsPage` provides the page-scoped `GoalsStore` and `GoalMilestonesStore`. The first read of
  an organization shows the page skeleton (`Loading the goals`); its failure renders
  `RouteErrorBoundary`, whose `Retry` runs the route again; a successful read without goals shows
  `No goals this quarter`. The goals are read to the last cursor without the HTTP cache.
- No goal notice exists (gap G-R2): the goals are read again in the background on a window focus,
  a visible tab, a realtime reconnection and when a task detail closes or reports a change, once
  at the end of a 300 ms window. A background read keeps the goals shown while it runs and when it
  fails.
- The statistics are computed from the goals shown (count, rounded average, on track or achieved,
  achieved, at risk or behind) with the expected progress of the last read's summary.
- Rights (gap G-G3): an owner or administrator creates goals of the organization (`spaceId:
null`); anyone else gets a required `Space` select of the spaces they `edit`, and no `New goal`
  without one. A goal of the organization is changed by an owner or administrator, a space goal by
  whoever has `edit` on its space; the others see it read-only (no `Delete`, steps, checkbox,
  `Remove` or `Add a key result`). The gateway still refuses what a role does not allow.
- Writes: every goal write sends the version shown as `If-Match`; a `412 request.version-mismatch`
  reads the goal and sends once more from its version. The writes of one goal are serialized, and
  only the last value of a burst of `−`/`+` clicks is sent; once a goal's writes settle, the goal is
  read again for its progress, health and version. Values show at once and return to the confirmed
  ones after a refusal, which toasts the failure. An unknown outcome (no answer, a `5xx`) is
  settled by a read and never reported as a failure: a creation of unknown outcome counts as done
  when the read finds it. Confirmed writes stay over the read goals until a read issued after them
  lands. Each write is bound to the organization it started in: after a switch nothing more is
  sent, patched or toasted, and the forms and the confirmation close.
- Deletion asks for a confirmation (`Delete the goal “<name>”?`), since `deleteGoal` is final and
  no restore exists (gap G-G4); the toast `Goal deleted` has no `Undo`. A goal already gone counts
  as deleted. A key result is removed without undo, as the mockup does.
- Milestones (gap G-G1): one `getTask` per milestone key, at most four at once, cancelled when the
  keys change, on a reconnection, when a task detail closes or reports a change, and with the page.
  A `404` shows `Milestone not found`; a task due before today shows `Late`, otherwise `Upcoming`.
- A list-progress result names its list from `LIST_DIRECTORY`, or reads `Calculated from its list`
  for an archived list the sidebar does not show (gap G-G2).
- The expected progress is a tick drawn over `cw-progress`, which has no marker (G-G5, DS2); the
  statistics strip is laid out two by two below 1024 px over `cw-stat-group` (DS3). Below 640 px
  the progress bar takes its own line.
