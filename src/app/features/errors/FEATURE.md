# Errors

## Purpose

Renders the typed route errors of `@shared/route-errors` for every feature through the router's
error boundary, and owns the 404 of unknown addresses. Each feature decides when to throw a typed
error from its page's primary read; guards and resolvers redirect instead.

## Routes

`ERRORS_ROUTES` mounts `**` with the not-found state and the « Page introuvable » title. The
application mounts it after its known routes, and Workspace mounts it again below `/:org`, where it
renders inside the shell. The page keeps the unknown address in the browser.

## Public entry points

| Entry point     | Consumers      |
| --------------- | -------------- |
| `errors.routes` | app, workspace |
| `.`             | app            |

`.` publishes `RouteErrorPage`, the `defaultErrorComponent` of `withErrorBoundaries` in
`app.config.ts`. A route that needs its own `errorComponent` uses the same page. The architecture
test grants `index.ts` an exception to the `page-boundary` rule for this re-export, because the
router takes the component type at bootstrap.

## Dependencies

- `@cadenway/api-client`: `AccessRequestsService.createAccessRequest` and
  `TrashService.restoreTrashEntry`, through `ErrorRecovery`.
- Workspace's `ports/workspace-context`, optional, for the trash link of the current workspace.
- `@core/api` problem readers, `@cadenway/ui` and `@cadenway/icons`.

## Invariants

- The boundary passes what the page threw; a resource read in its error state throws an error
  whose `cause` is the loader's rejection, so the page follows the `cause` chain to the typed error.
- States: not found (« Retour à l’accueil » to `/home`), access denied (optional message to the
  owner, « Demander l’accès », then « Demande envoyée »), deleted task (« Restaurer la tâche », then
  the route runs again; « Déjà restaurée » for a `trash-entry.not-found`; « Ouvrir la corbeille » to
  `/<slug>/trash`), and unavailable for any other failure (« Impossible de charger cette page »,
  `Erreur <status> · réf. <requestId>` when known, « Réessayer »).
- Retry runs the route again with a same-URL navigation and `onSameUrlNavigation: 'reload'`: the
  router re-creates a page whose outlet shows its error component, and re-runs the guards and
  resolvers its `runGuardsAndResolvers` allows. `errors.routes.spec.ts` covers it.
- « État des services » shows only when a status page URL is configured; none exists yet.
- `ErrorRecoveryStore` is page-scoped (component providers), so each failure starts over. A failed
  access request or restore returns to its idle state; its failure message waits for the shell's
  toaster.
- The failure is reported to Angular's `ErrorHandler` by the boundary's `onError`.
