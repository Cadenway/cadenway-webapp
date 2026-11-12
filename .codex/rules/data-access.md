---
paths:
  - 'src/app/**/data-access/**'
  - 'src/app/core/api/**'
---

# Data access

- Only `@cadenway/api-client` reaches the API; never `HttpClient` or a hand-built URL.
- DTOs stay in `data-access/`; pure adapters map them to display models in `models/`.
- Loading and errors are explicit (`resource()` or the established helper, backed by the generated client): pages show
  the route skeleton, then the error panel with "Réessayer".
