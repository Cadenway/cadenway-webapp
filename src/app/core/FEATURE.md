# Core

## Purpose

App-wide infrastructure only: shell, rail, sidebar, Ctrl + K palette, toasts, shortcuts, session, API client setup, realtime and the runtime configuration. It owns no business screen and never imports a feature.

## Routes

None yet.

## Public entry points

- `config/runtime-config.ts`: `RuntimeConfigStore`, the gateway addresses read from `config.json`.

## Dependencies

None yet.

## Invariants

None yet.
