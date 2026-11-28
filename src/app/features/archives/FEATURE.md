# Archives

## Purpose

The archives (`App.dc.html` lines 1999-2022, logic `fxArchives` 5453-5503): the archived lists and
tasks of the current organization and their restore. It owns that page only; its `Archives` link
and count in the sidebar footer belong to Spaces, the task detail (opened from a restore toast) to
Task, the shell and its slots to Workspace. Archiving a list or a task happens in Spaces and Task.

## Routes

`ARCHIVES_ROUTES` mounts `ArchivesPage` at `archives` below `/:org`, inside the application shell,
with the `Archives` route title (`archives.route.title`) and `errorComponent: RouteErrorBoundary`.
`?tab=tasks` selects the `Tasks` tab; the default is `Lists`. Picking a tab rewrites `?tab` in
place (`replaceUrl`), dropping it for `Lists`. Spaces' sidebar footer links to it.

## Public entry points

| Entry point       | Consumers |
| ----------------- | --------- |
| `archives.routes` | workspace |

## Dependencies

- `@cadenway/api-client` through `data-access/` (`ArchivesApi`): `ArchivesService`
  (`listArchivedLists` and `listArchivedTasks`, read 100 at a time, 10 pages (1,000 items) per tab
  at first and per `Show more` from the tab's cursor; `unarchiveList`, `unarchiveTask`, without
  `If-Match`), `MembersService.listMembers`
  (every page, for the `by` of the rows), and `ListsService.getList` and `TasksService.getTask`
  (one item, bypassing the HTTP cache, to settle an unknown restore outcome). Each read is given
  10 s and each restore 30 s, since restoring a task restores its subtree and maybe its list.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, `OrganizationSwitchPendingError`,
  `hasProblemCode`) and `@core/realtime` (`RealtimeConnection.reconnected`, optional).
- Spaces' `ports/space-directory` (`SPACE_DIRECTORY`, the space name of an archived list, gap
  G-A1) and `ports/navigation-refresh` (`NAVIGATION_REFRESH.refresh()` after a restore).
- Task's `.` entry: `TaskDetailOpener` (the toast's `Open`, and `closed`, which reads the archives
  again).
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`button`, `empty`, `skeleton`, `tabs`, `toast`) and `@cadenway/icons`.

## Invariants

- `ArchivesStore` is page-scoped (`ArchivesPage` providers) and keyed on the organization pin. It
  reads both tabs side by side, each down to its depth (10 pages, so 1,000 items, at first), with
  the gateway's totals and each tab's continuation cursor: actively when the page opens,
  passively on window focus, on a tab becoming visible, after a realtime reconnection, after a
  task detail closes and after each restore, once at the end of a 300 ms burst; no
  organization-wide notice exists (gap G-R2). A read asked for while one runs is sent once it
  settles. A tab holding fewer rows than its total says so under its rows.
- While a tab's cursor is not null, `Show more` under its rows reads the next 10 pages from that
  cursor and adds them (deduplicated) under the rows, so every archived item can be reached and
  restored; the tab's depth grows by 10 pages, and later background reads refresh it down to that
  depth only. A failed `Show more` keeps the depth and the rows and shows a failure toast; one
  that ends while a read of the archives runs or after one landed reads again at the new depth.
  An organization switch resets both depths.
- A failure of the first read renders `RouteErrorBoundary` (the unavailable state with `Retry`) in
  place of the page, so the shell stays; a background read that fails keeps the rows. An empty tab
  is a successful read with no item (`No archived list`, `No archived task`). The mockup draws no
  loading state: a rows skeleton (`Loading the archives`) shows during the first read, under the
  `h1`, which is the route focus target (`data-route-focus`).
- `Restore` shows on a list only when its `callerRole` is `edit` (or absent, read as `edit`). The
  archived tasks carry no role (their `ListRef` has none): a `403 access.role-insufficient` gets
  its own toast.
- Restores are bound to the organization where they started and to the page: the organization
  and its generation are captured before each await, and when it changed (A then B, or A then B
  then A), or the page was destroyed, the state is not patched and no toast shows. One restore per
  item runs at a time; while it runs, its `Restore` stays focusable with `aria-disabled` and
  `aria-busy`, and ignores clicks.
- A confirmed restore hides its item from every read that began before the confirmation, so an
  older read still in flight cannot bring it back; a read that began later is the gateway's word.
  Restoring a task whose list is archived (`list.state === 'archived'`) restores that list too, so
  the list is hidden the same way.
  The summary and tab counts are the gateway's totals less the hidden items.
- An unknown outcome (no answer, a timeout, `408`, `5xx`) is never reported as a failure: the row
  stays pending while the item itself is read again 2, 4 and 8 s later (`ARCHIVES_CONFIRM_DELAYS_MS`).
  Once it reads live the restore counts as confirmed; when it is still archived after the last
  read, or no longer readable, the page shows a neutral notice, and the sidebar and the archives
  are read again. A `403 access.role-insufficient` shows its own toast; another refusal (`4xx`) a
  failure toast; both read the archives again. A write refused before it left, because the
  organization was switching (`OrganizationSwitchPendingError`), shows nothing and reads nothing.
- After a confirmed restore, focus moves off the row (when it was there) before the row leaves: to
  the nearest following `Restore`, else the nearest preceding one, else the tab's panel. Then
  `NAVIGATION_REFRESH.refresh()` reads the sidebar again (a list or a task comes back, and with a
  task its archived list), and the archives are read again (a list's tasks now name it; a task's
  list may leave the `Lists` tab).
- The page dismisses the toasts it raised when it is destroyed and when the organization changes;
  a restored task's `Open` does nothing outside the organization it was restored in.
- A list names its space from Spaces' directory, or no space while the directory does not hold it
  (`is back in its space.` in the toast). The `by` names a member, or is left out for another
  actor (an automation, a service) and while the members are not known; a failed members read is
  read again with the next archives read.
- Copy not taken word for word from the mockup: `Loading the archives`, `archived on <date>`
  without `by`, `Show more` and its failure `The next archived items could not be loaded`, the
  truncation notice `Only the <n> most recently archived are shown, out of
<total>.`, the failure toasts `The list could not be restored`, `The sprint could not be
restored` and `<KEY> could not be restored`, the missing-right toasts `You cannot restore
<name or KEY>` / `Restoring takes the edit right on the list.`, and the neutral notices `The
restore of <name or KEY> could not be confirmed` / `The archives were read again: check whether
it is back.`, and the tabs' spoken counts `<n> list(s)` and `<n> task(s)` (`archives.tabs.*-count-*`,
  read after the tab's name through `cwTab` `countLabel`).
