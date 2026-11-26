# Task

## Purpose

The task building blocks other features compose (step 4a of the mockup integration), the task
create dialog and the task detail (step 5). It owns the task display models and their adapters,
the status change interaction of `cw-status-interactions`, the cancel reason dialog, the status,
priority, people and label pickers, the due date, the label chips and the name cell of a row, the
create dialog with its `N` shortcut, and the task detail: a dialog over the current page driven by
`?task=<KEY>`, its store, header, layout, properties panel (`cw-task-properties-panel`), tabs
(`cw-task-detail-tabs`: details, subtasks, comments, activity) and their stores, list and parent
pickers. Lists, boards and their grouping belong to Spaces, which composes these blocks and opens
the detail through `TaskDetailOpener`; the typed route error states belong to Errors.

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
- `TaskStatusChangesStore`, a SignalStore the consumer provides on its route, typed
  `TaskStatusChangesInstance`: `request(task, status, options?, behavior?)` (`behavior` is
  `TaskStatusRequestOptions`, whose `quiet` confirms without the change toast),
  `requestCancel(tasks, options?)`, `pendingStatus(taskId)`, `displayedStatus(task)`,
  `settledStatus(task)`, `settledTask(task)`, `undo(taskId)`, `cancelRequest` with
  `confirmCancel(cancellation)` and `keepTask()`, the `changed` stream, and the `completed` stream
  after each write succeeds or fails; `STATUS_SETTLE_MS` (460).
- `TaskActionsApi` (root): `bulk(selection, action, current)` (chunks of 50, idempotent, one retry
  after an uncertain answer that only a success settles, any refusal of the retry leaving the chunk
  unknown; per-task versions, copies and trash entries), `remind(taskKey, at)` and
  `restore(entryId)`, for the stores of the screens that act on several tasks.
- `TaskCreate` (root): `open(options?)`, `useDefaults(defaults, destroyRef)`, `close()`, `isOpen`,
  `options`, `created`.
