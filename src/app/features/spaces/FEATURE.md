# Spaces

## Purpose

The spaces of a workspace and their lists: the spaces part of the shell (the « Espaces » rail item,
the sidebar's favorites, spaces accordion and suggestions, the sprint progress of its footer), the
space overview, the frame of a list page (header, view tabs and saved views, view tools and active
filters, the selection bar) with its view configuration, and the « Liste » view: its grouped,
virtualized task rows, read page by page. The cells, pickers, status interaction and create dialog
belong to Task, which the rows compose; the task detail opened from a row comes in step 5; the
eight other views and the space, list, share, status and automation dialogs come in step 4b.

## Routes

`SPACES_ROUTES` is mounted by Workspace below `/:org` (an empty-path entry after Home). A
componentless parent provides the English texts of the bricks (statuses, alert dialog, avatar,
breadcrumb, dialog, inline edit, toolbar).

- `spaces/:spaceId` loads `SpaceOverviewPage` (« Vue d’ensemble »).
- `l/:listId` loads `ListPage` and provides `ListPageStore` and `ListViewStore` to its views; `''`
  redirects to `list`, which loads `ListViewPage` and provides `ListRowsStore`, Task's
  `TaskStatusChangesStore`, and the English texts of `cw-data-table`.
  `?savedView=<id>` applies a saved view of the list; `?task=<KEY>` is set when a row opens (the
  detail host that reads it comes in step 5).
- Failed primary reads render the router's default error component, `RouteErrorBoundary`, in the
  failing route's outlet: a failed view keeps the list header.

## Public entry points

| Entry point     | Consumers |
| --------------- | --------- |
| `spaces.routes` | workspace |
| `providers`     | workspace |

`providers` publishes, for the `/:org` route that loads the shell:

- `provideSpacesNavigation()`: the workspace's `SpacesNavigationStore`;
- `withSpacesRailItem()` (`railNavigation`, order 30): « Espaces », which toggles the sidebar
  through `SHELL_SIDEBAR` and is current on a spaces screen;
- `withSpacesSidebar()` (`sidebar`, order 0): « Favoris », « Espaces » and the suggestions;
- `withSprintProgress()` (`sidebarFooter`, order 0): the current sprint's progress.

## Dependencies

- `@cadenway/api-client` through `data-access/`: `SpacesService` (`listSpaces`, `getSpace`,
  `getSpaceOverview`, `listSpaceMilestones`, `listFavorites`, `createFavorite`, `deleteFavorite`),
  `ListsService` (`getList`, `getListCounts`, `updateList`, `duplicateList`, `exportListTasks`,
  `deleteList`, `listSavedViews`, `createSavedView`, `updateSavedView`, `duplicateSavedView`,
  `deleteSavedView`), `ArchivesService.archiveList`, `AccessService.listListGrants`,
  `MembersService.listMembers`, `TasksService` (`listLabels`, `executeBulkTaskAction`,
  `listSubtasks`) and `TaskQueriesService` (`queryListTasks` for the rows and the milestone count,
  `countTaskGroups` for the groups). Every rows read bypasses the HTTP cache.
- Task (`@features/task`): `TaskSummary`, `TaskStatusChangesStore`,
  `TaskCreate`, `cw-task-title-cell`,
  `cw-task-due-date`, `cw-task-label-chips`, `cw-task-cancel-dialog`, `personOf` and the status
  rules.
- `@core/api` (problem readers), `@core/realtime` (`watch({ kind: 'list' })`), `@shared/layout-slot`
  (`SlotFeature`, `SHELL_SIDEBAR`) and `@shared/route-errors`.
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `avatar`, `breadcrumb`, `button`, `checkbox`,
  `context-menu`, `data-table`, `dialog`, `empty`, `priority-icon`, `inline-edit`, `input`, `menu`, `popover`, `progress`,
  `sidebar`, `skeleton`, `status-icon`, `tabs`, `toast`, `toggle-group`, `toolbar`) and
  `@cadenway/icons`.

## Invariants

