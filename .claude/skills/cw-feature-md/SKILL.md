---
name: cw-feature-md
description: "The canonical sections of a feature FEATURE.md and the changes that make updating it mandatory. Load it when a route, a public entry, a dependency or an invariant changes."
---

# FEATURE.md

```markdown
# <Feature>
## Purpose
## Routes
## Public entry points
## Dependencies
## Invariants
```

- List each SignalStore of the feature with its providing scope (component, route or root) under
  Public entry points when another feature may inject it, otherwise under Invariants.
- Update FEATURE.md when a store is added, removed, exposed or changes scope, and when the feature
  starts using the NgRx Events plugin.
