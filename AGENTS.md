# cadenway-webapp: agent instructions

These instructions are mandatory for every AI assistant working in this repository, whatever the
vendor. [CLAUDE.md](CLAUDE.md) imports them for Claude Code. Explicit user instructions take
precedence over procedures, never over the hard limits below.

This file states the **rules**. See the tooling guides for [Claude Code](.claude/README.md)
and [Codex](.codex/README.md) for agents, skills, commands and hooks.

## First read

- The [frontend architecture](docs/architecture.md) and the `FEATURE.md` of the feature you touch.
- The mockup screen you implement (`docs/maquette/source/*.dc.html`, or the live mockup) and its section in the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et).
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "cadenway-webapp".
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## What this repository is

The structure and workflows below describe the bootstrap target. Check the checkout for available files and commands.

cadenway-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, NgRx SignalStore, `@cadenway/ui`, `@cadenway/api-client`. It talks only to `cadenway-api-gateway` (REST) and `cadenway-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads the gateway addresses from `public/config.json` at start-up.

```text
src/app/
├─ app.component.ts  app.component.html  app.component.spec.ts
├─ app.config.ts     app.routes.ts
├─ core/             # app-wide infrastructure, organized by concern
│  └─ config/
│     ├─ index.ts
│     └─ environment/ # source, validation, models and runtime config store
├─ features/         # auth, account, organization, spaces, task, home, my-tasks,
│                    # goals, docs, dashboards, trash and archives
├─ layouts/          # application shells and their slots, when implemented
└─ shared/           # generic non-visual helpers, when needed
```

## Language

- Everything written in the repository is **English**: code, comments, docs, agent prompts, rules,
  skills, commit messages, branch names, PR titles and descriptions.
- User-facing copy is **French**, word for word from the mockup; keep it out of logic so a later
  `@angular/localize` extraction is mechanical.
- Follow the user's language in the conversation only. No emojis.
- Never invent facts about the product, the contracts, the mockup or the tooling: cite the file or
  the document. When something does not exist yet, say so and say which step of the start-up plan
  brings it.

## Architectural ownership

- Business UI belongs to its owner under `features/`. `core` owns app-wide infrastructure (config, API client setup, realtime, theme and shortcuts). `layouts` owns shells and `shared` owns generic non-visual helpers.
- Pages orchestrate under `ui/pages/`; presentational components take inputs and emit outputs. Place unit specs beside their subjects and browser scenarios under `tests/e2e/`.
- Generic visual bricks belong to cadenway-design-system, never here.

## Boundaries (hard rules)

- `core` never imports a feature or a layout. Cross-feature imports use an entry and consumer declared in the owner's `FEATURE.md`.
- No `shared/ui`, no local copy of a `@cadenway/ui` brick, no other component library.
- No `HttpClient` to reach the API; no hand-built API URL.
- Signal Forms only: never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`.
- State is NgRx SignalStore (`@ngrx/signals`) only: never the global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`) or a third-party store extension, never `protectedState: false`; a store reaches the API through its feature's `data-access/`.
- `docs/maquette/` is a read-only reference copy of the mockup.

## GitHub files (`.github/`)

This repository carries everything GitHub reads from it; Cadenway has no organization `.github`
repository and nothing is inherited.

- [`.github/README.md`](.github/README.md) is the repository home page; `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/` and
  `CODEOWNERS` sit next to it.
- `.github/workflows/` holds this repository's complete CI, release and deploy workflows: no reusable
  workflow from another repository. The Renovate configuration is complete here too, with no shared
  preset.
- The parts shared with the other repositories are duplicated on purpose; a change to them is repeated
  in each repository through its own pull request.

## Commands and quality gates

The scripts below are this repository's contract. While the repository is being bootstrapped,
create them with these exact names; afterwards, use them and never an ad-hoc equivalent. Run the
narrowest check that covers the change first, then widen:

| Changed                         | Minimum check                                                              |
| ------------------------------- | -------------------------------------------------------------------------- |
| Components, templates           | `pnpm test --include <area>`, `pnpm lint`, `pnpm build` (strict templates) |
| State, services                 | `pnpm test --include <area>`, then `pnpm test:coverage`                    |
| Routes, guards                  | `pnpm build`                                                               |
| Browser flows                   | `pnpm e2e <spec>`                                                          |
| Copy                            | `cw-web-copy-reviewer` against the mockup                                  |
| Docs or agent instructions only | Scoped formatting and link review                                          |

Report the commands you actually ran and their results; a check you did not run is reported as not
run.

## Git and branch flow

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Cadenway task id first when there is one (`feat/cad-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags, publishes the image and lets the deploy workflow write the version into cadenway-ops.
- Stage only the files of your task; preserve other people's changes in the working tree.

