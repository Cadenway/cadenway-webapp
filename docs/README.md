# waypoint-webapp documentation

Planned role: waypoint-webapp is the whole application of the mockup, from the sign-in screens to the settings: Angular 22, Tailwind 4, Signal Forms, `@waypoint/ui`, `@waypoint/api-client`. It talks only to `waypoint-api-gateway` (REST) and `waypoint-realtime-gateway` (WebSocket), ships as a Docker image of static files behind Traefik on `app.<domain>`, and reads the gateway addresses from `public/config.json` at start-up.

## Current status

At the time this documentation was written, this checkout has no `package.json`, application source tree, or GitHub workflow files. The target architecture, scripts, and workflows in this guide must be created and verified during bootstrap.

## Read the guides

- [Architecture and ownership](architecture.md): boundaries and planned repository structure.
- [Development and checks](development.md): prerequisites, planned commands and verification.
- [Domain and integration](integration.md): repository-specific contracts, behavior and dependencies.
- [Read-only mockup reference](maquette/README.md).

## Sources and policy

- [Repository overview](../.github/README.md) and [contribution guide](../.github/CONTRIBUTING.md).
- [Repository instructions and hard limits](../AGENTS.md).
- [Claude Code instructions](../CLAUDE.md) and [tooling](../.claude/README.md).
- [Codex tooling](../.codex/README.md).
- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N).

Repository instructions take precedence over this summary. Refer to the actual package manifests, implementation, specifications, and workflows once they exist; do not infer a deployed feature from a target design.
