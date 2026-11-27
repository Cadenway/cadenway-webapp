# Home

## Purpose

The home screen at the root of a workspace (`/:org`, `App.dc.html` lines 1683-1747) and its `Home`
rail item (`home.rail.label`). It owns that page, its read (`getHome`), its counters, sprint card
and lists, and that item only; the task lines (`cw-task-line`), the task menu, its writes
(`TaskRowActionsStore`), the cancel reason dialog, the create dialog and the task detail belong
to Task, the notification digest under `Mentions and activity` to Inbox, the list and space names
to Spaces, the shell, the workspace context and the slug guards to Workspace.

## Routes

`HOME_ROUTES` mounts `HomePage` at `''` (`pathMatch: 'full'`) below `/:org`, with the `Home`
route title (`home.route.title`) and Task's `TASK_ROW_ACTIONS_PROVIDERS` (its write lane,
`TaskStatusChangesStore` and `TaskRowActionsStore`), so the menu's pending writes and toasts die
with the screen. `?notice=logo-upload-failed` reaches the page as its `notice` input.

## Public entry points

| Entry point   | Consumers |
| ------------- | --------- |
| `home.routes` | workspace |
| `providers`   | workspace |

`providers` publishes `withHomeRailItem()` (`railNavigation`, order 0): a link to `/<slug>` marked
`aria-current="page"`, with the filled house, while the home screen is shown.

## Dependencies

- `@cadenway/api-client` through `data-access/` (`HomeApi`): `MyTasksService.getHome` (`today`, the
  caller's local day; `cache: 'no-store'`, pinned with `If-Organization-Match`, passive for
  background refreshes) and `MembersService.listMembers` (owners, admins and members, to the last
  page) for the menu's `Assign`.
- Task's `.` entry: `TaskSummary`, `TaskLine`, `TaskMenu`, `TaskCancelDialog`,
  `TASK_ROW_ACTIONS_PROVIDERS`, `TaskRowActionsStore`, `TaskDetailOpener` (`closed`, `changed`),
  `TaskCreate` (`open`, `created`), `TaskMoveTarget`, `TaskMenuPeopleState`, `Person`, `personOf`.
- Inbox's `.` entry: `InboxDigest` (`cw-inbox-digest`).
- Spaces' `ports/list-directory` (`LIST_DIRECTORY`, optional) for the list names, the space names
  and `Move to`.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the person's first name, the
  organization and the slug.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, problem readers), `@core/realtime`
  (`RealtimeConnection.reconnected`, optional).
- `@cadenway/ui` (`alert`, `alert-dialog`, `app-rail`, `button`, `context-menu`, `menu`,
  `progress`, `skeleton`, `stat`) and `@cadenway/icons`.

## Invariants

- The greeting is the page's `h1` and its route focus target (`data-route-focus`). The header
  (date, greeting, `Create a task`) renders at once; while the first read runs, a skeleton
  (`home.loading`, `role="status"`, `aria-busy`) stands for the counters, the priorities and the
  aside, as the mockup's `SK_PAGES.Home`.
- `HomeStore` is provided by `HomePage` (component scope), so the error boundary's `Retry`, which
  re-creates the page, starts over. Its first read of an organization is active; its failure
  reaches the router's default error component (`RouteErrorBoundary`, the unavailable state)
  through the template's read. A refresh that fails keeps every value of the previous read
  (`The home page could not be refreshed.` with `Retry`); a passive refresh refused while the
  organization context is stale (`OrganizationSwitchPendingError` or a `412
organization.context-changed`) keeps them silently, with the error of an earlier failed
  refresh still shown, and is sent again once the context is verified. A successful read with no priority shows the mockup's dashed paragraph; no current
  sprint hides the sprint card, no list hides `Lists`.
- Each read sends the local day it is made on (`today`), so a refresh after midnight counts the
  late and due tasks against the new day.
