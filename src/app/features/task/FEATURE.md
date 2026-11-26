# Task

## Purpose

The task building blocks other features compose (step 4a of the mockup integration), the task
create dialog and, in step 5, the task detail. It owns the task display models and their adapters,
the status change interaction of `cw-status-interactions`, the cancel reason dialog, the status,
priority, people and label pickers, the due date, the label chips and the name cell of a row, and
the create dialog with its `N` shortcut. Lists, boards and their grouping belong to Spaces, which
composes these blocks; the task detail page comes in step 5.

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
  the link has no access-denied state. The task detail comes in step 5.

## Public entry points

| Entry point   | Consumers      |
| ------------- | -------------- |
| `.`           | spaces, search |
| `providers`   | workspace      |
| `task.routes` | workspace      |

`providers` publishes `withTaskCreate()` (`overlays`, order 20), bound on `/:org`.

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
  after an uncertain answer, per-task versions, copies and trash entries), `remind(taskKey, at)` and
  `restore(entryId)`, for the stores of the screens that act on several tasks.
- `TaskCreate` (root): `open(options?)`, `useDefaults(defaults, destroyRef)`, `close()`, `isOpen`,
  `options`, `created`.
- Presentational components, inputs and outputs only: `cw-task-status-picker`,
  `cw-task-priority-picker`, `cw-task-people-picker`, `cw-task-label-picker`, `cw-task-due-date`,
  `cw-task-label-chips`, `cw-task-title-cell` and `cw-task-cancel-dialog`.

## Dependencies

- `@cadenway/api-client` through `data-access/`: `TasksService.updateTask` (status with `If-Match`), `getTask`, `createTask` and `createSubtask` (with `Idempotency-Key`), `executeBulkTaskAction` (with `Idempotency-Key`), `listLabels`;
  `RemindersService.setTaskReminder`, `TrashService.restoreTrashEntry`;
  `SpacesService.listSpaces`, `getSpace` (`cache: 'no-store'`), `listTaskTemplates`;
  `ListsService.listLists`; `MembersService.listMembers` (owners, admins and members). Every
  collection is read to its last cursor page.
- `@cadenway/contracts` enums: `STATUS_KEYS`, `STATUS_CATEGORIES`, `STATUS_CATEGORY_BY_KEY`,
  `MILESTONE_STATUS_KEYS`, `PRIORITY_KEYS`, `CANCEL_REASONS`, `RECURRENCES`.
- `@core/api` (`hasProblemCode`, `readProblem`, `OrganizationPin`), `@shared/route-errors`, `@core/shortcuts` (`N`, Ctrl Enter), `@shared/layout-slot`
  (`ShellOverlay`, slot contribution), Workspace's `ports/workspace-context`.
- `@cadenway/ui` (`badge`, `button`, `combobox`, `date-picker`, `dialog`, `input`, `kbd`, `menu`,
  `priority-icon`, `radio-group`, `split-button`, `status-icon`, `switch`, `textarea`, `toast`) and
  `@cadenway/icons`.

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
- Known gaps: the comment count of a row is null (task summaries carry none); the Git chip is left
  out (B4, no API yet); the dialog's file drop is not built (attachments need the task first); the
  mockup's built-in templates (`Bug`, `Feature`, `Release`) appear only when the space
  returns them from `listTaskTemplates`, and the template menu has no icon or tone (the DTO carries
  none); avatars draw initials (members give an avatar id, no address). The people and label
  triggers show the combobox's own content (the chosen option, `(me)` included, or `n
people`), and the due trigger shows the short date without `Tomorrow ·` or the
  `Today` tone, until `cw-combobox` and `cw-date-picker` take a trigger template; the dialog
  is `size="lg"`, not the mockup's `max-w-4xl`.

## Copy not taken word for word from the mockup

| Unit                                                                                        | Reason                                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `task.combobox.*`                                                                           | Texts of the combobox brick, taken from its built-in defaults.    |
| `task.create.due-*` but `due-today`, `due-tomorrow`, `due-friday`, `due-sprint`, `due-none` | Texts of the date picker brick, taken from its built-in defaults. |
| `task.people-picker.search`, `task.label-picker.search`                                     | The mockup's menus have no search field.                          |
| `task.priority-picker.label`, `task.status-picker.menu`, `task.create.destination`          | Accessible names the mockup does not write out.                   |
| `task.create.name-required`                                                                 | The mockup disables `Create the task` without showing an error.   |
| `task.create.lists-failed`, `task.retry`, `task.create.no-list`                             | The mockup draws no failed or empty read of the lists.            |
| `task.create.failed`, `task.create.failed-text`                                             | The mockup draws no refused creation.                             |
| `task.status-change.failed*`, `task.status-change.conflict*`                                | The mockup draws no refused or conflicting status change.         |
| `task.status-change.cancel-failed-*`                                                        | The mockup draws no refused cancellation.                         |
| `task.title-cell.subtasks`, `task.title-cell.checklist`, `task.title-cell.comments`         | Screen reader texts and tooltips the mockup does not write out.   |
| `task.cancel-dialog.close`, `task.create.close`                                             | Close button of the dialog brick.                                 |
