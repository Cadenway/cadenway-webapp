---
paths:
  - 'src/app/**/*.ts'
  - 'src/**/*.css'
---

# Motion

- Menus open in 300 ms (`--ease-snap`), options stagger (420 ms, `--ease-spring`), a changing label
  slides in 280 ms, a moved row joins its group 460 ms after the click.
- Use the classes of `@cadenway/tokens` and `animate.enter` / `animate.leave`.
- Everything stops under `prefers-reduced-motion: reduce`; an animation never delays the data change.
