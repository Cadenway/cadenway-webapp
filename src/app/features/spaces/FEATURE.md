# Spaces

## Purpose

The spaces of a workspace and their lists: the spaces part of the shell (the `Spaces` rail item
and the favorite spaces of the rail, the sidebar's favorites, spaces accordion, context menus and
suggestions, the sprint progress and the `Trash` and `Archives` rows of its footer), the
space and list dialogs (create, edit, delete a space; create a list or a sprint, edit it), the
space overview, the frame of a list page (header, view tabs and saved views, view tools and active
filters, the selection bar, the hosts of the header's dialogs) with its view configuration, and
the `List` view: its grouped, virtualized task rows, read page by page. The cells, pickers, status
interaction and create dialog belong to Task, which the rows compose, as the task detail opened
from a row does; the trash and archives screens belong to their features. The eight other views
(`Board`, `Calendar`, `Gantt`, `Workload`, `Sheet`, `Form`, `Activity`, `Timesheet`) and the
`Share`, `Sprint report`, `Space statuses` and `Automations` dialogs have their routes, hosts and
stubs; their content comes in step 4b, one package each.

## Routes

`SPACES_ROUTES` is mounted by Workspace below `/:org` (an empty-path entry after Home). A
componentless parent provides the English texts of the bricks (statuses, alert dialog, avatar,
breadcrumb, dialog, inline edit, toolbar).

- `spaces/:spaceId` loads `SpaceOverviewPage` (`Overview`).
- `l/:listId` loads `ListPage` and provides `ListPageStore` and `ListViewStore` to its views; `''`
  redirects to `list`, which loads `ListViewPage` and provides `ListRowsStore`, Task's
  `TaskStatusChangesStore`, `ListTasksApi` (so it can read the workspace-scoped user for `me`),
  and the English texts of `cw-data-table`.
  `?savedView=<id>` applies a saved view of the list; `?task=<KEY>`, set when a row opens, opens
  Task's detail over the view.
- One child per other layout, at its `LAYOUT_SEGMENTS` segment
  (`constants/view-layouts/view-layouts.constants.ts`): the segment is the layout key, except
  the saved views' `table`, whose segment is `sheet`.

  | Segment     | Layout      | Page (`ui/pages/…`)                         | Providers (`state/…`)                                                     |
  | ----------- | ----------- | ------------------------------------------- | ------------------------------------------------------------------------- |
  | `board`     | `board`     | `board-view-page` (`BoardViewPage`)         | `board-view/board-view.providers.ts` (`BOARD_VIEW_PROVIDERS`)             |
  | `calendar`  | `calendar`  | `calendar-view-page` (`CalendarViewPage`)   | `calendar-view/calendar-view.providers.ts` (`CALENDAR_VIEW_PROVIDERS`)    |
  | `gantt`     | `gantt`     | `gantt-view-page` (`GanttViewPage`)         | `gantt-view/gantt-view.providers.ts` (`GANTT_VIEW_PROVIDERS`)             |
  | `workload`  | `workload`  | `workload-view-page` (`WorkloadViewPage`)   | `workload-view/workload-view.providers.ts` (`WORKLOAD_VIEW_PROVIDERS`)    |
  | `sheet`     | `table`     | `sheet-view-page` (`SheetViewPage`)         | `sheet-view/sheet-view.providers.ts` (`SHEET_VIEW_PROVIDERS`)             |
  | `form`      | `form`      | `form-view-page` (`FormViewPage`)           | `form-view/form-view.providers.ts` (`FORM_VIEW_PROVIDERS`)                |
  | `activity`  | `activity`  | `activity-view-page` (`ActivityViewPage`)   | `activity-view/activity-view.providers.ts` (`ACTIVITY_VIEW_PROVIDERS`)    |
  | `timesheet` | `timesheet` | `timesheet-view-page` (`TimesheetViewPage`) | `timesheet-view/timesheet-view.providers.ts` (`TIMESHEET_VIEW_PROVIDERS`) |

  Each provides its view's store (`<View>ViewStore`, `state/<view>-view/<view>-view.store.ts`),
  and the five task views (board, calendar, gantt, workload, sheet) Task's
  `TaskStatusChangesStore`. Until its package lands, each page is a stub that says the view is
  not available yet and each store is empty.

- `RELEASED_LAYOUTS` (`constants/released-views/released-views.constants.ts`, read through the
  `RELEASED_VIEWS` token) decides which layouts users reach. Today it holds `list` only. A layout
  outside it has no tab, and `releasedLayoutGuard(layout)` (`http/guards/released-layout/`)
  replaces its address with `list`, keeping the query parameters, so a saved view of that layout
  opens on `list`. The lead adds a layout when its package merges; view builders never edit the
  file. `RELEASED_LIST_DIALOGS`, beside it, does the same for the header dialogs' openers (empty
  today).
- Failed primary reads render the router's default error component, `RouteErrorBoundary`, in the
  failing route's outlet: a failed view keeps the list header. Every view's `data`
  (`RouteErrorData`) titles its unavailable state with the mockup's single title, `Could not load
