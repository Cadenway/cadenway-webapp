# Core

## Purpose

App-wide infrastructure organized by concern. Runtime configuration lives in
`config/environment/` with its source, validator, model and state. The generated API client is
configured in `api/client/`. The shell belongs to
`layouts/`, and session workflows belong to their owning feature. Realtime connections live in
`realtime/` and are provided by the workspace route.

## Public entry points

| Entry point       | Responsibility                                               |
| ----------------- | ------------------------------------------------------------ |
| `@core/config`    | The root `RuntimeConfigStore` and the `RuntimeConfig` model. |
| `@core/api`       | Transport, `OrganizationPin`, and validated problem readers. |
| `@core/realtime`  | Workspace-scoped connection, rooms, presence, and notices.   |
| `@core/theme`     | Theme preference and document synchronization.               |
| `@core/shortcuts` | Scoped keyboard shortcut registration.                       |
| `@core/routing`   | Route title, focus and the reserved first segments (slugs).  |

## Dependencies

The root transport provides Angular HTTP to the generated `@cadenway/api-client` services.

## Invariants

- The application initializer loads the mounted `config.json` once through the concern's private
  source service. The store fails an early read explicitly and retains the configuration across
  session and organization changes.
- The API transport resolves generated relative paths against the configured gateway origin and
  uses the browser's session cookie there.
- `OrganizationPin` attaches the expected organization to supported gateway operations and reports
  `organization.context-changed`; the guard may explicitly read the actual session organization
  without the pin to recover.
- Realtime uses one lazy connection per workspace, fresh tickets on reconnect and ref-counted rooms.
  The gateway envelope does not identify the delivering room, so validated deduplicated changes are
  broadcast to every watch; consumers filter or refetch. A future contract should include the room.
- The resolved theme is reflected in `data-theme` on the document element.
- After a path change, focus moves to the innermost route focus target or `main` without scrolling;
  initial and query-only navigation leave focus alone.
- Shortcuts ignore editable targets unless allowed, repeated and composing events; single-key
  shortcuts can be disabled in memory. Registrations end with their owning scope.
