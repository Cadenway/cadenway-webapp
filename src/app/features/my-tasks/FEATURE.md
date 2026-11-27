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
  (`state` `open` or `closed`, 100 per page, `cache: 'no-store'`, pinned with
  `If-Organization-Match`, passive for background refreshes; `To do` to the last cursor, `Done`
  a page at a time) and `MembersService.listMembers` (owners, admins and members, to the last
  page) for the menu's `Assign`.
- Task's `.` entry: `TaskSummary`, `TaskLine`, `TaskMenu`, `TaskCancelDialog`,
  `TASK_ROW_ACTIONS_PROVIDERS`, `TaskRowActionsStore`, `TaskDetailOpener` (`closed`, `changed`),
  `TaskCreate` (`open`, `created`), `TaskMoveTarget`, `TaskMenuPeopleState`, `Person`, `personOf`,
  `isClosedStatus`.
- Spaces' `ports/list-directory` (`LIST_DIRECTORY`, optional) for the list names, their spaces
  and `Move to`.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the organization and the slug.
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, problem readers), `@core/realtime`
  (`RealtimeConnection.reconnected`, optional).
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `button`, `context-menu`, `empty`, `menu`,
  `skeleton`, `tabs`) and `@cadenway/icons`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`). The header stays while the first
  read runs; the skeleton (`my-tasks.loading`, `role="status"`, `aria-busy`) stands for the tabs
  and three labelled groups of four, three and two lines. Once the counts are known, the selected
  tab's content renders in its `cw-tab-panel`, which the tab controls.
- `MyTasksStore` is provided by `MyTasksPage` (component scope), so the error boundary's `Retry`,
  which re-creates the page, starts over. Its first read of an organization and tab is active; a
  failure of its first page reaches the route's error boundary through the template's read (the
  unavailable state). A first read whose later page fails shows the pages read before it (`Some of
your tasks could not be loaded.` with `Retry`). A refresh that fails, on its first page or a
  later one, keeps every row of the previous read (`Your tasks could not be refreshed.` with
  `Retry`) and never replaces it with a partial result; a passive refresh refused, on any page,
  while the organization context is stale (`OrganizationSwitchPendingError` or a `412
organization.context-changed`) keeps the rows silently and is sent again once the context is
  verified. A successful empty tab shows `Nothing here`.
- Read cost (a decision that deviates from the step 6 spec, section 3, which reads both tabs to the
  last cursor): `To do` is read to the last cursor, so its groups and counts are exact; `Done` is
  read one page (100 tasks) at a time, `Show more` adding the next page under the rows
  (`The next tasks could not be loaded.` when it fails, the button trying again), and a refresh of
  `Done` reads again only the pages shown. A window focus reads the tab again only when no read
  settled in the last 30 s (`FOCUS_REFRESH_MS`). The members are read on the first opening of the
  task menu, not when the page opens; `Assign` shows them loading (`peopleState`), then a failure
  with `Retry`, which reads them again, as the next opening does.
- No realtime event covers the caller's tasks across lists (gap G-R1): the tab is read again in
  the background, keeping its rows, after each settled write of the menu
  (`TaskRowActionsStore.changed`), on window focus (see above), after a realtime reconnection,
  when a task detail closes or reports a change (`TaskDetailOpener.closed`, `changed`) and after a
  creation (`TaskCreate.created`). A read asked for while another read or `Show more` runs is sent
  once it settles; no list room is joined.
- An organization switch or a tab change drops the rows at once and reads anew; a read of the
  previous organization or tab is aborted and never shown, nor is a `Show more` answered after it.
  The tab counts (`counts.open`, `counts.closed`, from the last page read) stay while another tab
  of the same organization is read.
- Groups: on `To do` the late (grenat), today, next seven days, later and undated buckets
  (`utils/due-bucket`, the rules of the mockup's `dueInfo` against the local day of the read), only
  the non-empty ones, in that order; on `Done` one `Done and cancelled` group. Each heading reads
  its name, a separator for screen readers and its count. Lines keep the gateway's order (by due
  date). A line stays in the group of its read status and date until the next read, which a
  settled status write triggers; a pending status or value of the menu stays shown over a reread
  of an older copy; a deleted line hides at once (`TaskRowActionsStore.rows`).
- The context menu opens from the list item around each `cw-task-line` (right click, Shift F10,
  the Menu key, a long press), not from the line itself, whose `opened` output would otherwise also
  receive the trigger's. The item has `tabindex="-1"` and hands the focus it receives itself (the
  menu closing after a right click or a long press) to the line's button, so the focus is never
  lost.
- A list that Spaces' `LIST_DIRECTORY` does not hold reads `Archived list` (gap G-T1, until
  `TaskSummary` carries its list's name) only when the directory holds at least one list of the
  task's space; otherwise (the space's overview failed or is still read) the cell is empty.
- The rail item reads the router's `isActive` signal instead of `RouterLinkActive`, which removes
  `aria-current` on each of its updates (a query-only navigation such as `?task=` included).

## Copy not taken word for word from the mockup

| Id                            | English                                 | French                                              | Source of the French                                       |
| ----------------------------- | --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `my-tasks.partial.incomplete` | Some of your tasks could not be loaded. | Certaines de vos tâches n’ont pas pu être chargées. | Not in the mockup                                          |
| `my-tasks.partial.stale`      | Your tasks could not be refreshed.      | Vos tâches n’ont pas pu être actualisées.           | Not in the mockup                                          |
| `my-tasks.partial.retry`      | Retry                                   | Réessayer                                           | The mockup's page error (`App.dc.html` lines 4817-4823)    |
| `my-tasks.closed.more`        | Show more                               | Afficher plus                                       | Not in the mockup (`spaces.activity.show-more`'s word)     |
| `my-tasks.closed.more-failed` | The next tasks could not be loaded.     | Les tâches suivantes n’ont pas pu être chargées.    | Not in the mockup (`spaces.rows.more-failed`'s wording)    |
| `my-tasks.row.archived-list`  | Archived list                           | Liste archivée                                      | The mockup's Archives screen (`App.dc.html` 5494 and 8821) |
| `my-tasks.delete.cancel`      | Cancel                                  | Annuler                                             | The mockup's confirmations                                 |
