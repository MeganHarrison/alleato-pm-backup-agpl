"use client";

import * as React from "react";

import {
  ClipboardCopy,
  FileCode,
  GitBranch,
  GripHorizontal,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

import { AnnotationsTab } from "@/components/dev-panel/AnnotationsTab";
import { ChatTab } from "@/components/dev-panel/ChatTab";
import { CommentsTab } from "@/components/dev-panel/CommentsTab";
import { DebugTab, type ConsoleEntry, type NetworkEntry } from "@/components/dev-panel/DebugTab";
import { FeedbackTab } from "@/components/dev-panel/FeedbackTab";
import { GapsTab } from "@/components/dev-panel/GapsTab";
import { SchemaTab } from "@/components/dev-panel/SchemaTab";
import { ScreenshotsTab } from "@/components/dev-panel/ScreenshotsTab";
import { SpecTab } from "@/components/dev-panel/SpecTab";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { featureFromPathname } from "@/lib/procore-route-map";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBrowserUser } from "@/lib/supabase/current-user";
import { useProcorePanelStore } from "@/lib/stores/procore-panel-store";
import { cn } from "@/lib/utils";

// ─── Tab definitions ────────────────────────────────────────────────────────

type TabId = "screenshots" | "spec" | "schema" | "gaps" | "feedback" | "debug" | "annotations" | "comments" | "chat";

const TABS: { id: TabId; label: string }[] = [
  { id: "screenshots",  label: "Screenshots" },
  { id: "spec",         label: "Spec" },
  { id: "schema",       label: "Schema" },
  { id: "gaps",         label: "Gaps" },
  { id: "feedback",     label: "Feedback" },
  { id: "debug",        label: "Debug" },
  { id: "annotations",  label: "Annotations" },
  { id: "comments",     label: "Comments" },
  { id: "chat",         label: "Ask Procore" },
];

// ─── Console + Network interception ─────────────────────────────────────────

let _entryId = 0;

function serializeArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(arg, (_k, v) => {
      if (typeof v === "function") return `[Function]`;
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    });
  } catch { return String(arg); }
}

// ─── Column map inference ────────────────────────────────────────────────────

function inferColumnMappings(pathname: string) {
  const headers = typeof document !== "undefined"
    ? Array.from(document.querySelectorAll("table thead th"))
        .map((el) => el.textContent?.trim() ?? "")
        .filter((t) => t.length > 0 && t !== "Select" && t !== "Actions")
    : [];

  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const tableName = last && !last.toLowerCase().endsWith("id") ? last.replaceAll("-", "_") : "Unknown";

  return {
    tableName,
    mappings: headers.map((h) => ({
      visibleColumnName: h,
      actualColumnOrFormula: h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      notes: "Inferred from visible header — verify in source",
    })),
  };
}

// ─── Copy context for Claude ─────────────────────────────────────────────────

