# Batch outcomes

**Reading guide:** [Architecture](../../../../docs/architecture.md) · [Data access rule](../../../../.claude/rules/data-access.md).

The non-visual check that a batch answer covers what was sent. An invitation batch answers one
result per distinct address; an address the answer leaves out, or gives two different outcomes,
proves nothing about that address, so it must not be counted as sent or skipped.

## Model

- `matchBatchOutcomes(sent, entries)`: matches the per-address results (`BatchEntry`, an address
  and an outcome) to the addresses sent, without regard to case. It returns `BatchOutcomes`:
  `settled`, each address sent with its one outcome, in the order sent and spelled as sent, and
  `unknown`, the addresses sent with no result or conflicting results. A repeated identical
  result counts once; results for addresses not sent are ignored.

## Usage

```ts
const { settled, unknown } = matchBatchOutcomes(emails, dto.invitations);
```

Adapters call it at the data-access boundary, with the generated DTO's entries, which match
`BatchEntry` structurally: the helper never imports a DTO.

## Public entry

| Entry point              | Consumers                                                                |
| ------------------------ | ------------------------------------------------------------------------ |
| `@shared/batch-outcomes` | The invitation adapters of Organization and Onboarding (`inviteMembers`) |

## Rules

It is non-visual and pure: it never imports `@cadenway/ui`, `@cadenway/api-client`, a feature or a
layout.