- No realtime event covers the caller's tasks across lists (gap G-R1): the page is read again in
  the background, keeping its values, after each settled write of the menu
  (`TaskRowActionsStore.changed`), on window focus (never while a read runs, before the
  organization's first read settled, or within 30 s of a settled read, `FOCUS_REFRESH_MS`), after a realtime reconnection, when a task detail closes or reports a
  change (`TaskDetailOpener.closed`, `changed`) and after a creation (`TaskCreate.created`). A read
  asked for while another runs is sent once it settles; no list room is joined.
- An organization switch drops the values at once and reads anew; a read of the previous
  organization is aborted and never shown, and its failure never shows the previous
  organization's values.
- Counters (`cw-stat` in a `cw-stat-group`): four columns from 1024 px, a 2×2 grid with inner
  borders below (the group's one-row layout is overridden on the page, brick gap DS3); `Late` is
  grenat above 0. Each hint takes the plural form of its count (`Intl.PluralRules` of
  `$localize.locale`). `Done` counts every done task assigned to the caller (`stats.done`, gap
  G-H1), so its hint says `in total` instead of the mockup's "since the start of the sprint".
- `My priorities` shows `getHome`'s priorities (seven at most) as `priority` lines. The context menu
  opens from the list item around each line (right click, Shift F10, the Menu key, a long press),
  not from the line itself; the item has `tabindex="-1"` and hands the focus it receives itself (the
  menu closing) to the line's button. A pending status or value of the menu stays shown over a
  reread of an older copy; a deleted line hides at once (`TaskRowActionsStore.rows`). Every write
  of the menu, and the status it checks, take the read copy of the task looked up by key
  (`HomeStore.tasks`), never the drawn copy, so `Undo` only puts back a confirmed value; only the
  menu's checkmarks (`tasks`) take the drawn copy (`displayedTask`). After a confirmed deletion the
  focus goes to the line that took its place, else the one before it, else the empty paragraph or
  the `My priorities` heading (both `tabindex="-1"`). Below 640 px
  the lines drop their priority (Task's line); below 1024 px the aside stacks under them.
- The members are read on the first opening of the task menu, not when the page opens; `Assign`
  shows them loading (`peopleState`), then a failure with `Retry`, which reads them again
  (`loadPeople`), as the next opening does.
- A list that `LIST_DIRECTORY` does not hold reads `Archived list` (gap G-T1, until `TaskSummary`
  carries its list's name) only when the directory holds at least one list of the task's space;
  otherwise the text after the key is left out. A space whose name the directory does not know is
  left out of its `Lists` row.
- The sprint card shows `sprints[0]`: its range in the application locale (`LOCALE_ID`) and
  `done / live · percent`, the live tasks leaving the cancelled ones out.
- `Mentions and activity` is Home's heading over Inbox's digest, a secondary read with its own
  inline error and `Retry`; its failure never reaches the boundary. Mounting it brings
  `inbox.digest.loading` into the extracted catalog.
- The date follows the application locale (`LOCALE_ID`) and is computed when the page opens.
- `?notice=logo-upload-failed`, set by Auth after a creation whose logo could not be uploaded,
  shows a dismissible notice pointing to the organization settings.

## Known gaps

- G-H1: `stats.done` has no sprint bound; the contract-first fix is `stats.doneSinceSprintStart`
  on task-service `getHome`, then the gateway relay.
- G-T1: `TaskSummary` carries no list name; archived lists read `Archived list`.
- G-R1: no realtime notice for the caller's tasks across lists; see the refresh triggers above.
- The route relies on the router's default error component instead of declaring
  `errorComponent: RouteErrorBoundary`, because Errors' `.` entry does not list `home` among its
  consumers; the rendered state is the same.

## Copy not taken word for word from the mockup

| Id                               | English                               | French                               | Source of the French                                       |
| -------------------------------- | ------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `home.notice.close`              | Close                                 | Fermer                               | Not in the mockup                                          |
| `home.notice.logo-upload-failed` | The organization was created, …       | L’organisation a été créée, …        | Not in the mockup                                          |
| `home.stats.assigned-hint.one`   | open task                             | tâche ouverte                        | Singular of the mockup's `tâches ouvertes`                 |
| `home.stats.due-today-hint.one`  | due today                             | échéance du jour                     | Singular of the mockup's `échéances du jour`               |
| `home.stats.done-hint.one`       | task completed in total               | tâche terminée au total              | Not in the mockup (gap G-H1)                               |
| `home.stats.done-hint.other`     | tasks completed in total              | tâches terminées au total            | Not in the mockup (gap G-H1)                               |
| `home.stale.text`                | The home page could not be refreshed. | L’accueil n’a pas pu être actualisé. | Not in the mockup                                          |
| `home.stale.retry`               | Retry                                 | Réessayer                            | The mockup's page error (`App.dc.html` lines 4817-4823)    |
| `home.priorities.archived-list`  | Archived list                         | Liste archivée                       | The mockup's Archives screen (`App.dc.html` 5494 and 8821) |
| `home.delete.cancel`             | Cancel                                | Annuler                              | The mockup's confirmations                                 |
