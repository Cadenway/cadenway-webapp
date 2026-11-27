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
- Writes: every goal write sends the version its goal's write queue last knew as `If-Match` (the
  newer of the goal shown and the last write or read of the queue). The writes of one goal are
  serialized; a key result's value enters its goal's queue 300 ms after its last click
  (`GOAL_EDIT_BURST_MS`), so a burst of `−`/`+` clicks sends one value, and a burst still waiting
  when the page is left is sent at once; once a goal's writes settle, the goal is read again for its progress, health and
  version, unless the page is gone. A `412 request.version-mismatch` reads the goal: an edit is
  sent again only while the goal still shows the value it started from; a number otherwise moves
  by the same steps from the newer value, and a checkbox is dropped with `This key result changed
elsewhere`. Values show at once and return to the confirmed ones after a refusal, which toasts
  the failure; a later edit of the same key result is kept and sent. A confirmed write moves the
  value an edit counts its steps from, so a queued edit keeps only its unsent steps. An unknown
  outcome (no answer, a `5xx`) is never reported as a failure: a change is settled by reading its
  goal inside its queue before a later edit of it is sent (recorded, the later edits follow it;
  not recorded, only the steps made after it are kept, from the value read). The queue stays held
  while that read is retried after 2, 4 and 8 s (`GOAL_SETTLE_BACKOFF_MS`); when it still fails,
  the later edits of that key result are dropped, never rebased on an unknown value, `The key
result change could not be confirmed` shows and the goals are read again. A creation (goal or key
  result) keeps one idempotency key per draft until a definitive answer and is sent again with it
  after an unknown outcome or `409 idempotency.request-in-progress`, one second apart, three sends
  in all; still unknown, `The goal could not be confirmed` or `The key result could not be
confirmed` asks to submit again, which reuses the key. A deletion of unknown outcome whose goal is
  still there, or cannot be read, shows `The deletion could not be confirmed`, and the goals are
  read again. Confirmed writes stay over the read
  goals until a read issued after them lands; a snapshot of one goal counts from when it was sent
  and is not kept once a newer read landed. A superseded read is aborted between its pages. Each
  write is bound to the organization generation it started in: after a switch, even back to the
  same organization, nothing more is sent, patched or toasted, and the forms and the confirmation
  close.
- Focus: after a key result is removed, the next row's control takes it, else `Add a key result`,
  else the goal's trigger; a closed goal form returns it to `New goal`, or to the new goal's trigger
  after a creation; a closed key result form returns it to `Add a key result`. The key result
  checkbox is named after its label.
- Members: an owner the members read does not name shows no name until a read sent for that
  owner confirms it, then `Former member`; the members are read again once per new set of unknown
  owners and, after a failure, on the next background read.
- Deletion asks for a confirmation (`Delete the goal “<name>”?`), since `deleteGoal` is final and
  no restore exists (gap G-G4); the toast `Goal deleted` has no `Undo`. A goal already gone counts
  as deleted. The deletion is sent from the version shown when it was confirmed; a `412` deletes
  nothing: `This goal changed since you confirmed` shows, the goal is read again and stays shown,
  and deleting it takes a new confirmation. A key result is removed without undo, as the mockup
  does.
- Milestones (gap G-G1): one `getTask` per milestone key, at most four at once. Only the new keys
  of a changed set are read, and a key that leaves has its read cancelled; a task detail that
  closes or reports a change reads only that task again, a realtime reconnection every task; a
  newer read of a task cancels the older one, and only the newest settles it; the reads stop with
  the page.
  A `404` shows `Milestone not found`; a task due before today shows `Late`, otherwise `Upcoming`.
- A list-progress result names its list from `LIST_DIRECTORY`, or reads `Calculated from its list`
  for an archived list the sidebar does not show (gap G-G2).
- The expected progress is a tick drawn over `cw-progress`, which has no marker (G-G5, DS2); the
  statistics strip is laid out two by two below 1024 px over `cw-stat-group` (DS3). Below 640 px
  the progress bar takes its own line.
