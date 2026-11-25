# Spaces

## Purpose

The spaces of a workspace and their lists: the spaces part of the shell (the « Espaces » rail item,
the sidebar's favorites, spaces accordion and suggestions, the sprint progress of its footer), the
space overview and the frame of a list page (header, view tabs and saved views, view tools and active
filters, the selection bar) with its view configuration. Step 4a builds the frame and the « Liste »
view's placeholder; the task rows, pickers and creation belong to Task and are wired in the next
pass; the eight other views and the space, list, share, status and automation dialogs come in step 4b.

## Routes

`SPACES_ROUTES` is mounted by Workspace below `/:org` (an empty-path entry after Home). A
componentless parent provides the English texts of the bricks (statuses, alert dialog, avatar,
breadcrumb, dialog, inline edit, toolbar).

- `spaces/:spaceId` loads `SpaceOverviewPage` (« Vue d’ensemble »).
- `l/:listId` loads `ListPage` and provides `ListPageStore` and `ListViewStore` to its views; `''`
  redirects to `list`, which loads `ListViewPage`. `?savedView=<id>` applies a saved view of the
  list.
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
  `MembersService.listMembers`, `TasksService` (`listLabels`, `executeBulkTaskAction`) and
  `TaskQueriesService.queryListTasks` (the milestone count).
- `@core/api` (problem readers), `@core/realtime` (`watch({ kind: 'list' })`), `@shared/layout-slot`
  (`SlotFeature`, `SHELL_SIDEBAR`) and `@shared/route-errors`.
- `@cadenway/ui` (`alert-dialog`, `app-rail`, `avatar`, `breadcrumb`, `button`, `checkbox`,
  `context-menu`, `dialog`, `empty`, `inline-edit`, `input`, `menu`, `popover`, `progress`,
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
- « Créer une tâche » emits `taskCreated` from `ViewTools`; the next pass opens the task feature's
  creation dialog. `ListViewPage` holds the selection the rows pass fills.

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
- Bulk selections over 50 must be chunked in the rows pass.
- Realtime notices without a list or space id cannot be attributed to the open list and do not
  refresh its counts; the notice contract needs to include that context.
- The filter dialog does not count the visible tasks (« n sur m tâches »): the rows pass reads them.

## Copy not taken word for word from the mockup

| Unit                                                                                                                           | Reason                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `spaces.retry`, `spaces.sidebar.failed`, `spaces.overview.milestones-failed`, `spaces.secondary.*`, `spaces.saved.read-failed` | The mockup draws no failed read.                                           |
| `spaces.favorite.failed`, `spaces.list.*-failed`, `spaces.saved.failed`, `spaces.saved.delete-failed`, `spaces.bulk.failed`    | The mockup draws no refused write.                                         |
| `spaces.saved-view.missing`                                                                                                    | The mockup does not show a missing saved-view address.                     |
| `spaces.save-view.name-required`                                                                                               | The mockup disables the save button rather than showing an error.          |
| `spaces.list.export-failed`                                                                                                    | Taken from the mockup's « Export impossible ici » title only.              |
| `spaces.labels.*`                                                                                                              | The bricks' own French defaults, which the mockup does not show as copy.   |
| `spaces.sidebar.overview`                                                                                                      | The mockup's « Vue d’ensemble de … », with the space name.                 |
| `spaces.list-view.region`, `spaces.sprint-progress.label`, `spaces.saved.modified-group`                                       | Accessible names of regions the mockup names differently or does not name. |
| `spaces.route.overview`, `spaces.route.list`                                                                                   | Route titles.                                                              |
| `spaces.tips.*`                                                                                                                | Two of the five suggestions: the others need integrations or seat counts.  |
