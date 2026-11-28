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
| `@core/routing`   | Route title, focus, reserved first segments (slugs) and shareable addresses.           |
| `@core/locale`    | Locale of the build and the switch to another locale build.                            |
| `@core/ui-labels` | The English texts of the `@cadenway/ui` bricks.                                        |

## Dependencies

The root transport provides Angular HTTP to the generated `@cadenway/api-client` services.

## Invariants

- The application initializer loads `/config.json`, mounted at the site root beside the locale
  builds, once through the concern's private source service. The store fails an early read explicitly and retains the configuration across
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
- The locale is the build's: each locale is a separate application compiled by `pnpm build` and
  served below its own segment (`/en/`, `/fr/`, its `<base href>`), which sets `$localize.locale`,
  read by Angular's default `LOCALE_ID`, its locale data and `<html lang>`. `main.ts` prepares
  nothing. `LocaleService` reads the locale and `use()` switches it: it writes the first-party
  `cw_locale` cookie (`Path=/; Max-Age=31536000; SameSite=Lax`, `Secure` over HTTPS, the locale code
  only), which the web server reads for an address without a segment, then opens the same page
  below the other segment with a full navigation, query and fragment kept. The account preference
  calls it once a language is saved.
- `AppLinkService.absolute()` builds every address given to copy or share (task, list, document,
  public form) from a router path through the location strategy's `prepareExternalUrl`, so it
  carries the base href, the current locale segment, on the page origin. No code writes a locale
  segment by hand.
- `isUnknownWriteOutcome` calls a failed write uncertain when it may still have been applied (no
  answer, an unreadable `2xx`, `408`, `5xx`, `409 idempotency.request-in-progress`); `isDroppedOrganizationWrite` calls
  it dropped when the pin blocked it during a switch or the gateway answered
  `412 organization.context-changed`. Features never report either as a definite failure.
- `provideCadenwayUiLabels()` gives English texts, with `@@core.ui-labels.*` ids, to the
  `@cadenway/ui` bricks every area renders and no feature names (key names, the close buttons of
  alerts, banners and sheets, the sidebar defaults, the spinner, the split button menu, the
  priority words); their built-in texts are French. The `/:org` route provides it from its own
  concern, `@core/ui-labels`, because its brick entry points would add about 330 kB to the shell
  bundle from the root providers. A feature's own labels
  provider below it still wins.
- The resolved theme is reflected in `data-theme` on the document element.
- After a path change, focus moves to the innermost route focus target or `main` without scrolling;
  initial and query-only navigation leave focus alone. While an `aria-modal` window holds the focus
  (one kept open across the navigation, or one still closing), the move waits until no modal window
  is left, then runs after the window restored its focus.
- Shortcuts ignore editable targets unless allowed, repeated and composing events; single-key
  shortcuts can be disabled in memory. Registrations end with their owning scope.
