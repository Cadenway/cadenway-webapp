# Core

## Purpose

App-wide infrastructure only: shell, rail, sidebar, Ctrl + K palette, toasts, shortcuts, session, API client setup, realtime and the runtime configuration. It owns no business screen and never imports a feature.

## Routes

None yet.

## Public entry points

- `config/runtime-config-store.ts`: `RuntimeConfigStore` (NgRx SignalStore, root), the gateway addresses read from `config.json`; `config()` throws before the application initializer has loaded it.
- `config/runtime-config.ts`: the `RuntimeConfig` type and `parseRuntimeConfig`.

## Dependencies

None yet.

## Invariants

- `RuntimeConfigStore` is loaded once by the application initializer, through
  `config/data-access/runtime-config-source.ts` (`RuntimeConfigSource`, the only reader of
  `config.json`), and is never reset: the gateway addresses do not depend on the user or the
  organization.