the tasks` (`App.dc.html` lines 487-499, 4816-4821).

## View and dialog packages

Each step 4b package fills its own files and uses these extension points of the frame, which it
does not edit (`spaces.routes.ts`, `list-page.*`, `list-header.*`, `view-tabs.*`, `view-tools.*`,
`list-view.store.ts`, `list-view-config.interface.ts`, `saved-view.adapter.ts`,
`list-view-query.util.ts`, `view-summary.util.ts`, `view-layouts.constants.ts`; the released
constants belong to the lead):

- A view package owns `ui/pages/<view>-view-page/*` and `state/<view>-view/*`. It adds what its
  route subtree shares (stores, data-access services) to its `<VIEW>_VIEW_PROVIDERS`; it provides
  its bricks' label providers in its page's `providers`.
- The page injects `ListPageStore` (the list, its space, members, labels, counts) and
  `ListViewStore`: `taskQuery` and `groupQuery` (the filters, search, milestones, level and sort to
  read), `layout`, `tools`, `presentation` and `setPresentation(change)` (the board's
  `hiddenBoardStatusKeys`; the sheet's `hiddenSheetColumns`, `hiddenCustomFieldIds`, `sheetSort`,
  `customFieldSort`), `followRows(summary)` to publish its visible count and subtask flag to
  the tools, and, for the sheet, `followCustomFields(fields)` to publish the list's custom fields
  (`ActiveCustomField`: id and name). `Save the view`, `Modified`, the saved-view summary
  (`N columns hidden`, `sort: time spent` for the sheet's own sort) and the CSV export
  (`sheetExportSort`) follow the presentation of the shown layout on their own; once the fields
  are published, they ignore the ids of retired fields. The sheet's column names are
  `sheetColumnLabels()`.
- `LAYOUT_TOOLS` gives the tools of each layout: all of them with `Columns` instead of `Group by`
  on the board (which shows `Columns shown`, writing `hiddenBoardStatusKeys`); none on `form` and
  `activity`, which hides the toolbar (`App.dc.html` line 7811); `Filter`, `Search`,
  `Create a task` and `Save the view` on `timesheet`, whose rows have no milestone, order, group or
  subtask level (see `Timesheet view`); all of them elsewhere.

- The task views (board, calendar, Gantt, workload, sheet) share the task plumbing of the `List`
  view, which they compose and do not edit:
  - `cw-task-menu` (`ui/components/task-menu`): the task menu, presentational (`tasks`, `status`,
    `statuses`, `people`, `userId`, `lists`; one output per item). The view opens `menu()` from its
    own `[cwContextMenuTriggerFor]` triggers.
  - `withViewTaskWrites()` (`state/view-task-writes/view-task-writes.feature.ts`): the per-task
    serialized writes, composed by the view's reader store (`act`, `update`, `remind`,
    `restore`; the host connects its reads in `onInit` with `_connectWrites` and calls
    `_resetWrites`, `_settleWrites` and `_appliedWrite`).
  - `ViewTaskWritesStore` (page-scoped, with `VIEW_TASK_WRITER` set to the view's reader store):
    the menu's and the selection bar's writes with their toasts, `Undo`, refusals, the shared
    cancellation reason and the deletion confirmation, and `updateFields` for single-field writes.
  - `ListTasksStore` (`state/list-tasks`): the flat reader of the calendar, Gantt and sheet, which
    each provides through its `<VIEW>_VIEW_PROVIDERS`.
  - `cw-task-card` (`ui/components/task-card`): the board card (`card`) and the calendar side
    panel's line (`item`).
- A dialog package owns `ui/dialogs/<dialog>/*` (`share-dialog`, `sprint-report-dialog`,
  `space-statuses-dialog`, `automations-dialog`) and its `state/` and `data-access/` files. The list
  page hosts it in a `@defer` block loaded on first opening and binds `open` (a two-way model the
  dialog sets to false on closing) and `list` (`ShareDialog`, `SprintReportDialog`) or `space`
  (`SpaceStatusesDialog`, `AutomationsDialog`: the sidebar's `SpaceDetails`, with its version and
  rights, or null). The openers: `Share` beside the header's `…` menu, `Sprint report` on a
  sprint's goal line, `Space statuses` (enabled when the space is editable) and `Automations`
  (enabled for organization admins and owners) in the list menu after `Edit the space`.

## Board view

The `Board` view (`ui/pages/board-view-page`, `App.dc.html` lines 716-773, logic lines 6343-6377,
column menu lines 7314-7323) files the list's tasks into status columns with `cw-kanban`.

- `BOARD_VIEW_PROVIDERS` provides `TaskStatusChangesStore`, `ListTasksApi`, `ListTasksStore` and
  `BoardViewStore` (`state/board-view`). The page reads the tasks with `ListTasksStore.load`
  (the view's `taskQuery`, no due window) and publishes its `summary` with `followRows`. One flat
  read, rather than `countTaskGroups` and one read per status: `cw-kanban` has no per-column
  paging, so every card is read anyway. A list over `LIST_TASKS_CAP` tasks shows the first ones
  and says so. A failed first read reaches the route's error boundary (read again when the route
  runs again); a failed refresh keeps the cards and offers `Retry` in place.
- `BoardViewStore`: the columns, in `BOARD_ORDER` with the space's names, without the statuses
  hidden with `Columns` (`ListViewStore.presentation().hiddenBoardStatusKeys`) and without those
  the space stopped using, unless a card still sits there; the cards (`models/board-view`), filed
  under the status they show; the folded columns, kept while the view lives; `Hide the column`
  with its `Column hidden` toast, whose `Undo` shows that column again and leaves the columns
  hidden since; the moves waiting to be written.
- A card: key, priority icon and word, milestone icon, name (muted once closed, struck through
  when cancelled), labels, due date, subtask or checklist progress and assignee initials; a
  closed card is see-through (`dimmedBy`). The board draws the card frame, so the card's fields
  are the page's card template, not `cw-task-card` (a button with its own frame, which cannot sit
  in the board's focusable card).
- A drop in another column, with the mouse or the brick's keyboard move (Space, arrows, Space;
  Escape cancels), moves the card at once (`BoardViewStore.stage`: a waiting move per task, kept
  with the task it started from, which a read of the tasks never replaces) and writes it through
  `ViewTaskWritesStore.setStatus` `STATUS_SETTLE_MS` (460 ms) after the task's last move: quick
  moves write only the last status and a move back to the confirmed status writes nothing.
  Another query (a filter, the search) writes the waiting moves at once, from the task each
  started from when the new read no longer holds it. Leaving the view writes them with
  `TaskActionsApi.bulk` (root-provided, so it outlives the view; `BoardViewStore.leave`), each
  after the board's write of the same task still in flight has settled and at the version it
  left: `VIEW_TASK_WRITER` is `BoardViewStore.writerOver(ListTasksStore)`, the reader's writes
  with each task's write in flight followed. A move written after leaving reads the list's
  counts again (`ListPageStore.refreshCounts`, inert once the list page is left too, since its
  resources are destroyed) and shows the same status toast, whose `Undo` writes the confirmed
  status back with `TaskActionsApi` at the version the move left (a refusal warns
  `CAD-482 changed since`); a refused, uncertain or unsent move (the organization changed) shows
  `The task could not be changed`. In the view, the written move's toast offers `Undo` and a
  refusal puts the card back. A drop on `Cancelled`, or `Cancelled` in the task menu, asks the
  reason first and holds the waiting move meanwhile (the card keeps its column): confirming
  replaces it with the cancellation, dismissing lets it settle 460 ms later. `Cancelled` is never
  written on leaving. Another status picked in the task menu replaces a waiting move at once. A drop in
  the card's own column, or in a column whose status the task cannot take (a milestone's four
  statuses, a status the space stopped using), puts the card back: no order is written.
- Click or Enter opens the task's detail (`?task=<KEY>`). A right click, Shift F10 or the Menu key
  opens `cw-task-menu` on the card (`cardMenu`), or on the selection (Ctrl click, Ctrl Space)
  holding it, with the menu's writes, cancellation reason and deletion confirmation. In a column
  they open the column menu (`columnMenu`), as does the `…` button of an open column header
  (`cwKanbanColumnMenu` slot, `Actions on the column X`): `New task in “X”`, `Fold the column` or
  `Unfold the column`, `Hide the column`; each also has a visible control (`+`, the fold button,
  `Columns`). `+`, `Add a task` and N on a card (`addRequest`, the quick add off) open Task's
  create dialog with the column's status; N elsewhere creates in this list.
- Known gaps: no manual order within a column (G1: no rank field or reorder operation); no
  work-in-progress limit (G2: the mockup's `progress` limit of 2 is not kept); no Git chip on the
  cards (G3); the drop's toast is `ViewTaskWritesStore`'s status toast (`CAD-482 · In progress`,
  `Status changed.`), not the mockup's `CAD-482 déplacée` / `Statut : En cours.`, since
  `setStatus` takes no toast wording; no selection bar on the board (the mockup has none); the
  mockup's folded column says `Déplier la colonne X`, the brick adds the count. A card has no
  visible trigger for its menu: `cw-kanban` 0.10.0 offers no card actions slot, and a button in
  the card template would sit inside the brick's focusable card (a nested control, a second tab
  stop, a click that also opens the task). On touch the card menu opens only where a long press
  fires `contextmenu` (Android, not iOS Safari); a card actions slot in the design system is the
  lasting fix.

| Unit                                                                                                                                                                                                                               | Reason                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `spaces.board.column`, `spaces.board.count-*`, `spaces.board.quick-add*`, `spaces.board.selected`, `spaces.board.instructions`, `spaces.board.grabbed`, `spaces.board.position*`, `spaces.board.dropped`, `spaces.board.cancelled` | The brick's own texts (`CW_KANBAN_LABELS`), which the mockup does not show as copy. |
| `spaces.board.expand`                                                                                                                                                                                                              | The mockup's `Déplier la colonne X`, with the brick's count.                        |
| `spaces.board.region`                                                                                                                                                                                                              | Accessible name of the board region, which the mockup does not name.                |
| `spaces.board.column-actions`                                                                                                                                                                                                      | The mockup's `Actions sur …` for a column header, which the mockup does not draw.   |
| `spaces.board.truncated`                                                                                                                                                                                                           | The mockup's lists never exceed one read.                                           |

## Activity view

`ActivityViewPage` (`ui/pages/activity-view-page/`, `App.dc.html` lines 1299-1361, 7676-7720,
7985-8001) shows the activity log of the open list in `cw-activity-feed`, without the view tools.

- Toolbar: a person select (`cw-select`: `Everyone`, then the member directory of
  `ListPageStore.organizationMembers`), the type chips (`cw-toggle-group`, multiple: `All`,
  `Statuses`, `Assignments`, `Creations`, `Comments`, `Priorities`, `Due dates`; turning `All` on
  or every kind off shows every kind) and the gateway's count of matching events (`N events`,
  `aria-live`). It wraps under 768 px.
- Feed: grouped by local day (`Today`, `Yesterday`, the long day) with its count, newest first.
  An entry shows its actor (a member's avatar; an icon for an automation, the Git provider or a
  service), the verb and its details (statuses from and to with their icons and the space's
  names, the new priority with its icon, the due dates), the comment's plain excerpt, the task
  chip (status, key, name) and the time of day. The chip opens Task's detail
  (`TaskDetailOpener.open(key)`, no preview: the entry does not say whether the task is a
  milestone).
- Task menu: the chip of a task the list holds opens the shared `cw-task-menu` (right click, Menu
  key, Shift F10, long press), with its cancellation dialog and deletion confirmation, written
  through the page-scoped `ViewTaskWritesStore` over `ListTasksStore` (`VIEW_TASK_WRITER`). The
  route provides `ListTasksStore`, `ListTasksApi` and Task's `TaskStatusChangesStore`; the page
  loads every task of the list, unfiltered (`level: all`, `sort: manual`), since the menu needs the
  task summary (priority, assignees, version) that an entry does not carry. Such a chip shows the
  task's status and name as the list shows them, a write applied at once. The chip of a task the
  list does not hold (moved out, or past the reader's 2,000-task cap) only opens the task.
- `ActivityViewStore`, route-scoped through `ACTIVITY_VIEW_PROVIDERS` with `ListActivityApi`
  (`ListsService.listListActivity`, 50 entries a page, the HTTP cache bypassed). The kinds and
  the person filter on the server (`kind`, `actorId`). The first page is the view's primary read
  (a `resource`): a failure before anything was shown for the list reaches the route's error
  boundary, whose `Retry` runs the route again; a later failure (another filter, a refresh) shows
  `The activity could not be loaded.` with `Retry` in place, keeping the entries when they answer
  the current filters. Older pages are read when the feed scrolls within 200 px of its end or
  with `Show more`, appended once each by id; a failed one offers `Retry`. Each page request has
  an identity: only the active one changes the entries, the cursor, `loadingMore` or the error
  when it settles, and a refresh or another read supersedes it. Another filter shows the skeleton
  until its answer; another organization or list hides the entries at once and late answers are
  dropped.
- Refresh: the store watches the list's room and reads the shown range again (as many entries as
  shown, in pages of 100, then any older entries loaded meanwhile, with the cursor of the oldest
  page; the feed tracks entries by id, so the scroll stays) 1 s after the first `task.updated.v1`,
  `task.status-changed.v1` or `list.tasks-changed.v1` (naming this list) of a window, once per
  window; so do a task created in the list from this tab (`TaskCreate.created`) and a task detail
  that closes or whose `Undo` restored a task (`TaskDetailOpener.closed`, `changed`). A refresh
  asked for while the first page is being read (the first read, another filter), which the
  resource cannot restart, is queued once and runs when that read answers, for the same list,
  organization and filters only; a failed read drops it.
- Bricks: `activity-feed`, `select`, `toggle-group`, `button`, `status-icon`, `priority-icon`,
  `context-menu`, `alert-dialog`; the page provides the feed's and the select's texts.
- Known gaps:
  - `Public form` (G8): the contract records an intake submission as a `create` by a `system`
    actor, with no intake actor type, requester email or actor-type filter. The select does not
    offer `Public form`, and a `system` actor shows as `System` with the gear icon.
  - `· deleted` (G9): closed by the contract, which leaves out of `items` and `total` the entries
    of a task the caller no longer sees, archived or in the trash; the chip always links.
  - Comments made in another tab appear on the next refresh only: `comment.created.v1` goes to
    task rooms, not to the list's room.
  - Times are times of day: the mockup's `Just now` and `N min ago` are not written.
- Copy not taken word for word from the mockup: `spaces.activity.read-failed`,
  `spaces.activity.more-failed`, `spaces.activity.show-more` (the mockup draws no failed read and
  no paging), `spaces.activity.unknown-person`, `spaces.activity.automation`,
  `spaces.activity.system` (actors the mockup does not draw), `spaces.activity.select-placeholder`
  and `spaces.activity.select-empty` (the select's own texts), `spaces.activity.count-one` (a
  singular the mockup writes for 0 and 1 alike).

### Share dialog

`ui/dialogs/share-dialog` (`ShareDialog`, `App.dc.html` lines 2980-3016, 5448, 6871, 8830-8855)
provides its own `ListShareStore` (`state/list-share/`, component-scoped), which reaches the
gateway through `ListAccessApi` (`data-access/services/list-access-api/`, adapter
`data-access/adapters/list-access/`, models `models/list-share/`). The list page keeps the dialog
once it was opened, so the store lives with the list page, across closings and reopenings.

- Each opening on a list reads, at once, `ListsService.getList` (the `Organization access` switch,
  `organizationAccess`, and `callerRole`), `SpacesService.getSpace` (the owner and the
  visibility) and every page of `AccessService.listListGrants`; a failure is the dialog's inline
  error with `Retry`, distinct from its skeleton. Every page of `MembersService.listMembers`
  (names, addresses, guests) is read apart: a `403` leaves the names unknown and hides
  `Invite by email`; any other failure (network, 5xx) is its own inline error with `Retry`
  (`spaces.secondary.members-failed`) above the people, who stay listed without names.
- `People with access`: the space's owner first (`Owner`, no select: `Grant` has no owner, who
  is `Space.owner`), then the grants in the order access was given, then the people invited from
  the dialog. Grants of the space, which also open the list, are not listed. Guests carry
  `Guest`, and the guest sum follows. Without `edit` on the list, the roles read as words, the
  switch is disabled and the invitation hidden.
- Writes are optimistic: a role (`setListGrant`), a removal (`removeListGrant`), the switch
  (`updateList` with `organizationAccess` only). The writes of one list and subject (a person, or
  the switch) are sent one after the other, whether the dialog is open, closed, reopened or shows
  another list: a reopened dialog shows the changes still on their way over its read, and its new
  changes wait behind them. No accepted change is dropped. A refusal puts back the last confirmed
  value, unless a newer change of the same subject is still on its way, and always shows its
  failure toast. Once the last change of a list ends, its access is read again if the dialog shows
  it (once more after a read already in flight), and that read replaces the changes it covers.
- None sends `If-Match`, which the contract makes optional on all three: each write sets one
  absolute value, so two people sharing at once never overwrite each other. Every change raises
  the list's version: each recorded write, even after the dialog closed, hands the version the
  gateway answered (`ETag`, or the patched list) to `ListPageStore.followListEdits` while the list
  page shows that list, so the header's later writes send the current `If-Match`; a grant change
  also reads the header's members again.
- Removing a grant asks `Remove X's access?` in a `cw-alert-dialog`, with the mockup's text. When
  the `Organization access` switch is on outside a private space, the confirmation of a member
  (never a guest) adds `They can still see it through the organization access.`: removing the
  grant leaves them what the rule of the organization gives. A grant of the space, which also
  keeps the list visible, is not checked, so the text can promise more than the removal does for
  such a person.
- `Invite by email` (G10): the contract has no invitation by email carrying a list role, and no
  feature publishes an organization invitation entry. The address therefore resolves, without
  regard to case, against the member directory: a member or guest gets the chosen role
  (`setListGrant`) at once, then `Invitation sent` / `<email> can now edit the list.`; an address
  outside the organization gets `This person is not in the organization: invite them first.` and
  nothing is sent; the owner's gets a note that they already have access. The mockup's external
  invitation (`Adresse externe : …` note and `Invité ajouté` toast) is not built.
- `Organization access` is hidden in a private space, where it changes nothing
  (`openapi/public/lists.yaml`).
- `Copy the link` copies `/<slug>/l/<listId>` with `List link copied` (`navigator.clipboard`).
- Gaps: no presence on the avatars (Account's `PRESENCE` publishes the person's own presence
  only); no realtime follow of `list.access-changed.v1` while the dialog is open; `cw-dialog`
  has no `max-w-lg` size, so the dialog uses `default` (`max-w-md`).

## Timesheet view

`TimesheetViewPage` (`ui/pages/timesheet-view-page/`) and `TimesheetViewStore`
(`state/timesheet-view/`, route-scoped on `timesheet` with `TimesheetApi` through
`TIMESHEET_VIEW_PROVIDERS`) show the time recorded on the list's tasks over one week, Monday to
Sunday (`App.dc.html` lines 1363-1449, 7813-7880; skeleton lines 613-624).

- Data: `TaskTimeService.getListTimesheet` (`weekStart`, pages of 100, read to the end, no HTTP
  cache), mapped by `data-access/adapters/timesheet` to `models/timesheet`. Per-person sums, the
  figures and the chart series are computed in the client; people are named from
  `ListPageStore.organizationMembers` (a former member reads `Unknown user`), sorted by name. A
  failed members read shows `The names of the people could not be loaded.` with `Retry`
  (`organizationMembers.reload()`).
- Filters: `getListTimesheet` takes none. The store follows `ListViewStore.taskQuery`
  (`followQuery`) and keeps, in the client, the rows matching the search (task key or name), the
  statuses and the assignees, read as the person who recorded the time (`me` is the signed-in
  user, `Unassigned` keeps nobody); every total, figure, chart and estimate is computed again from
  the rows kept (`week`). A week with time but none kept shows `No task matches`. Priority and
  label filters cannot apply, and the view says so (`Priority and label filters do not apply to
recorded time.`). The toolbar shows `Filter`, `Search`, `Create a task` and `Save the view`
  (`LAYOUT_TOOLS.timesheet`); the view publishes no rows summary (`followRows`).
- Week: it opens on the caller's current week; `Previous week` and `Next week` move it, the title
  (`Week of Nov 2 to Nov 8`) is announced politely, `This week` or `Back to this week` follow.
  Another list starts over on the current week; another organization reads again.
- Figures (`cw-stat`): `Week total` (its tasks), `Average per working day` (Monday to Friday
  divided by the working days with time), `Longest task` (across people) and
  `Estimated on these tasks` (`p% consumed`, or `No estimate`). The estimates are a secondary read,
  `getTaskTimeSummary` per task with time, four at a time, read again only when the set of tasks
  changes or on a refresh (a refresh asked while they are read follows that read); a failure stops
  the reads and shows `Retry` under the figures.
- Table (`table[cwTable]`, 760 px wide at least, scrolling below): `Person and task` × the seven
  days × `Total`; a person row (avatar, name, daily sums tinted by amount), then the person's
  tasks, whose row-wide button (`Open CAD-482 · …`) opens Task's detail over the view with the row
  as preview; a `Total` footer. Weekend days are shaded, today ringed. Past 15 body rows
  (`BOUNDED_ROWS`) the table scrolls in a frame 36 rem high, its header and footer sticky. It is
  not virtualized: the CDK viewport's transformed wrapper would break the sticky header and footer,
  and person and task rows differ in height. Measured on 2026-11-26 (Chromium through Playwright,
  built styles, static markup): 1,000 rows lay out and paint in about 100 ms, 2,000 in about
  200 ms, 4,000 in about 400 ms, scrolling at 60 frames per second at every size; Angular's
  rendering of the rows (jsdom unit test) takes about 120 ms for 500, 270 ms for 1,000 and 340 to
  720 ms for 2,000. Showing a week becomes noticeably slow from about 1,000 rows (one per person and
  task with time).
- Charts: `Time per day` (`cw-chart` stacked bars, one series per person, largest first, the fifth
  and later summed into `Others`) and `Breakdown by person` (a dot in the person's chart color and a
  `cw-meter` per person); they stack under `lg`.
- States: the skeleton while a week is read (the header stays); a week without time shows
  `No time recorded this week`. Until a week of the list was read once (`hasRead`), a failed read
  reaches the route's error boundary, whose `Retry` renders the page again, which reads again. Later,
  a failed read of another week shows `The timesheet could not be loaded` with `Retry` in place of
  the week; a failed refresh keeps the week shown (`sheet`, the last answer for the list and week)
  with a `Retry` line.
- Refresh: time entries have no realtime notice (G13). The week (and its estimates) is read again
  1 s after the first of: a notice of the list's room naming this list or a task update or status
  change, the task detail closing or giving way (`TaskDetailOpener.closed`, `changed`: time is
  recorded from the detail), the tab becoming visible again; once per window.
- Writes: none. The mockup's timesheet only reads; time is recorded from the task detail (Task).

Known gaps:

- G7: `ListTimesheetRow` has no `estimateMinutes`; the estimate figure costs one
  `getTaskTimeSummary` per task with time. A contract addition of the estimate to the rows removes
  those reads.
- `ListTimesheetPage` sums entries per person, task and day and carries no entry count: the
  `Week total` hint counts tasks (`3 tasks`) instead of the mockup's entries (`n saisies`).
- G13: no realtime notice for time entries; another tab's or person's entries show on the next
  refresh cause above.
- `cw-stat` takes no icon: the figures show without the mockup's label icons.
- `cw-meter` has one fill color: the person's color is the dot beside the gauge, not the gauge.

Copy not taken word for word from the mockup:

| Unit                                                                                                                                 | Reason                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `spaces.timesheet.kpi-tasks`, `spaces.timesheet.kpi-tasks-one`                                                                       | The gateway gives no entry count (see the gaps). |
| `spaces.timesheet.kpi-days-one`                                                                                                      | Singular form the mockup writes in the plural.   |
| `spaces.timesheet.failed`, `spaces.timesheet.refresh-failed`, `spaces.timesheet.estimates-failed`, `spaces.timesheet.members-failed` | The mockup draws no failed read.                 |
| `spaces.timesheet.filters-unapplied`                                                                                                 | The mockup applies no filter to the timesheet.   |
| `spaces.timesheet.chart-*`, `spaces.timesheet.stat-*`, `spaces.timesheet.meter-*`                                                    | The bricks' own default texts.                   |
| `spaces.timesheet.share-percent`                                                                                                     | The mockup's `38%`, as a unit for its placement. |

## Form view

The `Form` view (`ui/pages/form-view-page`, `App.dc.html` lines 1102-1297) designs the list's
request form. The preview is Intake's renderer (`IntakeForm` from `@features/intake`), in a
browser frame whose address is the public link (`<origin>/f/<publicKey>`, `Not published` until
published), with the organization badge of `WORKSPACE_CONTEXT`. It follows the settings live and
is inert: a valid request is not sent, and a toast says so. The settings aside shows from 1024 px:
the name and description, a `Required` checkbox and a show switch per field (the title is locked),
the created task's default status (the space's statuses and names) and assignee (`Unassigned`, then
`ListPageStore.organizationMembers`), the destination note, `Copy the public link` (enabled once
published), `Open the preview` (which hides the aside until `Close the preview`) and the
publication (`Publish the form`, `Unpublish the form`). A list the caller cannot edit
(`TaskList.canEdit`) shows an empty state and reads nothing.

- `FormViewStore` (`state/form-view`, route-scoped through `FORM_VIEW_PROVIDERS`) reads
  `getIntakeFormConfiguration` through `IntakeFormApi` (`data-access/services/intake-form-api`);
  that primary read fails to the route boundary, and a view re-entered after a failure reads
  again. A change shows at once; 500 ms after the last one, what differs from the newest recorded
  settings is sent with `updateIntakeFormConfiguration` against their version (`If-Match`); a blank
  title is not sent. Settings changes, `publishIntakeForm` and `disableIntakeForm` (followed by a
  read, since it answers without a body) share one write queue: they run one after the other, a
  publication first sends the change waiting before it and is not sent when a settings write
  before it is refused or unconfirmed (`The form was not published: …`), a withdrawal goes ahead
  anyway, and an answer older than the version already known is ignored. A change still waiting when the view is left, or when another list is
  shown, is sent at once and completes after the store is gone. A refused change toasts `The form
settings could not be saved` (`This status or assignee cannot be used in this list` for
  `422 intake-form.defaults-invalid`) and reads the settings again: the settings it sent go back
  to the recorded values unless edited since, and the edits made since are sent against the
  settings read.
- The mockup's `on`/`req` pair maps to the contract's mode: a hidden field is `disabled`, a field
  shown again is `optional`.
- Known gaps: the destination note gives no next reference (`prochaine référence <id>`), which
  needs a published next-key read (G14); no realtime notice tells another editor's changes (G13);
  the preview shows the organization badge that the public page cannot show.

| Unit                                                                                                                                                                                              | Reason                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `spaces.form.publish`, `spaces.form.unpublish`, `spaces.form.published`, `spaces.form.unpublished`, `spaces.form.unpublished-address`, `spaces.form.publish-failed`, `spaces.form.disable-failed` | The mockup has no publication.                             |
| `spaces.form.destination`                                                                                                                                                                         | The mockup's note without its next reference (G14).        |
| `spaces.form.preview-only*`                                                                                                                                                                       | The mockup's preview creates a task; this one never sends. |
| `spaces.form.read-only`                                                                                                                                                                           | The mockup draws no list the caller cannot edit.           |
| `spaces.form.save-failed`, `spaces.form.defaults-invalid`, `spaces.form.link-failed`                                                                                                              | The mockup draws no refused write.                         |

### Sprint report

`SprintReportDialog` (`ui/dialogs/sprint-report-dialog/`, `App.dc.html` lines 2729-2776 and
5512-5561) shows the report of the sprint it is given:

- Store: `SprintReportStore` (`state/sprint-report/`), component-scoped on the dialog. Each
  opening reads `ListsService.getSprintReport` again through `SprintReportApi`
  (`data-access/services/sprint-report-api/`), with the caller's `today` and browser time zone,
  every burndown page joined (100 days a page, 10 pages at most), bypassing the HTTP cache.
  Closing keeps the shown report for the closing animation; the next opening starts from
  skeletons. A failed read shows an inline error whose `Retry` reads again; a sprint without
  tasks shows `No task in this sprint`.
- Header: `<sprint> report` and `<start> – <end> · day n of m`, from the list until the report
  answers; the day is held within the sprint.
- Figures (`cw-stat`): `Points committed` (the opening commitment, with the tasks of the current
  scope), `Points delivered` (with their share of the delivered and remaining points),
  `Points remaining` (with the open tasks) and `Projected end`: `On track` when at most 0.5
  point would remain, else `≈ n pts` and `would remain on <end>`, from the gateway's forecast,
  or, once the sprint has closed (after its last day), what remains; without a forecast it is
  unknown until then, the last day included. A figure the gateway cannot establish shows a dash.
- `Burndown` (`cw-chart` lines): `Actual`, dashed `Ideal` and `Projection`, one category per day,
  and a `Today` marker while the caller's day is in the sprint.
- `Velocity` (`cw-chart` grouped bars): the earlier sprints the gateway returns (four at most),
  then this one, named `S13` (the mockup's `Sprint ` to `S`, made unique), gray committed and
  jade delivered, with the average delivered by the earlier sprints that have history.
- `Delivered` and `To carry over`: the counts, the first six tasks with their points and
  `+ n others`; a task closes the report and opens its detail (`TaskDetailOpener`).
- `cw-dialog` `lg`, scrollable, filling the screen under 768 px.
- Known gaps: `cw-dialog` has no width between `lg` (`max-w-2xl`) and full screen, so the report
  is narrower than the mockup's `max-w-4xl` and stacks `Velocity` above the summary. `cw-chart`
  colors a series, not a bar: the current sprint's bar is jade like the others (violet in the
  mockup), and the `done / committed` line under each bar is in the tooltip and the chart's data
  table only. The backdrop has no accessible name (`Fermer le rapport` in the mockup).

## Space statuses dialog

`SpaceStatusesDialog` (`ui/dialogs/space-statuses-dialog/`, `App.dc.html` lines 3302-3317 and
8587-8608) provides `SpaceStatusesStore` (`state/space-statuses/`, component-scoped), which writes
through `SpaceStatusesApi` (`data-access/services/space-statuses-api/`, `updateSpace` with the
`statuses` member only and `If-Match`).

- The ten statuses in workflow order under their category headings: icon, name field (the default
  label as placeholder, 24 characters at most once trimmed; empty puts back the default), hint
  (from 640 px) and a switch `Stop using …` / `Use …`. `To do` and `Done` stay used
  (`… (required)`, disabled). The text counts the statuses used out of 10. Every control is
  disabled without `SpaceDetails.canEdit`; skeleton rows show while `space` is null.
- A switch and `Reset to defaults` (`statuses: null`) write at once; a name is written when its
  field changes (blur or Enter), not on every keystroke as in the mockup. An unchanged value sends
  nothing. Each change shows at once; the writes run one after the other, each from the version the
  previous one recorded, and an accepted change is sent even once the dialog or the page is
  destroyed. A refusal (a 4xx with a problem code) takes back its own change only, with the failure
  toast (one shown at a time). Without an answer (network, timeout, 5xx) the space is read again
  (`getSpace`) before the next change: the change counts as saved when that read holds it, else it
  is taken back with the failure toast, and the next changes are sent from the version read; when
  that read fails too, the change is taken back with `The change could not be confirmed…`. A field
  or switch whose change ends unsaved shows the recorded value again. `Done` closes the dialog;
  writes in flight go on.
- Once the last write ends, `ListPageStore.space.reload()` (once more after a read in flight) and
  `SpacesNavigationStore.refresh()` read the space again, even after the dialog is destroyed, so
  the status words, the hidden groups and the version `Edit the space` sends follow. A list page
  opened on the same space before the last write ends reads the space on its own and may show the
  previous statuses until it reads again. A newer read of the space replaces the statuses only while no change is pending.
- Copy not taken from the mockup: `spaces.statuses.save-failed` and `spaces.statuses.save-unknown`
  (the mockup draws no refused or unanswered write).
- Known gaps: `space.updated.v1` is not relayed by the realtime gateway, so another tab sees the
  change only after it reads the space again; a write refused with `412` (the space changed
  elsewhere) is taken back and the reads that follow bring the newer version. `cw-dialog` has no
  `max-w-lg` size: the dialog uses `default` (`max-w-md`) where the mockup uses `max-w-lg`.

## Public entry points

| Entry point            | Consumers    |
| ---------------------- | ------------ |
| `spaces.routes`        | workspace    |
| `providers`            | workspace    |
| `ports/list-directory` | search, task |

`providers` publishes, for the `/:org` route that loads the shell:

- `provideSpacesNavigation()`: the workspace's `SpacesNavigationStore` and `LIST_DIRECTORY`;
- `withSpacesRailItem()` (`railNavigation`, order 30): `Spaces`, which opens the last list or
  space overview shown in the tab (else the first space) and is current on a spaces screen, then,
  on desktop, a separator and one button per favorite space;
- `withSpacesSidebar()` (`sidebar`, order 0): `Favorites`, `Spaces`, the suggestions and the
  host of the navigation's dialogs;
- `withSprintProgress()` (`sidebarFooter`, order 0): the current sprint's progress;
- `withSidebarFooterLinks()` (`sidebarFooter`, order 50): `Trash` and `Archives` with
  their counts, linking to `/:org/trash` and `/:org/archives`.

`ports/list-directory` publishes `LIST_DIRECTORY` (`ListDirectoryPort`: `lists`, a signal of
`ListDirectoryEntry` — id, name, space id and name, Bold icon and tone class — in sidebar order),
computed from the navigation's reads, for the command palette's `Lists` and the task detail's
`Move to…`.

## Dependencies

- `@cadenway/api-client` through `data-access/`: `SpacesService` (`listSpaces`, `getSpace`,
  `createSpace`, `updateSpace`, `deleteSpace`, `getSpaceOverview`, `listSpaceMilestones`,
  `listFavorites`, `createFavorite`, `deleteFavorite`), `ListsService` (`getList`, `createList`,
  `getListCounts`, `updateList`, `duplicateList`, `exportListTasks`, `deleteList`,
  `listSavedViews`, `createSavedView`, `updateSavedView`, `duplicateSavedView`, `deleteSavedView`),
  `ArchivesService` (`archiveList`, `unarchiveList`, `listArchivedLists` and `listArchivedTasks`
  for the footer count), `TrashService.listTrash` (the footer count),
  `BillingService.getBillingSubscription` (the free seats of `Invite your team`),
  `AccessService.listListGrants`, and for the `Share` dialog (`ListAccessApi`) `setListGrant`,
  `removeListGrant`, `ListsService.getList` and `updateList` (`organizationAccess`),
  `SpacesService.getSpace` and `MembersService.listMembers`,
  `MembersService.listMembers`, `TasksService` (`listLabels`, `executeBulkTaskAction`,
  `listSubtasks`, `updateTask` with `If-Match` for the task views' single-field writes) and
  `TaskQueriesService` (`queryListTasks` for the rows, the flat reads with an optional
  `dueFrom`/`dueTo` window and the milestone count, `countTaskGroups` for the groups). Every rows
  read bypasses the HTTP cache.
- Task (`@features/task`): `TaskSummary`, `TaskStatusChangesStore`, `TaskActionsApi` and the
  `TaskBulk*` models (the rows' writes), the status words, hints and categories,
  `TaskCreate`, `TaskDetailOpener` (`open`, `closed`, `changed`), `cw-task-title-cell`,
  `cw-task-due-date`, `cw-task-label-chips`, `cw-task-cancel-dialog`, `personOf` and the status
  rules.
- `@core/api` (problem readers), `@core/realtime` (`watch({ kind: 'list' })`), `@shared/layout-slot`
  (`SlotFeature`, `SHELL_SIDEBAR`) and `@shared/route-errors`.
- Errors' `.` entry: the `RouteErrorData` type of the `list` route's `data`.
- Workspace's `ports/workspace-context` (the signed-in member, `Me` in the assignee filter, and
  the role that enables `Automations`).
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `avatar`, `breadcrumb`, `button`, `checkbox`,
  `context-menu`, `data-table`, `date-picker`, `dialog`, `empty`, `priority-icon`, `inline-edit`,
  `input`, `menu`, `popover`, `progress`, `radio-group`, `sidebar`, `skeleton`, `status-icon`,
  `switch`, `tabs`, `textarea`, `toast`, `toggle-group`, `toolbar`) and `@cadenway/icons`.

## Invariants

- Stores and scopes:
  - `SpacesNavigationStore`, route-scoped on `/:org` (`provideSpacesNavigation()`): the spaces,
    one overview per space read at most four at a time, each page given 10 s (a failed one
    offers Retry), the favorites and the open spaces. Keyed on the committed organization id: a
    switch closes every space and
    reads again. A task created from this tab (`TaskCreate.created`) reads the overview of its
    list's space again, one creation after the other, each page given 10 s; a failed read, an
    unknown space or a full read in flight makes every overview be read again after it.
    Favorites change optimistically and a refusal restores the previous list. The
    current sprint is the first sprint, in sidebar order, whose dates hold the caller's today.
    It also holds the free seats, the trash and archive counts (one item read each, for their
    `total`), the last spaces address of the tab, and the open dialog (`dialog`, opened with
    `openDialog` by the rail, the sidebar, the overview and the list page, rendered by the
    sidebar). Its writes: `updateSpace`, `deleteSpace`, `updateList` and `archiveList` change the
    sidebar at once and restore it when refused (`updateSpace` and `updateList` send the shown
    version as `If-Match`); `createSpace` (`409 space.prefix-taken` reported to the dialog) and
    `createList` each keep one idempotency key per organization and draft (and space, for a list),
    reused by a retry and renewed when the dialog closes or the organization changes, and read the
    sidebar again and open the new space; `unarchiveList` and `removeList` serve the undos. The recorded lists and
    spaces are emitted by `listEdited` and `spaceEdited`, which `ListPageStore.followListEdits` /
    `followSpaceEdits` and the overview page follow.
  - `ListPageStore`, route-scoped on `l/:listId`: the list (primary read) and its space, counts,
    milestone count, members, labels and saved views (secondary reads), the header's and the
    selection bar's writes. It watches the list's realtime room while the page lives and
    refreshes the counts 300 ms after a notice, once per window, so a steady flow cannot hold them
    back; since the socket hands every notice to every watch, it ignores a notice naming another
    list or space and the comment and Git link notices, while a task update or status change
    (`{ taskId, changed }`) and `list.tasks-changed.v1` naming this list (a task joined or left it)
    count. A task created in the list from this tab (`TaskCreate.created`) refreshes the counts at
    once; its echoed notice reads them once more.
  - `ListViewStore`, route-scoped on `l/:listId`: filters, sort, grouping, subtask display, search,
    `Milestones` and the applied saved view. It exposes `taskQuery` (the `queryListTasks` body
    without cursor and limit) and `groupQuery` (the `countTaskGroups` parameters, null when not
    grouped) for the rows. A saved view applies over the standard tab, which gets its configuration
    back when the view is left; the search, `Milestones` and the subtask display stay local and never
    make a saved view `Modified`. Another list starts over from the default configuration.
    It holds the routed layout, which the list page publishes from its child route
    (`showLayout`, which forgets the rows' summary when the layout changes), and the tools that
    layout shows (`tools`, `LAYOUT_TOOLS`). The presentation (`setPresentation`) is saved with a
    view, but only the shown layout's part counts (`presentationFor`): hidden board columns on
    the board, hidden sheet columns and the sheet sort on the sheet make a standard tab savable
    and an applied view `Modified`, and are the only part written (a `Save` leaves the other
    layouts' stored members untouched). Presentation values a newer client stored (unknown
    statuses, columns or sorts) are kept beside the view (`SavedView.unknownPresentation`) and
    merged back on `Save`, so this client never erases them. The `Undo` of a deletion creates the
    view again with everything it stored (`ListsApi.restoreSavedView`): the whole presentation,
    every layout's members, known and unknown.
    The export follows the sheet sort on the sheet (`sheetExportSort`, the custom field's
    first while the list has it). The sheet publishes the list's custom fields
    (`followCustomFields`); until then (`customFields` null) every stored field id counts.
    The shown view publishes its rows' summary to it (`followRows`, until the view is destroyed),
    so the list page's tools read `rows`: the tasks shown with the filters and whether the tasks
    read have subtasks.
  - `ListRowsStore`, route-scoped on `list`: the rows of the `List` view. Grouping is a filter:
    the primary read takes `countTaskGroups`, then cursor pages of each group in the gateway's
    order, until 50 tasks of open groups are read; `loadMore` reads the next page when the table
    nears its end. When the grouped field is filtered, only selected group values are shown and
    each group is read with its value as a server-side filter. A task assigned to several people
    appears only in the selected assignee groups; `me` resolves to the signed-in user. A folded group (`Cancelled` by default when
    grouping by status) prefetches its first page, and reads on when opened.
    Hidden status groups do not consume the initial loading target or pagination reads. When no
    renderable rows remain, the store reads visible groups until a row is available or every
    visible group is exhausted; a failed continuation offers Retry instead of an empty state.
    Another query reads again and keeps the rows until the answer (superseded reads are aborted);
    another list or organization (`WORKSPACE_CONTEXT`) empties them at once and drops late answers.
    Its `summary` sums the groups' counts (unknown while a count is, and when grouped by
    assignee, where a task counts in several groups) and tells whether a task read has subtasks or
    is one. A first primary read fails to the route's error boundary; a failed background refresh, next
    page or subtask read offers `Retry` in place. A row is filed under the task's settled status, so it joins its new
    group 460 ms after the last click (`STATUS_SETTLE_MS`), or immediately with reduced motion,
    while the icon and word change at once. The row retains focus when it moves. Grouping by
    assignee uses the gateway's order for each group, including a task with several assignees.
    Subtasks are read under visible opened parents (`listSubtasks`, four reads at a time), two
    levels deep; closed and folded parents are pruned and stale answers are ignored. `unfolded` opens every parent and a mode change
    forgets the parents opened by hand; `apart` reads `level: all` and shows the parent's key.
    Subtask creation is offered only when loaded ancestry proves the depth limit is not reached.
    It watches the list's realtime room and reads again in place 1 s after the first notice of a
    window, once per window (`list.tasks-changed.v1` included: a task created, archived,
    unarchived, trashed, restored or moved out); the status store keeps pending and in-flight
    changes over what it reads. A
    task created in the list (`TaskCreate.created`), a completed local status write, a bulk action
    a task detail that closes over the view or gives way to another (`TaskDetailOpener.closed`)
    and a task its `Undo` restored (`TaskDetailOpener.changed`; the detail's writes would
    otherwise reach the rows only through realtime) read the rows again,
    through the same 1 s refresh window.
  - `ListTasksStore`, route-scoped on the calendar, Gantt and sheet views once their packages
    provide it: the tasks of the list with the view's `taskQuery` and an optional due window, read
    page after page to the last one and stopping at 2,000 tasks (`truncated`). A superseded read
    is aborted; another list or organization empties the tasks at once and drops late answers; a
    failed first read fails to the route's error boundary. The same realtime window as the rows
    (1 s; for a read of more than three pages 1 s more per three pages, and 5 s for a truncated
    one or from fifteen pages), a completed status write, `TaskDetailOpener.closed` and `changed`
    read again; a task created in the list reads at once. Its `summary` feeds
    `ListViewStore.followRows`, with an unknown count while a due window applies.
  - `ViewTaskWritesStore`, page-scoped on each task view's page (`ListViewPage` today), over its
    reader store (`VIEW_TASK_WRITER`): what follows for the row menu and the selection bar.
  - `TaskStatusChangesStore` (Task), route-scoped on `list` and on the board, calendar, gantt,
    workload and sheet views, so pending changes die with the view.
  - `BoardViewStore`, `CalendarViewStore`, `GanttViewStore`, `WorkloadViewStore`,
    `SheetViewStore`, `FormViewStore`, `ActivityViewStore` and `TimesheetViewStore`, each
    route-scoped on its view through its `<VIEW>_VIEW_PROVIDERS`; empty until its package fills
    it.
  - `SpaceOverviewStore`, page-scoped on `SpaceOverviewPage`. Its lists come from the sidebar's
    overview of the same space, shown at once even while the sidebar reads again, and follow it
    once it changes. The page reads on its own only when the sidebar has no value for the space,
    without waiting for the sidebar; it then ignores a sidebar value from a read begun before its
    own (`SpacesNavigationStore.overviewOrder`), gives its result to the sidebar
    (`offerOverview`, which a sidebar read begun earlier never replaces), and takes a newer
    sidebar value received during its read when that read ends, even if its own failed, so both
    converge on the newest counts.
- Route errors: the gateway answers `404 space.not-found` or `list.not-found` for a deleted
  resource and for a private one the caller does not see alike, and the access request never
  reveals which; that answer renders `Access denied` with `Request access`. Any other `404` or
  a `400` (malformed id) is not found; anything else is unavailable with its status and reference.
- The sidebar's counts come from `getSpaceOverview`, one call per space, which the contract
  designates for the sidebar; `getListCounts` serves the list header.
- Shell contributions and pages take link slugs from the committed `WORKSPACE_CONTEXT`.
- The list page claims the shell's sidebar toggle (`claimToggle`) and renders it in its breadcrumb
  row while the sidebar is collapsed.
- The dismissed suggestions are kept in browser storage under `cadenway-tips`, as in the mockup.
  `Invite your team` shows only while the plan has free seats.
- Context menus (right click, Menu key, Shift F10, long press; `[cwContextMenuTriggerFor]`, the
  innermost wins): a list (and a favorite list) offers `Open`, `New task`,
  `Edit the list` / `Edit the sprint`, the favorite toggle, `Copy the link` and
  `Archive` (with `Undo`); a space (in the sidebar and the rail) `Overview`,
  `Edit the space`, the favorite spaces toggle, `New list`, `New sprint`, fold or
  unfold, `Delete the space` (its typed name first); a favorite saved view `Open`; the
  sidebar background `New space`, `Expand all spaces` and `Collapse all spaces`. Rights: list items need `canEdit`, space edits `SpaceDetails.canEdit`, the deletion
  and the confidentiality `canManage`.
- Dialog outcomes: `Space created` opens its first list; `Space updated`, `List updated` and `Sprint updated` offer `Undo`, which writes the previous values back from the recorded version (a refusal shows the
  failure toast); a created list or sprint opens. `New sprint` proposes `Sprint N+1`, the day after the end
  of the space's last sprint (else today), 14 days, the lightning and `Amethyst`.
- List page undos: `List archived` brings it back (`unarchiveList`) and opens it; `List duplicated` deletes the copy; `View deleted` creates the view again at its place (with a new
  id) and applies it again when it was applied.
- Deleting a list asks for its typed name (`cw-alert-dialog` with `confirmText`), then opens the
  home screen; archiving opens the space overview. The export downloads the gateway's CSV with the
  view's filters, sort and level.
- `Create a task` (`ViewTools.taskCreated`), each group's trailing `Add a task` row (with the group's status,
  priority or assignee, nobody for `Unassigned`), the empty state's `Add a task`, the
  list menu's `New task` and `N` (`TaskCreate.useDefaults`) open the create dialog in the
  open list.
- A row: a click on the name, Enter or the `…` button opens the task's detail over the view
  (Task's `TaskDetailOpener`, `?task=<KEY>` merged into the address, the row as the header's
  preview; `App.dc.html` line 695); a milestone of the overview opens it the same way; the right click, the Menu key, Shift F10
  or a long press anywhere in the task row (`App.dc.html` line 659; the view hands a right click
  or a key the cells' triggers do not handle to the row's `…` trigger, in the capture phase) open
  the menu of the task, or of the selection when the row belongs to
  a selection of several tasks: `Open`, `Status` (by category, with hints; `Cancelled` asks one
  reason for the tasks not cancelled already), `Priority`, `Assign` (ticked when every task
  has the person, picking them again removes them), `Move to`, `Remind me tomorrow morning`
  (9 h tomorrow, `setTaskReminder`), `Duplicate`, `Copy the link` (`/<slug>/t/<KEY>`),
  `Copy the identifier` and `Delete` (confirmed). `…` and the add-subtask button show on
  row hover or focus. The add-subtask button (`Add a subtask to <key>`, offered while the depth
  and the 25-subtask limits allow) opens the task's detail on its `Subtasks` tab with the
  new-subtask field focused (`TaskDetailOpener.open(key, preview, { tab: 'subtasks' })`,
  `App.dc.html` lines 6291-6294). A right click elsewhere in the view opens the list menu: `New task`,
  `Group by`, `Sort by`, `Select all`, `Export as CSV` and `Edit the list` (`Edit the sprint` for a sprint, `App.dc.html` line 7310), which opens the list
  dialog through `SpacesNavigationStore.openDialog`. `Name` sorts by name,
  ascending then descending. The row's icon animates from its previous status.
- `ListViewPage` holds the table's selection. The row menu (`cw-task-menu`) and the selection bar
  write through `ViewTaskWritesStore` and `ListRowsStore.act` (`withViewTaskWrites`), which sends
  Task's `TaskActionsApi.bulk`: chunks
  of 50 `executeBulkTaskAction` calls one after the other, each with an idempotency key reused for
  one retry after an uncertain response; each send and retry checks the starting organization and
  the store's lifetime, and the remaining tasks are reported as not sent when either changes.
  Writes are serialized per task: an action waits for the earlier actions of its tasks, then sends
  each task at its newest known version (the last read, or the version the gateway returned to an
  earlier action), so a second action never fails on a version the first one superseded; a waiting
  status change gives way to a newer status change of the same task, which alone is sent. The
  rows change at once (`_patches`, one patch per action and task, merged in order; a confirmed
  patch applies until a read reaches the version the gateway returned): the icon, the word or the
  people at once, the group 460 ms after the task's last action, a moved or deleted row leaves at
  once; `Mark done` and a move empty the selection at once. A refused, uncertain or unsent task
  loses only that action's patch; a refused chunk stays selected and a second toast counts it; an
  unresolved response warns and the rows are read again. Each applied action reads the list's
  counts again (`ListPageStore.refreshCounts`) and shows a toast whose `Undo` writes back the
  values confirmed before the action (statuses with their reasons and the cancellation notes
  recorded by the view, priorities, assignees, lists) or restores the trash entries of a deletion
  (`restoreTrashEntry`, four at a time, like the reminders). An `Undo` is bound to the version its
  action left each task at (`ListActOutcome.after`): a task known to have changed since, through
  this view or a read, is skipped and a warning names it (`CAD-482 changed since`), and the others
  are sent at that version, so a change not read yet makes the gateway refuse them; an `Undo`
  reports tasks not sent, uncertain or refused like the action and reads the rows again after a
  refusal. Leaving the view
  dismisses its `Undo` toasts, as `TaskStatusChangesStore` does for the status toasts. A copy's
  toast offers `Open`. A single-field write (`update`: dates, estimate, name, custom fields) is
  serialized with the actions and sent with `updateTask` and `If-Match`; the name and the dates
  show at once (without a start in the write, a new due date moves the start by the same days and
  a removed due date removes it, as the task service does), the estimate and custom fields once
  read, since task summaries do not carry them. A refusal that may come from a version the view
  has not read (a `412` of a single-field write, any refused chunk of a bulk action, whose answer
  gives no reason) reads the tasks again; a refused single-field write shows
  `The task could not be changed`.
- The table declares gateway groups in order, omitting hidden and empty groups except the five default empty status groups in an unfiltered view. Filtered empty results show the empty state. `nearEnd` requests further pages with a threshold accounting for unread group lines. Under 768 px the grid keeps selection, name and due date.

## Organization pin

`listSpaces`, `getSpaceOverview`, favorites, `getListCounts`, saved views, `listLabels`,
`listMembers` and `listListGrants` carry `If-Organization-Match` since contracts 0.42.0 (B20): the
gateway checks them and `ORGANIZATION_PIN_OPERATIONS` lists them.

## Known gaps

- `cw-data-table` has no row-level context menu input: the `List` view delegates row clicks and
  keys outside the cells' triggers to the row's `…` trigger. A row context-menu input in
  `@cadenway/ui` is the lasting fix.
- Task summaries (`queryListTasks`) carry no cancellation note: the `Undo` of a change from
  `Cancelled` puts back the note only when this view recorded it (a cancellation made here);
  otherwise it restores the reason without a note.
- Row writes and the status icon's writes (`TaskStatusChangesStore`) are serialized separately;
  each reads the other's confirmed version only once it is read or settled.

- `cw-sidebar-space` has no slot next to the name: the private lock of a space shows on its
  overview, not in the sidebar, until the design system adds one.
- `cw-sidebar-item` takes no color: the lists and favorite lists of the sidebar show their icon
  without their color, until the design system adds one. A favorite saved view shows the funnel:
  `Favorite` carries no icon.
- A favorite saved view's menu holds `Open` only: renaming, duplicating and deleting a view
  live on its list page.
- `Sprint report`, `Space statuses` and `Automations` are stub dialogs; their openers and
  `Share`'s (built, see "Share dialog") stay hidden until `RELEASED_LIST_DIALOGS` lists them; the Git section of `Automations` stays hidden until B6 is decided. The Slack and
  Figma suggestions need integrations no service provides.
- The tabs show every released layout: the mockup's views added per list (`Added` / `Add`,
  `App.dc.html` lines 6187, 8792-8795) have no list setting in the contract (G12) and are not
  kept.
- `View deleted` restores the saved configuration, not unsaved changes of the applied view.
- The trash and archives screens are not built: the footer rows link to their future addresses.
- The plan names of `Invite your team` are spaces units (`spaces.tips.plan-*`): Organization
  publishes `planName` to Workspace only.
- Realtime notices without a list or space id cannot be attributed to the open list and do not
  refresh its counts; the notice contract needs to include that context.
- The filter dialog counts the visible tasks (`n of m tasks`, `ViewTools.visibleCount`), hides
  `Subtasks: …` without subtasks (`hasSubtasks`) and offers the signed-in member once as `Me`
  (`userId`). The mockup's `listHasKids` looks at every task of the list; `hasSubtasks` looks at the
  tasks read (shown while unknown), and the count stays blank when grouped by assignee.
- The row's status icon and name open the task. Assignees, priority, due date and labels are display
  only in the cells; the row menu changes them. A row can create a subtask with its parent key.
- The row menu's `Move to` and the selection bar list the lists of the sidebar's overviews
  only.
- `ListViewPage` copies the list page's CSV record count for `Export as CSV`.
- `queryListTasks` items are mapped by `list-task.adapter`, a copy of Task's `task-summary`
  adapter: a DTO adapter cannot be published across features.

## Copy not taken word for word from the mockup

| Unit                                                                                                                           | Reason                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `spaces.retry`, `spaces.sidebar.failed`, `spaces.overview.milestones-failed`, `spaces.secondary.*`, `spaces.saved.read-failed` | The mockup draws no failed read.                                           |
| `spaces.favorite.failed`, `spaces.list.*-failed`, `spaces.saved.failed`, `spaces.saved.delete-failed`, `spaces.bulk.failed`    | The mockup draws no refused write.                                         |
| `spaces.saved-view.missing`                                                                                                    | The mockup does not show a missing saved-view address.                     |
| `spaces.save-view.name-required`                                                                                               | The mockup disables the save button rather than showing an error.          |
| `spaces.list.export-failed`                                                                                                    | Taken from the mockup's `Export not possible here` title only.             |
| `spaces.labels.*`, `spaces.table.*`                                                                                            | The bricks' own default texts, which the mockup does not show as copy.     |
| `spaces.rows.more-failed`, `spaces.rows.subtasks-failed`                                                                       | The mockup draws no failed read.                                           |
| `spaces.bulk.partial*`                                                                                                         | The mockup draws no refused chunk of a bulk action.                        |
| `spaces.rows.remind-failed`, `spaces.rows.copy-failed`, `spaces.bulk.restore-failed`                                           | The mockup draws no refused reminder, copy or restore.                     |
| `spaces.rows.empty`, `spaces.rows.add`                                                                                         | The empty list without filters, from the board's `No task`.                |
| `spaces.sidebar.overview`                                                                                                      | The mockup's `Overview of …`, with the space name.                         |
| `spaces.list-view.region`, `spaces.sprint-progress.label`, `spaces.saved.modified-group`                                       | Accessible names of regions the mockup names differently or does not name. |
| `spaces.route.overview`, `spaces.route.list`                                                                                   | Route titles.                                                              |
| `spaces.tips.*`                                                                                                                | Three of the five suggestions: the others need integrations.               |
| `spaces.tips.invite-text-one`, `spaces.list.*-one`, `spaces.space.delete-*-one`                                                | Singular forms the mockup writes in the plural.                            |
| `spaces.space.save-failed`, `spaces.space.delete-failed`, `spaces.list.save-failed`, `spaces.list.unarchive-failed`            | The mockup draws no refused write.                                         |
| `spaces.space-dialog.name-required`, `spaces.list-dialog.name-required`                                                        | The mockup disables the submit button rather than showing an error.        |
| `spaces.list-dialog.date-*`, `spaces.list-dialog.pick-date`, `spaces.footer.*`                                                 | The date picker's texts and the footer rows' names.                        |
| `spaces.look.*`                                                                                                                | `LOOK_COLORS` names and the default choices of `lookPicker`.               |
| `spaces.view-stub.text`                                                                                                        | The stub of a view not built yet, which the mockup does not have.          |
| `spaces.share.*-failed`, `spaces.share.read-failed`                                                                            | The mockup draws no failed read or refused write.                          |
| `spaces.share.not-member`                                                                                                      | The contract's `access.grantee-invalid` title (G10).                       |
| `spaces.share.already-owner`                                                                                                   | The mockup does not draw the owner's address.                              |
| `spaces.share.remove-inherited`                                                                                                | The mockup has no wording for access kept through the organization.        |
| `spaces.share.email-placeholder`                                                                                               | The mockup's address names its own organization.                           |
| `spaces.share.guests-one`                                                                                                      | Singular form the mockup builds in its script.                             |
| `spaces.share.access-of`, `spaces.share.remove-label`                                                                          | Accessible names, from the mockup's `aria-label`s.                         |

| `spaces.task-writes.field-failed` | The mockup draws no refused single-field write. |

| `spaces.sprint-report.failed`, `spaces.sprint-report.empty`, `spaces.sprint-report.chart-empty` | The mockup draws no failed read or empty sprint. |
| `spaces.sprint-report.projected-unknown` | The mockup always has a projection. |
| `spaces.sprint-report.chart-*` (except `chart-empty`), `spaces.sprint-report.stat-*` | The bricks' own texts, which the mockup does not show as copy. |
| `spaces.sprint-report.today` | The today marker's label; the mockup's line has none. |
| `spaces.sprint-report.tasks-one`, `spaces.sprint-report.open-tasks-one` | Singular forms the mockup writes in the plural. |

## Automations dialog

`AutomationsDialog` (`ui/dialogs/automations-dialog/`, `App.dc.html` lines 3246-3301, logic lines
8532-8585) shows the organization's "when… then…" rules, which apply to every task of the workspace.

- `AutomationsStore` (`state/automations/`), component-scoped on the dialog, reads nothing until
  the dialog opens. Each opening reads the rules (every page) and the last runs again; it reads the
  members once, through `ListsApi.organizationMembers`. Another organization reads all of them
  again. A failed rules read shows an inline error with Retry (`No automation yet.` is kept for a
  successful empty read). A failed runs or members read shows its own inline error with Retry.
- Writes go through `AutomationsApi` (`data-access/services/automations-api/`,
  `AutomationsService`: `listAutomationRules`, `createAutomationRule`, `updateAutomationRule`,
  `deleteAutomationRule`, `listRecentAutomationRuns`), mapped by
  `data-access/adapters/automation-rule/` to `models/automation-rule/`.
  - The confirmed rules (`confirmedRules`) are kept apart from the read in flight. They are the
    newest read, with the results of this dialog's writes that settled after that read started
    applied over it: a newer version, a created rule, a deleted rule. They keep their value while
    an opening reads again, so a write always uses the newest known version and is always sent.
  - A switch changes at once. The writes of a rule are serialized, each sent with the version the
    previous one left (`If-Match`). Only the last state asked is sent, and coming back to the
    recorded state sends nothing. A definite refusal (`4xx`) restores the recorded state and shows
    an error toast. A `412 request.version-mismatch` or `404 automation.rule-not-found` also reads
    the rules again.
  - A lost answer (no response, `408`, `5xx`) may still be applied, so it is not a refusal: the
    original write may still be running when a read happens. The store resends the same write
    with the same `If-Match` version, after the waits of `AUTOMATION_RETRY_DELAYS` (three
    resends over about 6.5 s by default). A resent switch that succeeds applies. One refused on
    its version (`412`) means the version moved, so a read of the rules tells whether the wanted
    state holds (`applied`), or not (`not-applied`, `The automation was not changed`).
  - When the resends do not settle it, the outcome is `unknown` and the dialog warns. The wanted
    state stays shown (a deleted rule stays hidden), and the rule's controls are disabled
    (`unresolvedRuleIds`): the rule takes no other write. The store reads the rules again; the
    first read started after the resends gave up settles the rule.
  - A deletion is confirmed by `cw-alert-dialog` (`Delete this automation?`), then hides the rule
    at once. It succeeds only once the gateway deletes the rule or reports it absent. A refusal
    brings it back with an error toast. A lost answer is resent with the same version: a `404`
    (already gone) means it applied, a `412` that the rule is still there.
  - A creation sends one `Idempotency-Key` per draft and organization. A definite refusal
    (`4xx`), a recorded rule, another draft or a closed builder renews it. The created rule is
    added last and shows `Automation created`. A refusal keeps the builder and its values.
  - A lost creation answer (no response, `408`, `5xx`, `409 idempotency.request-in-progress`) is
    resent with the same key, which the gateway replays, after the same waits. When the resends
    do not settle it, the store reads the rules again and keeps the draft and its key, even when
    the builder closes (`creationUnknown`). The builder then warns that the rule may already
    exist. Submitting again sends the same key, so the rule is never created twice. Submitting
    another draft first resends the kept one with its key.
    A comment over 5,000 characters (the contract's limit) blocks `Create the rule` and shows
    `spaces.automations.comment-too-long`. The field also carries the native `maxlength` that
    Signal Forms derives from the rule.
- Statuses use their default words: a rule is not tied to a space, so the `space` input does not
  rename them.
- Extension point for gap B6: the mockup's `Git automations` section (lines 3274-3296) is not
  rendered. Its place is between the builder and `Last runs`. It needs a contract first (e.g.
  `getSpaceGitAutomations` / `updateSpaceGitAutomations` with `If-Match`), then its producer and
  gateway route, then new `AutomationsApi` methods and store state, and a product decision on
  its scope: per space as planned, or global as in the mockup.
- Known gaps:
  - `automation.executed.v1` is not relayed by the realtime gateway, so `Last runs` refreshes
    only when the dialog opens.
  - `cw-toggle-group` (`@cadenway/ui` 0.8.0) reads its items' required `value` before every
    `@for` item has received it. The fixed chips are written out statically. The person chips
    show the first member until they have rendered once (`personValue`). The lasting fix belongs
    in the design system.
  - The mockup shows no member's view: the opener is disabled for members (list header).
- Copy not taken word for word from the mockup:

  | Unit                                                                                              | Reason                                                   |
  | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
  | `spaces.automations.load-failed`, `runs-failed`, `members-failed`                                 | The mockup draws no failed read.                         |
  | `spaces.automations.create-failed`, `toggle-failed`, `delete-failed`                              | The mockup draws no refused write.                       |
  | `spaces.automations.toggle-not-applied`, `toggle-unknown`, `delete-not-applied`, `delete-unknown` | The mockup draws no lost answer.                         |
  | `spaces.automations.create-unknown`, `create-unknown-toast`                                       | The mockup draws no lost answer.                         |
  | `spaces.automations.comment-too-long`                                                             | The mockup has no wording for a comment over the limit.  |
  | `spaces.automations.former-member`                                                                | A rule or run naming someone no longer in the directory. |
  | `spaces.automations.loading`                                                                      | Accessible name of the skeleton rows.                    |
  | `spaces.automations.text-one`                                                                     | Singular form the mockup writes in the plural.           |
  | `spaces.automations.run-minutes`, `run-hours`                                                     | The mockup only shows `just now`.                        |
