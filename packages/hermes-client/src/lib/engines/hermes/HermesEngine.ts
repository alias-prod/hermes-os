import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";
import type { StoredMessage } from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";
import type { NotificationRecord } from "@/lib/notifications";
import type { Settings } from "@/lib/storage";
import { getSettings, saveSettings } from "@/lib/storage";
import type { HermesThreadListItem, ModelChoice, SessionRow } from "@/types/gateway-responses";
import { EventType } from "@openuidev/react-headless";
import type {
  AgentInfo,
  ConversationStore,
  Engine,
  EngineCapabilities,
  GatewayCommand,
  HermesEngineConfig,
  ModelInfo,
  SessionInfo,
} from "../types";

const warn = (...args: unknown[]) => console.warn("[hermes:engine]", ...args);

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8642/v1";
const SESSION_STORAGE_KEY = "hermes-os-sessions-v1";
const HISTORY_STORAGE_KEY = "hermes-os-history-v1";

export interface CompactSessionResult {
  ok: boolean;
  compacted: boolean;
  tokensBefore: number | null;
  tokensAfter: number | null;
  reason: string | null;
}

export interface HermesEngineEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onPairingRequired: (deviceId: string | null) => void;
  onAuthFailed: () => void;
  onSettingsChanged: (settings: Settings) => void;
  onSessionMetaChanged: (meta: Map<string, SessionRow>) => void;
  onModelsChanged: (models: ModelChoice[]) => void;
  onModelDefaultsChanged: (defaults: {
    workspaceDefault: string | null;
    byAgent: Map<string, string>;
    defaultAgentId: string | null;
  }) => void;
  onKnownAgentIdsChanged: (ids: Set<string>) => void;
  onSessionChanged: (sessionKey: string) => void;
  onCronChanged: () => void;
}

type LocalSession = {
  id: string;
  agentId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  hermesSessionId?: string;
};

type OpenAIModel = { id?: unknown; object?: unknown; owned_by?: unknown };

type ChatCompletionChunk = {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type HermesToolProgress = {
  tool?: string;
  label?: string;
  toolCallId?: string;
  status?: "running" | "completed" | string;
};

function nowIso(ts: number): string {
  return new Date(ts).toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeApiBaseUrl(raw: string | undefined): string {
  const value = (raw || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  return value.endsWith("/v1") ? value : `${value}/v1`;
}

function deriveTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "New Hermes session";
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact;
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as { type?: unknown; text?: unknown };
      return (p.type === "text" || p.type === "input_text") && typeof p.text === "string"
        ? p.text
        : "";
    })
    .join("\n");
}

function normalizeMessages(
  messages: unknown[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const normalized: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const m = message as { role?: unknown; content?: unknown };
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = extractMessageText(m.content).trim();
    if (!content) continue;
    normalized.push({ role: m.role, content });
  }
  return normalized;
}

function sessionToInfo(session: LocalSession): SessionInfo {
  return {
    id: session.id,
    agentId: session.agentId,
    title: session.title,
    createdAt: nowIso(session.createdAt),
    updatedAt: nowIso(session.updatedAt),
  };
}

function makeEmptyStream(message: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: EventType.RUN_ERROR, message }) + "\n"),
        );
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/octet-stream" } },
  );
}

function openUISystemPrompt(): string {
  return `You are Hermes Agent rendered inside Hermes OS, an OpenUI workspace. Prefer concise answers, but when the user asks for a visual comparison, table, dashboard, form, tracker, or anything interactive, render it as fenced \`\`\`openui-lang blocks. Use only documented openui-lang assignment syntax; do not use JSX/MDX/object literals. For durable dashboards, explain the needed data and produce an inline preview instead of claiming persistence unless the app tools are available.`;
}

export function agentMainSessionKey(agentId: string): string {
  return agentId === "main" ? "main" : agentId;
}

export function resolveChatSessionKey(threadId: string, _agentIds: Set<string>): string {
  return threadId;
}

class HermesConversationStore implements ConversationStore {
  constructor(private engine: HermesEngine) {}

