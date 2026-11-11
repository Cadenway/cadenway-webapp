---
name: wp-api-client-data-access
description: "How a feature reaches the API: generated client, data-access services, pure adapters to display models, loading and error states, partial aggregates. Load it before any data access."
---

# Data access with @waypoint/api-client

```text
<feature>/data-access/
├─ services/<concern>.ts     ← calls @waypoint/api-client, returns display models
└─ adapters/<concept>.ts     ← pure DTO → model functions, unit tested
```

- The client is configured once in `core/api/` (base URL from `config.json`, auth, trace id).
- A service method returns display models, never DTOs.
- The task detail aggregate may be partial (`partial: ['gitLinks']`): show the part that arrived and an
  inline error for the missing one.
