---
name: cw-ui-consumer
description: "Which @cadenway/ui brick to use for each mockup pattern, how to import tokens, icons and brick labels, and how to add a missing brick to cadenway-design-system. Load it before any markup."
---

# Consuming @cadenway/ui

Import each brick from its entry point, `@cadenway/ui/components/<brick>`; the root entry exports nothing.

| Mockup pattern | Brick |
| --- | --- |
| Buttons (primary, outline, ghost, icon) | `button[cwButton]` with `variant`, `size` (`icon-xs`, `icon-sm`, `icon` for icon-only, plus an `aria-label`) |
| Welded buttons | `cw-button-group` + `cwButton` |
| Status split button | `cw-split-button` (`label`, `tooltip`, `(triggered)`, `arrow`, `opensMenu`, projected `cw-menu`), wrapped by the task feature's status picker with `cw-status-icon`; the next-status logic stays in the webapp |
| Password strength | `cw-password-strength` + `cw-password-strength-level`; the field's `aria-describedby` is `rulesId` |
| Select without native control | `cw-select` |
| Suggestions, duration, mentions | `cw-combobox` (`multiple`, `creatable`), `input[cwAutocomplete]`; `parseDuration` from `time-tracker` |
| Menu, context menu | `cw-menu`, `[cwMenuTriggerFor]`, `[cwContextMenuTriggerFor]` |
| Popover, dialog, confirmation | `cw-popover`, `cw-dialog` (`size`), `cw-alert-dialog` (`items`, `confirmText` for typed confirmations) |
| Toast with undo | one `cw-toaster` in the shell, `CwToastService` (`undo`, `action`) |
| Tabs, choice chips, switch, checkbox | `cw-tabs`, `cw-toggle-group` or `cw-radio-group` (`variant="card"`), `cw-switch`, `cw-checkbox` |
| Date picker, calendar | `cw-date-picker` (`presets`, `withTime`), `cw-calendar` |
| Avatars, badges, meter | `cw-avatar`, `cw-avatar-group`, `[cwBadge]`, `cw-status-badge`, `cw-meter`, `cw-progress`, `cw-stat` |
| Skeleton, empty state, error panel | `div[cwSkeleton]`, `cw-empty`; an error panel is `cw-empty` with `cw-empty-media tone="destructive"` |
| Block editor, Markdown, comments | `cw-block-editor`, `cw-markdown`, `cw-comment-composer`, `cw-message` |
| Collections | `cw-data-table` (long lists: `virtual` with `[page]="null"` inside a bounded-height container, such as a fixed height or a flex parent with `min-h-0`), `cw-kanban`, `cw-calendar-view`, `cw-timeline`, `table[cwTable]`, `cw-filter-bar` |
| Shell | `nav[cwAppRail]` + `[cwAppRailItem]` (tab bar below 768 px), `cw-sidebar`, `nav[cwBreadcrumb]`, `cw-page-header`, `cw-toolbar`, `[cwTooltip]`, `cw-command-dialog`, `cw-banner`, `cw-logo variant="lockup"` |
| Side or bottom panel | `cw-sheet` (`side`, `size`); `provideCwPhoneSheets()` docks menus, popovers, selects and comboboxes above the tab bar on phones |

`styles.css`: `@import "tailwindcss"; @import "@cadenway/tokens/tokens.css"; @import "@cadenway/tokens/theme.css";
@source "../node_modules/@cadenway/ui";`.

**Brick copy and locale** (`@cadenway/ui` 0.4.0 and later): the application's source copy is English. The bricks'
French defaults are replaced once, in `core/locale`, with each entry point's `provideCw<Entry>Labels()`
written with `$localize` (`provideCwDataTableTexts` for the data table), and dates, numbers and sizes
follow `provideCwLocale(() => inject(LOCALE_ID))` from `@cadenway/ui/core`. Status and priority words
come from `injectCwStatusLabels` and `injectCwPriorityLabels`. Never rely on a brick's built-in default
text.

**Missing generic brick**: build it in `cadenway-design-system` with its `cw-ds-component-builder`
procedure (signal API, states, keyboard, mockup screen, spec, story, changeset). Once the release is
published, bump the exact `@cadenway/ui` version here in a dedicated change. Never copy or fork a brick
locally. A feature may still wrap bricks in its own components: forms, dialogs, sheets.
