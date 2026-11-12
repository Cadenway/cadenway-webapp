# cadenway-webapp: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of cadenway-webapp: **22 agents**,
23 slash commands, 16 rules, 21 skills, 3 hooks, the project
settings and launch configuration. The application launch requires the planned package scripts.

Start from [AGENTS.md](../AGENTS.md) (the rules every assistant follows) and [CLAUDE.md](../CLAUDE.md)
(the Claude entry point).

## Settings (`settings.json`)

- **Hooks** are wired through `${CLAUDE_PROJECT_DIR}` so they resolve from any working directory:
  `guard.mjs` before every `Write` / `Edit` / `MultiEdit`, `guard-git.mjs` before every `Bash` /
  `PowerShell` command, and `format.mjs` after matching edit events for supported files.
  Apply the repository rules across tools.
- **Permissions** allow specific repository commands and read-only Git commands. The project
  denies `Read` on `.env` and `.env.*`. Follow the repository secret-handling rules across tools.
  The project does not pre-approve `git push`, `gh` writes or arbitrary shell commands.
- **Fast mode is off** (`fastMode: false` and `CLAUDE_CODE_DISABLE_FAST_MODE=1`). Agent models and
  efforts are explicit in each agent's frontmatter; do not silently substitute a model.
- **MCP**: `enabledMcpjsonServers` enables `angular`, `playwright`, `context7` from the root `.mcp.json`.
- **No plugins** are enabled (`enabledPlugins: {}`). The folder is itself a plugin
  (`.claude-plugin/plugin.json`, `hooks/hooks.json`) for installations outside this checkout.

## Working with the sibling repositories

Start from this checkout and attach the peers you need, for example:

```powershell
claude --add-dir ../cadenway-design-system ../cadenway-api-contracts ../cadenway-api-gateway
```

