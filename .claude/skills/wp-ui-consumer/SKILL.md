---
name: wp-ui-consumer
description: "Which @waypoint/ui brick to use for each mockup pattern, how to import tokens and icons, and how to request a missing brick from waypoint-design-system. Load it before any markup."
---

# Consuming @waypoint/ui

| Mockup pattern | Brick |
| --- | --- |
| Buttons (primary, outline, ghost, icon) | `button[wpButton]`, `button[wpIconButton]` |
| Status split button | `wp-split-button` + `wp-status-icon` |
| Select without native control | `wp-select` |
| Duration with suggestions | `wp-combobox` (estimation) |
| Menu, context menu | `wp-menu`, `[wpContextMenu]` |
| Popover, dialog, confirmation | `wp-popover`, `wp-dialog`, `wp-confirm-dialog` |
| Toast with Annuler | `wp-toast` |
| Tabs, choice chips, switch, checkbox | `wp-tabs`, `wp-choice-chips`, `wp-switch`, `wp-checkbox` |
| Date picker | `wp-date-picker` |
| Avatars, badges, meter | `wp-avatar`, `wp-avatar-stack`, `wp-badge`, `wp-meter` |
| Skeleton, empty state, error panel | `wp-skeleton`, `wp-empty-state`, `wp-error-panel` |
| Block editor, Markdown | `wp-block-editor`, `wp-markdown` |

`styles.css`: `@import "tailwindcss"; @import "@waypoint/tokens/tokens.css"; @import "@waypoint/tokens/theme.css";
@source "../node_modules/@waypoint/ui";`.

**Missing brick**: write the request (name, API in signals, states, keyboard, mockup screen) for
waypoint-design-system's `wp-ds-component-builder`, then wait for the published version.
