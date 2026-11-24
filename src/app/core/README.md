# Core

## Purpose

App-wide infrastructure organized by concern. Runtime configuration lives in
`config/environment/` with its source, validator, model and state. The generated API client is
configured in `api/client/`. The shell belongs to
`layouts/`, and session workflows belong to their owning feature. The realtime client is rebuilt
in step 3; the earlier task-room adapter was removed with the screens that used it.

## Public entry points

| Entry point       | Responsibility                                               |
| ----------------- | ------------------------------------------------------------ |
| `@core/config`    | The root `RuntimeConfigStore` and the `RuntimeConfig` model. |
| `@core/api`       | Transport interceptor and validated HTTP problem readers.    |
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
- The resolved theme is reflected in `data-theme` on the document element.
- After a path change, focus moves to the innermost route focus target or `main` without scrolling;
  initial and query-only navigation leave focus alone.
- Shortcuts ignore editable targets unless allowed, repeated and composing events; single-key
  shortcuts can be disabled in memory. Registrations end with their owning scope.
