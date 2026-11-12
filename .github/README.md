# waypoint-webapp

waypoint-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, `@waypoint/ui`, `@waypoint/api-client`. It talks only to `waypoint-api-gateway` (REST) and `waypoint-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads the gateway addresses from `public/config.json` at start-up.

```text
src/app/
├─ core/          ← shell, rail, sidebar, Ctrl + K palette, toasts, shortcuts, session, api client setup, realtime
├─ auth/          ← sign-in, sign-up, MFA, codes, password, sign-out, organization choice
├─ home/  my-tasks/  spaces/ (list-page, views/, space-overview)  task/ (task-detail, task-create, shared/)
├─ goals/  docs/  dashboards/  trash/  archives/
├─ account/       ← 5 sections
└─ organization/  ← 7 sections
```

## Getting started

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Waypoint repositories, flat, in one folder.
2. To run it with the rest of Waypoint, start the stack from `waypoint-ops`; it builds the sibling
   folders, this one included (`core` profile; `full` adds every other service):

   ```bash
   cd ../waypoint-ops/compose
   docker compose -f compose.yaml -f compose.local.yaml --profile core up -d
   ```

3. To work on this repository alone:

   ```bash
   pnpm install
   pnpm start                  # http://localhost:4200
   ```

## Checks

Run the narrowest check first; CI runs them all on every pull request.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test --include "src/app/<area>/**/*.spec.ts"   # targeted
pnpm test:coverage
pnpm build
pnpm e2e <spec>                          # browser flows, stack running
```

## Contributing

- [Contributing guide](CONTRIBUTING.md): branches, commits, pull requests, releases.
- [Code of conduct](CODE_OF_CONDUCT.md), [security policy](SECURITY.md), [getting help](SUPPORT.md).
- AI assistants follow [AGENTS.md](../AGENTS.md); Claude Code also reads [CLAUDE.md](../CLAUDE.md) and the
  tooling described in [.claude/README.md](../.claude/README.md).

## License

This repository is proprietary. See [LICENSE](../LICENSE) for the rights and restrictions that apply.

## References

- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE): every screen, state and interaction.
- [Integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et): tokens, data shapes, component names.
- [Repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N): what each repository owns, deployment.
