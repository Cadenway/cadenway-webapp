# Core

## Purpose

App-wide infrastructure organized by concern. Runtime configuration lives in
`config/environment/` with its source, validator, model and state. The generated API client is
configured in `api/client/`. The shell belongs to
`layouts/`, and session workflows belong to their owning feature. Realtime connections live in
`realtime/` and are provided by the workspace route.

## Public entry points

| Entry point       | Responsibility                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- |
| `@core/config`    | The root `RuntimeConfigStore` and the `RuntimeConfig` model.                           |
| `@core/api`       | Transport, `OrganizationPin`, validated problem readers and write-outcome classifiers. |
| `@core/realtime`  | Workspace-scoped connection, rooms, presence, and notices.                             |
| `@core/theme`     | Theme preference and document synchronization.                                         |
| `@core/shortcuts` | Scoped keyboard shortcut registration.                                                 |
| `@core/routing`   | Route title, focus and the reserved first segments (slugs).                            |
| `@core/locale`    | Locale of the load, chosen and installed before bootstrap.                             |

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
  without the pin to recover. The operation list follows the installed public contracts and a drift
  spec checks it in both directions. Member avatars and organization logos rendered via an `img`,
  and CSV exports fetched via a direct download link, bypass HttpClient and remain unpinned. The
  current account avatar uses initials; the list CSV export uses the generated client and is pinned
  before its content is saved through an object URL.
- A context mismatch from the current pin revision marks the pin stale, fencing passive pinned
  requests until verification. Mismatches from an older verified revision are ignored. Recovery runs
  only while the document is visible and focused, immediately or after a running navigation ends;
  otherwise it waits for focus or visibility. Failed recovery retries with bounded backoff. A rejected
  realtime ticket waits for a verified commit before reconnecting.
- Pinned cross-origin GETs are not CORS-simple: each distinct URL requires a preflight, including
  search-as-you-type and cursor pages. The gateway caches preflight results for 600 seconds. Deploy a
  gateway release including `cadenway-api-gateway#57` before shipping this image.
- Realtime uses one lazy connection per workspace, fresh tickets on reconnect and ref-counted rooms.
  The route-scoped connection survives an in-place slug change and reconnects for the new organization.
  The gateway envelope does not identify the delivering room, so validated deduplicated changes are
  broadcast to every watch; consumers filter or refetch. A future contract should include the room.
- Presence starts unknown until the paginated snapshot returns the saved preference. An
  unacknowledged choice in this tab takes precedence and is retried after reconnection. The
  snapshot reconciles concurrent notices, and an absent member is offline. Whether guests should see presence remains a product
  question; the gateway currently sends both snapshots and notices to them.
- Socket acknowledgement types are local: generated `@cadenway/contracts` 0.42.0
  `events/realtime-gateway.ts` describes producer facts, not socket acknowledgements.
- Personal `notification.created.v1` and `reminder.due.v1` notices are validated and deduplicated
  by their envelope ID. They are invalidations, not replayed data; consumers refetch after reconnect.
  Delivery requires `REALTIME_PERSONAL_NOTICES_ENABLED` on the gateway.
- The locale is chosen before bootstrap by `loadLocale`, which `main.ts` awaits before it imports the
  application modules, since `$localize` translates a message when its module evaluates.
  `?lang=fr` or `?lang=en` selects it and is remembered on the device (`cadenway-locale`, inaccessible
  storage ignored); otherwise the remembered choice applies, else English, the source copy, which
  loads nothing. French fetches `/messages.fr.json` (copied from `src/locale/messages.fr.json`)
  and its Angular locale data, then calls `loadTranslations()`; a failed load starts in English and
  is logged. `$localize.locale`, read by Angular's default `LOCALE_ID`, and `<html lang>` name the
  active locale. `LocaleService` reads it and switches by reloading the page with `?lang=`; no
  screen offers the switch yet.
- `isUnknownWriteOutcome` calls a failed write uncertain when it may still have been applied (no
  answer, `408`, `5xx`, `409 idempotency.request-in-progress`); `isDroppedOrganizationWrite` calls
  it dropped when the pin blocked it during a switch or the gateway answered
  `412 organization.context-changed`. Features never report either as a definite failure.
- The resolved theme is reflected in `data-theme` on the document element.
- After a path change, focus moves to the innermost route focus target or `main` without scrolling;
  initial and query-only navigation leave focus alone.
- Shortcuts ignore editable targets unless allowed, repeated and composing events; single-key
  shortcuts can be disabled in memory. Registrations end with their owning scope.
