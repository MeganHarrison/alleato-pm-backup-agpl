"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface Annotation {
  id: string;
  type: string;
  message: string;
  url?: string;
  selector?: string;
  severity?: string;
  created_at?: string;
  acknowledged?: boolean;
  resolved?: boolean;
  resolved_at?: string;
  ai_reply?: string;
  screenshot_url?: string;
  component_hint?: string;
  status?: string;
}

interface Props {
  pageUrl: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AnnotationsTab({ pageUrl }: Props) {
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [filter, setFilter] = React.useState<"all" | "pending" | "resolved">("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dev-panel/annotations?url=${encodeURIComponent(pageUrl)}`);
      if (res.ok) {
        const data = await res.json() as { annotations: Annotation[] };
        setAnnotations(data.annotations ?? []);
      }
    } catch {
      // annotations service may not always be available
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, [pageUrl]);

  React.useEffect(() => {
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const visible = annotations.filter((a) => {
    if (filter === "pending") return !a.resolved;
    if (filter === "resolved") return a.resolved;
    return true;
  });

  const pendingCount = annotations.filter((a) => !a.resolved).length;
  const resolvedCount = annotations.filter((a) => a.resolved).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Filter pills */}
          {(["all", "pending", "resolved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium transition-colors capitalize",
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {pendingCount}
                </span>
              )}
              {f === "resolved" && resolvedCount > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground">
                  {resolvedCount}
                </span>
              )}
            </button>
          ))}
          {lastChecked && (
            <span className="text-[10px] text-muted-foreground/50">
              · {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[11px] text-primary hover:underline disabled:opacity-40"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <span className="text-xl">{annotations.length === 0 ? "✓" : "🔍"}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {annotations.length === 0
                ? "No annotations for this page yet."
                : `No ${filter} annotations.`}
            </p>
            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground/70">
                Annotations appear here when the agentation browser extension flags issues.
                Use watch mode in Claude Code to auto-resolve them.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visible.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "px-4 py-3 transition-colors",
                  a.resolved ? "opacity-60" : "",
                )}
              >
                {/* Top row: status badge + time */}
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                    a.resolved
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : a.acknowledged
                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
                  )}>
                    {a.status ?? "pending"}
                  </span>
                  {a.component_hint && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {a.component_hint}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {a.created_at ? timeAgo(a.created_at) : ""}
                  </span>
                </div>

                {/* Message */}
                <p className="text-xs text-foreground">{a.message}</p>

                {/* Selector */}
                {a.selector && (
                  <p className="mt-1 truncate text-[10px] font-mono text-muted-foreground/60">
                    {a.selector}
                  </p>
                )}

                {/* AI reply */}
                {a.ai_reply && (
                  <div className="mt-2 rounded bg-primary/5 px-2.5 py-2">
                    <p className="mb-0.5 text-[10px] font-semibold text-primary">AI Reply</p>
                    <p className="text-[11px] text-foreground/80">{a.ai_reply}</p>
                  </div>
                )}

                {/* Screenshot thumbnail */}
                {a.screenshot_url && (
                  <div className="mt-2">
                    { }
                    <img
                      src={a.screenshot_url}
                      alt="Annotation screenshot"
                      className="h-20 w-auto rounded border border-border/40 object-cover object-top"
                    />
                  </div>
                )}

                {/* Resolved timestamp */}
                {a.resolved && a.resolved_at && (
                  <p className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    Resolved {timeAgo(a.resolved_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
