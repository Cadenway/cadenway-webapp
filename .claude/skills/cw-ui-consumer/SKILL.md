---
name: cw-ui-consumer
description: "Which @cadenway/ui brick to use for each mockup pattern, how to import tokens, icons and brick labels, and how to add a missing brick to cadenway-design-system. Load it before any markup."
---

# Consuming @cadenway/ui

Import each brick from its entry point, `@cadenway/ui/components/<entry>`; the root entry exports
nothing. A selector's name does not always give its entry point: use the third column.

| Mockup pattern | Brick | Entry point |
| --- | --- | --- |
| Buttons (primary, outline, ghost, icon) | `button[cwButton]` with `variant` and `size`; an icon-only button uses `icon-xs`, `icon-sm` or `icon` and an `aria-label` | `button` |
| Welded buttons | `cw-button-group` + `cwButton` | `button-group` |
| Status split button | `cw-split-button` (`label`, `tooltip`, `(triggered)`, `arrow`, `opensMenu`, projected `cw-menu`), wrapped by the task feature's status picker with `cw-status-icon`; the next-status logic stays in the webapp | `split-button`, `status-icon` |
| Select without native control | `cw-select` | `select` |
| Suggestions, duration, mentions | `cw-combobox` (`multiple`, `creatable`), `input[cwAutocomplete]`, `parseDuration` | `combobox`, `autocomplete`, `time-tracker` |
| Menu, context menu | `cw-menu`, `[cwMenuTriggerFor]`, `[cwContextMenuTriggerFor]` | `menu`, `context-menu` |
| Popover, dialog, confirmation | `cw-popover`, `cw-dialog` (`size`), `cw-alert-dialog` (`items`, `confirmText` for typed confirmations) | `popover`, `dialog`, `alert-dialog` |
| Side or bottom panel | `cw-sheet` (`side`, `size`); `provideCwPhoneSheets()` docks menus, popovers, selects and comboboxes above the tab bar on phones | `sheet`; `@cadenway/ui/core` |
| Toast with undo | one `cw-toaster` in the shell, `CwToastService` (`undo`, `action`) | `toast` |
| Tabs | `cw-tabs` | `tabs` |
| Choice chips | `cw-radio-group` with `cw-radio-group-item variant="card"`, or `cw-toggle-group` (`default`, `outline`) | `radio-group`, `toggle-group` |
| Switch, checkbox | `cw-switch`, `cw-checkbox` | `switch`, `checkbox` |
| Date picker, calendar | `cw-date-picker` (`presets`, `withTime`), `cw-calendar` | `date-picker`, `calendar` |
| Avatars, badges | `cw-avatar`, `cw-avatar-group`, `[cwBadge]`, `cw-status-badge`, `cw-priority-badge` | `avatar`, `badge` |
| Meters, figures | `cw-meter`, `cw-progress`, `cw-stat` | `meter`, `progress`, `stat` |
| Password strength | `cw-password-strength` + `cw-password-strength-level`; the field's `aria-describedby` is `rulesId` | `password-strength` |
| Skeleton, empty state, error panel | `div[cwSkeleton]`, `cw-empty`; an error panel is `cw-empty` with `cw-empty-media tone="destructive"` | `skeleton`, `empty` |
| Block editor, Markdown, comments | `cw-block-editor`, `cw-markdown`, `cw-comment-composer`, `cw-message` | `block-editor`, `markdown`, `comment-composer`, `message` |
| Collections | `cw-data-table` (long lists: `virtual` with `[page]="null"` inside a bounded-height container, such as a fixed height or a flex parent with `min-h-0`), `cw-kanban`, `cw-calendar-view`, `cw-timeline`, `table[cwTable]`, `cw-filter-bar` | `data-table`, `kanban`, `calendar-view`, `timeline`, `table`, `filter-bar` |
| Shell | `nav[cwAppRail]` + `[cwAppRailItem]` (tab bar below 768 px), `cw-sidebar`, `nav[cwBreadcrumb]`, `cw-page-header`, `cw-toolbar`, `[cwTooltip]`, `cw-banner`, `cw-logo variant="lockup"` | `app-rail`, `sidebar`, `breadcrumb`, `page-header`, `toolbar`, `tooltip`, `banner`, `logo` |
| Command palette | `cw-command-dialog` | `command` |

`styles.css`: `@import "tailwindcss"; @import "@cadenway/tokens/tokens.css"; @import "@cadenway/tokens/theme.css";
@source "../node_modules/@cadenway/ui";`.

**Brick copy and locale** (`@cadenway/ui` 0.4.0 and later): the application's source copy is English.
The bricks' French defaults are replaced by the layout or feature that renders them, with `$localize` texts given to each
entry point's labels provider:
- most entry points: `provideCw<Entry>Labels()`;
- status and priority: `provideCwStatusLabels` and `provideCwPriorityLabels`;
- data table: `provideCwDataTableTexts`;
- message, time tracker and dropzone: several providers each.

Dates, numbers and sizes follow `provideCwLocale(() => inject(LOCALE_ID))` from `@cadenway/ui/core`,
provided by the layout routes so that core chunk stays out of the initial bundle. Status and priority
words come from `injectCwStatusLabels` and `injectCwPriorityLabels`. Never rely on a brick's built-in
default text.

**Missing generic brick**: build it in `cadenway-design-system` with its `cw-ds-component-builder`
procedure (signal API, states, keyboard, mockup screen, spec, story, changeset). Once the release is
published, bump the exact `@cadenway/ui` version here in a dedicated change. Never copy or fork a brick
locally. A feature may still wrap bricks in its own components: forms, dialogs, sheets.