## Hard limits (never without the user's explicit request in this conversation)

- Never push to `main`, merge into it locally, create or push Git tags, or bump a version by hand.
- Never run a registry publish (`npm publish`, `pnpm publish`): this repository ships as a Docker image built by CI.
- Never force-push, and never amend or rebase commits that are already pushed.
- Never bypass the Git hooks (`--no-verify`, `core.hooksPath` overrides, `ALLOW_MAIN_PUSH=1`,
  `CW_SKIP_PUSH_CHECKS=1`).
- Never write a token, password or private key anywhere; `.npmrc` keeps `${NODE_AUTH_TOKEN}`. Do
  not read or write secret environment files; new variables are documented in `.env.example`.
- Never edit generated trees (`dist/`, `node_modules/`, `coverage/`) or lockfiles by hand.
- Never modify a sibling checkout (`../cadenway-*`) from a task in this repository.

The agent hooks enforce most of these mechanically; a refused command is a signal to stop and ask,
not to find another way around it.

## Agent tooling

- **Claude Code**: [CLAUDE.md](CLAUDE.md) and [.claude/README.md](.claude/README.md): the
  `cw-web-*` agents, the `/cw-*` commands (`/cw-quality` runs the whole local gate),
  path-scoped rules and hooks.
- **Codex**: [.codex/README.md](.codex/README.md) covers the specialists, `$cw-*` skills, rules and hooks.
- **Builders** (assigned writes): `cw-web-feature-builder`, `cw-web-component-builder`, `cw-web-form-builder`, `cw-web-overlay-builder`, `cw-web-collection-builder`, `cw-web-service-builder`, `cw-web-state-builder`, `cw-web-realtime-builder`, `cw-web-routing-builder`, `cw-web-ui-consumer`, `cw-web-test-writer`, `cw-web-e2e-runner`, `cw-web-github-maintainer`.
- **Reviewers** (read-only): `cw-web-design-reviewer`, `cw-web-a11y-auditor`, `cw-web-architecture-reviewer`, `cw-web-state-reviewer`, `cw-web-security-auditor`, `cw-web-performance-reviewer`, `cw-web-api-contract-reviewer`, `cw-web-motion-reviewer`, `cw-web-copy-reviewer`.
- Specialists are available, not mandatory. Delegate a bounded responsibility with explicit files and
  checks, assign disjoint files to parallel agents and integrate their results yourself.

## Repository hygiene

- Reuse existing commands, tools and test infrastructure before adding files.
- Prefer inline commands or a task-specific temporary directory for one-off diagnostics; clean up
  disposable files before delivery.
- Keep a permanent script only when it provides a reusable capability that existing tooling cannot.
- Add permanent tests for meaningful behavior or regressions, in the existing test structure.
- Before delivery, inspect untracked files and remove only the disposable artifacts of the current
  task. Report every new permanent tooling file and why it needs to stay.
- Report material failures, skipped checks and limitations, including non-blocking ones. Ask for
  user input only when a missing decision or authorization blocks the dependent work.

## References

- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et) and
  [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) (living documents).
