# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the target design from repository instructions and skills. Its behavior has not been verified as implemented in this snapshot.

## Application boundaries

The app consumes the published API client and UI packages and communicates with the API and realtime gateways. Runtime gateway configuration is planned under `public/config.json`. [The mockup copy](maquette/README.md) is read-only. The conventions below document the target behavior, not working implementation.

## Angular22 Conventions

Source: `cw-angular22-conventions` ([Claude](../.claude/skills/cw-angular22-conventions/SKILL.md), [Codex](../.codex/skills/cw-angular22-conventions/SKILL.md)).

| Element                 | Convention                       | Example                                |
| ----------------------- | -------------------------------- | -------------------------------------- |
| Selector                | `cw-` + kebab-case               | `cw-task-row`                          |
| Class                   | PascalCase, no suffix            | `TaskRow`                              |
| Files                   | kebab-case                       | `task-row.ts`, `task-row.html`         |
| Attribute directive     | `cw` + camelCase                 | `[cwSwap]`                             |
| Inputs, outputs, models | `input()`, `output()`, `model()` | `status = input.required<StatusKey>()` |
| Injectable              | `@Service()`                     | `@Service() export class TaskApi`      |

- Change detection is OnPush by default; zoneless.
- Forms: Signal Forms (`form()`, `[formField]`).
- Async data: `resource()` or the established helper, backed by the generated client (loading → skeleton, error →
  error panel, `reload()` → Réessayer).
- Overlays: CDK Overlay and Angular Aria (`ngMenu`, `ngCombobox`, `ngListbox`, `ngTabs`) through
  `@cadenway/ui`.

## Api Client Data Access

Source: `cw-api-client-data-access` ([Claude](../.claude/skills/cw-api-client-data-access/SKILL.md), [Codex](../.codex/skills/cw-api-client-data-access/SKILL.md)).

```text
<feature>/data-access/
├─ services/<concern>.ts     ← calls @cadenway/api-client, returns display models
└─ adapters/<concept>.ts     ← pure DTO → model functions, unit tested
```

- The client is configured once in `core/api/` (base URL from `config.json`, auth, trace id).
- A service method returns display models, never DTOs.
- The task detail aggregate may be partial (`partial: ['gitLinks']`): show the part that arrived and an
  inline error for the missing one.

## Status Interactions

Source: `cw-status-interactions` ([Claude](../.claude/skills/cw-status-interactions/SKILL.md), [Codex](../.codex/skills/cw-status-interactions/SKILL.md)).

- Status change: icon and label update at once; the row joins its new group 460 ms later when the
  view groups by status.
- Fast clicks: one pending change per task; a new click replaces it; returning to the saved status
  cancels it; automations and the log see only the final status.
- Cancelling asks a reason (Doublon, Ne sera pas fait, Hors périmètre, Obsolète) and an optional note.
- Toasts: 6 s, title, description, Annuler (restores the snapshot) or Ouvrir.
- Deletion: confirmation; trash 30 days with subtasks; sensitive deletions type the name.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
