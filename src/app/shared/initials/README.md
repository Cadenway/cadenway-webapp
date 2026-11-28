# Initials

**Reading guide:** [Architecture](../../../../docs/architecture.md).

The one rule that turns a name into the mark shown in place of a picture, so the rail, the
settings navigation, the General logo tile and the organization choice never disagree
(`Atelier Nord Est` is `AE` everywhere).

## Model

- `initialsOf(name)`: the first letters of the first and last words, or the first two letters of a
  single word, upper-cased; an empty string for a blank name. The mockup's names (`Atelier Nord`,
  `Studio Pivot`, `Coopérative Lumen` in `App.dc.html` and `Organisations.dc.html`) all give the
  drawn `AN`, `SP` and `CL`.

## Public entry

| Entry point        | Consumers                                                                      |
| ------------------ | ------------------------------------------------------------------------------ |
| `@shared/initials` | Workspace's context adapter, Organization's adapter, Auth's organization pages |

## Rules

It is non-visual: it never imports `@cadenway/ui`, a feature or a layout.
