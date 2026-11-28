---
paths:
  - 'src/**/*.css'
  - 'src/app/**/*.html'
---

# Styles and tokens

- Tailwind utilities over the `@cadenway/tokens` theme; literal class strings only (a computed class
  produces no CSS).
- Theme through `data-theme="light|dark"` on `<html>`; semantic tokens (`bg-background`, `text-foreground`,
  `bg-muted`, `text-muted-foreground`, `border-border`, `primary`, `destructive`) make dark mode work.
- `styles.css` holds imports, the `@source` towards `@cadenway/ui` and document-level rules only.
  Its first statement, `@layer ng-icon, theme, base, components, utilities;`, keeps ng-icon's color rule
  below the utilities, so `text-*` colors an `<ng-icon>`.
- Size an `<ng-icon>` with its `size` input (`size="1rem"`), never a `size-*` class, which its unlayered host
  style overrides (see `cw-ui-consumer`).
- The primary action is `bg-foreground text-background`; amethyst is never a full background.
