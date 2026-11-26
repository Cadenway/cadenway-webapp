# Task

## Purpose

The task building blocks other features compose (step 4a of the mockup integration), the task
create dialog and the task detail (step 5). It owns the task display models and their adapters,
the status change interaction of `cw-status-interactions`, the cancel reason dialog, the status,
priority, people and label pickers, the due date, the label chips and the name cell of a row, the
create dialog with its `N` shortcut, and the task detail: a dialog over the current page driven by
`?task=<KEY>`, its store, header, layout, list and parent pickers. Lists, boards and their grouping
belong to Spaces, which composes these blocks; the typed route error states belong to Errors. The
detail's properties panel and tabs are placeholders filled by the next step-5 changes.

## Routes

`TASK_ROUTES` (`task.routes.ts`), mounted by Workspace below `/:org`:

- `t/:taskKey`, the shareable deep link of a task (the create toast's `Open`, `Copy the link`):
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

| Entry point   | Consumers             |
| ------------- | --------------------- |
| `.`           | spaces, search, inbox |
| `providers`   | workspace             |
| `task.routes` | workspace             |

`providers` publishes, bound on `/:org`:

- `withTaskCreate()` (`overlays`, order 20);
- `withTaskDetail()` (`overlays`, order 30): `TaskDetailHost`, which renders the detail dialog of
  `?task=<KEY>` (loaded in its own chunk) on every workspace page and removes the parameter, keeping
  the others, once the dialog closes.

`.` publishes:

- Models: `TaskSummary` (`id` is the key, `version` is the `If-Match` precondition), `TaskProgress`,
  `StatusOption`, `Person`, `TaskStatusChange`, `TaskCancellation`, `TaskCancelRequest`,
  `TaskCreateOptions` (list, status, due date, parent, priority and assignees), `CreatedTask`,
  `TaskBulkAction`, `TaskBulkSelection`, `TaskBulkEntry`, `TaskBulkOutcome`; the words
  `STATUS_LABELS`, `STATUS_HINTS`, `MILESTONE_STATUS_HINTS`, `STATUS_CATEGORY_LABELS`,
  `CANCEL_REASON_LABELS` and `PRIORITY_LABELS`; the rules `nextStatus`, `isClosedStatus`,
  `isMilestoneStatus`, `statusLabel`, `pickableStatuses` and `defaultStatusOptions`; `initialsOf` and `personOf(userId, name)` for members another feature read.
- `TaskStatusChangesStore`, a SignalStore the consumer provides on its route: `request(task, status,
options?)`, `requestCancel(tasks, options?)`, `pendingStatus(taskId)`, `displayedStatus(task)`,
  `settledStatus(task)`, `settledTask(task)`, `undo(taskId)`, `cancelRequest` with
  `confirmCancel(cancellation)` and `keepTask()`, the `changed` stream, and the `completed` stream
  after each write succeeds or fails; `STATUS_SETTLE_MS` (460).
- `TaskActionsApi` (root): `bulk(selection, action, current)` (chunks of 50, idempotent, one retry
  after an uncertain answer that only a success settles, any refusal of the retry leaving the chunk
  unknown; per-task versions, copies and trash entries), `remind(taskKey, at)` and
  `restore(entryId)`, for the stores of the screens that act on several tasks.
- `TaskCreate` (root): `open(options?)`, `useDefaults(defaults, destroyRef)`, `close()`, `isOpen`,
  `options`, `created`.
- `TaskDetailOpener` (root): `open(taskKey, preview?)` merges `?task=<KEY>` into the current
  address (the list view, the command palette, the inbox, a toast's `Open`), `close()` removes it,
  `taskKey`, `isOpen` and `preview`; `TaskDetailPreview` (key, name, status, milestone), what the
  opening screen shows of the task while the detail is read.
- Presentational components, inputs and outputs only: `cw-task-status-picker`,
  `cw-task-priority-picker`, `cw-task-people-picker`, `cw-task-label-picker`, `cw-task-due-date`,
  `cw-task-label-chips`, `cw-task-title-cell` and `cw-task-cancel-dialog`.

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
  `ListsService.listLists`; `MembersService.listMembers` (owners, admins and members). Every
  collection is read to its last cursor page.
- `@cadenway/contracts` enums: `STATUS_KEYS`, `STATUS_CATEGORIES`, `STATUS_CATEGORY_BY_KEY`,
  `MILESTONE_STATUS_KEYS`, `PRIORITY_KEYS`, `CANCEL_REASONS`, `RECURRENCES`.
- `@core/api` (`hasProblemCode`, `readProblem`, `OrganizationPin`), `@shared/route-errors`, `@core/shortcuts` (`N`, Ctrl Enter), `@shared/layout-slot`
  (`ShellOverlay`, slot contribution), Workspace's `ports/workspace-context`.
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
  status at once, only while the task still has the status that change gave it. Undoing a change
  away from `Cancelled` sends its reason again without its note, which task summaries do not carry.
  A pending write flushed after destruction is dropped if its queued organization is no longer
  the committed organization.
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
  and the subtasks while retaining the template's checklist. Its toast `Open` leads to `/<slug>/t/<key>`.
  A refused creation's issues (422) stay on their fields until each field changes, and all go when
  another destination list is picked or the dialog opens again. An issue on a field edited, or a
  destination changed, while the creation ran is not shown; when none is left, the toast says the
  creation was refused.
- The task detail (`App.dc.html` lines 2027-2673):
  - Opening: `TaskDetailOpener.open` merges `?task=<KEY>`; `TaskDetailHost` renders
    `TaskDetailDialog` while the parameter is there and another key shows that task in the same
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
    `commentsFailed` with `reloadComments()` for the comments' inline error.
  - `TaskDetailStore` is provided by the dialog, so its state dies with it. It keeps the confirmed
    task and its version; `update(patch)` shows the values at once (`pendingFields`,
    `isPending(field)`), sends the writes one after the other, each with `If-Match` set to the
    newest confirmed version, confirms the returned task, and on a refusal drops the local values
    (the confirmed ones come back) with the failure toast; a `412` reads the detail again and warns
    (`CAD-482 changed elsewhere`). A read never replaces a newer confirmed task, and pending values
    stay over what it reads. A parent or list change reads the detail again (parent, list).
  - Realtime: while a task is open the store watches its `task:` room; `task.updated.v1` and
    `task.status-changed.v1` read the detail again, `comment.created.v1` the first comment page
    (`commentsRevision`), `git.links-changed.v1` counts `gitRevision`; each part at most once
    per 300 ms (`NOTICE_WINDOW_MS`). Notices name a task id, not its key, and the socket hands
    every watched room's notices to every watch, so a notice about another task (of an open list)
    also reads again.
  - Header: key, `Subtask of <key> · <name>` (opens the parent), the read-only status badge with
    the space's label, `Cancelled: <reason> · <note>`, the title (saved on change or blur when
    changed and not blank), follow (count, `aria-pressed`, toasts), the reminder (presets from
    the opening instant: in 1 hour, this afternoon before 15 h, tomorrow 9 h, the Monday of next
    week 9 h, the day before the due date 9 h; custom day among 14 and hour among six, a past
    hour refused; the note saved on change while a reminder exists; `Delete the reminder`),
    `Copy the link` (`<origin>/<slug>/t/<KEY>`), `More actions` (`Copy the identifier`,
    `Duplicate` with `Open`, `Move to…`, `Archive` with `Undo`, `Save as a template`,
    `Convert to a subtask of…` or `Move to another task…`, `Detach from <key>`, `Delete`
    confirmed, then `Undo` restores the trash entry) and `Close`. Writing actions need the list's
    `edit` role (`callerRole`, absent reads as `edit`).
  - Pickers: `Move to…` lists Spaces' `LIST_DIRECTORY` (the sidebar's lists) filtered by name; the
    parent picker reads one page of the task's list (`listTasks`, `level: all`) and, once text is
    typed, the search hits of other lists, without the task, its subtree, its parent, a task with
    25 subtasks or one too deep for the three levels (what the read shows; the gateway refuses the
    rest and the toast says which limit), the list first, 12 at most; attach and detach toasts
    offer `Undo`.
  - Extension points: `TaskDetailStoreInstance` (`task`, `confirmedTask`, `space`, `statuses`,
    `list`, `canEdit`, `parent`, `subtasks`, `comments`, `commentsFailed`, `partial`,
    `pendingFields`, `commentsRevision`, `gitRevision`; `update`, `accept(task)`,
    `acceptVersion(version)`, `reload`, `reloadComments`), and the placeholders
    `cw-task-properties-panel` and `cw-task-detail-tabs`, containers of the dialog that inject the
    store. The dialog also provides `TaskStatusChangesStore` for the panel's status; a completed
    status write reads the detail again.
