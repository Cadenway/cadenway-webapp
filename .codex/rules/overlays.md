---
paths:
  - 'src/app/**/*menu*'
  - 'src/app/**/*dialog*'
  - 'src/app/**/*popover*'
  - 'src/app/**/*overlay*'
---

# Overlays

- Use `@waypoint/ui` overlays (CDK overlay underneath): they open on the side with room, shift
  horizontally to stay visible and cap their height (96 px minimum) with scrolling.
- Width follows the content (`max-w-sm`); the selected option carries a check on the right.
- Close on outside click and Escape; one menu at a time; focus returns to the trigger.
- Hover is `bg-muted` without border; the active choice is violet (`primary`).
- Deletions confirm through `wp-confirm-dialog`; sensitive ones require typing the name.
