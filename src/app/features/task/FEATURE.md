# Task

## Purpose

The task building blocks other features compose (step 4a of the mockup integration), the task
create dialog and, in step 5, the task detail. It owns the task display models and their adapters,
the status change interaction of `cw-status-interactions`, the cancel reason dialog, the status,
priority, people and label pickers, the due date, the label chips and the name cell of a row, and
the create dialog with its `N` shortcut. Lists, boards and their grouping belong to Spaces, which
composes these blocks; the task detail page comes in step 5.

## Routes

None yet: `/:org/t/:taskKey` comes in step 5 (the create toast's « Ouvrir » leads there and renders
the 404 meanwhile).

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| `.`         | spaces    |
| `providers` | workspace |

`providers` publishes `withTaskCreate()` (`overlays`, order 20), bound on `/:org`.

`.` publishes:

- Models: `TaskSummary` (`id` is the key, `version` is the `If-Match` precondition), `TaskProgress`,
  `StatusOption`, `Person`, `TaskStatusChange`, `TaskCancellation`, `TaskCancelRequest`, `TaskCreateOptions`,
  `CreatedTask`; the words `STATUS_LABELS` and `PRIORITY_LABELS`; the rules `nextStatus`,
  `isClosedStatus`, `statusLabel`, `pickableStatuses` and `defaultStatusOptions`.
- `TaskStatusChangesStore`, a SignalStore the consumer provides on its route: `request(task, status,
options?)`, `requestCancel(tasks, options?)`, `pendingStatus(taskId)`, `displayedStatus(task)`, `settledStatus(task)`, `undo(taskId)`,
  `cancelRequest` with `confirmCancel(cancellation)` and `keepTask()`, and the `changed` stream;
  `STATUS_SETTLE_MS` (460).
- `TaskCreate` (root): `open(options?)`, `close()`, `isOpen`, `options`, `created`.
- Presentational components, inputs and outputs only: `cw-task-status-picker`,
  `cw-task-priority-picker`, `cw-task-people-picker`, `cw-task-label-picker`, `cw-task-due-date`,
  `cw-task-label-chips`, `cw-task-title-cell` and `cw-task-cancel-dialog`.

## Dependencies

- `@cadenway/api-client` through `data-access/`: `TasksService.updateTask` (with `If-Match`),
  `getTask`, `createTask` and `createSubtask` (with `Idempotency-Key`), `listLabels`;
  `SpacesService.listSpaces`, `getSpace` (`cache: 'no-store'`), `listTaskTemplates`;
  `ListsService.listLists`; `MembersService.listMembers` (owners, admins and members). Every
  collection is read to its last cursor page.
- `@cadenway/contracts` enums: `STATUS_KEYS`, `STATUS_CATEGORIES`, `STATUS_CATEGORY_BY_KEY`,
  `MILESTONE_STATUS_KEYS`, `PRIORITY_KEYS`, `CANCEL_REASONS`, `RECURRENCES`.
- `@core/api` (`hasProblemCode`, `OrganizationPin`), `@core/shortcuts` (`N`, Ctrl Entrée), `@shared/layout-slot`
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
  the failure toast. A confirmed change shows a 6 s toast whose « Annuler » sends the previous
  status at once, only while the task still has the status that change gave it. Undoing a change
  away from « Annulé » sends its reason again without its note, which task summaries do not carry.
  A pending write flushed after destruction is dropped if its queued organization is no longer
  the committed organization.
- « Annulé » always opens the cancel reason dialog first (`cancelRequest`): Doublon, Ne sera pas
  fait, Hors périmètre, Obsolète and an optional « Précision »; « Garder la tâche » changes nothing.
  The consumer renders `cw-task-cancel-dialog` bound to `cancelRequest`, `confirmCancel` and
  `keepTask`.
- `displayedStatus(task)` and `settledStatus(task)` prefer the store's settled status only while
  its write is in flight or its version is newer than the caller's task, so a refetched task wins.
- `TaskCreate` (root) only holds whether the dialog is open and its presets, through
  `ShellOverlay`, so it never opens over the command palette or the shortcuts dialog. `N` opens it
  outside fields while the shell lives; Ctrl Entrée creates while it is open.
