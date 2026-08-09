# Hermes OS — Prerequisites Checklist

> **Clone location:** `/Users/alias/Documents/GitHub/hermes-os`  
> **Upstream:** https://github.com/Minoo7/hermes-os  
> **Status:** Analysis complete. Fill in the **Your values** sections below, save this file, then tell the agent to continue with install / setup / run / test.

---

## What this project is (summary)

Hermes OS is a **browser workspace** for [Nous Research Hermes Agent](https://github.com/NousResearch/hermes-agent). It is a fork/port of OpenUI’s OpenClaw OS workspace.

| Piece | Role |
| --- | --- |
| `@openuidev/hermes-client` | Next.js 16 + React 19 + Tailwind + OpenUI (`@openuidev/react-ui`, `react-lang`, `react-headless`) UI on port **18790** |
| `@openuidev/hermes-os-plugin` | Python Hermes plugin (`plugin.yaml` + `register(ctx)`) that teaches Hermes OpenUI Lang / skills / tools |
| Hermes Agent gateway | External dependency — OpenAI-compatible API at `http://127.0.0.1:8642/v1` |

The client stores connection settings in **browser `localStorage`** (`hermes-settings-v1`), not in a repo `.env`. Hermes secrets live in **`~/.hermes/.env`**.

Official docs used by this port:

- API server: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- Plugins: https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins
- Architecture: https://hermes-agent.nousresearch.com/docs/developer-guide/architecture
- Programmatic integration: https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration
- Creating skills: https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills
- Hermes Agent repo: https://github.com/NousResearch/hermes-agent

---

## Toolchain prerequisites (already checked on this machine)

| Requirement | Source in repo | Expected | This machine (pre-install) |
| --- | --- | --- | --- |
| Node.js ≥ 20 | `.nvmrc` → `20`, `package.json` `engines` | 20+ (CI uses 20) | `v26.6.0` OK |
| pnpm ≥ 9.15 | `CONTRIBUTING.md`, CI `9.15.4` | Always use pnpm | `11.20.0` OK |
| Hermes Agent CLI | README / CONTRIBUTING | Installed + runnable | `hermes` v0.20.0 at `/opt/homebrew/bin/hermes` |
| `~/.hermes/.env` | Hermes + README | Must exist for API server | **MISSING** — create below |
| LLM provider credentials | Hermes (not hermes-os repo) | At least one provider | Shell/auth has keys; doctor still wants `~/.hermes/.env` |

Package manager lockfile: `pnpm-lock.yaml` (do **not** use npm/yarn/bun for this repo).

---

## A. Required — Hermes API server (`~/.hermes/.env`)

These are **not** in the hermes-os git tree. They are documented in:

- Repo: `README.md` (lines ~14–21), `packages/hermes-client/README.md`
- Upstream docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- Hermes reference template: `~/.hermes/hermes-agent/.env.example` (general Hermes env; API server vars are primarily documented on the API server page)

Create / edit: **`~/.hermes/.env`**

| Variable | Required? | Purpose | Where to get / how to set |
| --- | --- | --- | --- |
| `API_SERVER_ENABLED` | **Yes** (for e2e) | Turns on OpenAI-compatible HTTP API | Set to `true` |
| `API_SERVER_KEY` | **Yes** | Bearer token for `/v1/*` | Choose any strong local secret (e.g. `openssl rand -hex 32`). Same value is pasted into the Hermes OS Settings UI. |
| `API_SERVER_CORS_ORIGINS` | **Yes for browser UI** | Allows browser on `:18790` to call Hermes | Set to `http://localhost:18790` (README also mentions this). Docs: API server → CORS |
| `API_SERVER_PORT` | Optional | Default `8642` | Only if you change the port |
| `API_SERVER_HOST` | Optional | Default `127.0.0.1` | Keep localhost for local dev |
| `API_SERVER_MODEL_NAME` | Optional | Name advertised on `/v1/models` | Defaults to `hermes-agent` |

### Your values — paste here (agent will apply to `~/.hermes/.env`)

```bash
# === FILL THESE IN, THEN SAVE THIS FILE ===
API_SERVER_ENABLED=true
API_SERVER_KEY=
API_SERVER_CORS_ORIGINS=http://localhost:18790
# API_SERVER_PORT=8642
# API_SERVER_HOST=127.0.0.1
```

**UI pairing (entered in browser after client starts — not env files):**

| Setting | Value |
| --- | --- |
| API base URL | `http://127.0.0.1:8642/v1` |
| API key | Same as `API_SERVER_KEY` above |
| Stored at | Browser `localStorage` key `hermes-settings-v1` via Settings dialog (`packages/hermes-client/src/lib/storage.ts`, `SettingsDialog.tsx`) |

---

## B. Required — at least one LLM / Hermes provider credential

Hermes Agent needs a configured model/provider for chat to work. Keys go in **`~/.hermes/.env`** (or via `hermes setup` / `hermes portal` / `hermes model`).

**Not defined inside hermes-os.** Documented by Hermes:

- https://github.com/NousResearch/hermes-agent
- `hermes setup` / `hermes setup --portal`
- `~/.hermes/hermes-agent/.env.example`
- `hermes doctor` / `hermes status`

Common options (pick what you use):

| Variable | Get from |
| --- | --- |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| Nous Portal | `hermes portal` / `hermes setup --portal` — https://hermes-agent.nousresearch.com |

### Your values — paste provider keys you want written into `~/.hermes/.env`

```bash
# === FILL AT LEAST ONE, THEN SAVE THIS FILE ===
# OPENROUTER_API_KEY=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=

# Optional: pin default model after setup
# (or run: hermes model)
```

**Note:** `hermes doctor` on this machine reported `~/.hermes/.env` missing even though some keys exist in the shell / auth pool. For a reliable gateway + API server, put the keys you want Hermes to use into `~/.hermes/.env` explicitly.

---

## C. Optional — Hermes plugin install flags

Documented in `packages/hermes-plugin/README.md` and https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins

| Variable / action | Required? | Path / notes |
| --- | --- | --- |
| Install plugin | Recommended for OpenUI guidance | `hermes plugins install -l ./packages/hermes-plugin` then `hermes plugins enable hermes-os` **or** copy to `~/.hermes/plugins/hermes-os/` |
| `HERMES_ENABLE_PROJECT_PLUGINS=true` | Only if loading from `./.hermes/plugins/` | Set in `~/.hermes/.env` |

### Your preference

```text
# INSTALL_PLUGIN: yes | no
INSTALL_PLUGIN=yes

# PROJECT_LOCAL_PLUGINS: yes | no  (usually no — use hermes plugins install -l)
HERMES_ENABLE_PROJECT_PLUGINS=false
```

---

## D. Optional — Cloudflare / remote tunnel (NOT needed for local install)

Found in: **`packages/hermes-client/.env.example`**

| Variable | Purpose | Where to get |
| --- | --- | --- |
| `CF_TUNNELS_API_TOKEN` | Cloudflare Tunnel Edit + DNS Edit | https://dash.cloudflare.com/profile/api-tokens |
| `CF_TUNNELS_ACCOUNT_ID` | Cloudflare account ID | Cloudflare dashboard → Overview (right sidebar) or URL |
| `CF_TUNNELS_ZONE_ID` | Zone ID for `generativeui.cloud` | Cloudflare dashboard → domain Overview |
| `DOMAIN` | Default `generativeui.cloud` | Deploy target; see also `wrangler.jsonc` → `app.generativeui.cloud` |

`scripts/setup-tunnel.mjs` currently **prints a message** that Hermes OS no longer manages a gateway tunnel — local path is Hermes API server + client only. Leave blank unless you are deploying / tunneling.

### Your values (optional)

```bash
# CF_TUNNELS_API_TOKEN=
# CF_TUNNELS_ACCOUNT_ID=
# CF_TUNNELS_ZONE_ID=
# DOMAIN=generativeui.cloud
```

---

## E. Repo-local env files (hermes-os)

| Path | Used for | Required for local `pnpm dev`? |
| --- | --- | --- |
| `packages/hermes-client/.env.example` | Template for Cloudflare tunnel vars | No |
| `packages/hermes-client/.env` | Copy of example if you deploy CF | No for local |
| Root `.env` | **Does not exist / not used** by docs | N/A |
| Browser settings | API URL + key after first launch | Yes for e2e chat (UI, not file) |

Build-time only:

| Variable | Path | Purpose |
| --- | --- | --- |
| `NEXT_OUTPUT` | Set by `package.json` scripts via `cross-env` | `server` for `dev`/`start`; static export when unset (`next.config.ts`) |

You do **not** need to set `NEXT_OUTPUT` manually for local dev.

---

## F. Commands that will run after you save this file

```bash
cd /Users/alias/Documents/GitHub/hermes-os

# 1) Apply ~/.hermes/.env from values above (agent will do this carefully)
# 2) Install workspace
pnpm install

# 3) Optional plugin
hermes plugins install -l ./packages/hermes-plugin
hermes plugins enable hermes-os

# 4) Start Hermes gateway (API server)
hermes gateway

# 5) Start UI
pnpm --filter @openuidev/hermes-client dev
# → http://localhost:18790

# 6) Automated checks
pnpm test
pnpm ci   # lint + format + typecheck + build (same spirit as GitHub Actions)
```

---

## G. Ready gate

Flip this when values are filled and the file is saved:

```text
READY_FOR_INSTALL=no
```

Change to:

```text
READY_FOR_INSTALL=yes
```

Then reply in chat (e.g. “prerequisites saved — continue”) so install / setup / run / testing can proceed. A final process report will be written to `SETUP_REPORT.md` in the repo root when testing is done.

---

## Security note

This file may contain secrets after you fill it in. It is **not** in `.gitignore` by default — avoid committing it. Prefer putting live secrets only in `~/.hermes/.env` (mode `600`) and leaving this checklist as a pointer if you prefer.