  async listSessions(agentId?: string): Promise<SessionInfo[]> {
    return this.engine
      .getLocalSessions()
      .filter((session) => !agentId || session.agentId === agentId)
      .map(sessionToInfo);
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = this.engine.getLocalSessions().find((item) => item.id === sessionId);
    return session ? sessionToInfo(session) : null;
  }

  async createSession(agentId: string, title?: string): Promise<SessionInfo> {
    const ts = Date.now();
    const session: LocalSession = {
      id: `hermes-${ts}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      title: title || "New Hermes session",
      createdAt: ts,
      updatedAt: ts,
    };
    this.engine.upsertLocalSession(session);
    return sessionToInfo(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.engine.deleteLocalSession(sessionId);
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const session = this.engine.getOrCreateLocalSession(sessionId);
    this.engine.upsertLocalSession({ ...session, title, updatedAt: Date.now() });
  }

  async loadHistory(sessionId: string): Promise<StoredMessage[]> {
    return this.engine.getHistory(sessionId);
  }

  async getSessionConfig(_sessionId: string): Promise<Record<string, string>> {
    return {};
  }

  async setSessionConfig(_sessionId: string, _key: string, _value: string): Promise<void> {
    return;
  }
}

export class HermesEngine implements Engine {
  readonly id: string;
  readonly capabilities: EngineCapabilities = {
    loadSession: true,
    listSessions: true,
    deleteSessions: true,
    multiAgent: false,
    sessionConfig: false,
    artifacts: false,
    apps: false,
    uploads: false,
  };

  readonly conversations: ConversationStore = new HermesConversationStore(this);
  readonly artifacts = undefined;
  readonly apps = undefined;
  readonly uploads = undefined;

  private _connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private _settings: Settings | null;
  private _sessionMeta = new Map<string, SessionRow>();
  private _availableModels: ModelChoice[] = [];
  private events: HermesEngineEvents;
  private activeAbortControllers = new Map<string, AbortController>();

  constructor(config: HermesEngineConfig, events: HermesEngineEvents) {
    this.id = config.id;
    this._settings = config.gatewayUrl
      ? { gatewayUrl: config.gatewayUrl, token: config.token }
      : getSettings();
    this.events = events;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get settings(): Settings | null {
    return this._settings;
  }

  get sessionMeta(): Map<string, SessionRow> {
    return this._sessionMeta;
  }

  get availableModels(): ModelChoice[] {
    return this._availableModels;
  }

  async connect(): Promise<void> {
    this._setConnectionState(ConnectionState.CONNECTING);
    try {
      await this.refreshModels();
      this.events.onKnownAgentIdsChanged(new Set(["main"]));
      this.events.onModelDefaultsChanged({
        workspaceDefault: this._availableModels[0]?.id ?? "hermes-agent",
        byAgent: new Map([["main", this._availableModels[0]?.id ?? "hermes-agent"]]),
        defaultAgentId: "main",
      });
      this._rebuildSessionMeta();
      this._setConnectionState(ConnectionState.CONNECTED);
    } catch (error) {
      warn("connect failed", error);
      this._setConnectionState(ConnectionState.UNREACHABLE);
    }
  }

  async disconnect(): Promise<void> {
    for (const controller of this.activeAbortControllers.values()) controller.abort();
    this.activeAbortControllers.clear();
    this._setConnectionState(ConnectionState.DISCONNECTED);
  }

  reconnect(newSettings: Settings): void {
    this._settings = newSettings;
    saveSettings(newSettings);
    this.events.onSettingsChanged(newSettings);
    void this.connect();
  }

  async listAgents(): Promise<AgentInfo[]> {
    return [{ id: "main", name: "Hermes" }];
  }

  async listModels(): Promise<ModelInfo[]> {
    await this.refreshModels();
    return this._availableModels.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      contextWindow: model.contextWindow,
      capabilities: { thinking: model.reasoning },
    }));
  }

  async sendMessage(
    sessionId: string,
    messages: unknown[],
    abortController: AbortController,
  ): Promise<Response> {
    const settings = this._settings ?? getSettings();
    const apiBaseUrl = normalizeApiBaseUrl(settings?.gatewayUrl);
    const apiKey = settings?.token;
    const session = this.getOrCreateLocalSession(sessionId);
    const normalized = normalizeMessages(messages);
    const lastUser = [...normalized].reverse().find((message) => message.role === "user");
    if (!lastUser) return makeEmptyStream("No user message found.");

    if (session.title === "New Hermes session") {
      this.upsertLocalSession({
        ...session,
        title: deriveTitle(lastUser.content),
        updatedAt: Date.now(),
      });
    }

    const controller = new AbortController();
    this.activeAbortControllers.set(sessionId, controller);
    abortController.signal.addEventListener("abort", () => controller.abort(), { once: true });

    const encoder = new TextEncoder();
    let assistantText = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let messageStarted = false;
    const messageId = `msg-${crypto.randomUUID()}`;
    const activeTools = new Set<string>();

    const writeEvent = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      event: Record<string, unknown>,
    ) => {
      controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    };

    const ensureMessageStarted = (
      streamController: ReadableStreamDefaultController<Uint8Array>,
    ) => {
      if (messageStarted) return;
      messageStarted = true;
      writeEvent(streamController, {
        type: EventType.TEXT_MESSAGE_START,
        messageId,
        role: "assistant",
      });
    };

    const stream = new ReadableStream<Uint8Array>({
      start: async (streamController) => {
        try {
          const response = await fetch(`${apiBaseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              ...(session.hermesSessionId
                ? { "X-Hermes-Session-Id": session.hermesSessionId }
                : {}),
              ...(apiKey ? { "X-Hermes-Session-Key": `hermes-os:${session.id}` } : {}),
            },
            body: JSON.stringify({
              model: this._availableModels[0]?.id ?? "hermes-agent",
              stream: true,
              messages: [
                { role: "system", content: openUISystemPrompt() },
                ...normalized.map((message) => ({ role: message.role, content: message.content })),
              ],
            }),
            signal: controller.signal,
          });

