#!/usr/bin/env node
console.log(`Hermes OS no longer manages a gateway tunnel.\n\nRun Hermes Agent directly, enable its API server in ~/.hermes/.env, then start the client:\n\n  API_SERVER_ENABLED=true\n  API_SERVER_KEY=change-me-local-dev\n  hermes gateway\n  pnpm --filter @openuidev/hermes-client dev\n`);