- `TaskDetailOpener` (root): `open(taskKey, preview?, options?)` merges `?task=<KEY>` into the
  current address (the list view, the command palette, the inbox, a toast's `Open`), `close()`
  removes it, `taskKey`, `isOpen` and `preview`; `TaskDetailPreview` (key, name, status,
  milestone), what the opening screen shows of the task while the detail is read;
  `TaskDetailOpenOptions` (`tab`, a `TaskDetailTab`: `details`, `subtasks`, `comments` or
  `activity`) opens the column on that tab, kept out of the address, which the tabs take once
  (`takeTab(taskKey)`); `subtasks` also focuses the new-subtask field (a row's `Add a subtask`).
- Presentational components, inputs and outputs only: `cw-task-status-picker` (`statusChanged`
  for the split button's advance, `statusPicked` for a menu option),
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
- For the properties panel (`TaskPropertyApi`, `TaskTimeApi`): `TasksService.assignTask`,
  `unassignTask` (the new version from the `ETag`), `addTaskLabel`, `removeTaskLabel`,
  `listTaskWatchers` (to its last page), `getTaskApproval`, `requestTaskApproval` (`If-Match`),
  `listTaskDependencies`, `createTaskDependency` (`Idempotency-Key`), `deleteTaskDependency`,
  `listDependencyCandidates`; `TaskTimeService.listTaskTimeEntries`, `createTaskTimeEntry`
  (`Idempotency-Key`), `deleteTaskTimeEntry`, `getTaskStatusDurations`; `ListsService.getList`
  (the sprint end); the people and labels of `TaskCreateApi`. `parseDuration` and
  `formatDuration` of `@cadenway/ui/components/time-tracker`.
- `@cadenway/contracts` enums: `STATUS_KEYS`, `STATUS_CATEGORIES`, `STATUS_CATEGORY_BY_KEY`,
  `MILESTONE_STATUS_KEYS`, `PRIORITY_KEYS`, `CANCEL_REASONS`, `RECURRENCES`.
- `@core/api` (`hasProblemCode`, `readProblem`, `OrganizationPin`), `@shared/route-errors`, `@core/shortcuts` (`N`, Ctrl Enter), `@shared/layout-slot`
  (`ShellOverlay`, slot contribution), Workspace's `ports/workspace-context`.
- For the tabs (`TaskSectionsApi`): `TasksService.getTaskApproval`, `voteOnTaskApproval`,
  `withdrawTaskApprovalVote` and `requestTaskApproval`; `listTaskComments` (later pages),
  `createTaskComment` (mention spans, `Idempotency-Key`), `deleteTaskComment` (`If-Match`),
  `listTaskParticipants` (the `@` menus of the composer and the description), `updateTask`
  (`description` with `descriptionMentions`, `If-Match`); `addChecklistItem` and
  `updateChecklistItem` (without `If-Match`); `createSubtask` (`Idempotency-Key`) and `getTask`
  (the parent's parent, for the depth); `TaskActivityService.listTaskActivity`;
  `AttachmentsService.listTaskAttachments`, `startTaskAttachmentUpload` (`Idempotency-Key`), the
  signed form post to object storage (`HttpClient`, never to the API), `completeTaskAttachmentUpload`,
  `deleteTaskAttachment` (`If-Match`) and `getTaskAttachmentDownload`; `MembersService.listMembers`
  (every role, guests included). `@cadenway/ui` `tabs`, `block-editor`, `comment-composer`,
  `markdown`, `attachment`, `dropzone`, `checkbox`, `progress`, `avatar`, `context-menu`.
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
    `commentsFailed` with `reloadComments()` for the comments' inline error.
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
    queued when another task opens is still sent with its own key and version.
  - `TASK_WRITE_LANE` (`ports/task-write-lane`): the optional write path the status
    changes use instead of writing on their own; the dialog provides it with its
    `TaskDetailStore` (`useExisting`), so a status write never overlaps another write of the task.
  - Realtime: while a task is open the store watches its `task:` room; `task.updated.v1` and
    `task.status-changed.v1` read the detail again, `comment.created.v1` the first comment page
    (`commentsRevision`), `git.links-changed.v1` counts `gitRevision`; each part at most once
    per 300 ms (`NOTICE_WINDOW_MS`). Notices name a task id, not its key, and the socket hands
    every watched room's notices to every watch, so a notice about another task (of an open list)
    also reads again.
  - Header: key, `Subtask of <key> · <name>` (opens the parent), the read-only status badge with
    the space's label, `Cancelled: <reason> · <note>`, the title (saved on change or blur when
    changed and not blank), follow (count, `aria-pressed`, toasts), the reminder (presets from
    the opening instant: in 1 hour (an hour from now, to the minute), this afternoon before 15 h, tomorrow 9 h, the Monday of next
    week 9 h, the day before the due date 9 h; custom day among 14 and hour among six, a past
    hour refused; the note saved on change while a reminder exists; `Delete the reminder`),
    `Copy the link` (`<origin>/<slug>/t/<KEY>`), `More actions` (`Copy the identifier`,
    `Duplicate` with `Open`, `Move to…`, `Archive` with `Undo`, `Save as a template`,
    `Convert to a subtask of…` or `Move to another task…`, `Detach from <key>`, `Delete`
    confirmed, then `Undo` restores the trash entry) and `Close`. Writing actions need the list's
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
    text clears it; a confirmed text never replaces what is being typed), the checklist
    (`<done> / <n>`, ticks shown at once and rolled back with the failure toast, `Add an item` with Enter and Escape; no deletion, as in the mockup), the
    attachments (`cw-attachment` tiles, `Add` and the drop zone, 25 MB refused with `File too
large` and an empty file with `Empty file`, a name already attached skipped, files being sent
    shown with a spinner (the fetch backend reports no upload progress), `Remove “<name>”?` confirmed then toasted, the
    preview dialog with previous and next, arrow keys and `Download`, raster images drawn from
    their signed address) and `cw-task-development`, the placeholder of the Git panel (empty
    state and the key hint, no action yet). `Subtasks`: progress, rows that open the subtask
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
    the detail again (they change the task's version). `Activity`: read each time the tab opens,
    again while shown when the version moves; actor (member, automation, `GitHub` or `GitLab`, a
    service by name), what changed and when, `Show more`. Every list has its loading, inline
    error with `Retry` and empty state. Writing needs `edit`; commenting needs `comment` or
    `edit` (`TaskDetailStore.canComment`, from the list's `callerRole`). The participants are
    read once, when `Comments` opens or a `@` menu first searches, and not for a caller who may
    not comment.
  - Extension points: `TaskDetailStoreInstance` (`task`, `confirmedTask`, `space`, `statuses`,
    `list`, `canEdit`, `canComment`, `parent`, `subtasks`, `comments`, `commentsFailed`,
    `partial`, `pendingFields`, `commentsRevision`, `gitRevision`; `update`, `write`, `accept(task)`,
    `acceptVersion(version, changes?, key?)`, `reload`, `reloadComments`), which `cw-task-properties-panel` and
    `cw-task-detail-tabs`, containers of the dialog, inject; each provides its own stores. The
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
  is `size="lg"`, not the mockup's `max-w-4xl`.
- Detail gaps: `cw-dialog` has no size for the mockup's panel (`top-[6vh] h-[88vh] max-w-5xl`):
  the detail uses `size="full"` (the viewport less 2 rem) with `scrollable`, so the header has the
  brick's `px-6 py-4` and the body cancels its padding; a `sheet`-like size is a design-system
  need. The reminder button does not mark which preset the pending reminder came from unless its
  instant matches one; the
  afternoon preset is left out after 15 h (the mockup always shows it). The parent picker cannot
  check the depth and size of a search hit from another list. The header's follow button shows
  the watcher count only; the people are in the panel's `Followers` row. Realtime presence (who
  is viewing) has no contract yet.
- Properties gaps: the API keeps no running timer, so its start lives in the device storage per
  organization and task (`cadenway-task-timer.<organizationId>.<taskKey>`) and is lost with it;
  stopping records the elapsed minutes (1 to 1,440) for today and clears the timer only once the
  entry is confirmed: a refused stop keeps it, and stopping again sends the first stop's entry
  under the same `Idempotency-Key`, as any entry sent again after a failure. A deleted time
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
  panel each read the approval (`getTaskApproval` into their own models); both read it again
  once the confirmed version moves past the one they read, so they agree after any write. The
  Git panel waits for the read of a task's Git links.

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
| `task.attachments.empty`, `task.attachments.empty-text`                                     | The mockup draws no refused empty file.                            |
