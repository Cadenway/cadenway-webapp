# cadenway-webapp: agent instructions

Apply these instructions in every assistant. Explicit user instructions take precedence over
procedures, within the hard limits below. Follow the rules for the affected paths and load only
the skills relevant to the task.

## First read

- Read the [frontend architecture](docs/architecture.md) and the affected feature's `FEATURE.md`.
- Before UI changes, consult the relevant `docs/maquette/source/*.dc.html` screen or live mockup
  and its integration guide section. Use `cw-angular22-conventions` for Angular code and
  `cw-ui-consumer` for markup. Build a missing generic brick in cadenway-design-system, then bump the
  exact `@cadenway/ui` version here; feature-specific wrappers (forms, dialogs, sheets) stay in the feature.
- For screens and services that fetch data, apply the data-access rule for the generated client,
  DTO ownership and loading, error with Retry, and empty states.
- For ownership decisions, consult the webapp section of the repositories document.
- Get versions and scripts from `package.json`. Keep version declarations there.

## What this repository is

This Angular application serves the authenticated mockup, using the REST and realtime gateways.
See the [deployment and target structure](docs/architecture.md#purpose-and-target-structure)
and check the checkout for available files and commands.

```text
src/app/
├─ app.component.ts  app.component.html  app.component.spec.ts
├─ app.config.ts     app.routes.ts
├─ core/             # app-wide infrastructure, organized by concern
│  └─ config/
│     ├─ index.ts
│     └─ environment/ # source, validation, models and runtime config store
├─ features/         # auth, workspace, account, organization, spaces, task, intake, home,
│                    # my-tasks, inbox, search, onboarding, goals, docs, dashboards, trash,
│                    # archives and errors
├─ layouts/          # auth-layout, app-shell, settings-shell and their slots
└─ shared/           # generic non-visual helpers, when needed
```

## Language

- Everything written in the repository is **English**: code, comments, docs, agent prompts, rules,
  skills, commit messages, branch names, PR titles and descriptions.
- That includes URL paths and the user-facing copy: English strings with a stable
  `@@feature.area.key` id (`$localize`, `i18n`). No French text anywhere in the sources (code,
  comments, specs, fixtures). English is the default locale; the mockup's French wording, word for
  word, lives only in the French catalog `src/locale/messages.fr.json`, compiled into the French
  build. Each locale is a separate build below its own path segment, `/en/` and `/fr/` (see
  `core/locale` and `deploy/nginx.conf`). Keep copy out of logic.
- Follow the user's language in the conversation only. No emojis.
- Never invent facts about the product, the contracts, the mockup or the tooling: cite the file or
  the document. When something does not exist yet, say so and say which step of the start-up plan
  brings it.

## Architectural ownership

- Business UI belongs to its owner under `features/`. `core` owns app-wide infrastructure (config, API client setup, realtime, theme, shortcuts and locale). `layouts` owns shells and `shared` owns generic non-visual helpers.
- Pages orchestrate under `ui/pages/`; presentational components take inputs and emit outputs. Place unit specs beside their subjects and browser scenarios under `tests/e2e/`.
- Generic visual bricks belong to cadenway-design-system, never here.

## Boundaries (hard rules)

- `core` never imports a feature or a layout. Cross-feature imports use an entry and consumer declared in the owner's `FEATURE.md`.
- No `shared/ui`, no local copy of a `@cadenway/ui` brick, no other component library.
- Only `@cadenway/api-client` reaches the API, through `data-access/`. Keep DTOs there.
  No `HttpClient` to reach the API; no hand-built API URL.
- Signal Forms only: never `ReactiveFormsModule`, `FormBuilder`, `FormGroup`, `FormControl`.
- State is NgRx SignalStore (`@ngrx/signals`) only: never the global Store family (`@ngrx/store`, `@ngrx/effects`, `@ngrx/entity`, `@ngrx/store-devtools`) or a third-party store extension, never `protectedState: false`; a store reaches the API through its feature's `data-access/`.
- `docs/maquette/` is a read-only reference copy of the mockup.

## GitHub files (`.github/`)

Use the `github.md` rule for this checkout's [GitHub homepage](.github/README.md), community
files, templates, owners and workflows. Cadenway has no organization `.github` repository.
Keep complete CI, release and deploy workflows here, without reusable workflows from siblings.
Keep Renovate local without a shared preset. Apply common changes through a PR in each affected
repository.

## Code quality

- Read the affected entry point, its callers, and its relevant tests before editing.
  Preserve the behavior callers rely on unless the task changes it.
- Keep the diff focused. Use names that express intent and reuse existing code when
  it preserves the required behavior. Extract code when it clarifies a responsibility.
- Keep business decisions with their owning module. Validate external inputs at the
  boundary and use documented public interfaces across modules and repositories.
- For writes that can fail, overlap, or be retried, verify the resulting state.
  Check transaction boundaries, tenant scope, and repeated delivery where relevant.
- For collections and repeated work, check what grows with input size. Measure or
  inspect the bottleneck before adding an index, cache, worker, or replica.
- Run the repository checks that cover the affected behavior. Report the commands
  and their results, including checks that did not run and tests that selected zero cases.

## Commands and quality gates

Use the repository scripts and start with the [minimum checks by change](docs/development.md#minimum-checks-by-change).
The [full local quality gate](docs/development.md#full-local-quality-gate) defines the ordered
suite and the focused test procedure for both assistants.

## Git and branch flow

Use the `git-and-commits.md` rule for work off `main`, branch names and Conventional
Commits. Validate a branch name with `git check-ref-format --branch <name>`. Target `main` with
reviewed PRs and squash-merge after green CI. release-please opens the release PR. CI publishes
the image and the deploy workflow writes its version into cadenway-ops. Stage only task files
and preserve existing changes.

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

Use the [Codex](.codex/README.md) and [Claude Code](.claude/README.md) guides for rules,
skills, hooks and the [specialist inventory](.claude/README.md#agents). Builders have
assigned write scopes and reviewers are read-only. Specialists are optional. When delegating,
assign disjoint files and explicit checks, then integrate the results yourself.

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