- Known gaps: the comment count of a row is null (task summaries carry none); the Git chip is left
  out (B4, no API yet); the dialog's file drop is not built (attachments need the task first); the
  mockup's built-in templates (`Bug`, `Feature`, `Release`) appear only when the space
  returns them from `listTaskTemplates`, and the template menu has no icon or tone (the DTO carries
  none); avatars draw initials (members give an avatar id, no address). The people and label
  triggers show the combobox's own content (the chosen option, `(me)` included, or `n
people`), and the due trigger shows the short date without `Tomorrow ·` or the
  `Today` tone, until `cw-combobox` and `cw-date-picker` take a trigger template; the dialog
  is `size="lg"`, not the mockup's `max-w-4xl`.
- Detail gaps: `cw-dialog` has no size for the mockup's panel (`top-[6vh] h-[88vh] max-w-5xl`):
  the detail uses `size="full"` (the viewport less 2 rem) with `scrollable`, so the header has the
  brick's `px-6 py-4` and the body cancels its padding; a `sheet`-like size is a design-system
  need. The properties panel and the tabs are placeholders (step 5 continues). The reminder button
  does not mark which preset the pending reminder came from unless its instant matches one; the
  afternoon preset is left out after 15 h (the mockup always shows it). The parent picker cannot
  check the depth and size of a search hit from another list. Watchers show the count only (the
  list of people and the `Followers` row belong to the panel). Realtime presence (who is viewing)
  has no contract yet.

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
| `task.detail.trashed-with-one`, `task.detail.reminder.hour`, `task.detail.reminder.*-at`    | Singular form and time formats the mockup writes inline.           |
| `task.detail.confirm-*`, `task.detail.dialog-close`, `task.detail.copy-failed`              | Texts of the bricks and of a refused clipboard.                    |
| `task.detail.reminder.note-placeholder`                                                     | The English source names no person; the French keeps the mockup's. |
