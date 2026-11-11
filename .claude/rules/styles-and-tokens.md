---
paths:
  - 'src/**/*.css'
  - 'src/app/**/*.html'
---

# Styles and tokens

- Tailwind utilities over the `@waypoint/tokens` theme; literal class strings only (a computed class
  produces no CSS).
- Theme through `data-theme="light|dark"` on `<html>`; semantic tokens (`bg-background`, `text-foreground`,
  `bg-muted`, `text-muted-foreground`, `border-border`, `primary`, `destructive`) make dark mode work.
- `styles.css` holds imports, the `@source` towards `@waypoint/ui` and document-level rules only.
- The primary action is `bg-foreground text-background`; amethyst is never a full background.
