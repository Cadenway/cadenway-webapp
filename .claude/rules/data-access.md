---
paths:
  - 'src/app/**/data-access/**'
  - 'src/app/core/api/**'
---

# Data access

- Follow the API boundary in `AGENTS.md`. Pure adapters map DTOs to display models in `models/`.
- Represent loading, a successful result and a failed request explicitly with `resource()` or the
  established helper, backed by the generated client. Reserve the empty state for a successful
  response with no items. Pages show the route skeleton during initial loading.
- A page's primary read that fails (its resource loader rejects) is caught by the route's error
  boundary: `errorComponent` replaces the page content with the typed state, which is not found,
  access denied (with an access request), deleted task (with Restore) or unavailable (with Retry,
  `errors.unavailable.retry`, which runs the route again). A secondary or partial read (a shell widget,
  a popover, `TaskDetail.partial`) keeps an inline error whose Retry calls its `reload()`. Guards and
  resolvers never reach the boundary: they redirect with a `UrlTree` or a `RedirectCommand`.
- For a task list, the feature's service calls the generated list operation and maps its
  DTOs to display models. Retry repeats that operation with the current list filters.