- Stores and scopes:
  - `SpacesNavigationStore`, route-scoped on `/:org` (`provideSpacesNavigation()`): the spaces,
    one overview per space read at most four at a time (a failed one offers Retry), the favorites and the
    open spaces. Keyed on the committed organization id: a switch closes every space and
    reads again. Favorites change optimistically and a refusal restores the previous list. The
    current sprint is the first sprint, in sidebar order, whose dates hold the caller's today.
  - `ListPageStore`, route-scoped on `l/:listId`: the list (primary read) and its space, counts,
    milestone count, members, labels and saved views (secondary reads), the header's and the
    selection bar's writes. It watches the list's realtime room while the page lives; since the
    gateway broadcasts notices to every watch, it filters by list or space and debounces count refreshes.
  - `ListViewStore`, route-scoped on `l/:listId`: filters, sort, grouping, subtask display, search,
    « Jalons » and the applied saved view. It exposes `taskQuery` (the `queryListTasks` body
    without cursor and limit) and `groupQuery` (the `countTaskGroups` parameters, null when not
    grouped) for the rows. A saved view applies over the standard tab, which gets its configuration
    back when the view is left; the search, « Jalons » and the subtask display stay local and never
    make a saved view « Modifiée ». Another list starts over from the default configuration.
  - `ListRowsStore`, route-scoped on `list`: the rows of the « Liste » view. Grouping is a filter:
    the primary read takes `countTaskGroups`, then cursor pages of each group in the gateway's
    order with the group's value in the filters, until 50 tasks of open groups are read; `loadMore`
    reads the next page when the table nears its end. A folded group (« Annulé » by default when
    grouping by status) reads its first page only, so its header shows, and reads on when opened.
    Another query reads again and keeps the rows until the answer (superseded reads are aborted);
    another list or organization (`WORKSPACE_CONTEXT`) empties them at once and drops late answers.
    A first primary read fails to the route's error boundary; a failed background refresh, next
    page or subtask read offers « Réessayer » in place. A row is filed under the task's settled status, so it joins its new
    group 460 ms after the last click (`STATUS_SETTLE_MS`), or immediately with reduced motion,
    while the icon and word change at once. The row retains focus when it moves. Grouping by
    assignee uses the gateway's order for each group, including a task with several assignees.
    Subtasks are read under visible opened parents (`listSubtasks`, four reads at a time), two
    levels deep; closed and folded parents are pruned and stale answers are ignored. « Dépliées » opens every parent and a mode change
    forgets the parents opened by hand; « À part » reads `level: all` and shows the parent's key.
    Subtask creation is offered only when loaded ancestry proves the depth limit is not reached.
    It watches the list's realtime room and reads again in place 300 ms after the last notice of
    the list; the status store keeps pending and in-flight changes over what it reads. A
    task created in the list (`TaskCreate.created`) and a bulk action read the rows again.
  - `TaskStatusChangesStore` (Task), route-scoped on `list`, so pending
    changes die with the view.
  - `SpaceOverviewStore`, page-scoped on `SpaceOverviewPage`.
- Route errors: the gateway answers `404 space.not-found` or `list.not-found` for a deleted
  resource and for a private one the caller does not see alike, and the access request never
  reveals which; that answer renders « Accès refusé » with « Demander l’accès ». Any other `404` or
  a `400` (malformed id) is not found; anything else is unavailable with its status and reference.
- The sidebar's counts come from `getSpaceOverview`, one call per space, which the contract
  designates for the sidebar; `getListCounts` serves the list header.
- Shell contributions and pages take link slugs from the committed `WORKSPACE_CONTEXT`.
- The list page claims the shell's sidebar toggle (`claimToggle`) and renders it in its breadcrumb
  row while the sidebar is collapsed.
- The dismissed suggestions are kept in browser storage under `cadenway-tips`, as in the mockup.
- Deleting a list asks for its typed name (`cw-alert-dialog` with `confirmText`), then opens the
  home screen; archiving opens the space overview. The export downloads the gateway's CSV with the
  view's filters, sort and level.
- « Créer une tâche » (`ViewTools.taskCreated`), each group's « + » (with the group's status when
  grouping by status), the empty state's « Ajouter une tâche » and `N` (`TaskCreate.useDefaults`)
  open the create dialog in the open list.
- A row: the status icon moves the task to its next status; the people and priority pickers edit
  in place with `If-Match`; a click on the name or Enter opens `?task=<KEY>` with
  `queryParamsHandling: 'merge'`; the « … » button and the right click open the menu of the task,
  or of the selection when the row belongs to a selection of several tasks, whose « Statut » sets
  any status; « Annulé » asks the reason once through `cw-task-cancel-dialog`
  (`requestCancel(tasks)`). The status store's toasts offer « Annuler ».
- `ListViewPage` holds the table's selection; the selection bar sends it explicitly, with each
  task's shown version, through `ListPageStore.bulk`, in chunks of 50 `executeBulkTaskAction` calls
  one after the other. Each chunk has an idempotency key, reused for one retry after an uncertain
  response. An unresolved response is reported as unknown and triggers a reload; a refused chunk
  stays selected and a second toast counts it. The row menu uses the same bulk path for a selected
  group, including a shared cancellation reason.
