# Home

## Purpose

The home screen at the root of a workspace (`/:org`) and its « Accueil » rail item. It owns the page
content and that item only; the shell, the workspace context and the slug guards belong to Workspace.

This step is a skeleton: the date line and the greeting (`App.dc.html` lines 1683-1690). The
statistics, the task groups, « Créer une tâche » and the rest of the home screen come in step 6.

## Routes

`HOME_ROUTES` mounts `HomePage` at `''` (`pathMatch: 'full'`) below `/:org`, with the « Accueil »
route title.

## Public entry points

| Entry point   | Consumers |
| ------------- | --------- |
| `home.routes` | workspace |
| `providers`   | workspace |

`providers` publishes `withHomeRailItem()` (`railNavigation`, order 0): a link to `/<slug>` marked
`aria-current="page"`, with the filled house, while the home screen is shown.

## Dependencies

- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the person's first name.

## Invariants

- The greeting is the page's `h1` and its route focus target (`data-route-focus`).
- `?notice=logo-upload-failed`, set by Auth after a creation whose logo could not be uploaded,
  shows a dismissible notice pointing to the organization settings. Its French copy is not in the
  mockup.
- The date follows the application locale (`LOCALE_ID`) and is computed when the page opens.
- A failure of the page renders the router's default error component, `RouteErrorBoundary`.
