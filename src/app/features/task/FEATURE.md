# Task

## Purpose

The task building blocks other features compose (step 4a of the mockup integration), the task
create dialog and the task detail (step 5). It owns the task display models and their adapters,
the status change interaction of `cw-status-interactions`, the cancel reason dialog, the status,
priority, people and label pickers, the due date, the label chips and the name cell of a row, the
task menu (`cw-task-menu`) shared by every view that lists tasks, the one-line row of the pages
whose tasks belong to no list (`cw-task-line`) with the menu's writes for those rows
(`TaskRowActionsStore`), the create dialog with its `N` shortcut, and the task detail: a dialog over the current page driven by
`?task=<KEY>`, its store, header, layout, properties panel (`cw-task-properties-panel`), tabs
(`cw-task-detail-tabs`: details with the Development panel of the task's Git links, subtasks,
comments, activity) and their stores, list and parent pickers. Lists, boards and their grouping
belong to Spaces, which composes these blocks (its list views write the menu's actions through
their own `ViewTaskWritesStore`) and opens the detail through `TaskDetailOpener`;
the typed route error states belong to Errors.

## Routes

`TASK_ROUTES` (`task.routes.ts`), mounted by Workspace below `/:org`:

- `t/:taskKey`, the shareable deep link of a task (`Copy the link`):
  `taskLinkResolver` reads the task by key (`TaskApi.readLink`) once the workspace context is committed
  and redirects with a `RedirectCommand` to `/<slug>/l/<listId>/list?task=<KEY>`, replacing the
  address. A task it cannot read resolves the typed route error the read fails with (`toTaskRouteError`):
  `404 task.trashed` is the deleted task (`Restore the task`), another `404` or a `400` is not found,
  anything else (offline included) is unavailable (`Retry`). `TaskLinkPage` throws it to the
  router's error boundary, which renders it at the task's address inside the shell; the route runs
  its resolver on every navigation (`runGuardsAndResolvers: 'always'`), so `Retry` and the restore
  read the task again. The gateway answers `task.not-found` for a task the caller does not see, so
  the link has no access-denied state. The list view then opens the task's detail from
  `?task=<KEY>`.
- The detail has no route of its own: `?task=<KEY>` on any workspace page opens it (see
  `withTaskDetail()`); the copied link stays `/:org/t/<KEY>`.

## Public entry points

| Entry point   | Consumers                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| `.`           | spaces, search, inbox, home, my-tasks, dashboards, goals, trash, archives, onboarding |
| `providers`   | workspace                                                                             |
| `task.routes` | workspace                                                                             |

