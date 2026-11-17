---
paths:
  - 'src/app/**/data-access/**'
  - 'src/app/core/api/**'
---

# Data access

- Follow the API boundary in `AGENTS.md`. Pure adapters map DTOs to display models in `models/`.
- Represent loading, a successful result and a failed request explicitly with `resource()` or the
  established helper, backed by the generated client. Reserve the empty state for a successful
  response with no items. Pages show the route skeleton during initial loading and the error panel
  with `Réessayer` on failure.
- For a task list, the feature's service calls the generated list operation and maps its
  DTOs to display models. A failed request produces a state the page can render as an error.
  Selecting `Réessayer` repeats that operation with the current list filters.
