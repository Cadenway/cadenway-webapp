---
name: wp-overlay-placement
description: "The placement, sizing and dismissal rules of every menu, popover and dialog in Waypoint, from the mockup and the guide. Load it before any overlay work."
---

# Overlay placement

- Measure the visible zone (viewport reduced by the dialog and scrolling panels); open on the side
  with room (up or down), shift horizontally to stay inside, cap the height at the room left (96 px
  minimum) and scroll inside.
- Width follows content with a minimum and `max-w-sm` (384 px); check on the right of the selected
  option; options one line each.
- Open animation: `menu-bloom` 300 ms from the trigger corner (`menu-from-tl/tr/bl/br`).
- Dismissal: outside click, Escape (closes the innermost first), focus back to the trigger.
