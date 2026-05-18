export type GatewayUrlValidation = { ok: true } | { ok: false; error: string };

/** Validate the Hermes OpenAI-compatible API base URL. */
export function validateGatewayUrl(raw: string): GatewayUrlValidation {
  if (!raw) return { ok: false, error: "Hermes API base URL is required." };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      error: "Not a valid URL. Use http://localhost:8642/v1 or your remote HTTPS endpoint.",
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: `Unsupported protocol "${parsed.protocol}". Use http:// for local or https:// for remote.`,
    };
  }
  if (!parsed.hostname) return { ok: false, error: "URL is missing a hostname." };
  return { ok: true };
}
