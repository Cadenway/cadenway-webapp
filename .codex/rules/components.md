---
paths:
  - 'src/app/**/*.ts'
  - 'src/app/**/*.html'
---

# Angular components

- **No `Component` suffix**: `TaskRow`, file `task-row.ts`, selector `cw-task-row`. Pages end in `Page`
  and live under `ui/pages/<name>-page/`.
- Signal APIs only: `input()`, `input.required()`, `output()`, `model()`; control flow `@if`, `@for`
  (with `track`), `@switch`; `@defer` for heavy parts. No `standalone: true` (default), no
  `ChangeDetectionStrategy` boilerplate (OnPush is the default in Angular 22).
- Members carry an access modifier and `readonly`: `public` for inputs and outputs, `protected` for
  what the template reads, `private` for injected collaborators (`inject()`).
- Outputs are past-tense or nouns: `opened`, `statusChanged`, never `onOpen`.
- Only pages inject state or services; presentational components take inputs and emit outputs.
- A page reads its SignalStore's signals and calls its methods; it provides a page-scoped store in
  its `providers` unless the route does. Never `patchState` on a store, never a `_` store member.
- Visual bricks come from `@cadenway/ui`; icons through `<ng-icon name="phosphor…Bold" />` registered by
  `provideCadenwayIcons()`.
- Brand logos (svgl) and country flags (flag-icons) are allowed next to Phosphor, through the same
  `<ng-icon>` and the sets `@cadenway/icons` ships. No other icon set, no inline SVG copy of a logo.
- French copy word for word from the mockup.