          const hermesSessionId = response.headers.get("X-Hermes-Session-Id") ?? undefined;
          if (hermesSessionId) {
            this.upsertLocalSession({
              ...this.getOrCreateLocalSession(session.id),
              hermesSessionId,
            });
          }

          if (!response.ok || !response.body) {
            const errorText = await response.text().catch(() => "");
            writeEvent(streamController, {
              type: EventType.RUN_ERROR,
              message: errorText || `Hermes API request failed (${response.status}).`,
            });
            streamController.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentEvent = "message";

          const handleData = (line: string) => {
            if (!line || line === "[DONE]") return;
            if (currentEvent === "hermes.tool.progress") {
              const tool = JSON.parse(line) as HermesToolProgress;
              const toolCallId = tool.toolCallId || `tool-${crypto.randomUUID()}`;
              const toolName = tool.tool || "tool";
              ensureMessageStarted(streamController);
              if (tool.status === "running") {
                activeTools.add(toolCallId);
                writeEvent(streamController, {
                  type: EventType.TOOL_CALL_START,
                  toolCallId,
                  toolCallName: toolName,
                  parentMessageId: messageId,
                });
                writeEvent(streamController, {
                  type: EventType.TOOL_CALL_ARGS,
                  toolCallId,
                  delta: JSON.stringify({ label: tool.label ?? toolName }),
                });
              } else if (activeTools.has(toolCallId)) {
                writeEvent(streamController, { type: EventType.TOOL_CALL_END, toolCallId });
                activeTools.delete(toolCallId);
              }
              return;
            }

            const chunk = JSON.parse(line) as ChatCompletionChunk;
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistantText += delta;
              ensureMessageStarted(streamController);
              writeEvent(streamController, {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta,
              });
            }
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
              completionTokens = chunk.usage.completion_tokens ?? completionTokens;
              totalTokens = chunk.usage.total_tokens ?? totalTokens;
            }
            const finishReason = chunk.choices?.[0]?.finish_reason;
            if (finishReason && finishReason !== "stop" && finishReason !== "length") {
              writeEvent(streamController, {
                type: EventType.RUN_ERROR,
                message: `Hermes finished with ${finishReason}.`,
              });
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n")) !== -1) {
              const raw = buffer.slice(0, idx).trimEnd();
              buffer = buffer.slice(idx + 1);
              if (!raw || raw.startsWith(":")) {
                currentEvent = "message";
                continue;
              }
              if (raw.startsWith("event:")) {
                currentEvent = raw.slice("event:".length).trim();
                continue;
              }
              if (raw.startsWith("data:")) {
                try {
                  handleData(raw.slice("data:".length).trim());
                } catch (error) {
                  warn("failed to parse Hermes SSE chunk", error);
                }
              }
            }
          }

          if (messageStarted) {
            writeEvent(streamController, { type: EventType.TEXT_MESSAGE_END, messageId });
          }
          writeEvent(streamController, {
            type: EventType.RUN_FINISHED,
            usage: {
              input: promptTokens,
              output: completionTokens,
              total: totalTokens,
            },
          });

          this.appendHistory(session.id, [
            { id: `user-${crypto.randomUUID()}`, role: "user", content: lastUser.content },
            { id: messageId, role: "assistant", content: assistantText },
          ]);
          this.upsertLocalSession({
            ...this.getOrCreateLocalSession(session.id),
            updatedAt: Date.now(),
          });
          this.events.onSessionChanged(session.id);
        } catch (error) {
          if ((error as Error).name !== "AbortError") {
            writeEvent(streamController, {
              type: EventType.RUN_ERROR,
              message: error instanceof Error ? error.message : "Hermes request failed.",
            });
          }
        } finally {
          this.activeAbortControllers.delete(sessionId);
          streamController.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }

  async abort(sessionId: string): Promise<void> {
    this.activeAbortControllers.get(sessionId)?.abort();
  }

  async fetchThreadList(): Promise<HermesThreadListItem[]> {
    const sessions = this.getLocalSessions();
    if (sessions.length === 0) {
      return [
        {
          id: "main",
          title: "Hermes",
          createdAt: Date.now(),
          hermesKind: "main",
          hermesAgentId: "main",
        },
      ];
    }
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      hermesKind: "extra" as const,
      hermesAgentId: session.agentId,
    }));
  }

  async resetSession(sessionKey: string): Promise<boolean> {
    this.setHistory(sessionKey, []);
    this.events.onSessionChanged(sessionKey);
    return true;
  }

  async compactSession(_sessionKey: string): Promise<CompactSessionResult> {
    return {
      ok: true,
      compacted: false,
      tokensBefore: null,
      tokensAfter: null,
      reason: "Hermes API server manages compression.",
    };
  }

  async patchSession(sessionKey: string, patch: Record<string, unknown>): Promise<boolean> {
    const session = this.getOrCreateLocalSession(sessionKey);
    const labelValue = patch["label"];
    const label = typeof labelValue === "string" ? labelValue : undefined;
    if (label) this.upsertLocalSession({ ...session, title: label, updatedAt: Date.now() });
    return true;
  }

  async subscribeSessions(): Promise<void> {
    return;
  }

  async fetchGatewayCommands(): Promise<GatewayCommand[]> {
    return [
      { key: "/model", name: "model", description: "Switch Hermes model via the Hermes CLI/TUI." },
      { key: "/new", name: "new", description: "Start a fresh Hermes session." },
      { key: "/help", name: "help", description: "Show Hermes slash command help." },
    ];
  }

  async listNotifications(): Promise<NotificationRecord[]> {
    return [];
  }

  async markNotificationsRead(_ids?: string[]): Promise<boolean> {
    return true;
  }

  async upsertNotification(
    _notification?: Omit<
      NotificationRecord,
      "id" | "createdAt" | "updatedAt" | "unread" | "readAt"
    >,
  ): Promise<boolean> {
    return false;
  }

  async listCronJobs(): Promise<CronJobRecord[]> {
    return [];
  }

  async listCronRuns(): Promise<CronRunEntry[]> {
    return [];
  }

  async getCronStatus(): Promise<CronStatusRecord> {
    return {};
  }

  async updateCronJob(_id?: string, _patch?: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  async runCronJob(_id?: string, _mode?: "force" | "due"): Promise<boolean> {
    return false;
  }

  async removeCronJob(_id?: string): Promise<boolean> {
    return false;
  }

  getLocalSessions(): LocalSession[] {
    return readJson<LocalSession[]>(SESSION_STORAGE_KEY, []).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  getOrCreateLocalSession(id: string): LocalSession {
    const existing = this.getLocalSessions().find((session) => session.id === id);
    if (existing) return existing;
    const ts = Date.now();
    return {
      id,
      agentId: "main",
      title: id === "main" ? "Hermes" : "New Hermes session",
      createdAt: ts,
      updatedAt: ts,
    };
  }

  upsertLocalSession(session: LocalSession): void {
    const sessions = this.getLocalSessions().filter((item) => item.id !== session.id);
    sessions.unshift(session);
    writeJson(SESSION_STORAGE_KEY, sessions);
    this._rebuildSessionMeta();
  }

  deleteLocalSession(sessionId: string): void {
    writeJson(
      SESSION_STORAGE_KEY,
      this.getLocalSessions().filter((session) => session.id !== sessionId),
    );
    const histories = readJson<Record<string, StoredMessage[]>>(HISTORY_STORAGE_KEY, {});
    delete histories[sessionId];
    writeJson(HISTORY_STORAGE_KEY, histories);
    this._rebuildSessionMeta();
  }

  getHistory(sessionId: string): StoredMessage[] {
    const histories = readJson<Record<string, StoredMessage[]>>(HISTORY_STORAGE_KEY, {});
    return histories[sessionId] ?? [];
  }

  setHistory(sessionId: string, messages: StoredMessage[]): void {
    const histories = readJson<Record<string, StoredMessage[]>>(HISTORY_STORAGE_KEY, {});
    histories[sessionId] = messages;
    writeJson(HISTORY_STORAGE_KEY, histories);
  }

  appendHistory(sessionId: string, messages: StoredMessage[]): void {
    this.setHistory(sessionId, [...this.getHistory(sessionId), ...messages]);
  }

  private async refreshModels(): Promise<void> {
    const settings = this._settings ?? getSettings();
    const apiBaseUrl = normalizeApiBaseUrl(settings?.gatewayUrl);
    const response = await fetch(`${apiBaseUrl}/models`, {
      headers: settings?.token ? { Authorization: `Bearer ${settings.token}` } : {},
    });
    if (response.status === 401 || response.status === 403) {
      this._setConnectionState(ConnectionState.AUTH_FAILED);
      this.events.onAuthFailed();
      throw new Error("Hermes API key rejected.");
    }
    if (!response.ok) throw new Error(`Hermes API unavailable (${response.status}).`);
    const body = (await response.json()) as { data?: OpenAIModel[] };
    const models = (body.data?.length ? body.data : [{ id: "hermes-agent" }]).map((model) => {
      const id = typeof model.id === "string" ? model.id : "hermes-agent";
      return { id, name: id, provider: "hermes", reasoning: true };
    });
    this._availableModels = models;
    this.events.onModelsChanged(models);
  }

  private _setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    this.events.onConnectionStateChange(state);
  }

  private _rebuildSessionMeta(): void {
    const meta = new Map<string, SessionRow>();
    for (const session of this.getLocalSessions()) {
      meta.set(session.id, {
        key: session.id,
        label: session.title,
        displayName: session.title,
        derivedTitle: session.title,
        updatedAt: session.updatedAt,
        model: this._availableModels[0]?.id ?? "hermes-agent",
        modelProvider: "hermes",
      });
    }
    this._sessionMeta = meta;
    this.events.onSessionMetaChanged(meta);
  }
}