- Under 768 px the table hides the assignees, priority, labels and actions columns.

## Gateway follow-up

`listSpaces`, `getSpaceOverview`, favorites, `getListCounts`, saved views, `listLabels`,
`listMembers` and `listListGrants` are not yet pinned by the gateway. They await B20
(`cadenway-api-contracts#118`, then the gateway); afterward the webapp adds them to
`ORGANIZATION_PIN_OPERATIONS`.

## Known gaps

- `cw-sidebar-space` has no slot next to the name: the private lock of a space shows on its
  overview, not in the sidebar, until the design system adds one.
- The « + » of « Espaces », the right-click menus of the sidebar, « Modifier », « Nouveau sprint »,
  « Nouvelle liste », « Partager », « Rapport de sprint » and the space dialogs open the dialogs of
  step 4b and are not built.
- `cw-tabs` of `@cadenway/ui` 0.7.0 reads the required value of a tab that is not bound yet when
  no earlier tab is active (NG0950): `ViewTabs` activates a saved view's tab only from the render
  after its creation. To fix in the design system.
- « Modifier la liste » uses inline editing until the list edit dialog in step 4b.
- Realtime notices without a list or space id cannot be attributed to the open list and do not
  refresh its counts; the notice contract needs to include that context.
- The filter dialog does not count the visible tasks (« n sur m tâches »): the rows store, provided
  on the `list` view, is not reachable from the list page's tools yet.
- `cw-data-table` (`@cadenway/ui` 0.7.0) gaps, to add in the design system:
  - the group header draws the count of the loaded rows, not the `countTaskGroups` count, and a
    group shows only once one of its rows is loaded, so the empty default groups of `App.dc.html`
    and the full count of a group read in part do not show (it needs a group count input and
    declared groups);
  - no output tells that the virtual window nears its end: the page listens to the scroller in the
    capture phase and finds it from the grid;
  - no per-row class, so the row-in motion plays on the name cell only;
  - under 768 px it turns the rows into cards instead of the mockup's three-column grid;
  - the « + » of a group sits in the group header, where `App.dc.html` draws a trailing
    « Ajouter une tâche » row.
- The row's status icon and name open the task; the row menu changes its status. Assignees,
  priority, due date and labels are display only. A row can create a subtask with its parent key.
- The row menu holds « Ouvrir » and « Statut » only; « Priorité », « Assigner », « Déplacer vers »,
  the reminder, « Dupliquer », the copies and « Supprimer » come with the context menus of step 4b.
- A row's status icon does not animate from the previous status (`from` is not tracked).
- Creating from a priority or assignee group presets only the list: `TaskCreateOptions` has no
  priority or assignee preset.
- `queryListTasks` items are mapped by `list-task.adapter`, a copy of Task's `task-summary`
  adapter: a DTO adapter cannot be published across features.

## Copy not taken word for word from the mockup

| Unit                                                                                                                           | Reason                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `spaces.retry`, `spaces.sidebar.failed`, `spaces.overview.milestones-failed`, `spaces.secondary.*`, `spaces.saved.read-failed` | The mockup draws no failed read.                                           |
| `spaces.favorite.failed`, `spaces.list.*-failed`, `spaces.saved.failed`, `spaces.saved.delete-failed`, `spaces.bulk.failed`    | The mockup draws no refused write.                                         |
| `spaces.saved-view.missing`                                                                                                    | The mockup does not show a missing saved-view address.                     |
| `spaces.save-view.name-required`                                                                                               | The mockup disables the save button rather than showing an error.          |
| `spaces.list.export-failed`                                                                                                    | Taken from the mockup's « Export impossible ici » title only.              |
| `spaces.labels.*`, `spaces.table.*`                                                                                            | The bricks' own French defaults, which the mockup does not show as copy.   |
| `spaces.rows.more-failed`, `spaces.rows.subtasks-failed`                                                                       | The mockup draws no failed read.                                           |
| `spaces.bulk.partial*`                                                                                                         | The mockup draws no refused chunk of a bulk action.                        |
| `spaces.rows.empty`, `spaces.rows.add`                                                                                         | The empty list without filters, from the board's « Aucune tâche ».         |
| `spaces.sidebar.overview`                                                                                                      | The mockup's « Vue d’ensemble de … », with the space name.                 |
| `spaces.list-view.region`, `spaces.sprint-progress.label`, `spaces.saved.modified-group`                                       | Accessible names of regions the mockup names differently or does not name. |
| `spaces.route.overview`, `spaces.route.list`                                                                                   | Route titles.                                                              |
| `spaces.tips.*`                                                                                                                | Two of the five suggestions: the others need integrations or seat counts.  |
