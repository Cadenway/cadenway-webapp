# Core

## Purpose

App-wide infrastructure organized by concern. Runtime configuration lives in
`config/environment/` with its source, validator, model and state. The generated API client is
configured in `api/client/`. The shell belongs to
`layouts/`, and session workflows belong to their owning feature.

## Public entry points

| Entry point    | Responsibility                                               |
| -------------- | ------------------------------------------------------------ |
| `@core/config` | The root `RuntimeConfigStore` and the `RuntimeConfig` model. |
| `@core/api`    | The transport interceptor used by the root providers.        |
| `@core/locale` | `provideAppLocale()`: `LOCALE_ID` from the translated build. |

## Dependencies

The root transport provides Angular HTTP to the generated `@cadenway/api-client` services.

## Invariants

- The application initializer loads the mounted `config.json` once through the concern's private
  source service. The store fails an early read explicitly and retains the configuration across
  session and organization changes.
- The API transport resolves generated relative paths against the configured gateway origin and
  uses the browser's session cookie there.
- `LOCALE_ID` follows `$localize.locale`: French in the served build, English in the source build.
