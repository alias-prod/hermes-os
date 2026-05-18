export const ConnectionState = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  AUTH_FAILED: "AUTH_FAILED",
  PAIRING: "PAIRING",
  UNREACHABLE: "UNREACHABLE",
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

export interface ChatHistoryToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatHistoryMessage {
  id?: string;
  role?: string;
  content?: unknown;
  tool_calls?: ChatHistoryToolCall[];
  tool_call_id?: string;
  error?: string;
  stopReason?: string;
  errorMessage?: string;
  __hermes?: { id: string; seq: number; kind?: string };
}
