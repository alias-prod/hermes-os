# Agents

- ALWAYS use pnpm.

## Hermes OS project notes

This repo is a Hermes Agent/OpenUI workspace.

- Client package: `packages/hermes-client`
- Hermes plugin package: `packages/hermes-plugin`
- Browser chat uses Hermes Agent's official OpenAI-compatible API server (`/v1/chat/completions`, `/v1/models`).
- Hermes session continuity uses `X-Hermes-Session-Id`; long-term channel scoping uses `X-Hermes-Session-Key`.
- Plugin code follows Hermes' official Python plugin contract: `plugin.yaml` plus `__init__.py` with `register(ctx)`.
- Use official Hermes docs before changing integration assumptions: architecture, programmatic integration, API server, plugins, and skills docs.
