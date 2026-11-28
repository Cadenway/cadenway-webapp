# Search

## Purpose

The command palette (Ctrl + K): search across lists and tasks, recent tasks, navigation and
actions. It owns the palette overlay and its triggers: the rail's `Search` item and the
sidebar's `Search…` button, and the port through which another feature opens the palette (the
404's `Search`). Search inside a single list belongs to Spaces.

## Routes

None.

## Public entry points

| Entry point                      | Consumers |
| -------------------------------- | --------- |
| `providers`                      | workspace |
| `ports/command-palette-launcher` | errors    |

`providers` publishes `withSearchRailItem()` (`railFooter`, order 0), `withSearchButton()`
(`sidebarHeader`, order 10), `withCommandPalette()` (`overlays`, order 0) and
`provideCommandPaletteLauncher()`, which Workspace puts on `/:org`, where every shell renders the
palette.

`ports/command-palette-launcher` publishes `COMMAND_PALETTE_LAUNCHER`
(`CommandPaletteLauncherPort`: `open()`, which opens the palette as the rail's `Search` does,
never over another shell overlay). It exists only below `/:org`: inject it as optional and leave
out what would open the palette when it is missing.

## Dependencies

- `@cadenway/api-client`: `SearchService.search` through `data-access/`.
- Auth's `.` entry (`SignOut`), Task's `.` entry (`TaskCreate`, `TaskDetailOpener`), Spaces' `ports/list-directory`
  (`LIST_DIRECTORY`, provided on `/:org` by `provideSpacesNavigation()`, taken as optional the first
  time the palette opens, since taking it starts the spaces and overviews reads),
  Workspace's `ports/workspace-context`, `@core/shortcuts`, `@core/theme`.
- `@cadenway/ui` (`app-rail`, `command`, `kbd`, `status-icon`, `toast`) and `@cadenway/icons`.

## Invariants

- `CommandPaletteStore` is provided by the palette component and keyed on the workspace's
  organization. A new text cancels the previous search at once, even a request already sent, and
  empties the results; the search runs 250 ms after the last keystroke
  (`switchMap(q => timer(250).pipe(switchMap(() => search(q))))`). An answer applies only to the
  text and the organization it was asked for. A committed organization switch cancels the pending
  request and clears the text and the results. A failure is a flag with an inline `Retry`,
  never an empty answer.
- `CommandPalette` (root) only holds whether the palette is open, through the shared `ShellOverlay`,
  so the palette never opens over the keyboard shortcuts dialog. Ctrl K (⌘ K) opens it through
  `ShortcutsService`, outside fields only, and leaves an open palette open; the brick's own shortcut
  is off. Escape closes it at once, even with a typed text (`clearOnEscape` off, as in the
  mockup), and the field's row ends with the mockup's `Esc` key hint (`fieldEnd`).
- The groups are `Suggestions` (`Create a task`, which closes the palette and opens Task's
  creation dialog; its key hint is N, the shortcut that opens that dialog, where the mockup draws C),
  `Recent tasks`, `Go to`, `Lists`, `Tasks`, `Settings` (`Profile and
security`, `Organization settings` (administrators), `Billing and quotas` (the owner), `Switch
organization`) and `Actions` (one theme action that toggles, named after the theme it
  switches to, then `Sign out`). Local items are filtered by their label; server matches
  always show.
- `Lists` shows the workspace's lists from `LIST_DIRECTORY`, in sidebar order, each with its
  icon in its tone, its name and its space: the first four before anything is typed, then up to
  twenty whose name contains the text (`App.dc.html` line 6935), followed by the server's list
  matches that are not already shown (deduplicated by list id).
- `Go to` has `Home`, `My tasks`, `Dashboards` and `Documents` (`App.dc.html` lines 6921-6924),
  which open `/<slug>`, `/<slug>/my-tasks`, `/<slug>/dashboards` and `/<slug>/docs`.
- `RecentTasks` keeps the last five tasks opened from the palette, per person and organization, in
  `localStorage` (`cadenway-recent-tasks:<userId>:<organizationId>`); Auth's `SignOut` removes them.
  The task page (step 5) will add to it.
- A task opens its detail over the current page (Task's `TaskDetailOpener`, `?task=<key>`, the
  result as the header's preview), and a list `/<slug>/l/<listId>`. Search
  requests carry the workspace organization pin (see Core).

## Copy not taken word for word from the mockup

| Unit                                                                    | Reason                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `search.palette.tasks`                                                  | The mockup lists tasks only as recent tasks.            |
| `search.palette.theme-light`, `search.palette.theme-dark`               | The mockup shows one toggle; each label is its wording. |
| `search.palette.failed`, `search.retry`                                 | The mockup draws no failed search.                      |
| `search.palette.sign-out-failed`, `search.palette.sign-out-failed-text` | The mockup draws no refused sign-out.                   |
| `search.palette.results-*`, `search.palette.loading`                    | Texts of the command brick.                             |
