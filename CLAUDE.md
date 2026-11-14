# cadenway-webapp: Claude Code instructions

> **Source of truth.** This file is the entry point for Claude Code. The normative rules live in
> [AGENTS.md](AGENTS.md), imported below: read it, do not paraphrase it from memory.

@AGENTS.md

> **Read on demand, deliberately not `@`-imported**: the [frontend architecture](docs/architecture.md), the touched feature's `FEATURE.md`, the mockup screen in `docs/maquette/source/`, the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). Importing them would
> cost context in every session. The path-scoped rules in `.claude/rules/` load automatically when
> you open a matching file and carry the few things that must never be got wrong there.

## TL;DR for every task

1. Read before writing: the feature `FEATURE.md`, the mockup screen (`docs/maquette/source/*.dc.html`) and its guide section.
2. Angular 22: role suffixes in files, no `Component` suffix in classes, `cw-` selectors, `input()`/`output()`/`model()`, `@if`/`@for`, OnPush default, zoneless, Signal Forms, `@Service()`, NgRx SignalStore for state.
3. Visuals come from `@cadenway/ui` with Tailwind over `@cadenway/tokens`; a missing brick is a cadenway-design-system request (`cw-web-ui-consumer`).
4. API access only through `@cadenway/api-client`, only in `data-access/`; DTOs never leave it.
5. French UI copy word for word from the mockup; English everything else.
6. Every screen has its states: skeleton while loading, error panel with Réessayer, empty state.
7. Place features in `src/app/features/` and unit specs beside their subjects. Keep shells in `layouts/` and generic non-visual code in `shared/`.

## Boundaries (hard rules)

- `core` never imports a feature or layout; features import each other only through entries declared in the owner's `FEATURE.md`.
- No `shared/ui`, no local copy of a `@cadenway/ui` brick, no other component library.
- No `HttpClient` to reach the API; no hand-built API URL.
- Signal Forms only: never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`.
- State is NgRx SignalStore (`@ngrx/signals`) only: never the global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`) or a third-party store extension, never `protectedState: false`; a store reaches the API through its feature's `data-access/`.
- `docs/maquette/` is a read-only reference copy of the mockup.

## Target quality gate

Use the [minimum checks by change](docs/development.md#minimum-checks-by-change) first.
Run `/cw-quality` without arguments for the full local gate when applicable. Report unavailable
checks during bootstrap.

```bash
pnpm format:check
pnpm test:lint
pnpm lint
pnpm typecheck
pnpm test:architecture
pnpm test:coverage
pnpm build
```

## Tooling: this repository ships its own `.claude/`

Open `cadenway-webapp/` as the workspace root to activate it. The `cw-web-*` agents, the `/cw-*`
commands, the skills and the hooks are described in [.claude/README.md](.claude/README.md). Two things
the session listing does not tell you:

- **Rules** in `.claude/rules/` load at session start unless they declare `paths`. Scoped rules
  load when Claude reads a matching file.
- **Hooks** cover the edit and shell tool events matched in `.claude/settings.json`.
  `guard.mjs` refuses edits that break a hard rule
  (generated trees, lockfiles, secrets, sibling checkouts, reactive forms, direct HttpClient outside data access, the global NgRx Store or a third-party store extension, `protectedState: false`, a local shared/ui, `export *` barrels and edits of the mockup copy, unpinned third-party actions and `pull_request_target` in workflows), `guard-git.mjs`
  refuses pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses and
  registry publishing, and `format.mjs` formats supported files when its formatter is available.
  Apply the repository rules across tools. Resolve a refusal without bypassing the hook.

The sibling repositories (`../cadenway-design-system`, `../cadenway-api-contracts`, `../cadenway-api-gateway`, `../cadenway-ops`) are read-only references
from here; add them to the session (`--add-dir`) when a task needs to read them.
