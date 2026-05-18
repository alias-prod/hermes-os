import type { Thread } from "@openuidev/react-headless";

export type HermesThread = Thread & {
  hermesKind?: "main" | "extra";
  hermesAgentId?: string;
};
