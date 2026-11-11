# waypoint-webapp: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of waypoint-webapp: **21 agents**,
22 slash commands, 16 rules, 20 skills, 3 hooks, the project
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
claude --add-dir ../waypoint-design-system ../waypoint-api-contracts ../waypoint-api-gateway
```

Their `.claude/agents/` are discovered too, so their `wp-*` roles become available. Peer checkouts
are **read-only** from a waypoint-webapp session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `wp-web-feature-builder` | Feature ownership, routes, public API, FEATURE.md. | opus | high | Assigned writes |
| `wp-web-component-builder` | Pages and presentational components from @waypoint/ui. | sonnet | high | Assigned writes |
| `wp-web-form-builder` | Signal Forms, validation and messages. | sonnet | high | Assigned writes |
| `wp-web-overlay-builder` | Menus, popovers, dialogs, context menus, confirmations. | sonnet | high | Assigned writes |
| `wp-web-collection-builder` | List, board, calendar, Gantt, workload and sheet views. | opus | high | Assigned writes |
| `wp-web-service-builder` | Data access over @waypoint/api-client. | sonnet | high | Assigned writes |
| `wp-web-state-builder` | Signal state, optimistic updates, fast-click handling. | opus | high | Assigned writes |
| `wp-web-realtime-builder` | WebSocket client and pushed changes. | sonnet | high | Assigned writes |
| `wp-web-routing-builder` | Routes, guards, lazy loading, error pages. | opus | high | Assigned writes |
| `wp-web-ui-consumer` | Compose from @waypoint/ui; relay missing bricks. | sonnet | high | Assigned writes |
| `wp-web-test-writer` | Component, state and service tests. | sonnet | high | Assigned writes |
| `wp-web-e2e-runner` | Playwright scenarios of the mockup flows. | sonnet | high | Assigned writes |
| `wp-web-design-reviewer` | Visual fidelity to the mockup. | sonnet | high | Read-only |
| `wp-web-a11y-auditor` | Roles, labels, focus, keyboard. | sonnet | high | Read-only |
| `wp-web-architecture-reviewer` | Feature boundaries, imports, data access. | opus | xhigh | Read-only |
| `wp-web-security-auditor` | Session, tokens, HTML, redirects. | opus | xhigh | Read-only |
| `wp-web-performance-reviewer` | Bundle, lazy loading, rendering cost. | sonnet | high | Read-only |
| `wp-web-api-contract-reviewer` | Data access against the contracts. | opus | high | Read-only |
| `wp-web-motion-reviewer` | Animation timings and reduced motion. | sonnet | medium | Read-only |
| `wp-web-copy-reviewer` | French copy against the mockup. | sonnet | medium | Read-only |
| `wp-web-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/wp-feature` | Create or reshape a feature and its FEATURE.md. | `wp-web-feature-builder` |
| `/wp-component` | Build a page or a presentational component. | `wp-web-component-builder` |
| `/wp-form` | Build a Signal Form. | `wp-web-form-builder` |
| `/wp-overlay` | Build a menu, popover, dialog or confirmation. | `wp-web-overlay-builder` |
| `/wp-view` | Build a space view (list, board, calendar, Gantt…). | `wp-web-collection-builder` |
| `/wp-service` | Build data access over @waypoint/api-client. | `wp-web-service-builder` |
| `/wp-state` | Build feature state with signals. | `wp-web-state-builder` |
| `/wp-realtime` | Connect pushed changes from the realtime gateway. | `wp-web-realtime-builder` |
| `/wp-route` | Change routes, guards or error pages. | `wp-web-routing-builder` |
| `/wp-ui` | Compose from @waypoint/ui or request a missing brick. | `wp-web-ui-consumer` |
| `/wp-test` | Write unit or component tests. | `wp-web-test-writer` |
| `/wp-e2e` | Write or run a Playwright scenario. | `wp-web-e2e-runner` |
| `/wp-design-review` | Compare a screen with the mockup. | `wp-web-design-reviewer` |
| `/wp-a11y` | Audit accessibility. | `wp-web-a11y-auditor` |
| `/wp-arch-review` | Review boundaries of the current change. | `wp-web-architecture-reviewer` |
| `/wp-security-review` | Audit frontend security. | `wp-web-security-auditor` |
| `/wp-perf-review` | Review performance. | `wp-web-performance-reviewer` |
| `/wp-contract-review` | Check data access against the contracts. | `wp-web-api-contract-reviewer` |
| `/wp-motion-review` | Review animations. | `wp-web-motion-reviewer` |
| `/wp-copy-review` | Check French copy against the mockup. | `wp-web-copy-reviewer` |
| `/wp-github` | Change workflows, templates or community files in .github/. | `wp-web-github-maintainer` |
| `/wp-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

## Rules

| File | Subject | Loads for |
| --- | --- | --- |
| `components.md` | Angular components | `src/app/**/*.ts`, `src/app/**/*.html` |
| `forms.md` | Forms | `src/app/**/*form*`, `src/app/**/forms/**`, `src/app/**/*.validator.ts` |
| `overlays.md` | Overlays | `src/app/**/*menu*`, `src/app/**/*dialog*`, `src/app/**/*popover*`, `src/app/**/*overlay*` |
| `collections.md` | Space views | `src/app/spaces/views/**` |
| `data-access.md` | Data access | `src/app/**/data-access/**`, `src/app/core/api/**` |
| `state.md` | State | `src/app/**/state/**` |
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
| `wp-context` | What Waypoint is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `wp-mockup` | Where the mockup lives (docs/maquette/source and the live artifact), what each artboard covers, how to read a .dc.html file and its properties, and which guide section maps each screen to Angular components. |
| `wp-angular22-conventions` | The Angular 22 conventions this app follows: file and class names without suffix, wp- selectors, signal inputs, outputs and models, control flow, OnPush default, Signal Forms, @Service(), resource APIs. |
| `wp-ui-consumer` | Which @waypoint/ui brick to use for each mockup pattern, how to import tokens and icons, and how to request a missing brick from waypoint-design-system. |
| `wp-api-client-data-access` | How a feature reaches the API: generated client, data-access services, pure adapters to display models, loading and error states, partial aggregates. |
| `wp-signal-forms` | How to build a Waypoint form with Signal Forms: model signal, schema rules, field binding, messages from the mockup, submit and focus behavior. |
| `wp-overlay-placement` | The placement, sizing and dismissal rules of every menu, popover and dialog in Waypoint, from the mockup and the guide. |
| `wp-status-interactions` | The mockup rules for status changes, fast clicks, toasts with undo, confirmations and the cancel-reason dialog. |
| `wp-web-testing` | How to test Waypoint web components, state and services with Vitest and Angular testing utilities, with mockup fixtures. |
| `wp-e2e-playwright` | How to run Waypoint end-to-end scenarios locally against the Docker Compose stack, with evidence. |
| `wp-feature-md` | The canonical sections of a feature FEATURE.md and the changes that make updating it mandatory. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, reactive forms, direct HttpClient outside data access, a local shared/ui, `export *` barrels and edits of the mockup copy, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
