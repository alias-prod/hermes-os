#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const envPath = join(homedir(), ".hermes", ".env");
let key = "<not set>";
if (existsSync(envPath)) {
  const match = readFileSync(envPath, "utf8").match(/^API_SERVER_KEY=(.*)$/m);
  key = match?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "<not set>";
}
console.log("Hermes API:", process.env.HERMES_API_BASE_URL || "http://127.0.0.1:8642/v1");
console.log("API key:", key);
