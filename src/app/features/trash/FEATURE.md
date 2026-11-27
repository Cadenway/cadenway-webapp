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

- `@cadenway/api-client` through `data-access/` (`TrashApi`): `TrashService.listTrash` (to the last
  cursor page, `cache: 'no-store'`, passive on focus and reconnection), `restoreTrashEntry`,
  `purgeTrashEntry`, `emptyTrash`, and `MembersService.listMembers` (to the last page) for the
  names of who deleted each entry.
- `@core/api` (`OrganizationPin`, `PASSIVE_REQUEST`, `hasProblemCode`) and `@core/realtime`
  (`RealtimeConnection.reconnected`, optional).
- Spaces' `ports/navigation-refresh` (`NAVIGATION_REFRESH`, optional).
- Task's `.` entry: `TaskDetailOpener` (the restore toast's `Open`, and `closed`) and
  `STATUS_LABELS` (the status word read next to the decorative icon).
- Errors' `.` entry (`RouteErrorBoundary`) for the route's `errorComponent`.
- `@cadenway/ui` (`alert-dialog`, `button`, `empty`, `skeleton`, `status-icon`, `toast`) and
  `@cadenway/icons`.

## Invariants

- The page's `h1` is its route focus target (`data-route-focus`).
- `TrashStore` is page-scoped (component providers). Its primary read follows the pinned
  organization; while it runs the page shows the mockup's skeleton (`Loading the trash`, one group of
  five rows). A failure renders `RouteErrorBoundary` in place of the page (`Could not load this
page`, whose `Retry` runs the route again), so the shell stays. A successful read without entries
  shows `The trash is empty`. A failed member read only leaves `by <name>` out.
- Rows show the status icon (with the status word for screen readers), the name, the key, the parent
  key of a subtask, `<list> · Deleted <today|yesterday|N days ago> by <name>` (`Deleted list` for a
  list in the `deleted` state, `Former member` for a person no longer in the directory, `An
automation` for a rule, nothing for another actor), and the days left (`purgeAt - now` rounded up,
  grenat at five or fewer). Days count from the instant of the read shown. The mockup draws no
  filter. Below 768 px the header and the rows wrap.
- `Restore` runs at once; `Delete forever` confirms in an alert dialog; `Empty the trash` (shown only
  with entries) asks to type `trash`, the translated word. A dialog stays open with its action
  pending until the write settles. One write per entry at a time; `Empty the trash` waits for no
  write in flight, and rows wait for the emptying.
- Each write is bound to the organization where it started: when the organization changes
  meanwhile, its answer patches nothing and raises no toast.
- A confirmed restore, purge or emptying is never undone by an older read: reads are ranked by start
  and a read never replaces a newer one, entries a write took out stay hidden, and reads started
  before a confirmed emptying show nothing.
- A write without an answer (no status, `408`, `5xx`, a client timeout) is not taken as failed: the
  trash is read again and the entry's presence decides (`restored` or `erased`, or the refusal
  toast). When that read fails too, `Could not confirm the change` says so and the entry stays.
- `404 trash-entry.not-found` on a restore toasts `Already restored`; on a purge, `KEY is no longer
in the trash`. Both hide the entry and read the trash again.
- After a restore (applied or already restored) the page calls `NAVIGATION_REFRESH.refresh()`, since
  a list or a space may come back; after a purge or an emptying, `refreshCounts()`. Each write is
  followed by a background read of the trash.
- No organization-wide realtime notice exists: the trash is read again on window focus, on realtime
  reconnection and when a task detail opened from the page closes.

## Copy not taken word for word from the mockup

| Unit                                                                                                             | Reason                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `trash.row.former-member`, `trash.row.automation`                                                                | The mockup names every author from its seed; the contract may name a former member or a rule. |
| `trash.row.days-left-title-one`, `trash.toast.emptied-one`                                                       | Singular forms the mockup does not have.                                                      |
| `trash.toast.restore-failed`, `trash.toast.purge-failed`, `trash.toast.empty-failed`, `trash.toast.unconfirmed*` | The mockup draws no failed or unconfirmed write.                                              |
| `trash.toast.gone`                                                                                               | The mockup draws no purge of an entry already gone.                                           |
| `trash.empty-dialog.word`                                                                                        | The word to type is translated, as the mockup asks for its own word in French.                |
| `trash.toast.already-restored`                                                                                   | Errors' `Already restored` text, as the step 6 spec asks.                                     |