- `TaskCreateStore` is provided by the create dialog. It reads the destinations, the people and the
  labels the first time the dialog opens; the statuses, the next key and the templates follow the
  chosen list's space, and the next key is read again after each creation. Failed reads expose
  « Réessayer », never a successful empty result. A creation sent again with the same body
  reuses its `Idempotency-Key`, including across dialog openings in the same organization; a changed
  body or organization gets a new one. A subtask (`parentKey`) goes to
  `createSubtask`, which takes no drafted subtasks or checklist. The parent key requires its list id.
- The create dialog starts each opening afresh: the presets, the current user assigned, « À faire »
  and « Moyenne ». « Créer d'autres tâches » keeps it open and empties the name, the description,
  and the subtasks while retaining the template's checklist. Its toast « Ouvrir » leads to `/<slug>/t/<key>`.
- Known gaps: the comment count of a row is null (task summaries carry none); the Git chip is left
  out (B4, no API yet); the dialog's file drop is not built (attachments need the task first); the
  mockup's built-in templates (Bug, Fonctionnalité, Mise en production) appear only when the space
  returns them from `listTaskTemplates`; avatars draw initials (members give an avatar id, no
  address).
- The copy of the entries no screen mounts yet (`TaskStatusChangesStore` toasts, `cw-task-title-cell`,
  `cw-task-due-date`) is extracted once a consumer mounts them: their units are `task.status-change.*`,
  `task.title-cell.*` and `task.due.*`, with the French below.

| Unit                                                                                | French                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `task.status-change.moved`, `task.status-change.from`                               | « {key} passée en {status} », « Depuis {status}. »                                               |
| `task.status-change.cancelled`, `task.status-change.reason`                         | « {key} annulée », « Motif : {reason}. »                                                         |
| `task.status-change.cancelled-one`, `task.status-change.cancelled-many`             | « {count} tâche annulée », « {count} tâches annulées »                                           |
| `task.status-change.cancel-failed-one`, `task.status-change.cancel-failed-count`    | « Impossible d’annuler {count} tâche », « Impossible d’annuler {count} tâches »                  |
| `task.status-change.failed`, `task.status-change.failed-text`                       | « Impossible de modifier le statut », « Le serveur n’a pas répondu. Réessayez dans un instant. » |
| `task.status-change.conflict`, `task.status-change.conflict-text`                   | « {key} modifiée ailleurs », « Son dernier statut est affiché : {status}. »                      |
| `task.title-cell.advance`, `task.title-cell.parent`                                 | « {status} · passer à « {next} » », « Sous-tâche de {key} »                                      |
| `task.title-cell.subtasks`, `task.title-cell.checklist`, `task.title-cell.comments` | « Sous-tâches terminées », « Checklist », « Commentaires »                                       |
| `task.due.today`, `task.due.tomorrow`, `task.due.late`, `task.due.none`             | « Aujourd’hui », « Demain », « (en retard) », « Sans échéance »                                  |

## Copy not taken word for word from the mockup

| Unit                                                                                        | Reason                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `task.combobox.*`                                                                           | Texts of the combobox brick, taken from its French defaults.     |
| `task.create.due-*` but `due-today`, `due-tomorrow`, `due-friday`, `due-sprint`, `due-none` | Texts of the date picker brick, taken from its French defaults.  |
| `task.people-picker.search`, `task.label-picker.search`                                     | The mockup's menus have no search field.                         |
| `task.priority-picker.label`, `task.status-picker.menu`, `task.create.destination`          | Accessible names the mockup does not write out.                  |
| `task.create.name-required`                                                                 | The mockup disables « Créer la tâche » without showing an error. |
| `task.create.lists-failed`, `task.retry`, `task.create.no-list`                             | The mockup draws no failed or empty read of the lists.           |
| `task.create.failed`, `task.create.failed-text`                                             | The mockup draws no refused creation.                            |
| `task.status-change.failed*`, `task.status-change.conflict*`                                | The mockup draws no refused or conflicting status change.        |
| `task.status-change.cancel-failed-*`                                                        | The mockup draws no refused cancellation.                        |
| `task.title-cell.subtasks`, `task.title-cell.checklist`, `task.title-cell.comments`         | Screen reader texts and tooltips the mockup does not write out.  |
| `task.cancel-dialog.close`, `task.create.close`                                             | Close button of the dialog brick.                                |
