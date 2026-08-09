# Agents

- ALWAYS use pnpm.

## Hermes OS project notes

This repo is a Hermes Agent/OpenUI workspace.

- Client package: `packages/hermes-client`
- Hermes plugin package: `packages/hermes-plugin`
- Browser chat uses Hermes Agent's official OpenAI-compatible API server (`/v1/chat/completions`, `/v1/models`).
- Local defaults: client `http://localhost:18790`, Hermes API `http://127.0.0.1:8642/v1` (CORS must allow the client origin).
- Hermes API/LLM secrets live in `~/.hermes/.env`, not in this repo's `.env`.
- Client API base URL and key are entered in the browser Settings UI and stored in `localStorage` (`hermes-settings-v1`), not via a checked-in env file.
- Hermes session continuity uses `X-Hermes-Session-Id`; long-term channel scoping uses `X-Hermes-Session-Key`.
- Plugin code follows Hermes' official Python plugin contract: `plugin.yaml` plus `__init__.py` with `register(ctx)`.
- Use official Hermes docs before changing integration assumptions: architecture, programmatic integration, API server, plugins, and skills docs.
