---
paths:
  - 'src/app/**/*.routes.ts'
  - 'src/app/**/guards/**'
---

# Routing

- `app.routes.ts`: prefixes, redirects and lazy feature entries only.
- One route tree per `*.routes.ts`; parameters reach pages as signal inputs.
- Error pages: 404, deleted task (with Restaurer), access denied (with a request form).