async function copyClaudeContext(feature: string | null) {
  if (!feature) { toast.error("No feature detected for this page"); return; }
  const parts: string[] = [`# Dev context: ${feature}\n`];

  try {
    const [specRes, gapsRes] = await Promise.all([
      apiFetch<{
        tool?: { name?: string; status?: string; description?: string };
        manifestStates?: Record<string, { columns?: { label: string }[] }>;
      }>(`/api/dev-panel/spec/${feature}`),
      apiFetch<{ findings?: { status: string; gap_id: string; severity: string; layer: string; description?: string }[] }>(
        `/api/dev-panel/gaps/${feature}`,
      ),
    ]);

    if (specRes?.tool) {
      parts.push(`## Tool: ${specRes.tool.name} (${specRes.tool.status})`);
      if (specRes.tool.description) parts.push(specRes.tool.description);
    }

    const states = Object.entries(specRes?.manifestStates ?? {}) as [string, { columns?: {label:string}[] }][];
    if (states.length) {
      parts.push(`\n## Procore views (${states.length})`);
      states.forEach(([id, s]) => {
        parts.push(`- ${id}: ${(s.columns ?? []).map((c) => c.label).join(", ")}`);
      });
    }

    const openGaps = (gapsRes?.findings ?? []).filter((f: {status:string}) => f.status === "open");
    if (openGaps.length) {
      parts.push(`\n## Open gaps (${openGaps.length})`);
      openGaps.forEach((f: {gap_id:string; severity:string; layer:string; description?:string}) => {
        parts.push(`- ${f.gap_id} [${f.severity}/${f.layer}]: ${f.description ?? "(no description)"}`);
      });
    }
  } catch (error) {
    reportNonCriticalFailure({
      area: "procore-reference-panel",
      operation: "copy-context-open-gaps",
      error,
      userVisibleFallback: "Open gaps were not included in copied context.",
    });
  }

  await navigator.clipboard.writeText(parts.join("\n"));
  toast.success("Context copied — paste into Claude Code");
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export function ProcoreReferencePanel() {
  const open    = useProcorePanelStore((s) => s.open);
  const setOpen = useProcorePanelStore((s) => s.setOpen);
  const pathname = usePathname()!;
  const params   = useParams()! as Record<string, string | string[] | undefined>;

  const [activeTab, setActiveTab]                   = React.useState<TabId>("screenshots");
  const [screenshotExpanded, setScreenshotExpanded] = React.useState(false);

  // Badge counts
  const [gapCount,      setGapCount]      = React.useState<number | null>(null);
  const [feedbackCount, setFeedbackCount] = React.useState<number | null>(null);
  const [commentCount,  setCommentCount]  = React.useState<number | null>(null);
  const [debugCount,    setDebugCount]    = React.useState(0);
  const [dbOnline,      setDbOnline]      = React.useState<boolean | null>(null);

  // User
  const [userName,  setUserName]  = React.useState("You");
  const [userEmail, setUserEmail] = React.useState<string | undefined>();

  // Console + Network interception
  const [consoleEntries, setConsoleEntries] = React.useState<ConsoleEntry[]>([]);
  const [networkEntries, setNetworkEntries] = React.useState<NetworkEntry[]>([]);

  // Column map state (inferred from DOM, updated on pathname change)
  const [detectedTableName, setDetectedTableName] = React.useState("Unknown");
  const [columnMappings, setColumnMappings] = React.useState<{ visibleColumnName: string; actualColumnOrFormula: string; notes: string }[]>([]);

  // Quick-action state
  const [isCheckingRoutes, setIsCheckingRoutes] = React.useState(false);

  const feature = featureFromPathname(pathname ?? "");

  // ── Auth ────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    getCurrentBrowserUser(createClient()).then((user) => {
      if (user) {
        setUserName(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "You");
        setUserEmail(user.email ?? undefined);
      }
    }).catch((error) => {
      console.warn("[ProcoreReferencePanel] Failed to resolve current user.", error);
    });
  }, []);

  // ── DB connection status ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;

    void apiFetch("/api/health")
      .then(() => setDbOnline(true))
      .catch(() => setDbOnline(false));
  }, [open]);

  // ── Console interception ─────────────────────────────────────────────────
  React.useEffect(() => {
    const origError = console.error;
    const origWarn  = console.warn;

    console.error = (...args) => {
      origError(...args);
      const msg = args.map(serializeArg).join(" ");
      setConsoleEntries((prev) => [{ id: ++_entryId, message: msg, timestamp: Date.now(), type: "error" }, ...prev.slice(0, 49)]);
      setDebugCount((n) => n + 1);
    };
    console.warn = (...args) => {
      origWarn(...args);
      const msg = args.map(serializeArg).join(" ");
      setConsoleEntries((prev) => [{ id: ++_entryId, message: msg, timestamp: Date.now(), type: "warning" }, ...prev.slice(0, 49)]);
    };

    return () => { console.error = origError; console.warn = origWarn; };
  }, []);

  // ── Fetch interception ───────────────────────────────────────────────────
  React.useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = Date.now();
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].toString() : (args[0] as Request).url;
      const method = (typeof args[1] === "object" && args[1]?.method) ? args[1].method : "GET";

      // Only track /api/ calls
      if (!url.includes("/api/")) return origFetch(...args);

      try {
        const res = await origFetch(...args);
        setNetworkEntries((prev) => [{
          id: ++_entryId, url, method, status: res.status,
          duration: Date.now() - start, timestamp: Date.now(),
        }, ...prev.slice(0, 99)]);
        if (res.status >= 400) setDebugCount((n) => n + 1);
        return res;
      } catch (err) {
        setNetworkEntries((prev) => [{
          id: ++_entryId, url, method, status: 0,
          duration: Date.now() - start, timestamp: Date.now(),
          error: String(err),
        }, ...prev.slice(0, 99)]);
        setDebugCount((n) => n + 1);
        throw err;
      }
    };
    return () => { window.fetch = origFetch; };
  }, []);

  // ── Column map inference (runs after render so DOM is available) ─────────
  React.useEffect(() => {
    const { tableName, mappings } = inferColumnMappings(pathname ?? "");
    setDetectedTableName(tableName);
    setColumnMappings(mappings);
  }, [pathname]);

  // ── Badge counts ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!feature || !open) return;

    apiFetch<{ findings?: { status: string }[] }>(`/api/dev-panel/gaps/${feature}`)
      .then((d) => {
        setGapCount((d?.findings ?? []).filter((f) => f.status === "open").length);
      })
      .catch(() => {});

    apiFetch<{ feedback?: { status: string }[] }>(`/api/dev-panel/feedback/${feature}`)
      .then((d) => {
        setFeedbackCount((d?.feedback ?? []).filter((f) => f.status === "open").length);
      })
      .catch(() => {});

    apiFetch<{ comments?: unknown[] }>(`/api/dev-panel/comments/${feature}`)
      .then((d) => setCommentCount((d?.comments ?? []).length))
      .catch(() => {});
  }, [feature, open]);

  const badges: Partial<Record<TabId, number>> = {
    gaps:     gapCount      ?? 0,
    feedback: feedbackCount ?? 0,
    comments: commentCount  ?? 0,
    debug:    debugCount,
  };

  // ── Quick actions ────────────────────────────────────────────────────────
  const clearCache = async () => {
    try {
      const d = await apiFetch<{ success?: boolean; message?: string }>(
        "/api/dev-tools/clear-cache",
        { method: "POST" },
      );
      toast[d?.success ? "success" : "error"](d?.success ? "Cache cleared — refresh the page." : (d?.message ?? "Failed"));
    } catch (err) { toast.error("Failed to clear cache"); }
  };

  const regenTypes = async () => {
    try {
      const d = await apiFetch<{ success?: boolean; message?: string }>(
        "/api/dev-tools/regenerate-types",
        { method: "POST" },
      );
      toast[d?.success ? "success" : "error"](d?.success ? "Types regenerated successfully." : (d?.message ?? "Failed"));
    } catch (err) { toast.error("Failed to regenerate types"); }
  };

  const checkRoutes = async () => {
    setIsCheckingRoutes(true);
    try {
      const d = await apiFetch<{ conflicts?: string }>("/api/dev-tools/check-routes");
      toast.info(d?.conflicts ?? "No route conflicts found");
    } catch (err) { toast.error("Route check failed"); }
    finally { setIsCheckingRoutes(false); }
  };

  // ── Panel height (drag-to-resize) ────────────────────────────────────────
  const [userHeight, setUserHeight] = React.useState<number | null>(null);
  const dragRef = React.useRef<{ startY: number; startHeight: number } | null>(null);

  const winH = typeof window !== "undefined" ? window.innerHeight : 800;
  const defaultHeight = !open
    ? 0
    : activeTab === "screenshots" && screenshotExpanded
    ? Math.round(winH * 0.58)
    : activeTab === "screenshots"
    ? 224
    : Math.round(winH * 0.45);

  const resolvedHeight = open ? (userHeight ?? defaultHeight) : 0;

  const handleDragMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: resolvedHeight };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - ev.clientY;
        const next = Math.min(
          Math.max(dragRef.current.startHeight + delta, 120),
          Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.85),
        );
        setUserHeight(next);
      };

      const onMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [resolvedHeight],
  );

  // Reset user height when panel closes so it reopens at default size
  React.useEffect(() => {
    if (!open) setUserHeight(null);
  }, [open]);

  return (
    <div
      className={`w-full shrink-0 bg-card overflow-hidden${open ? " border-t border-border" : ""}`}
      style={{ height: resolvedHeight, transition: dragRef.current ? "none" : "height 0.3s ease-in-out" }}
    >
      {open && (
        <div className="flex h-full flex-col">
          {/* ── Resize handle ── */}
          <Button
            type="button"
            variant="ghost"
            onMouseDown={handleDragMouseDown}
            aria-label="Drag to resize panel"
            className="flex h-2 w-full shrink-0 cursor-row-resize items-center justify-center hover:bg-muted/60 transition-colors group focus:outline-none p-0 rounded-none"
          >
            <GripHorizontal className="h-3 w-8 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
          </Button>

          {/* ── Header ── */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/60 px-2">
            {/* Tab bar */}
            <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
              {TABS.map((tab) => {
                const count = badges[tab.id];
                const showBadge = count !== undefined && count > 0;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setScreenshotExpanded(false);
                      if (tab.id === "debug") setDebugCount(0);
                    }}
                    className={cn(
                      "flex h-auto shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    {showBadge && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                        tab.id === "gaps"     ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                        tab.id === "feedback" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                        tab.id === "debug"    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                        "bg-muted text-muted-foreground",
                      )}>
                        {count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Right: quick actions + status + close */}
            <div className="flex shrink-0 items-center gap-1 pl-1">
              {/* DB status dot */}
              <span
                title={dbOnline === null ? "Checking DB…" : dbOnline ? "DB connected" : "DB offline"}
                className={cn(
                  "h-2 w-2 rounded-full",
                  dbOnline === null ? "bg-muted-foreground/40" :
                  dbOnline ? "bg-emerald-500" : "bg-red-500",
                )}
              />

              {/* Feature label */}
              {feature && (
                <span className="hidden text-[10px] capitalize text-muted-foreground sm:block px-1">
                  {feature.replace(/-/g, " ")}
                </span>
              )}

              {/* Copy context */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void copyClaudeContext(feature)}
                title="Copy context for Claude"
                className="h-auto w-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
              </Button>

              {/* Clear cache */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void clearCache()}
                title="Clear Next.js cache"
                className="h-auto w-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              {/* Regen types */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void regenTypes()}
                title="Regenerate Supabase types"
                className="h-auto w-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <FileCode className="h-3.5 w-3.5" />
              </Button>

              {/* Check routes */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void checkRoutes()}
                disabled={isCheckingRoutes}
                title="Check route conflicts"
                className="h-auto w-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                {isCheckingRoutes
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <GitBranch className="h-3.5 w-3.5" />}
              </Button>

              {/* Close */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close dev panel"
                className="h-auto w-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "screenshots" && (
              <ScreenshotsTab
                key={`${pathname}-screenshots`}
                feature={feature}
                onExpandedChange={setScreenshotExpanded}
              />
            )}
            {activeTab === "spec"        && <SpecTab feature={feature} />}
            {activeTab === "schema"      && (
              <SchemaTab
                key={pathname}
                pathname={pathname ?? ""}
                params={params}
                detectedTableName={detectedTableName}
                columnMappings={columnMappings}
              />
            )}
            {activeTab === "gaps"        && <GapsTab feature={feature} />}
            {activeTab === "feedback"    && <FeedbackTab feature={feature} />}
            {activeTab === "debug"       && (
              <DebugTab
                consoleEntries={consoleEntries}
                networkEntries={networkEntries}
                onClearConsole={() => setConsoleEntries([])}
                onClearNetwork={() => setNetworkEntries([])}
              />
            )}
            {activeTab === "annotations" && <AnnotationsTab pageUrl={pathname ?? ""} />}
            {activeTab === "comments"    && (
              <CommentsTab
                feature={feature}
                currentUserName={userName}
                currentUserEmail={userEmail}
              />
            )}
            {activeTab === "chat"        && <ChatTab feature={feature} />}
          </div>
        </div>
      )}
    </div>
  );
}
