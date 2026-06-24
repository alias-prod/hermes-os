/**
 * Single source of truth for the Hermes session-key format.
 *
 * Format:  agent:<agentId>:<slot>:hermes-os
 *   - `<slot>` is `"main"` for the agent's primary thread, or a UUID for
 *     extra (named) sessions under the same agent.
 *   - The `:hermes-os` suffix is what lets the gateway / plugin filter
 *     Hermes sessions out of the rest of the Hermes session pool.
 *
 * Centralizing here so the format isn't grepped+rebuilt across the codebase
 * — the legacy-session port (BUGS.md B15) needs to change exactly one file.
 *
 * `decode` and the matchers are tolerant of legacy keys missing the suffix
 * so we can still surface them in the UI; only `encodeMain` / `encodeExtra`
 * are authoritative when *creating* a key.
 */

import { createId } from "@/lib/uuid";

export const CLAW_SUFFIX = ":hermes-os";

const MAIN_KEY_REGEX = /^agent:[^:]+:main:hermes-os$/i;
const EXTRA_KEY_REGEX = /^agent:[^:]+:([0-9a-f-]+):hermes-os$/i;
const AGENT_ID_KEY_REGEX = /^agent:([^:]+):[^:]+:hermes-os$/i;

/** `agent:<agentId>:main:hermes-os` — the agent's primary thread key. */
export function encodeMain(agentId: string): string {
  return `agent:${agentId}:main${CLAW_SUFFIX}`;
}

/** `agent:<agentId>:<uuid>:hermes-os` — an extra named session key. */
export function encodeExtra(agentId: string, slotId: string = createId()): string {
  return `agent:${agentId}:${slotId}${CLAW_SUFFIX}`;
}

/** True if the key is *any* Hermes-owned session (main or extra). */
export function hasHermesSuffix(key: string): boolean {
  return key.endsWith(CLAW_SUFFIX);
}

/** True if the key is the agent's main session (slot === "main"). */
export function isMainSession(key: string): boolean {
  return MAIN_KEY_REGEX.test(key.trim());
}

/**
 * Pull the slot UUID out of an extra-session key (for short display strings).
 * Returns `null` for a main-session key or a non-Hermes key.
 */
export function extractExtraSlotId(key: string): string | null {
  const match = key.trim().match(EXTRA_KEY_REGEX);
  return match?.[1] ?? null;
}

/**
 * Pull the agent id out of any Hermes session key (main or extra). Returns
 * `null` if the input doesn't match the `agent:<id>:<slot>:hermes-os`
 * shape — useful when callers receive a bare agent id or a non-Hermes key.
 */
export function extractAgentIdFromKey(key: string): string | null {
  const match = key.trim().match(AGENT_ID_KEY_REGEX);
  return match?.[1] ?? null;
}
