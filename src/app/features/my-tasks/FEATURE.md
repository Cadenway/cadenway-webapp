# My tasks

## Purpose

The `My tasks` screen (`App.dc.html` lines 1749-1789): every task assigned to the caller, across
spaces, and its `My tasks` rail item (`my-tasks.rail.label`). It owns that page, its reads, its
due buckets and that item only; the task rows (`cw-task-line`), the task menu, its writes
(`TaskRowActionsStore`), the cancel reason dialog and the task detail belong to Task, the list
names to Spaces, the shell and its slots to Workspace.

## Routes

`MY_TASKS_ROUTES` mounts `MyTasksPage` at `my-tasks` below `/:org`, inside the application shell,
with the `My tasks` route title (`my-tasks.route.title`), `errorComponent: RouteErrorBoundary` and
Task's `TASK_ROW_ACTIONS_PROVIDERS` (its write lane, `TaskStatusChangesStore` and
`TaskRowActionsStore`), so the menu's pending writes and toasts die with the screen.
`?tab=closed` selects the `Done` tab; the default is `To do`, without a parameter.

## Public entry points

| Entry point       | Consumers |
| ----------------- | --------- |
| `my-tasks.routes` | workspace |
| `providers`       | workspace |

`providers` publishes `withMyTasksRailItem()` (`railNavigation`, order 20, between Inbox and
Spaces): a link to `/<slug>/my-tasks` with the check square, filled and marked
`aria-current="page"` while the screen is shown, whatever its query parameters.

## Dependencies

- `@cadenway/api-client` through `data-access/` (`MyTasksApi`): `MyTasksService.listMyTasks`
  (`state` `open` or `closed`, 100 per page, read to the last cursor, `cache: 'no-store'`, pinned
  with `If-Organization-Match`, passive for background refreshes) and `MembersService.listMembers`
  (owners, admins and members, to the last page) for the menu's `Assign`.
- Task's `.` entry: `TaskSummary`, `TaskLine`, `TaskMenu`, `TaskCancelDialog`,
  `TASK_ROW_ACTIONS_PROVIDERS`, `TaskRowActionsStore`, `TaskDetailOpener` (`closed`, `changed`),
  `TaskCreate` (`open`, `created`), `TaskMoveTarget`, `Person`, `personOf`, `isClosedStatus`.
- Spaces' `ports/list-directory` (`LIST_DIRECTORY`, optional) for the list names and `Move to`.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the organization and the slug.
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, problem readers), `@core/realtime`
  (`RealtimeConnection.reconnected`, optional).
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `button`, `context-menu`, `empty`, `menu`,
  `skeleton`, `tabs`) and `@cadenway/icons`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`). The header stays while the first
  read runs; the skeleton (`my-tasks.loading`, `role="status"`, `aria-busy`) stands for the tabs
  and three labelled groups of four, three and two lines.
- `MyTasksStore` is provided by `MyTasksPage` (component scope), so the error boundary's `Retry`,
  which re-creates the page, starts over. Its first read of an organization and tab is active and
  its failure reaches the route's error boundary through the template's read (the unavailable
  state). A failed later page keeps the pages read before it (`Some of your tasks could not be
loaded.` with `Retry`); a failed refresh keeps the previous rows (`Your tasks could not be
refreshed.` with `Retry`); a refresh refused while the organization context is stale keeps them
  silently and is sent again once the context is verified. A successful empty tab shows
  `Nothing here`.
- No realtime event covers the caller's tasks across lists (gap G-R1): the tab is read again in
  the background, keeping its rows, after each settled write of the menu
  (`TaskRowActionsStore.changed`), on window focus, after a realtime reconnection, when a task
  detail closes or reports a change (`TaskDetailOpener.closed`, `changed`) and after a creation
  (`TaskCreate.created`). A read asked for while another runs is sent once it settles; no list
  room is joined.
- An organization switch or a tab change drops the rows at once and reads anew; a read of the
  previous organization is aborted and never shown. The tab counts (`counts.open`,
  `counts.closed`, from the last page read) stay while another tab of the same organization is
  read.
- Groups: on `To do` the late (grenat), today, next seven days, later and undated buckets
  (`utils/due-bucket`, the rules of the mockup's `dueInfo` against the local day of the read), only
  the non-empty ones, in that order; on `Done` one `Done and cancelled` group. Lines keep the
  gateway's order (by due date). A line stays in the group of its read status and date until the
  next read, which a settled status write triggers; a deleted line hides at once
  (`TaskRowActionsStore.rows`).
- The context menu opens from the list item around each `cw-task-line` (right click, Shift F10,
  the Menu key, a long press), not from the line itself, whose `opened` output would otherwise also
  receive the trigger's. The members are a secondary read: when it failed, `Assign` stays empty
  and the next menu opening reads them again.
- A list that Spaces' `LIST_DIRECTORY` does not hold, once it holds any list, is archived and
  reads `Archived list` (gap G-T1, until `TaskSummary` carries its list's name); the cell is empty
  while the directory is still empty.
- The rail item reads the router's `isActive` signal instead of `RouterLinkActive`, which removes
  `aria-current` on each of its updates (a query-only navigation such as `?task=` included).
