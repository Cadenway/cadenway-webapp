# Errors

## Purpose

Renders the typed route errors of `@shared/route-errors` for every feature through the route
`errorComponent`. Each feature decides when to throw them. The feature also owns the fallback for
unknown workspace routes.

## Routes

The application mounts the fallback after its known routes. The page keeps the unknown address in
the browser until a verified member chooses to return to `/accueil`.

## Public entry points

| Entry point     | Consumers |
| --------------- | --------- |
| `errors.routes` | app       |

## Dependencies

- The Auth feature's organization guard verifies workspace access.
- Published `@cadenway/ui` and `@cadenway/icons` render the fallback.

## Invariants

- A caller who needs a session or an organization follows Auth's access redirect.
- The page renders the same content for every unknown address and makes no resource lookup.
