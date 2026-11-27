# Trash

## Purpose

The trash (`App.dc.html` lines 1965-1997, logic 8371-8419): the deleted tasks the caller may
restore or erase for good, and the emptying of the trash. It owns that page only; its `Trash` link
and count in the sidebar footer belong to Spaces, the task detail to Task, the shell and its slots
to Workspace.

## Routes

`TRASH_ROUTES` mounts `TrashPage` at `trash` below `/:org`, inside the application shell, with the
`Trash` route title (`trash.route.title`) and `errorComponent: RouteErrorBoundary`. Spaces' sidebar
footer and Errors' `Open the trash` link to it.

## Public entry points

| Entry point    | Consumers |
| -------------- | --------- |
| `trash.routes` | workspace |

## Dependencies

- `@cadenway/api-client` through `data-access/` (`TrashApi`): `TrashService.listTrash` (pages of
  100, 1,000 entries per read and per `Show more`, `cache: 'no-store'`, passive on focus and
  reconnection), `restoreTrashEntry` (with
  `reportNotReady: true`), `purgeTrashEntry`, `emptyTrash`, and `MembersService.listMembers` (to
  the last page) for the names of who deleted each entry.
- `@core/api` (`OrganizationPin`, `OrganizationSwitchPendingError`, `PASSIVE_REQUEST`,
  `hasProblemCode`) and `@core/realtime` (`RealtimeConnection.reconnected`, optional).
- Spaces' `ports/navigation-refresh` (`NAVIGATION_REFRESH`, optional).
- Task's `.` entry: `TaskDetailOpener` (the restore toast's `Open`, and `closed`) and
  `STATUS_LABELS` (the status word read next to the decorative icon).
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`alert-dialog`, `button`, `empty`, `skeleton`, `status-icon`, `toast`) and
  `@cadenway/icons`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- `TrashStore` is page-scoped (component providers). Its primary read follows the pinned
  organization and the organization epoch, which rises on each organization change (A, then B,
  then A again gives three epochs). While the read runs the `h1` stays rendered (the route focus
  target) and the summary, the action and the rows show the mockup's skeleton
  (`Loading the trash`, one group of five rows). A failure renders `RouteErrorBoundary` in place of
  the page (`Could not load this page`, whose `Retry` runs the route again), so the shell stays. A
  successful read without entries shows `The trash is empty`. A failed member read only leaves
  `by <name>` out.
- The first read lists the 1,000 most recently deleted entries; the summary counts the whole trash
  (`total`), and while entries are not listed a notice says so above `Show more`, which reads the
  next 1,000 from the read's cursor. The store's later reads list as deep as what is shown, so a
  background read never takes back what `Show more` listed; a `Show more` that a newer read
  overtook is dropped, since that read is as deep. A failed `Show more` toasts
  `The next items could not be loaded.`.
- Rows show the status icon (with the status word for screen readers), the name, the key, the parent
  key of a subtask, `<list> · Deleted <today|yesterday|N days ago> by <name>` (`Deleted list` for a
  list in the `deleted` state, `Former member` for a person no longer in the directory,
  `An automation` for a rule, nothing for another actor), and the days left (`purgeAt - now`
  rounded up, grenat at five or fewer). Days count from the instant of the read shown. The mockup
  draws no filter. Below 768 px the header and the rows wrap.
- `Restore` runs at once; `Delete forever` confirms in an alert dialog; `Empty the trash` (shown only
  with entries) asks to type `trash`, the translated word. Each dialog belongs to the epoch it
  opened in: an organization change closes it and a confirmation from another epoch does nothing.
  A dialog stays open with its action pending until the write settles. One write per entry at a
  time; `Empty the trash` waits for no write in flight, and rows wait for the emptying.
- A pending button is `aria-busy` and `aria-disabled`, never natively disabled, so it keeps the
  focus; its clicks are ignored. When a row leaves after a write, or after its dialog closes, the
  focus goes to the next row's `Restore`, else the previous row's, else the `h1`; it stays where it
  is when the person had moved it elsewhere.
- Each write is bound to the organization and the epoch where it started, on a live page: when
  either changes or the page is destroyed meanwhile, its answer patches nothing and raises no
  toast. The restore toast's `Open` does nothing in another organization. The page's toasts are
  dismissed on an organization change and when the page is destroyed.
- A write blocked by an organization switch (`OrganizationSwitchPendingError`) never left: it is
  dropped without a read or a toast.
- A write confirmed by a success is never undone by an older read: reads are ranked by start and a
  read never replaces a newer one, entries a successful write took out stay hidden, and reads
  started before a successful emptying show nothing.
- A write without an answer (no status, `408`, `5xx`, a client timeout) is not taken as failed. Its
  entry stays pending (the emptying stays running) while the trash is read again after 2, 4 and 8
  seconds. The first read that no longer lists it gives a neutral `KEY is no longer in the trash`;
  for the emptying, only a read whose `total` is 0 gives `Trash emptied`, since a partial listing
  proves nothing. When no read proves it, `Could not confirm the change` (a warning, never a
  refusal) frees the entry.
- `404 trash-entry.not-found` never hides an entry by itself: the trash is read again and that read
  decides what shows; a restore then toasts `Already restored`, a purge
  `KEY is no longer in the trash`. A restore asks `reportNotReady`, so an entry whose list is still
  being deleted answers `409 trash-entry.not-restorable-yet`: `KEY cannot be restored yet`, and the
  entry stays.
- After a restore (applied, already restored, or confirmed by a read) the page calls
  `NAVIGATION_REFRESH.refresh()`, since a list or a space may come back; after a purge or an
  emptying, `refreshCounts()`. Each successful write is followed by a read of the trash.
- No organization-wide realtime notice exists: the trash is read again on window focus, on realtime
  reconnection and whenever a task detail shown over the page closes (`TaskDetailOpener.closed`).
  The store's own reads run one at a time with at most one more queued, and abort on an
  organization change and on destroy.

## Copy not taken word for word from the mockup

| Unit                                                                                                             | Reason                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `trash.row.former-member`, `trash.row.automation`                                                                | The mockup names every author from its seed; the contract may name a former member or a rule. |
| `trash.row.days-left-title-one`, `trash.toast.emptied-one`                                                       | Singular forms the mockup does not have.                                                      |
| `trash.toast.restore-failed`, `trash.toast.purge-failed`, `trash.toast.empty-failed`, `trash.toast.unconfirmed*` | The mockup draws no failed or unconfirmed write.                                              |
| `trash.toast.gone`                                                                                               | The mockup draws no write whose entry is already gone.                                        |
| `trash.toast.not-ready`, `trash.toast.not-ready-text`                                                            | The mockup draws no restore during a list deletion.                                           |
| `trash.capped`, `trash.show-more`, `trash.toast.more-failed`                                                     | The mockup's trash is never larger than one read.                                             |
| `trash.empty-dialog.word`                                                                                        | The word to type is translated, as the mockup asks for its own word in French.                |
| `trash.toast.already-restored`                                                                                   | Errors' `Already restored` text, as the step 6 spec asks.                                     |