`providers` publishes, bound on the shells of `/:org` (the application shell and both settings
shells, so the palette's `Create a task`, task results and `?task=<KEY>` work in the settings too):

- `withTaskCreate()` (`overlays`, order 20);
- `withTaskDetail()` (`overlays`, order 30): `TaskDetailHost`, which renders the detail dialog of
  `?task=<KEY>` (loaded in its own chunk) on every workspace page and removes the parameter, keeping
  the others, once the dialog closes.

Onboarding's getting-started checklist opens `TaskCreate` on the provisioned space's first list
for `Create your first task`, and reads its progress again after each `created`.

`.` publishes:

- Models: `TaskSummary` (`id` is the key, `version` is the `If-Match` precondition), `TaskProgress`,
  `StatusOption`, `Person`, `TaskStatusChange`, `TaskCancellation`, `TaskCancelRequest`,
  `TaskCreateOptions` (list, status, due date, parent, priority and assignees), `CreatedTask`,
  `TaskBulkAction`, `TaskBulkSelection`, `TaskBulkEntry`, `TaskBulkOutcome`, `TaskMoveTarget` (a
  list of `Move to`: id, name, space name, icon and tone class), `TaskLineVariant`; the words
  `STATUS_LABELS`, `STATUS_HINTS`, `MILESTONE_STATUS_HINTS`, `STATUS_CATEGORY_LABELS`,
  `CANCEL_REASON_LABELS` and `PRIORITY_LABELS`; the rules `nextStatus`, `isClosedStatus`,
  `isMilestoneStatus`, `statusLabel`, `pickableStatuses` and `defaultStatusOptions`; `initialsOf` and `personOf(userId, name)` for members another feature read.
- `TaskStatusChangesStore`, a SignalStore the consumer provides on its route, typed
  `TaskStatusChangesInstance`: `request(task, status, options?, behavior?)` (`behavior` is
  `TaskStatusRequestOptions`, whose `quiet` confirms without the change toast),
  `requestCancel(tasks, options?)`, `pendingStatus(taskId)`, `displayedStatus(task)`,
  `settledStatus(task)`, `settledTask(task)`, `undo(taskId)`, `cancelRequest` with
  `confirmCancel(cancellation)` and `keepTask()`, the `changed` stream, and the `completed` stream
  after each write succeeds or fails; `STATUS_SETTLE_MS` (460).
- `TaskActionsApi` (root): `bulk(selection, action, current)` (chunks of 50, idempotent, one retry
  after an uncertain answer (no answer, a `408` or a `5xx`) that only a success settles, any refusal
  of the retry leaving the chunk unknown; per-task versions, copies and trash entries),
  `remind(taskKey, at)` and
  `restore(entryId)`, for the stores of the screens that act on several tasks.
- `TASK_ROW_ACTIONS_PROVIDERS`, what the page of rows outside a list provides on its route:
  `TaskRowWriteLaneStore` (also bound as `TASK_WRITE_LANE`), `TaskStatusChangesStore` and
  `TaskRowActionsStore`.
- `TaskRowActionsStore`, typed `TaskRowActionsStoreInstance`: the writes of `cw-task-menu`
  for one task, `setStatus` (through `TaskStatusChangesStore`), `cancelKeys` with `confirmCancel`
  and `keepCancel` for `cw-task-cancel-dialog`, `setPriority`, `toggleAssignee(task, person)`,
  `moveTo(task, target)`, `remind`, `duplicate`, `copyLink`, `copyKey`, `askDelete` with
  `deleteOpen`, `deleteTitle`, `deleteText`, `deleteAction`, `deleteItems`, `deleting`,
  `setDeleteOpen` and `trash()` for the page's `cw-alert-dialog`; `open(task)`, `userId`,
  `sync(tasks)` (a `signalMethod` the page binds to its read tasks), `rows(tasks)`,
  `displayedTask(task)`, `displayedStatus(task)`, and the `changed` stream (task keys) on which
  the page reads its rows again.
- `TaskCreate` (root): `open(options?)`, `useDefaults(defaults, destroyRef)`, `close()`, `isOpen`,
  `options`, `created`.
- `TaskDetailOpener` (root): `open(taskKey, preview?, options?)` merges `?task=<KEY>` into the
  current address (the list view, the command palette, the inbox, a toast's `Open`), `close()`
  removes it, `taskKey`, `isOpen`, `preview`, `closed` (the key of each task whose detail
  closed or gave way to another) and `changed` with `notifyChanged(taskKey)` (a task the detail's
  archive or deletion `Undo` restored), so the view under it reads its rows again: Spaces' list
  rows consume both; `TaskDetailPreview` (key, name, status,
  milestone), what the opening screen shows of the task while the detail is read;
  `TaskDetailOpenOptions` (`tab`, a `TaskDetailTab`: `details`, `subtasks`, `comments` or
  `activity`) opens the column on that tab, kept out of the address, which the tabs take once
  (`takeTab(taskKey)`); `subtasks` also focuses the new-subtask field (a row's `Add a subtask`).
- Presentational components, inputs and outputs only: `cw-task-status-picker` (`statusChanged`
  for the split button's advance, `statusPicked` for a menu option),
  `cw-task-priority-picker`, `cw-task-people-picker`, `cw-task-label-picker`, `cw-task-due-date`,
  `cw-task-label-chips`, `cw-task-title-cell`, `cw-task-cancel-dialog`, `cw-task-menu` (`TaskMenu`:
  `tasks`, `status`, `statuses`, `people`, `userId`, `lists`; one output per item; the page opens
  `menu()` from its own `[cwContextMenuTriggerFor]`; the optional `peopleState`, a
  `TaskMenuPeopleState` `ready` (the default, `Assign` disabled without people), `loading` or
  `failed`, opens `Assign` on `Loading the members` or on `Could not load the members.` with
  `Retry`, which emits `peopleRetried`) and `cw-task-line` (`TaskLine`: `task`,
  `status`, `from`, `listName`, `people`, `variant` `mine`, `priority` or `late`; `opened`).

## Dependencies

- `@cadenway/api-client` through `data-access/`: `TasksService.updateTask` (status with `If-Match`), `getTask`, `createTask` and `createSubtask` (with `Idempotency-Key`), `executeBulkTaskAction` (with `Idempotency-Key`), `listLabels`;
  `RemindersService.setTaskReminder`, `TrashService.restoreTrashEntry`;
  `SpacesService.listSpaces`, `getSpace` (`cache: 'no-store'`), `listTaskTemplates`;
  for the detail (`TaskDetailApi`): `TasksService.getTaskDetail` and `listTaskComments`
  (`cache: 'no-store'`), `updateTask` (JSON Merge Patch with `If-Match`), `duplicateTask`
  (`If-Match`, `Idempotency-Key`), `listTaskWatchers`, `followTaskWatcher` and
  `unfollowTaskWatcher` (the new version from the `ETag`), `ArchivesService.archiveTask` and
  `unarchiveTask`, `TrashService.trashTask` and `restoreTrashEntry`,
  `RemindersService.getTaskReminder`, `setTaskReminder`, `updateReminderNote` and
  `deleteReminder`, `SpacesService.createTaskTemplate`, `TaskQueriesService.listTasks` and
  `SearchService.search` (the parent picker);
  `ListsService.listLists`; the assignable people of `TaskMembersApi` (owners, admins and
  members). Every collection is read to its last cursor page.
- For the properties panel (`TaskPropertyApi`, `TaskTimeApi`): `TasksService.assignTask`,
  `unassignTask` (the new version from the `ETag`), `addTaskLabel`, `removeTaskLabel`,
  `listTaskWatchers` (to its last page), `getTaskApproval` (through `TaskApprovalRead`),
  `requestTaskApproval` (`If-Match`),
  `listTaskDependencies`, `createTaskDependency` (`Idempotency-Key`), `deleteTaskDependency`,
  `listDependencyCandidates`; `TaskTimeService.listTaskTimeEntries`, `createTaskTimeEntry`
  (`Idempotency-Key`), `deleteTaskTimeEntry`, `getTaskStatusDurations`; `ListsService.getList`
  (the sprint end); the people and labels of `TaskCreateApi`. `parseDuration` and
  `formatDuration` of `@cadenway/ui/components/time-tracker`.
- For the Development panel (`TaskGitLinksApi`): `GitLinksService.listTaskGitLinks` (paged by
  cursor, 50 per page, `cache: 'no-store'`, pinned with `If-Organization-Match`); its first page
  comes with `getTaskDetail` (`development`).
- `@cadenway/contracts` enums: `STATUS_KEYS`, `STATUS_CATEGORIES`, `STATUS_CATEGORY_BY_KEY`,
  `MILESTONE_STATUS_KEYS`, `PRIORITY_KEYS`, `CANCEL_REASONS`, `RECURRENCES`.
- `@core/api` (`hasProblemCode`, `readProblem`, `OrganizationPin`), `@shared/route-errors`, `@core/shortcuts` (`N`, Ctrl Enter), `@shared/layout-slot`
  (`ShellOverlay`, slot contribution), Workspace's `ports/workspace-context`.
- For the tabs (`TaskSectionsApi`): `TasksService.getTaskApproval` (through
  `TaskApprovalRead`), `voteOnTaskApproval`,
  `withdrawTaskApprovalVote` and `requestTaskApproval`; `listTaskComments` (later pages),
  `createTaskComment` (mention spans, `Idempotency-Key`), `deleteTaskComment` (`If-Match`),
  `listTaskParticipants` (the `@` menus of the composer and the description), `updateTask`
  (`description` with `descriptionMentions`, `If-Match`); `addChecklistItem` and
  `updateChecklistItem` (without `If-Match`); `createSubtask` (`Idempotency-Key`) and `getTask`
  (the parent's parent, for the depth); `TaskActivityService.listTaskActivity`;
  `AttachmentsService.listTaskAttachments`, `startTaskAttachmentUpload` (`Idempotency-Key`), the
  signed form post to object storage (`HttpClient`, never to the API), `completeTaskAttachmentUpload`,
  `deleteTaskAttachment` (`If-Match`) and `getTaskAttachmentDownload`; the people of
  `TaskMembersApi` (every role, guests included). `@cadenway/ui` `tabs`, `block-editor`,
  `comment-composer`, `markdown`, `attachment`, `dropzone`, `checkbox`, `progress`, `avatar`,
  `context-menu`.
- Shared reads: `TaskMembersApi` reads `MembersService.listMembers` to its last page once for
  every role and gives the assignable people (guests left out) and all the people from it;
  `TaskApprovalRead` reads `TasksService.getTaskApproval` (`cache: 'no-store'`) by task. Each
  shares the read in flight with the readers that ask meanwhile (the tabs and the properties
  panel open together and follow the same version) and keeps nothing once it ends, so a later
  read is fresh. The directory read is bound to the organization id and `OrganizationPin`
  revision it began with: readers of another context start their own read, and once the context
  changes the old read requests no further page and fails with `OrganizationSwitchPendingError`.
  Approval reads are shared by organization context and task key, and an answer received after
  its context changed fails the same way. An approval reader passes the confirmed task version it
  follows (`atLeast`) and checks every answer against it, its retries included: while an answer
  is older (a read begun before a write), it reads again (a read it has not received yet, or a new
  one), twice at most, then keeps the latest answer for its version follower to refresh later.
- `@core/realtime` (`watch({ kind: 'task' })`) for the open detail; Errors' `.` entry
  (`RouteErrorPanel`) for the detail's not-found, deleted-task and unavailable states; Spaces'
  `ports/list-directory` (`LIST_DIRECTORY`) for `Move to…`.
- `@cadenway/ui` (`alert-dialog`, `badge`, `button`, `combobox`, `date-picker`, `dialog`, `empty`,
  `input`, `kbd`, `menu`, `popover`, `priority-icon`, `radio-group`, `skeleton`, `split-button`,
  `status-icon`, `switch`, `textarea`, `toast`) and `@cadenway/icons`.

## Invariants

- `TaskStatusChangesStore` is never provided at the root: the route whose screens change statuses
  provides it, so its pending changes die with it. The icon and the word change at once; one
  pending change per task, a new click replaces it and a click on the saved status cancels it; it
  settles 460 ms after the last click (`animateStatus` of `App.dc.html`) with one `updateTask`
  write against the last confirmed version, and the writes of one task never overlap (each one goes
  against the version the previous one returned). `changed` emits when a change settles, so a
  grouped view moves the task then, and again when a refusal or a conflict puts another status
  back. A `412` other than `organization.context-changed` reads the task again, shows its status
  and warns; any other failure restores the confirmed status, clears the pending change and shows
  the failure toast. A confirmed change shows a 6 s toast whose `Undo` sends the previous
  status at once, only while the task still has the status that change gave it; a `quiet`
  request (a status picked from the detail's menu) shows none, the last click deciding, while a
  failure still toasts and a cancellation still toasts after its dialog. Undoing a change
  away from `Cancelled` sends its reason again without its note, which task summaries do not carry.
  A pending write flushed after destruction is dropped if its queued organization is no longer
  the committed organization.
- `TaskRowActionsStore`, its `TaskStatusChangesStore` and its write lane are never provided at the
  root: the page of rows outside a list provides `TASK_ROW_ACTIONS_PROVIDERS`, so their shown
  values, holds and `Undo` and `Open` toasts die with it.
  - One write lane per task (`TaskRowWriteLaneStore`, bound as `TASK_WRITE_LANE`) carries the
    status changes and the menu's other writes, so they never overlap. Each write goes after the
    task's earlier writes and reads, at the newest known version: the page's copy, or the version
    the lane last sent at, returned or read. A returned version is adopted only at known + 1;
    another version, or a `TaskVersionConflict`, reads the task again and the next write waits for
    that read. The page's own changes therefore never cause a `412`. A lane read waits 10 s at most
    (`LANE_READ_TIMEOUT_MS`) and is aborted when the page is left, so it never holds the task for
    good. A queued write, status included, is dropped (`TaskWriteCancelled`, no failure toast, the
    shown value put back) right before it would be sent when the page was left since it was queued
    or its organization is no longer the current one; a last click flushed while the page is left
    is still sent in its organization.
  - Priority, assignee, move, duplicate and deletion go through `TaskActionsApi.bulk` with that
    version. A refused chunk reads the task back: found past the version sent, it changed
    elsewhere (warning, its values shown); otherwise the failure toast.
  - An uncertain answer keeps the shown value, warns, and holds the task's next writes while the
    task is read back after `ROW_RECONCILE_DELAYS_MS` (2, 4 and 8 s): a read past the version sent
    settles the write (applied when it holds the written values), a deleted task settles a
    deletion; once the reads still find the version sent, the write is taken as not applied (a
    late commit then refuses the next write, sent at that version). When no read answers, the
    outcome stays unknown: the value stays shown with the `is not confirmed` warning and no failure
    toast, the hold goes, and the page's next read (`sync`) decides. A copy is never held.
  - Shown values: the confirmed ones (a write's answer, a read) over a page copy older than their
    version, then each waiting write's own; a refusal drops only its write's values. An assignee
    toggle computes its assignees from the task as confirmed when it starts, never from an earlier
    write still waiting. `sync` prunes the confirmed values a page copy at their version or later
    replaced.
  - `Undo` is offered only when the returned version is the one sent + 1 (the write was the task's
    only change, the rule of `TaskDetailStore.acceptVersion`). It puts back the values confirmed
    when the write started, never an earlier optimistic value, and is sent against the returned
    version, so a later change refuses it (`The change could not be undone`); it does nothing once
    the organization changed.
  - A deletion is confirmed first, hides the row at once and counts the subtasks in its toast; its
    `Undo` restores the trash entry. A refused deletion or restore shows the row again (a refused
    restore also emits `changed`); `sync` shows a deleted task again once a read no longer holds
    it, unless its deletion is still uncertain.
  - Every queued write, reminder and restore checks the organization it was asked in before it
    is sent. Each settled write, restore and status write emits `changed`. A write answered after
    an organization change reports nothing; one answered after the page was left reports only
    what failed; leaving the page dismisses its `Undo` and `Open` toasts, and an `Open` does
    nothing in another organization.
- `cw-task-menu` keeps the `spaces.rows.*` and `spaces.bulk.*` ids it had in Spaces, so moving it
  changed no catalog text.
- `cw-task-line` is one button: its status icon never changes the status (the detail or the menu
  does), and the status word is read with the default words, since the space's own names are not
  known outside a list.
- `Cancelled` always opens the cancel reason dialog first (`cancelRequest`): `Duplicate`, `Will not
be done`, `Out of scope`, `Obsolete` and optional `Details`; `Keep the task` changes nothing.
  The consumer renders `cw-task-cancel-dialog` bound to `cancelRequest`, `confirmCancel` and
  `keepTask`.
- `displayedStatus(task)` and `settledStatus(task)` prefer the store's settled status only while
  its write is in flight or its version is newer than the caller's task, so a refetched task wins.
- `TaskCreate` (root) only holds whether the dialog is open and its presets, through
  `ShellOverlay`, so it never opens over the command palette or the shortcuts dialog. `N` opens it
  outside fields while the shell lives, with the defaults of the screen that gave some
  (`useDefaults`: the `List` view gives its list) until that screen is destroyed; Ctrl Enter
  creates while it is open.
- `TaskCreateStore` is provided by the create dialog. It reads the destinations, the people and the
  labels the first time the dialog opens; the statuses, the next key and the templates follow the
  chosen list's space, and the next key is read again after each creation. Failed reads expose
  `Retry`, never a successful empty result. A creation sent again with the same body
  reuses its `Idempotency-Key`, including across dialog openings in the same organization; a changed
  body or organization gets a new one. A subtask (`parentKey`) goes to
  `createSubtask`, which takes no drafted subtasks or checklist. The parent key requires its list id.
- The create dialog starts each opening afresh: the current user assigned, `To do` and
  `Medium`, unless the presets give a status, a priority or assignees (none for `Unassigned`). `Create more tasks` keeps it open and empties the name, the description,
  and the subtasks while retaining the template's checklist. Its toast `Open` opens the task's detail over the current page (`TaskDetailOpener`, `?task=<KEY>`).
  A refused creation's issues (422) stay on their fields until each field changes, and all go when
  another destination list is picked or the dialog opens again. An issue on a field edited, or a
  destination changed, while the creation ran is not shown; when none is left, the toast says the
  creation was refused.
- The task detail (`App.dc.html` lines 2027-2673):
  - Opening: `TaskDetailOpener.open` merges `?task=<KEY>`; `TaskDetailHost` renders
    `TaskDetailDialog` while the parameter holds a task key (the contracts' `TaskKey` pattern;
    another value opens nothing) and another key shows that task in the same
    dialog. Closing (backdrop, `Close`, Escape from the brick, an archive or a deletion) removes
    the parameter and keeps the others; Back closes it with the address. The focus trap and the
    focus return come from `cw-dialog`. `N` creates nothing while a detail is open
    (`App.dc.html` line 4382); Ctrl K and `?` still open over it, as in the mockup.
  - Layout: header, then the left column (`cw-task-detail-tabs`) and the aside `Properties of the
task` (`cw-task-properties-panel`, `md:w-96`, its own scroll); under 768 px the dialog is full
    screen and the aside goes below the content. While the detail is read the header shows the
    opening screen's preview (or the key) and the body the skeleton (`Loading the task`).
  - Errors inside the body: an unavailable read with a preview shows the mockup's `Could not load
the task` with `Retry`; otherwise Errors' `RouteErrorPanel` renders the typed route error of
    `toTaskRouteError` (not found, deleted task with `Restore the task` then a new read,
    unavailable with `Retry`). A partial detail (`partial: ['comments']`) shows the rest and
    `commentsFailed` with `reloadComments()` for the comments' inline error; a detail without
    its Git links (`partial: ['development']`) shows the Development panel's inline error with
    `Retry`.
  - `TaskDetailStore` is provided by the dialog, so its state dies with it. It keeps the confirmed
    task and its version; `update(patch)` shows the values at once (`pendingFields`,
    `isPending(field)`), sends the writes one after the other, each with `If-Match` set to the
    newest confirmed version, confirms the returned task, and on a refusal drops the local values
    (the confirmed ones come back) with the failure toast; a `412` reads the detail again and warns
    (`CAD-482 changed elsewhere`). A read never replaces a newer confirmed task, and pending values
    stay over what it reads. A parent or list change reads the detail again (parent, list).
  - One write path per task: `write(key, send, fallback?)` queues every write of a task (field
    patches, statuses, assignees, labels, followers, approvers, votes, dependencies, checklist)
    behind the earlier ones and calls `send(version)` with that task's newest confirmed version
    (`fallback` for a task the detail never confirmed, or for a write without `If-Match`, such as
    the checklist's `0`). `send` adopts its answer inside the callback, `accept(task)` for a
    returned task or `acceptVersion(version, changes, key)` for an `ETag` or `taskVersion` only, so
    the next write goes against it. `acceptVersion` adopts a version only at confirmed + 1; any
    other newer version reads the task again. A `412` (`TaskVersionConflict`) reads the task again
    and the next write of that task waits for that read; the error goes back to the caller. A write
    queued when another task opens is still sent with its own key and version, and a write
    confirmed once its task's detail closed or gave way to another calls
    `TaskDetailOpener.notifyChanged(key)`, so the view under it reads its rows again.
  - `TASK_WRITE_LANE` (`ports/task-write-lane`): the optional write path the status
    changes use instead of writing on their own; the dialog provides it with its
    `TaskDetailStore` (`useExisting`), so a status write never overlaps another write of the task.
  - Realtime: while a task is open the store watches its `task:` room; `task.updated.v1` and
    `task.status-changed.v1` read the detail again, `comment.created.v1` the first comment page
    (`commentsRevision`), `git.links-changed.v1` counts `gitRevision`, on which the Development
    panel reads its links again; each part at most once
    per 300 ms (`NOTICE_WINDOW_MS`). A reconnection of the socket (`reconnected`) makes the three
    parts stale, since missed notices are not replayed. A notice that comes before the first read
    settles is kept: a Git one counts at once (`developmentRevision`, the `gitRevision` at which
    the read now shown began, tells the panel whether its links predate it), a task or comment
    one is applied once the detail is shown. Notices name a task id, not its key, and the socket hands
    every watched room's notices to every watch, so a notice about another task (of an open list)
    also reads again.
  - Header: key, `Subtask of <key> · <name>` (opens the parent), the read-only status badge with
    the space's label, `Cancelled: <reason> · <note>`, the title (saved on change or blur when
    changed and not blank), follow (count, `aria-pressed`, toasts), the reminder (presets from
    the opening instant: in 1 hour (an hour from now, to the minute), this afternoon before 15 h, tomorrow 9 h, the Monday of next
    week 9 h, the day before the due date 9 h; custom day among 14 and hour among six, a past
    hour refused; the note saved on change while a reminder exists, one note write after the
    other, the last typed winning and a refusal rolling back only the latest to the last
    confirmed note; `Delete the reminder`; every time in one format, `reminderTimeLabel`:
    `11:00` or `14:19`, `11 h` or `14 h 19` in French, as the mockup's `Aujourd’hui, 11 h`),
    `Copy the link` (`<origin>/<slug>/t/<KEY>`), `More actions` (`Copy the identifier`,
    `Duplicate` with `Open`, `Move to…`, `Archive` with `Undo`, `Save as a template`,
    `Convert to a subtask of…` or `Move to another task…`, `Detach from <key>`, `Delete`
    confirmed, then `Undo` restores the trash entry) and `Close`. Duplicate, archive and delete
    go through `write`, against the version the task's earlier writes confirmed; a confirmed
    `Undo` of an archive or a deletion calls `TaskDetailOpener.notifyChanged`. Writing actions need the list's
    `edit` role (`callerRole`, absent reads as `edit`); commenting needs `edit` or `comment`
    (`canComment`; an unknown role reads as `view`).
  - Pickers: `Move to…` lists Spaces' `LIST_DIRECTORY` (the sidebar's lists) filtered by name; the
    parent picker reads one page of the task's list (`listTasks`, `level: all`) and, once text is
    typed, the search hits of other lists, without the task, its subtree, its parent, a task with
    25 subtasks or one too deep for the three levels (what the read shows; the gateway refuses the
    rest and the toast says which limit), the list first, 12 at most; attach and detach toasts
    offer `Undo`.
  - Tabs (`cw-task-detail-tabs`, `App.dc.html` lines 2111-2366): the tab list `Task sections`
    (`Details`, `Subtasks` and `Comments` with their counts, `Activity`), `Details` at each
    opening since the dialog renders the column anew per task, unless the opening asked for a tab
    (`TaskDetailOpener.open(key, preview, { tab })`; `Subtasks` focuses the new-subtask field);
    the composer is pinned under `Comments`. The container provides `TaskDetailSectionsStore`
    (description, checklist, subtask creation, member directory), `TaskApprovalCardStore`,
    `TaskAttachmentsStore`,
    `TaskCommentsStore` and `TaskActivityStore`, so they die with the open task, and the bricks'
    English texts (`TASK_SECTIONS_BRICK_LABELS`); the sections are presentational. `Details`:
    the approval card while a round has reviewers (title, counts, segment bar, reviewer states;
    `Approve`, `Request changes` with `What needs to change`, `Withdraw my review`; a vote that
    moved the status reads the detail again, otherwise the detail takes the answer's version;
    the round is read again when the confirmed version moves past it), the description
    (`cw-block-editor` with its toolbar and the `@` menu of the participants, the composer's;
    saved 800 ms after the last change and on blur through `update` with `description` and
    `descriptionMentions`, the spans of its `@[Name](id)` tokens, under `If-Match`; an empty
    text clears it; a confirmed text never replaces what is being typed; a draft still waiting
    when another task opens is saved to its own task through `write`, against that task's
    recorded version, never to the task now shown; a draft is compared with the text still being
    saved, so one reverted during a save is sent after it; each draft sent waits in the device
    storage (`cadenway-task-description-draft.<organizationId>.<userId>.<taskKey>`, so another
    account on the device never reads it) until its write is confirmed: a failed or conflicting
    save keeps it and its toast says so, and the task's next opening, or the failure itself while
    it is open, shows it in the editor with `Unsaved changes restored from this device.` and
    `Discard`. It is saved after the pause only when the description is still the one it was
    typed over; when the description changed since, the notice says so (`The task changed since;
your unsaved changes are restored from this device.`) and offers `Keep my version`, which
    saves it against the current version, and nothing is saved by itself, editing included,
    until `Keep my version` or `Discard`), the
    checklist
    (`<done> / <n>`, ticks shown at once and rolled back with the failure toast, `Add an item` with Enter and Escape; no deletion, as in the mockup), the
    attachments (`cw-attachment` tiles, `Add` and the drop zone, 25 MB refused with `File too
large` and an empty file with `Empty file`, a name already attached skipped, files being sent
    shown with a spinner (the fetch backend reports no upload progress), `Remove “<name>”?` confirmed then toasted, the
    preview dialog with previous and next, arrow keys and `Download`, raster images drawn from
    their signed address) and the Development panel (`cw-task-development`, `App.dc.html` lines
    2192-2268, with `TaskGitLinksStore`, provided by the tabs: it shows the first page of links
    the detail carries without reading it again, reads it itself when the detail names
    `development` in `partial` (inline error until `Retry` succeeds), `Show more` for older pages,
    and reads the list again to the depth shown on each `gitRevision`; a reread that fails keeps
    the rows under the inline error, and an answer for another task or older than a newer read is
    dropped. A row has the state icon (branch, draft, open, merged, closed), the request's title
    or the branch name linking to the provider in a new tab (`rel="noopener noreferrer"`) with
    `#214` or `!31` (not repeated when it stands in for a missing title), the state chip, the
    checks (passed with `<passed>/<total>`, failed with `<failed>/<total> failed` only when some
    failed, since suites may still run then, running), when they completed in the tooltip and
    the screen reader text, the review
    request unless merged, the repository with the host's logo, the diff size (GitHub only),
    the author's first name or login and when the link was recorded (`relativeInstant`), and where
    the key was detected; links of an unknown host or kind are left out, and an address that is
    not `https:` or `http:` (self-managed GitLab) without credentials is not a link. The heading
    counts the links listed (`50+` while more remain); `Show more` is refused while the list is
    read again, a reread ends any `Show more` in flight and the pages of a superseded reread are
    not read; the empty state shows only on the last page with no link (a page can hold only
    links of an unknown host), the inline error stays while `Retry` reads, and the key hint stays
    with its `Copy the identifier`). `Subtasks`: progress, rows that open the subtask
    through `TaskDetailOpener` (click, Enter, Space) with a status button that advances through
    `TaskStatusChangesStore`, the add field (`createSubtask`, toast, detail read again; the name
    stays in the field until the creation is saved, and a creation sent again reuses its
    `Idempotency-Key`) and the 3-level and 25-subtask messages instead of it (the depth read again
    when the task changes parent). `Comments`: the detail's first page, later
    pages with `Show more comments` (read again to the same depth on `commentsRevision`),
    `cw-markdown` bodies, the caller's own in the secondary bubble, the menu (right click, Shift
    F10 or the `More actions` button: `Copy the text`, `Reply` prefilling `@<first name> ` and
    answering that comment, `Delete` for the caller's own, shown at once, rolled back on refusal,
    `Undo` posting it again to the task it was deleted from, whichever task is open by then); the
    composer (`cw-comment-composer`: marks, link, list, code, `@`
    mentions of the participants sent as spans, files uploaded to the task's attachments and
    named on a last line `Attachments: …`, `<n> / 5,000`, Ctrl or Cmd Enter, the brick's error
    with `Retry` keeping the text and its `Idempotency-Key` for the same body and reply target). The
    tab's count corrects the first page's total only until the detail reads that page again. Posting and deleting a comment read
    the detail again (they change the task's version). `Activity`: read each time the tab opens
    (not again when the shown tab is selected once more),
    again while shown when the version moves; actor (member, automation, `GitHub` or `GitLab`, a
    service by name), what changed and when, `Show more`. Every list has its loading, inline
    error with `Retry` and empty state. Writing needs `edit`; commenting needs `comment` or
    `edit` (`TaskDetailStore.canComment`, from the list's `callerRole`). The participants are
    read once, when `Comments` opens or a `@` menu first searches, and not for a caller who may
    not comment.
  - Extension points: `TaskDetailStoreInstance` (`task`, `confirmedTask`, `space`, `statuses`,
    `list`, `canEdit`, `canComment`, `parent`, `subtasks`, `comments`, `commentsFailed`,
    `development`, `partial`, `pendingFields`, `commentsRevision`, `gitRevision`; `update`, `write`, `accept(task)`,
    `acceptVersion(version, changes?, key?)`, `reload`, `reloadComments`), which `cw-task-properties-panel` and
    `cw-task-detail-tabs`, containers of the dialog, inject (`development` is the first page of
    Git links the last read carried); each provides its own stores. The
    dialog also provides `TaskStatusChangesStore` for the panel's status and the subtasks' status
    buttons; a completed status write reads the detail again.
  - Properties panel (`cw-task-properties-panel`, `App.dc.html` lines 2368-2610): `Status`
    (`cw-task-status-picker` through the dialog's `TaskStatusChangesStore`: the split button
    advances with the change toast and `Undo`, the menu groups by category with hints and applies
    a pick without a toast (`quiet`, `App.dc.html` line 8717), fast clicks settle once, the icon
    morphs from the previous status; `Cancelled` opens `cw-task-cancel-dialog`, rendered by the
    panel), `Assignees` (five initials and `+N`, checkbox menu, `(me)`), `Due date` (`Today`,
    `Tomorrow`, `Yesterday` or the short date, late warning; dialog with `Today`, `Tomorrow`,
    `Friday`, `End of the sprint` for a sprint list, `No due date` and the calendar), `Priority`,
    `Estimate` (not for a milestone: steppers, suggestions, `parseDuration` with a bare number in
    hours, `Remove`, an unreadable text toasts), `Time spent` (against the estimate; add time
    with shortcuts, a duration in minutes and a note; entries newest first, the caller's own
    deletable after a confirmation, `Undo` records them again; the timer), `Labels`, `List`
    (`moveTo`, `Moved` toast), `Repeat` (`Next: {date}` or `Add a due date to repeat`),
    `Followers`, `Milestone` (switch and hint, toast; the gateway maps the status), `Approval`
    (not for a milestone), `Dependencies` (chips that open the other task, remove with `Undo`,
    the date warning, the add dialog with `Direction`, a debounced search and ten candidates),
    then `Time in status` (not for a milestone) and the subtask progress. Task fields go through
    `TaskDetailStore.update` or `moveTo`; `TaskPropertiesStore` (provided by the panel) holds the
    people, labels, watchers, approval, dependencies, time per status and sprint end, writes the
    collections at once one after the other and confirms them with `accept` or `acceptVersion`,
    restoring them with a toast on a refusal; `TaskTimeStore` (provided by the panel) holds the
    entries and the timer. Both follow the open task's key; the time per status is read again
    after a confirmed status or milestone change, the watchers after a confirmed assignee change,
    the approval once the confirmed version moves past the one it was read at (as the tabs'
    approval card, so a vote cast there shows in the row), unless its own approvers write runs.
    Without the list's `edit` role every row is read-only (no timer, no dependency buttons).
- Known gaps: the comment count of a row is null (task summaries carry none); the Git chip is left
  out (B4, no API yet); the dialog's file drop is not built (attachments need the task first); the
  mockup's built-in templates (`Bug`, `Feature`, `Release`) appear only when the space
  returns them from `listTaskTemplates`, and the template menu has no icon or tone (the DTO carries
  none); avatars draw initials (members give an avatar id, no address). The people and label
  triggers show the combobox's own content (the chosen option, `(me)` included, or `n
people`), and the due trigger shows the short date without `Tomorrow ·` or the
  `Today` tone, until `cw-combobox` and `cw-date-picker` take a trigger template; the dialog
  is `size="xl"` (the mockup's `max-w-4xl`) but centred, not at `top-[8vh]`, and its header keeps
  the brick's padding instead of the mockup's `px-5 py-3` bar. Its footer wraps on a phone: the
  `Create more tasks` switch, then the buttons.
- Detail gaps: `cw-dialog` has no size for the mockup's panel (`top-[6vh] h-[88vh] max-w-5xl`):
  the detail uses `size="full"` (the viewport less 2 rem) with `scrollable`; the header cancels
  part of the brick's `px-6 py-4` (`-mx-2 -my-1`, the mockup's `px-4 py-3`, aligned with the
  tabs) and the body all of its padding; a `sheet`-like size is a design-system need. The reminder button does not mark which preset the pending reminder came from unless its
  instant matches one; the
  afternoon preset is left out after 15 h (the mockup always shows it). The parent picker cannot
  check the depth and size of a search hit from another list. The header's follow button shows
  the watcher count only; the people are in the panel's `Followers` row. Realtime presence (who
  is viewing) has no contract yet.
- Properties gaps: the API keeps no running timer, so its start lives in the device storage per
  organization, user and task (`cadenway-task-timer.<organizationId>.<userId>.<taskKey>`, so
  another account on the device never sees it) and is lost with it;
  stopping records the elapsed minutes (1 to 1,440) for today and clears the timer only once the
  entry is confirmed: a refused stop keeps it, and stopping again sends the first stop's entry
  under the same `Idempotency-Key`, as any entry sent again after a failure. The stop's key is a
  UUID-shaped SHA-256 of the organization, the user, the task and the start (`stableKey`), so
  another tab stopping the same timer sends the same key and the entry the first stop froze, and
  the gateway records it once. That stop waits in
  the device storage next to the start (`<timer key>.stop`) until confirmed, so a stop whose
  answer was lost is not recorded twice after a reopen or a reload. A read of the entries that
  began before a confirmed write is dropped and made again, and the total is summed from the
  entries, so an entry a read already carries is not counted again when its write answers; a
  read applied while a deletion is pending leaves that entry out. A deleted time
  entry's `Undo` records a new entry (the API has no restore); both `Undo`s run against their task
  after navigating away. Changing approvers starts a new round
  (`requestTaskApproval`), which clears every vote, not only the removed reviewer's; a round keeps
  one reviewer, so the last one cannot be removed and a round cannot be withdrawn. Another
  person than the caller can be followed or unfollowed only with `edit` (the panel is read-only
  without it, the header's follow stays). The estimate field opens from a trigger in a
  `cw-popover` rather than being the mockup's inline combobox (`cw-combobox` has no free duration with steppers: a design-system need). Durations
  use `formatDuration` (`1 h 30`) in both languages. Dependencies and the time per status (but
  after a status or milestone change) are not read again on another person's change (realtime
  notices read the detail only); the approval is, once that read moves the version.
  `Since creation` shows only when the history is complete. The subtask count reads
  `{d} / {n} done` without the singular. Members outside the people list (guests, former
  members) read `Unknown member`.

- Tabs gaps: the description's `@` menu offers the task's participants (`listTaskParticipants`),
  like the composer, not every member who could read the list. The comment composer sends only
  with text (the mockup also sends files alone), its toolbar is the brick's (bold, italic, link, bulleted list, code, mention, attach), and its files are uploaded
  to the task as soon as they are chosen (the brick's contract), staying attached when taken off
  the comment. A deleted comment's `Undo` posts it again as a new comment at the end (the API has
  no restore). `cw-attachment` draws no uploader nor time on its tile (the preview does) and
  no thumbnail without a signed address per tile; `cw-checklist` has no tick-and-add-only mode,
  so the checklist composes `cw-checkbox`, `cw-progress` and `cw-input`; the attachment preview
  is a full-size `cw-dialog`, not the mockup's dark viewer. The approval card and the properties
  panel each read the approval (`getTaskApproval` into their own models, one request shared
  through `TaskApprovalRead` while both ask); both read it again once the confirmed version moves
  past the one they read, so they agree after any write.
- Development gaps: `Link a PR` and `Create a branch` are left out, not shown disabled, as other
  actions without an API are (the Git chip, `Share`): linking, unlinking and branch creation need
  the outbound provider client of gap B5. The row menu (`Copy the link`, `Copy the branch name`,
  `Open a pull request`, `Mark ready for review`, `Unlink`) goes with them. The contract carries no
  commits, so a row has no commit list; it says only whether reviewers are requested, not the
  mockup's `1 approval of 2`; and links are only detected today, so no row reads `linked by …`. A
  pull request whose title is not recorded yet shows its source branch, else its number. The
  empty state's text still offers to create the branch or link a PR, as in the mockup.

## Copy not taken word for word from the mockup

| Unit                                                                                        | Reason                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `task.combobox.*`                                                                           | Texts of the combobox brick, taken from its built-in defaults.     |
| `task.create.due-*` but `due-today`, `due-tomorrow`, `due-friday`, `due-sprint`, `due-none` | Texts of the date picker brick, taken from its built-in defaults.  |
| `task.people-picker.search`, `task.label-picker.search`                                     | The mockup's menus have no search field.                           |
| `task.priority-picker.label`, `task.status-picker.menu`, `task.create.destination`          | Accessible names the mockup does not write out.                    |
| `task.create.name-required`                                                                 | The mockup disables `Create the task` without showing an error.    |
| `task.create.lists-failed`, `task.retry`, `task.create.no-list`                             | The mockup draws no failed or empty read of the lists.             |
| `task.create.failed`, `task.create.failed-text`                                             | The mockup draws no refused creation.                              |
| `task.status-change.failed*`, `task.status-change.conflict*`                                | The mockup draws no refused or conflicting status change.          |
| `task.status-change.cancel-failed-*`                                                        | The mockup draws no refused cancellation.                          |
| `task.title-cell.subtasks`, `task.title-cell.checklist`, `task.title-cell.comments`         | Screen reader texts and tooltips the mockup does not write out.    |
| `task.cancel-dialog.close`, `task.create.close`                                             | Close button of the dialog brick.                                  |
| `task.detail.failed*`, `task.detail.*-failed`, `task.detail.conflict*`                      | The mockup draws no refused or conflicting write.                  |
| `task.detail.parent.failed`, `task.detail.parent.loading`, `task.detail.list.*`             | The mockup's pickers are popovers without a failed read or search. |
| `task.detail.trashed-with-one`, `task.detail.reminder.hour*`, `task.detail.reminder.*-at`   | Singular form and time formats the mockup writes inline.           |
| `task.detail.watch-one`, `task.detail.unwatch-one`                                          | The singular of the follower count, plural in the mockup.          |
| `task.detail.confirm-*`, `task.detail.dialog-close`, `task.detail.copy-failed`              | Texts of the bricks and of a refused clipboard.                    |
| `task.detail.reminder.note-placeholder`                                                     | The English source names no person; the French keeps the mockup's. |
| `task.editor.*`, `task.composer.*` but their mockup words, `task.comments.mention`          | Texts of the block editor and composer bricks, their defaults.     |
| `task.attachments.kind-*`, `*-of`, `processing*`, `uploading`, `failed`, `sending`          | Texts of the attachment brick, its defaults.                       |
| `task.attachments.working`, `done`, `remove`, `max`, `reject`, `limit`, `file*`             | Texts of the attachment and drop zone bricks, their defaults.      |
| `task.sections.avatar-*`, `task.sections.time.*`, `task.sections.size.*`                    | Avatar brick texts, time and size formats the mockup inlines.      |
| `task.*.read-failed`, `task.*.loading`, `task.*.more-failed`, `task.activity.empty`         | The mockup draws no failed, loading or empty read of these parts.  |
| `task.comments.load-more`, `task.activity.show-more`                                        | The mockup's lists are not paged.                                  |
| `task.approval.failed`, `task.attachments.upload-failed`, `task.attachments.remove-failed`  | The mockup draws no refused write.                                 |
| `task.comments.*-failed`, `task.subtasks.create-failed`                                     | The mockup draws no refused write.                                 |
| `task.properties.*-failed`, `task.properties.failed-text`                                   | The mockup draws no refused write.                                 |
| `task.properties.conflict-text`                                                             | The mockup draws no conflicting write.                             |
| `task.properties.approvers-invalid`, `task.properties.dependency-cycle`                     | Refusals the mockup does not draw.                                 |
| `task.properties.people-loading`, `task.properties.labels-none`                             | Loading and empty menus the mockup does not draw.                  |
| `task.properties.unknown-member`                                                            | A former member the mockup does not draw.                          |
| `task.properties.due-yesterday`, `task.properties.due-*-month`                              | Taken from the spec and the calendar brick.                        |
| `task.properties.time-entries`                                                              | The mockup writes `Saisies · 3 saisies`; the count is kept once.   |
| `task.activity.automation`                                                                  | The mockup names no automation actor.                              |
| `task.description.restored*`, `discard`, `keep`, `kept-*`                                   | The mockup draws no failed description save nor a kept draft.      |
| `task.attachments.empty`, `task.attachments.empty-text`                                     | The mockup draws no refused empty file.                            |
| `task.development.read-failed`, `loading`, `more-failed`, `show-more`, `list`               | The mockup draws no failed, loading or paged read of the links.    |
| `task.development.checks-failed-some`, `task.development.checks-failed`                     | The mockup writes one failed check; counts from the contract.      |
| `task.development.checks-failed-short`                                                      | The mockup's `11/12` counts suites still running as passed.        |
| `task.development.detected-description`                                                     | The mockup detects no key in a request's description.              |
| `task.row-actions.failed`, `task.row-actions.delete-failed`                                 | The mockup draws no refused write.                                 |
| `task.row-actions.undo-failed`, `remind-failed`, `restore-failed`                           | The mockup draws no refused undo, reminder or restore.             |
| `task.row-actions.conflict`, `task.row-actions.conflict-text`                               | The mockup draws no conflicting write.                             |
| `task.row-actions.unconfirmed`, `task.row-actions.unconfirmed-text`                         | The mockup draws no unanswered write.                              |
| `task.row-actions.unknown`, `task.row-actions.copy-failed`                                  | The mockup draws no uncertain write nor refused copy.              |
| `task.menu.people-loading`, `task.menu.people-failed`                                       | The mockup's `Assign` draws no loading nor failed read of members. |
