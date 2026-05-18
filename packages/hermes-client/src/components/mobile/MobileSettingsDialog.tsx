"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileButton } from "@/components/mobile/MobileButton";
import { ConnectionState } from "@/lib/gateway/types";
import { validateGatewayUrl } from "@/lib/gateway/url";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import type { Settings } from "@/lib/storage";

interface Props {
  open: boolean;
  currentSettings: Settings | null;
  connectionState: ConnectionState;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export function MobileSettingsDialog({
  open,
  currentSettings,
  connectionState,
  onClose,
  onSave,
}: Props) {
  useBodyScrollLock(open);

  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
  const [pending, setPending] = useState(false);
  // See SettingsDialog for the snapshot-based race rationale.
  const submitSnapshotRef = useRef<ConnectionState | null>(null);
  const hasLeftSnapshotRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGatewayUrl(currentSettings?.gatewayUrl ?? "");
    setToken(currentSettings?.token ?? "");
    setPending(false);
    submitSnapshotRef.current = null;
    hasLeftSnapshotRef.current = false;
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // intentionally not depending on currentSettings — sync only on open, never mid-typing (matches SettingsDialog)

  useEffect(() => {
    if (!pending) return;
    const snapshot = submitSnapshotRef.current;
    if (snapshot !== null && connectionState !== snapshot) {
      hasLeftSnapshotRef.current = true;
    }
    if (snapshot !== null && !hasLeftSnapshotRef.current) return;
    if (connectionState === ConnectionState.CONNECTED) {
      setPending(false);
      submitSnapshotRef.current = null;
      hasLeftSnapshotRef.current = false;
      setError(null);
      onClose();
    } else if (connectionState === ConnectionState.UNREACHABLE) {
      setPending(false);
      submitSnapshotRef.current = null;
      hasLeftSnapshotRef.current = false;
      setError(
        "Couldn't reach the Hermes API server at that URL. Check the address and try again.",
      );
    } else if (connectionState === ConnectionState.AUTH_FAILED) {
      setPending(false);
      submitSnapshotRef.current = null;
      hasLeftSnapshotRef.current = false;
      setError("Hermes rejected the API key. Check API_SERVER_KEY in ~/.hermes/.env.");
    }
  }, [pending, connectionState, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = gatewayUrl.trim();
    const validation = validateGatewayUrl(trimmedUrl);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const trimmedToken = token.trim() || undefined;
    const credsChanged =
      trimmedUrl !== currentSettings?.gatewayUrl || trimmedToken !== currentSettings?.token;
    const next: Settings = {
      gatewayUrl: trimmedUrl,
      token: trimmedToken,
      deviceToken: credsChanged ? undefined : currentSettings?.deviceToken,
    };
    setError(null);
    setPending(true);
    submitSnapshotRef.current = connectionState;
    hasLeftSnapshotRef.current = false;
    onSave(next);
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <header
        className="flex shrink-0 items-center justify-between gap-s bg-background px-ml py-m"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-heading text-md font-bold text-text-neutral-primary">Settings</h2>
        <HeaderIconButton onClick={onClose} label="Close settings">
          <X size={18} />
        </HeaderIconButton>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-ml pb-ml pt-m"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <form onSubmit={handleSubmit} className="mt-ml flex flex-col gap-ml">
          <p className="text-sm text-text-neutral-tertiary">
            Connect Hermes OS to the Hermes OpenAI-compatible API server. Add{" "}
            <code className="rounded bg-foreground px-1 font-mono">API_SERVER_ENABLED=true</code>{" "}
            and <code className="font-mono">API_SERVER_KEY</code> to{" "}
            <code className="rounded bg-foreground px-1 font-mono">~/.hermes/.env</code>, then run{" "}
            <code className="rounded bg-foreground px-1 font-mono">hermes gateway</code>. The
            default API base URL is{" "}
            <code className="rounded bg-foreground px-1 font-mono">http://127.0.0.1:8642/v1</code>.
          </p>

          <div className="flex flex-col gap-xs">
            <label className="font-label text-sm font-medium text-text-neutral-secondary">
              Hermes API Base URL
            </label>
            <input
              type="url"
              required
              placeholder="http://127.0.0.1:8642/v1"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              disabled={pending}
              className="h-11 rounded-lg border border-border-default bg-background px-m text-sm text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary focus:ring-2 focus:ring-border-default disabled:opacity-60 dark:border-border-default/16 dark:bg-foreground"
            />
            <p className="text-sm text-text-neutral-tertiary">
              Use <code className="font-mono">http://</code> for local and{" "}
              <code className="font-mono">https://</code> for remote.
            </p>
          </div>

          <div className="flex flex-col gap-xs">
            <label className="font-label text-sm font-medium text-text-neutral-secondary">
              API Key
            </label>
            <input
              type="password"
              placeholder="Paste API_SERVER_KEY here"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={pending}
              className="h-11 rounded-lg border border-border-default bg-background px-m text-sm text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary focus:ring-2 focus:ring-border-default disabled:opacity-60 dark:border-border-default/16 dark:bg-foreground"
            />
            <p className="text-sm text-text-neutral-tertiary">
              Use the value of <code className="font-mono">API_SERVER_KEY</code> from{" "}
              <code className="rounded bg-foreground px-1 font-mono">~/.hermes/.env</code>. Stored
              locally in this browser.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-status-error bg-danger-background px-m py-s text-sm text-text-danger-primary"
            >
              {error}
            </div>
          ) : null}

          {pending ? (
            <div className="flex items-center gap-s text-sm text-text-neutral-tertiary">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-status-warning" />
              Connecting to {gatewayUrl.trim()}…
            </div>
          ) : null}

          <MobileButton type="submit" variant="primary" fullWidth disabled={pending}>
            {pending ? "Connecting…" : "Save & Connect"}
          </MobileButton>
        </form>
      </div>
    </div>
  );
}
