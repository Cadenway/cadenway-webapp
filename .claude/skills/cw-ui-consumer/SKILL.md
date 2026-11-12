---
name: cw-ui-consumer
description: "Which @cadenway/ui brick to use for each mockup pattern, how to import tokens and icons, and how to request a missing brick from cadenway-design-system. Load it before any markup."
---

# Consuming @cadenway/ui

| Mockup pattern | Brick |
| --- | --- |
| Buttons (primary, outline, ghost, icon) | `button[cwButton]`, `button[cwIconButton]` |
| Status split button | `cw-split-button` + `cw-status-icon` |
| Select without native control | `cw-select` |
| Duration with suggestions | `cw-combobox` (estimation) |
| Menu, context menu | `cw-menu`, `[cwContextMenu]` |
| Popover, dialog, confirmation | `cw-popover`, `cw-dialog`, `cw-confirm-dialog` |
| Toast with Annuler | `cw-toast` |
| Tabs, choice chips, switch, checkbox | `cw-tabs`, `cw-choice-chips`, `cw-switch`, `cw-checkbox` |
| Date picker | `cw-date-picker` |
| Avatars, badges, meter | `cw-avatar`, `cw-avatar-stack`, `cw-badge`, `cw-meter` |
| Skeleton, empty state, error panel | `cw-skeleton`, `cw-empty-state`, `cw-error-panel` |
| Block editor, Markdown | `cw-block-editor`, `cw-markdown` |

`styles.css`: `@import "tailwindcss"; @import "@cadenway/tokens/tokens.css"; @import "@cadenway/tokens/theme.css";
@source "../node_modules/@cadenway/ui";`.

**Missing brick**: write the request (name, API in signals, states, keyboard, mockup screen) for
cadenway-design-system's `cw-ds-component-builder`, then wait for the published version.
