# Search

## Purpose

The command palette (Ctrl + K): search across lists and tasks, recent tasks, navigation and
actions. It owns the palette overlay and its triggers: the rail's « Rechercher » item and the
sidebar's « Rechercher… » button. Search inside a single list belongs to Spaces.

## Routes

None.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| `providers` | workspace |

`providers` publishes `withSearchRailItem()` (`railFooter`, order 0), `withSearchButton()`
(`sidebarHeader`, order 10) and `withCommandPalette()` (`overlays`, order 0).

## Dependencies

- `@cadenway/api-client`: `SearchService.search` through `data-access/`.
- Auth's `.` entry (`SignOut`), Workspace's `ports/workspace-context`, `@core/shortcuts`,
  `@core/theme`.
- `@cadenway/ui` (`app-rail`, `command`, `kbd`, `status-icon`, `toast`) and `@cadenway/icons`.

## Invariants

- `CommandPaletteStore` is provided by the palette component and keyed on the workspace's
  organization. A new text cancels the previous search at once, even a request already sent, and
  empties the results; the search runs 250 ms after the last keystroke
  (`switchMap(q => timer(250).pipe(switchMap(() => search(q))))`). An answer applies only to the
  text and the organization it was asked for. A committed organization switch cancels the pending
  request and clears the text and the results. A failure is a flag with an inline « Réessayer »,
  never an empty answer.
- `CommandPalette` (root) only holds whether the palette is open, through the shared `ShellOverlay`,
  so the palette never opens over the keyboard shortcuts dialog. Ctrl K (⌘ K) toggles it through
  `ShortcutsService`, in fields too, and the brick's own shortcut is off.
- The groups are « Tâches récentes », « Aller à », « Listes », « Tâches », « Réglages » (« Profil et
  sécurité », « Paramètres de l’organisation », « Facturation et quotas », « Changer
  d’organisation ») and « Actions » (one theme action that toggles, named after the theme it
  switches to, then « Se déconnecter »). Local items are filtered by their label; server matches
  always show.
- « Aller à » has « Accueil » only: every later step adds the entry of the page it builds.
- `RecentTasks` keeps the last five tasks opened from the palette, per person and organization, in
  `localStorage` (`cadenway-recent-tasks:<userId>:<organizationId>`); Auth's `SignOut` removes them.
  The task page (step 5) will add to it.
- A task opens `/<slug>/t/<key>` and a list `/<slug>/l/<listId>`; both render the 404 until steps
  5 and 4a. The search operation does not declare `If-Organization-Match` (see Workspace).

## Copy not taken word for word from the mockup

| Unit                                                                                                                                                                   | Reason                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `search.palette.tasks`                                                                                                                                                 | The mockup lists tasks only as recent tasks; this heading groups the server's task matches. |
| `search.palette.failed`, `search.retry`                                                                                                                                | The mockup draws no failed search.                                                          |
| `search.palette.sign-out-failed`, `search.palette.sign-out-failed-text`                                                                                                | The mockup draws no refused sign-out.                                                       |
| `search.palette.results`, `search.palette.results-none`, `search.palette.results-one`, `search.palette.results-many`, `search.palette.loading`, `search.palette.close` | Texts of the command brick, taken from its French defaults.                                 |

## Copy not taken word for word from the mockup

| Unit                                                                         | Reason                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `search.palette.tasks`                                                       | The mockup lists tasks only as recent tasks.            |
| `search.palette.theme-light`, `search.palette.theme-dark`                    | The mockup shows one toggle; each label is its wording. |
| `search.palette.failed`, `search.retry`                                      | The mockup draws no failed search.                      |
| `search.palette.sign-out-failed`, `search.palette.sign-out-failed-text`      | The mockup draws no refused sign-out.                   |
| `search.palette.results-*`, `search.palette.loading`, `search.palette.close` | Texts of the command brick.                             |
