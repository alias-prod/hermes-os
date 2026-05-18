<div align="center">

# Hermes OS — OpenUI workspace for Hermes Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

</div>

Hermes OS is a browser workspace for [Nous Research Hermes Agent](https://github.com/NousResearch/hermes-agent). It connects to Hermes Agent through the official OpenAI-compatible API server and teaches Hermes to return OpenUI Lang when an answer benefits from rich UI.

## Quick start

1. Install Hermes Agent with the web/API extras you need.
2. Enable the API server in `~/.hermes/.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
# Optional when hosting this UI separately in a browser:
# API_SERVER_CORS_ORIGINS=http://localhost:18790
```

3. Start Hermes:

```bash
hermes gateway
```

4. Run the workspace:

```bash
pnpm install
pnpm --filter @openuidev/hermes-client dev
```

5. Open `http://localhost:18790` and set:

- API base URL: `http://127.0.0.1:8642/v1`
- API key: your `API_SERVER_KEY`

The API shape follows the official Hermes API server docs: `/v1/models`, `/v1/chat/completions`, streaming SSE, and `X-Hermes-Session-Id` continuity.

## Packages

| Package | Description |
| --- | --- |
| [`@openuidev/hermes-client`](./packages/hermes-client) | Next.js/OpenUI workspace that talks to Hermes' OpenAI-compatible API server. |
| [`@openuidev/hermes-os-plugin`](./packages/hermes-plugin) | Official-style Hermes plugin (`plugin.yaml` + Python `register(ctx)`) that exposes OpenUI guidance as a skill/tool. |

## Hermes integration notes

- Uses Hermes' OpenAI-compatible API server for browser chat.
- Uses a Python Hermes plugin instead of a product-specific gateway extension.
- Does not require Hermes core changes.
- Stores lightweight browser-local thread metadata while Hermes persists the authoritative agent session in `~/.hermes/state.db`.

## Development

```bash
pnpm build
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm ci
```

Always use `pnpm` in this repo.

## Official Hermes docs used for this port

- Architecture: https://hermes-agent.nousresearch.com/docs/developer-guide/architecture
- Programmatic integration: https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration
- API server: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- Plugins: https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins
- Creating skills: https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills

## License

MIT. See [`LICENSE`](./LICENSE).
