"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, ArrowRight, Copy, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

const BOT_USERNAME = "alleatoAIbot";
const BOT_URL = `https://t.me/${BOT_USERNAME}`;

interface LinkStatus {
  linked: boolean;
  mapping: {
    platform_user_id: string;
    display_name: string | null;
    created_at: string;
  } | null;
}

interface GeneratedCode {
  code: string;
  deepLink: string;
  expiresAt: string;
}

export function TelegramLinkPanel() {
  const [status, setStatus] = React.useState<LinkStatus | null>(null);
  const [generated, setGenerated] = React.useState<GeneratedCode | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await apiFetch<LinkStatus>("/api/settings/telegram/link");
      setStatus(data);
      if (data.linked && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setGenerated(null);
      }
    } catch (error) {
      reportNonCriticalFailure({
        area: "settings-integrations",
        operation: "load-telegram-link-status",
        error,
        userVisibleFallback: "Telegram link status could not be refreshed.",
      });
    }
  }, []);

  React.useEffect(() => {
    fetchStatus().finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  const startPolling = React.useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchStatus, 3000);
  }, [fetchStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await apiFetch<GeneratedCode>("/api/settings/telegram/link", { method: "POST" });
      setGenerated(data);
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link code.");
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    setError(null);
    try {
      await apiFetch("/api/settings/telegram/unlink", { method: "DELETE" });
      setStatus({ linked: false, mapping: null });
      setGenerated(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink account.");
    } finally {
      setUnlinking(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiresIn = React.useMemo(() => {
    if (!generated) return null;
    const ms = new Date(generated.expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.ceil(ms / 60000);
    return `Expires in ${mins} min`;
  }, [generated]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking status…</span>
      </div>
    );
  }

  // ── Connected state ──────────────────────────────────────────────────────
  if (status?.linked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <span className="text-sm text-foreground">
            Connected
            {status.mapping?.display_name ? ` as @${status.mapping.display_name}` : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Open <strong>@{BOT_USERNAME}</strong> on Telegram and send it a message — it knows who you are.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5"
            onClick={() => window.open(BOT_URL, "_blank")}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Open @{BOT_USERNAME}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1.5 text-muted-foreground"
            onClick={handleUnlink}
            disabled={unlinking}
          >
            {unlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            Unlink
          </Button>
        </div>
      </div>
    );
  }

  // ── Not connected — code not yet generated ────────────────────────────────
  if (!generated) {
    return (
      <div className="space-y-4">
        {/* How it works */}
        <ol className="space-y-2">
          {[
            { n: "1", text: <>Find <strong>@{BOT_USERNAME}</strong> on Telegram — or tap the button below to open it directly.</> },
            { n: "2", text: <>Click <strong>Generate code</strong>, then send the code to the bot.</> },
            { n: "3", text: <>The bot links your account and you can start chatting.</> },
          ].map(({ n, text }) => (
            <li key={n} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {n}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="text-xs h-8 gap-1.5" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Generate code
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={() => window.open(BOT_URL, "_blank")}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Open @{BOT_USERNAME}
          </Button>
        </div>
      </div>
    );
  }

  // ── Code generated — waiting for user to send it ──────────────────────────
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Send this code to <strong>@{BOT_USERNAME}</strong> on Telegram. Tap{" "}
        <strong>Open in Telegram</strong> to do it automatically, or copy the code and paste it manually.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="text-xs h-8 gap-1.5"
          onClick={() => window.open(generated.deepLink, "_blank")}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Open in Telegram
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 gap-1.5"
          onClick={() => handleCopy(generated.code)}
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied!" : `Copy code · ${generated.code}`}
        </Button>
      </div>

      {expiresIn && (
        <p className="text-xs text-muted-foreground">{expiresIn} · Waiting for confirmation…</p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs text-muted-foreground underline-offset-2 hover:underline hover:bg-transparent"
        onClick={handleGenerate}
      >
        Regenerate code
      </Button>
    </div>
  );
}
