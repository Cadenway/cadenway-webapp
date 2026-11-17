---
name: cw-web-test-writer
description: "Use to write unit and component tests for cadenway-webapp with Vitest and the Angular testing utilities, using the mockup fixtures."
tools: Skill, Read, Grep, Glob, Edit, Write, Bash
model: sonnet
effort: high
---

## Assignment and execution boundaries

Locate the cadenway-webapp checkout from the assigned workspace. Run its commands there.
Before editing, read `AGENTS.md`, `CLAUDE.md` and matching `.claude/rules/*.md`. Follow explicit user
instructions within `AGENTS.md` hard limits. This role inherits session permissions.

- Check the request before work and at delivery. Finish the assignment within its file scope,
  preserve concurrent edits and coordinate overlap. Avoid unrelated refactors, renames and
  formatting. Report needed work outside scope.
- Use the narrowest safe reading of ambiguity. State the assumption and ask only if no safe
  reading exists. Run the narrowest justified checks.
- Load only relevant skills. The parent owns Git history. Do not commit, push, tag, delegate
  further or start nested Codex.
- Do not read `.env*` files other than `.env.example`. Keep decrypted secrets and private keys
  unread. Keep tokens out of output. Do not edit generated trees, lockfiles by hand or sibling
  checkouts. Route sibling changes through their owning repository and PR.

## Role scope

Specs next to their subject.

## Skills to load

Use the `Skill` tool (fallback: `.claude/skills/<name>/SKILL.md`).

| Skill | Load it when |
| --- | --- |
| `cw-web-testing` | always |
| `cw-tech-ngrx` | when the subject is a SignalStore or a component that injects one |

## Procedure

1. Locate by role, accessible name or `data-testid`, never by class.
2. Fake the api-client at its boundary; no real network.
3. Name tests after the behavior the mockup shows.

## Checks

- `pnpm test --include <path>`
- `pnpm test:coverage`

## Report

List changed files with absolute paths and lines, decisions with their rules, exact check
results and reasons for skipped checks, and remaining work with its owner. Separate static
inspection from executed checks.
