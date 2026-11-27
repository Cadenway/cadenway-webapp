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
  (`listArchivedLists` and `listArchivedTasks`, each read to its last cursor 100 at a time,
  `unarchiveList`, `unarchiveTask`, without `If-Match`) and `MembersService.listMembers` (every
  page, for the `by` of the rows). Each request is given 10 s.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, `OrganizationSwitchPendingError`) and
  `@core/realtime` (`RealtimeConnection.reconnected`, optional).
- Spaces' `ports/space-directory` (`SPACE_DIRECTORY`, the space name of an archived list, gap
  G-A1) and `ports/navigation-refresh` (`NAVIGATION_REFRESH.refresh()` after a restore).
- Task's `.` entry: `TaskDetailOpener` (the toast's `Open`, and `closed`, which reads the archives
  again).
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`button`, `empty`, `skeleton`, `tabs`, `toast`) and `@cadenway/icons`.

## Invariants

- `ArchivesStore` is page-scoped (`ArchivesPage` providers) and keyed on the organization pin. It
  reads both tabs side by side: actively when the page opens, passively on window focus, on a tab
  becoming visible, after a realtime reconnection, after a task detail closes and after each
  restore; no organization-wide notice exists (gap G-R2). A read asked for while one runs is sent
  once it settles.
- A failure of the first read renders `RouteErrorBoundary` (the unavailable state with `Retry`) in
  place of the page, so the shell stays; a background read that fails keeps the rows. An empty tab
  is a successful read with no item (`No archived list`, `No archived task`). The mockup draws no
  loading state: a rows skeleton (`Loading the archives`) shows during the first read, under the
  `h1`, which is the route focus target (`data-route-focus`).
- Restores are bound to the organization where they started: the organization is captured before
  the write, and when it changed meanwhile the state is not patched and no toast shows. One restore
  per item runs at a time; its `Restore` is disabled meanwhile.
- A confirmed restore hides its item from every read that began before the confirmation, so an
  older read still in flight cannot bring it back; a read that began later is the gateway's word.
  The summary and tab counts are the gateway's totals less the hidden items.
- An unknown outcome (no answer, a timeout, `408`, `5xx`) reads the sidebar and the archives again
  and is never reported; a refusal (another `4xx`) shows a failure toast and reads the archives
  again; a write refused before it left, because the organization was changing, shows nothing.
- After a confirmed restore, `NAVIGATION_REFRESH.refresh()` reads the sidebar again (a list or a
  task comes back, and with a task its archived list), then the archives are read again (a list's
  tasks now name it; a task's list may leave the `Lists` tab).
- A list names its space from Spaces' directory, or no space while the directory does not hold it
  (`is back in its space.` in the toast). The `by` names a member, or is left out for another
  actor (an automation, a service) and while the members are not known; a failed members read is
  read again with the next archives read.
- Copy not taken word for word from the mockup: `Loading the archives`, `archived on <date>`
  without `by`, and the failure toasts `The list could not be restored`, `The sprint could not be
restored` and `<KEY> could not be restored`.