Their `.claude/agents/` are discovered too, so their `cw-*` roles become available. Peer checkouts
are **read-only** from a cadenway-webapp session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `cw-web-feature-builder` | Feature ownership, routes, public API, FEATURE.md. | opus | high | Assigned writes |
| `cw-web-component-builder` | Pages and presentational components from @cadenway/ui. | sonnet | high | Assigned writes |
| `cw-web-form-builder` | Signal Forms, validation and messages. | sonnet | high | Assigned writes |
| `cw-web-overlay-builder` | Menus, popovers, dialogs, context menus, confirmations. | sonnet | high | Assigned writes |
| `cw-web-collection-builder` | List, board, calendar, Gantt, workload and sheet views. | opus | high | Assigned writes |
| `cw-web-service-builder` | Data access over @cadenway/api-client. | sonnet | high | Assigned writes |
| `cw-web-state-builder` | NgRx SignalStore state, optimistic updates, fast-click handling. | opus | high | Assigned writes |
| `cw-web-realtime-builder` | WebSocket client and pushed changes. | sonnet | high | Assigned writes |
| `cw-web-routing-builder` | Routes, guards, lazy loading, error pages. | opus | high | Assigned writes |
| `cw-web-ui-consumer` | Compose from @cadenway/ui; relay missing bricks. | sonnet | high | Assigned writes |
| `cw-web-test-writer` | Component, state and service tests. | sonnet | high | Assigned writes |
| `cw-web-e2e-runner` | Playwright scenarios of the mockup flows. | sonnet | high | Assigned writes |
| `cw-web-design-reviewer` | Visual fidelity to the mockup. | sonnet | high | Read-only |
| `cw-web-a11y-auditor` | Roles, labels, focus, keyboard. | sonnet | high | Read-only |
| `cw-web-architecture-reviewer` | Feature boundaries, imports, data access. | opus | xhigh | Read-only |
| `cw-web-state-reviewer` | NgRx SignalStore state and its specs. | opus | high | Read-only |
| `cw-web-security-auditor` | Session, tokens, HTML, redirects. | opus | xhigh | Read-only |
| `cw-web-performance-reviewer` | Bundle, lazy loading, rendering cost. | sonnet | high | Read-only |
| `cw-web-api-contract-reviewer` | Data access against the contracts. | opus | high | Read-only |
| `cw-web-motion-reviewer` | Animation timings and reduced motion. | sonnet | medium | Read-only |
| `cw-web-copy-reviewer` | French copy against the mockup. | sonnet | medium | Read-only |
| `cw-web-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/cw-feature` | Create or reshape a feature and its FEATURE.md. | `cw-web-feature-builder` |
| `/cw-component` | Build a page or a presentational component. | `cw-web-component-builder` |
| `/cw-form` | Build a Signal Form. | `cw-web-form-builder` |
| `/cw-overlay` | Build a menu, popover, dialog or confirmation. | `cw-web-overlay-builder` |
| `/cw-view` | Build a space view (list, board, calendar, Gantt…). | `cw-web-collection-builder` |
| `/cw-service` | Build data access over @cadenway/api-client. | `cw-web-service-builder` |
| `/cw-state` | Build feature state with NgRx SignalStore. | `cw-web-state-builder` |
| `/cw-realtime` | Connect pushed changes from the realtime gateway. | `cw-web-realtime-builder` |
| `/cw-route` | Change routes, guards or error pages. | `cw-web-routing-builder` |
| `/cw-ui` | Compose from @cadenway/ui or request a missing brick. | `cw-web-ui-consumer` |
| `/cw-test` | Write unit or component tests. | `cw-web-test-writer` |
| `/cw-e2e` | Write or run a Playwright scenario. | `cw-web-e2e-runner` |
| `/cw-design-review` | Compare a screen with the mockup. | `cw-web-design-reviewer` |
| `/cw-a11y` | Audit accessibility. | `cw-web-a11y-auditor` |
| `/cw-arch-review` | Review boundaries of the current change. | `cw-web-architecture-reviewer` |
| `/cw-state-review` | Review NgRx SignalStore state of the current change. | `cw-web-state-reviewer` |
| `/cw-security-review` | Audit frontend security. | `cw-web-security-auditor` |
| `/cw-perf-review` | Review performance. | `cw-web-performance-reviewer` |
| `/cw-contract-review` | Check data access against the contracts. | `cw-web-api-contract-reviewer` |
| `/cw-motion-review` | Review animations. | `cw-web-motion-reviewer` |
| `/cw-copy-review` | Check French copy against the mockup. | `cw-web-copy-reviewer` |
| `/cw-github` | Change workflows, templates or community files in .github/. | `cw-web-github-maintainer` |
| `/cw-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

## Rules

| File | Subject | Loads for |
| --- | --- | --- |
| `components.md` | Angular components | `src/app/**/*.ts`, `src/app/**/*.html` |
| `forms.md` | Forms | `src/app/**/*form*`, `src/app/**/forms/**`, `src/app/**/*.validator.ts` |
| `overlays.md` | Overlays | `src/app/**/*menu*`, `src/app/**/*dialog*`, `src/app/**/*popover*`, `src/app/**/*overlay*` |
| `collections.md` | Space views | `src/app/spaces/views/**` |
| `data-access.md` | Data access | `src/app/**/data-access/**`, `src/app/core/api/**` |
| `state.md` | State (NgRx SignalStore) | `src/app/**/state/**`, `src/app/**/*-store.ts`, `src/app/**/*-store.spec.ts` |
| `routing.md` | Routing | `src/app/**/*.routes.ts`, `src/app/**/guards/**` |
| `styles-and-tokens.md` | Styles and tokens | `src/**/*.css`, `src/app/**/*.html` |
| `motion.md` | Motion | `src/app/**/*.ts`, `src/**/*.css` |
| `testing.md` | Tests | `src/**/*.spec.ts` |
| `e2e.md` | End-to-end tests | `e2e/**` |
| `feature-docs.md` | FEATURE.md | `src/app/**/FEATURE.md` |
| `language.md` | Language | always |
| `git-and-commits.md` | Git and commits | always |
| `comments.md` | Comments and docblocks | `src/**/*.ts`, `src/**/*.html` |
| `github.md` | GitHub files | `.github/**` |

## Skills

See [skills/](skills/) for the complete inventory, including the technology guides.

| Skill | Use |
| --- | --- |
| `cw-context` | What Cadenway is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `cw-mockup` | Where the mockup lives (docs/maquette/source and the live artifact), what each artboard covers, how to read a .dc.html file and its properties, and which guide section maps each screen to Angular components. |
| `cw-angular22-conventions` | The Angular 22 conventions this app follows: file and class names without suffix, cw- selectors, signal inputs, outputs and models, control flow, OnPush default, Signal Forms, @Service(), resource APIs. |
| `cw-ui-consumer` | Which @cadenway/ui brick to use for each mockup pattern, how to import tokens and icons, and how to request a missing brick from cadenway-design-system. |
| `cw-api-client-data-access` | How a feature reaches the API: generated client, data-access services, pure adapters to display models, loading and error states, partial aggregates. |
| `cw-signal-forms` | How to build a Cadenway form with Signal Forms: model signal, schema rules, field binding, messages from the mockup, submit and focus behavior. |
| `cw-overlay-placement` | The placement, sizing and dismissal rules of every menu, popover and dialog in Cadenway, from the mockup and the guide. |
| `cw-status-interactions` | The mockup rules for status changes, fast clicks, toasts with undo, confirmations and the cancel-reason dialog. |
| `cw-web-testing` | How to test Cadenway web components, state and services with Vitest and Angular testing utilities, with mockup fixtures. |
| `cw-e2e-playwright` | How to run Cadenway end-to-end scenarios locally against the Docker Compose stack, with evidence. |
| `cw-feature-md` | The canonical sections of a feature FEATURE.md and the changes that make updating it mandatory. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, reactive forms, direct HttpClient outside data access, the global NgRx Store or a third-party store extension, `protectedState: false`, a local shared/ui, `export *` barrels and edits of the mockup copy, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
