---
paths:
  - 'src/app/**/*menu*'
  - 'src/app/**/*dialog*'
  - 'src/app/**/*popover*'
  - 'src/app/**/*overlay*'
---

# Overlays

- Use `@cadenway/ui` overlays over CDK. Follow `cw-overlay-placement` for sizing, placement,
  selection and dismissal, including focus return. Open one menu at a time.
- Hover is `bg-muted` without border; the active choice is violet (`primary`).
- Deletions confirm through `cw-confirm-dialog`; sensitive ones require typing the name.
