# Docs

## Purpose

The organization's documents (`App.dc.html` lines 1894-1963): the catalog, a document's reader and
editor, and the `Documents` rail item (`docs.rail.label`). It owns those pages and that item only;
the space names and rights belong to Spaces, the shell and its slots to Workspace.

This step is a foundation: the routes, the rail item and pages that render a title only (`Documents`,
`docs.header.title`; `Document`, `docs.document.title-fallback`). The catalog, the reader and the
editor come with its step 6 page package.

## Routes

`DOCS_ROUTES` mounts, below `/:org` inside the application shell, each with
`errorComponent: RouteErrorBoundary`:

- `docs`: `DocsPage`, the catalog, with the `Documents` route title (`docs.route.title`). `?q=`
  searches it.
- `d/:docId`: `DocumentPage`, the shareable address of a document. Its route title is the fallback
  `Document` (`docs.route.document`) until the page package titles it with the document's title.
  `?mode=edit` opens it in edit mode.

## Public entry points

| Entry point   | Consumers |
| ------------- | --------- |
| `docs.routes` | workspace |
| `providers`   | workspace |

`providers` publishes `withDocsRailItem()` (`railNavigation`, order 60, the last application
before the favorite spaces): a link to `/<slug>/docs` with the file, filled and marked
`aria-current="page"` while the catalog (exactly `/<slug>/docs`) or a document (`/<slug>/d/<id>`)
is shown, whatever the query parameters.

## Dependencies

- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the slug of the link.
- Errors' `.` entry (`RouteErrorBoundary`) for the routes' `errorComponent`.
- `@cadenway/ui` (`app-rail`).

## Invariants

- Each page's `h1` is its route focus target (`data-route-focus`).
- The rail item reads the router's `isActive` signals instead of `RouterLinkActive`, which removes
  `aria-current` whenever its own link is inactive, as on a document.
- A failure of a page's primary read renders `RouteErrorBoundary` in place of the page, so the
  shell stays.

## Copy not taken word for word from the mockup

| Unit                                                  | Reason                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `docs.route.document`, `docs.document.title-fallback` | The mockup titles a document with its own title, which this step does not read. |
