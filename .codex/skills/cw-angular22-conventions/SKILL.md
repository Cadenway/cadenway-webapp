---
name: cw-angular22-conventions
description: "The Angular 22 conventions this app follows: file and class names without suffix, cw- selectors, signal inputs, outputs and models, control flow, OnPush default, Signal Forms, @Service(), resource APIs. Load it before writing any Angular code."
---

# Angular 22 conventions

| Element | Convention | Example |
| --- | --- | --- |
| Selector | `cw-` + kebab-case | `cw-task-row` |
| Class | PascalCase, no suffix | `TaskRow` |
| Files | kebab-case | `task-row.ts`, `task-row.html` |
| Attribute directive | `cw` + camelCase | `[cwSwap]` |
| Inputs, outputs, models | `input()`, `output()`, `model()` | `status = input.required<StatusKey>()` |
| Injectable | `@Service()` | `@Service() export class TaskApi` |

- Change detection is OnPush by default; zoneless.
- Forms: Signal Forms (`form()`, `[formField]`).
- Async data: `resource()` or the established helper, backed by the generated client (loading → skeleton, error →
  error panel, `reload()` → Réessayer).
- Overlays: CDK Overlay and Angular Aria (`ngMenu`, `ngCombobox`, `ngListbox`, `ngTabs`) through
  `@cadenway/ui`.
