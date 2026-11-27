# Docs

## Purpose

The organization's documents (`App.dc.html` lines 1894-1963): the catalog, a document's reader and
editor, and the `Documents` rail item (`docs.rail.label`). It owns those pages and that item only;
the space names and rights belong to Spaces, the shell and its slots to Workspace.

- **Catalog** (`DocsPage`, lines 1895-1924): the header and its subtitle, the search (full width
  below 640 px), `New document` (only when the caller may edit a space), and the table `Title`,
  `Space`, `Author`, `Modified` (`DocumentTable`), which keeps 640 px and scrolls sideways inside its
  card on a narrower screen. A row opens its document; its context menu (lines 7362-7372) offers
  `Open`, `Copy the link`, and where the caller may edit `Edit` and `Delete`.
- **Document** (`DocumentPage`, lines 1925-1959, `max-w-3xl`): read mode with `Copy the document
link`, `Delete` and `Edit`, the title, `<space> · Modified <when> by <author>` and the body
  (`cw-markdown`); edit mode with the title field, `<space> · editing in progress`, the block
  editor and its toolbar (`cw-block-editor`, `variant="document"`), `Add a block at the end`,
  `Cancel` and `Done`.

## Routes

`DOCS_ROUTES` mounts, below `/:org` inside the application shell, a pathless route that provides
the English texts of the bricks the pages render (block editor, alert dialog, avatar, Markdown),
and two children, each with `errorComponent: RouteErrorBoundary`:

- `docs`: `DocsPage`, the catalog, with the `Documents` route title (`docs.route.title`). `?q=`
  searches it: the field writes it after a 300 ms pause (replacing the history entry).
- `d/:docId`: `DocumentPage`, the shareable address of a document, with `canDeactivate:
[unsavedChangesGuard]`. Its route title is the fallback `Document` (`docs.route.document`); the
  page then titles the browser tab `<title> — Cadenway` after each navigation. `?mode=edit` opens
  it in edit mode when the caller may edit it (the catalog's `Edit` and `New document`).

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

- `@cadenway/api-client` through `data-access/services/documents-api` (`DocumentsApi`):
  `DocumentsService` (`listDocuments`, `createDocument` with `Idempotency-Key`, `getDocument`,
  `updateDocument` and `deleteDocument` with `If-Match`) and `MembersService.listMembers` (the
  authors' names, every page). The catalog reads at most 5 pages of 100, the 500 most recently
  saved documents of a search.
- Workspace's `ports/workspace-context` (`WORKSPACE_CONTEXT`) for the organization of the reads and
  writes and the slug of the addresses.
- Spaces' `ports/space-directory` (`SPACE_DIRECTORY`, optional) for the space names, the caller's
  rights and the space of `New document`.
- Errors' `.` entry (`RouteErrorBoundary`) for the routes' `errorComponent`.
- `@shared/route-errors` (`NotFoundRouteError`, `UnavailableRouteError`) and
  `@shared/unsaved-changes` (`unsavedChangesGuard`, `warnBeforeUnload`).
- `@cadenway/ui` (`app-rail`, `alert-dialog`, `avatar`, `block-editor`, `button`, `context-menu`,
  `empty`, `input-group`, `markdown`, `menu`, `skeleton`, `toast`).

## Invariants

- Each page's `h1` is its route focus target (`data-route-focus`); in edit mode the title field is.
- Stores, both provided by their page (component scope): `DocsStore` (the catalog, its search,
  `New document` and its deletions) and `DocumentStore` (the document, its rights, its save and its
  deletion). They share `withDocumentDeletion()` (`state/document-deletion`).
- A page's primary read (`listDocuments`, `getDocument`) that fails renders `RouteErrorBoundary` in
  place of the page, so the shell stays: `404 document.not-found` and a malformed id are the not
  found page, anything else is unavailable with `Retry`. The member directory is a secondary read:
  its failure leaves the names `—`. While another search is read, the catalog keeps its last rows.
- No realtime notice reaches documents (gap G-C4): the catalog is read again when the window
  regains focus, and the document too while it is not edited and no write is under way. A failed
  background read keeps what is shown.
- Rights (gap G-C2): the caller may edit and delete a document when its role on the document's
  space (`SPACE_DIRECTORY.callerRole`) is `edit`; otherwise `Edit`, `Delete` and `?mode=edit` are
  absent. The gateway may still refuse (`403`), which a toast reports.
- `New document` (gap G-C3) creates `Untitled` in the first space the caller may edit and opens it
  in edit mode with an empty title field (a never edited `Untitled` document at version 1). The
  mockup's "current space" is not available to this page: the last space shown in the tab is held
  by Spaces' navigation store, which no port publishes yet.
- Every write is bound to the organization shown when it starts (and, on the document page, to the
  document): once either changes or the page goes away it sends nothing more and ends without a
  toast. An unknown outcome (no answer, a timeout, a `5xx`) is never reported as a failure: a
  creation is sent once more with the same idempotency key, which replays it; a save or a deletion
  reads the document again to learn what happened.
- Saving (`Done`) sends the title (trimmed, at most 200 characters, `Untitled` when empty) and the
  body from the version shown (`If-Match`). A stale version (`412`) reads the document again,
  keeps the draft over the newer version (which the next `Done` replaces) and says so. The draft
  lives in the page's Signal Forms model; every outcome but `saved` keeps edit mode and the draft.
- Leaving the document while the draft differs from the stored document or a save is under way
  asks `Leave without saving?` (`unsavedChangesGuard`); the browser asks before closing the tab.
- Deleting asks the alert dialog of line 9191 from both pages and offers no `Undo` (gap G-C1): no
  operation restores a document. A document already gone counts as deleted; a stale version keeps
  it and reads again.
- Read mode renders the body through `cw-markdown`: its links open in a new tab and its checkboxes
  are not clickable (gap G-C5: no brick toggles them in read mode). `Add a block at the end` gives
  focus to the editor, which cannot place the caret at the end.
- The rail item reads the router's `isActive` signals instead of `RouterLinkActive`, which removes
  `aria-current` on each of its updates (every navigation, query-only ones included) unless
  `ariaCurrentWhenActive` is set, while the brick writes the attribute only when `current` changes.

## Copy not taken word for word from the mockup

| Unit                                                    | Reason                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs.route.document`                                   | The route's fallback title until the document is read.                       |
| `docs.document.empty-read-only`                         | The mockup's empty line asks to choose `Edit`, which a reader does not have. |
| `docs.document.meta-no-author`                          | The mockup always knows the author.                                          |
| `docs.date.*`                                           | The mockup writes the dates as fixed strings (`Hier, 17:20`, `4 nov.`).      |
| `docs.discard.*`                                        | The mockup draws no unsaved-changes confirmation.                            |
| `docs.delete.cancel`                                    | The mockup's confirmation draws its `Cancel` without a dedicated text.       |
| `docs.toast.*` but `saved`, `deleted`, `link-copied`    | The mockup draws no refused, conflicting, uncertain or gone write.           |
| `docs.editor.*` but the mockup's words, `docs.labels.*` | Texts of the bricks, their defaults.                                         |
