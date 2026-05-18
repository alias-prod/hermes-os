#!/usr/bin/env node
/**
 * Opens a local Hermes OS client URL preconfigured for Hermes Agent's
 * OpenAI-compatible API server.
 */
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PREFIX = "[hermesos]";
const log = (msg) => console.log(`${PREFIX} ${msg}`);

const envPath = join(homedir(), ".hermes", ".env");
let apiKey = "";
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf8");
  const match = env.match(/^API_SERVER_KEY=(.*)$/m);
  apiKey = match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

const clientOrigin = process.env.HERMES_OS_CLIENT_URL || "http://localhost:18790";
const apiBaseUrl = process.env.HERMES_API_BASE_URL || "http://127.0.0.1:8642/v1";
const setupUrl = `${clientOrigin.replace(/\/$/, "")}/setup#apiBaseUrl=${encodeURIComponent(apiBaseUrl)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ""}`;

console.log();
log(`Hermes OS URL: ${setupUrl}`);
if (!apiKey) {
  log(`No API_SERVER_KEY found in ${envPath}; paste it in Settings if your API server requires auth.`);
}

const clipCmd = process.platform === "darwin" ? "pbcopy" : process.platform === "win32" ? "clip" : "wl-copy";
try {
  const cp = spawn(clipCmd, [], { stdio: ["pipe", "ignore", "ignore"] });
  cp.stdin.end(setupUrl);
  cp.on("error", () => {});
  log("Copied to clipboard.");
} catch {}

const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
try {
  execSync(`${opener} "${setupUrl}"`, { stdio: "ignore" });
  log("Opened in your browser.");
} catch {
  log("Could not auto-open browser. Paste the URL above into your browser.");
}
console.log();
