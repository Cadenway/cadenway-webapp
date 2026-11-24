# Development and verification

[Documentation index](README.md) · [Repository overview](../.github/README.md) · [Repository instructions](../AGENTS.md)

## Status

The scripts below are defined in `package.json`. Run Git, pnpm, build, and test commands with this repository as the working directory, never from the parent workspace, and report any check that could not run.

## Before making a change

- The `FEATURE.md` of the feature you touch.
- The mockup screen you implement (`docs/maquette/source/*.dc.html`, or the live mockup) and its section in the [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et).
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "cadenway-webapp".
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## Planned setup

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Cadenway repositories, flat, in one folder.
2. To run it with the rest of Cadenway, start the stack from `cadenway-ops`; it builds the sibling
   folders. The planned `core` profile provides the core backend. Start this frontend
   separately as shown below:

   ```bash
   cd ../cadenway-ops/compose
   docker compose -f compose.yaml -f compose.local.yaml --profile core up -d
   ```

3. To work on this repository alone:

   ```bash
   pnpm install
   pnpm start                  # http://localhost:4200
   ```

## Minimum checks by change

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

## Full local quality gate

Run the commands below from this repository, in order, and stop at the first failure.
`pnpm quality` runs the same checks. Keep the build in the gate for strict template checking.

```bash
pnpm format:check
pnpm test:lint
pnpm lint
pnpm typecheck
pnpm test:architecture
pnpm test:coverage
pnpm build
```

For a focused check, run `pnpm test --include "<glob>"` with one spec glob.

Report each command as passed, failed, not run or unavailable. When a test command runs,
include the executed count. Report `0 tests executed` as unverified even if the process exits
successfully. If a required dependency is unavailable, state what it prevented you from checking.

Run the browser checks separately once the stack is available. Pass the actual spec path to
`pnpm e2e --` for a targeted run.

When building the container locally, pass an npm configuration with GitHub Packages read access as
a BuildKit secret with `docker build --secret id=npmrc,src=/path/to/user/.npmrc .`.

## Collaboration and release

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Cadenway task id first when there is one (`feat/cad-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags, publishes the image and lets the deploy workflow write the version into cadenway-ops.
- Stage only the files of your task; preserve other people's changes in the working tree.

Keep credentials, private keys, decrypted environment files and Terraform state out of documentation and logs. Follow the hard limits in [AGENTS.md](../AGENTS.md); setup instructions do not authorize deployments or changes to real infrastructure.
