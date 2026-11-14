# Core

## Purpose

App-wide infrastructure organized by concern. Runtime configuration lives in
`config/environment/` with its source, validator, model and state. The shell belongs to
`layouts/`, and session workflows belong to their owning feature.

## Public entry points

| Entry point    | Responsibility                                               |
| -------------- | ------------------------------------------------------------ |
| `@core/config` | The root `RuntimeConfigStore` and the `RuntimeConfig` model. |

## Dependencies

None yet.

## Invariants

- The application initializer loads the mounted `config.json` once through the concern's private
  source service. The store fails an early read explicitly and retains the configuration across
  session and organization changes.
