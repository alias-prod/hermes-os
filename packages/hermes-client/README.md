# @openuidev/hermes-client

A Next.js/OpenUI workspace for [Hermes Agent](https://github.com/NousResearch/hermes-agent). It connects to Hermes' official OpenAI-compatible API server (`/v1`) and renders assistant output with OpenUI.

## Local development

```bash
pnpm install
pnpm --filter @openuidev/hermes-client dev
```

Enable Hermes' API server first:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
hermes gateway
```

Then open `http://localhost:18790` and enter:

- API base URL: `http://127.0.0.1:8642/v1`
- API key: `API_SERVER_KEY`

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint:check
pnpm format:check
pnpm typecheck
pnpm test
pnpm ci
```
