"use client";

/**
 * DevAnnotationOverlay
 *
 * Floating dev tool — only renders in development mode.
 * Lets Megan annotate any page and have Claude Code respond.
 *
 * Usage in root layout.tsx:
 *   import { DevAnnotationOverlay } from "@/components/dev/dev-annotation-overlay";
 *   ...
 *   {process.env.NODE_ENV === "development" && <DevAnnotationOverlay />}
 *
 * How it works:
 * 1. Floating button appears bottom-right in dev mode
 * 2. Click opens panel — current route pre-filled
 * 3. Optionally capture screenshot (uses html-to-image)
 * 4. Submit creates annotation via POST /api/dev/annotate
 * 5. Badge shows count of unresolved annotations
 * 6. Panel shows all annotations + Claude Code's replies
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

type Annotation = {
  id: string;
  route: string;
  comment: string;
  status: string;
  created_at: string;
  ai_reply: string | null;
  ai_replied_at: string | null;
  screenshot_url: string | null;
};

export function DevAnnotationOverlay() {
  const pathname = usePathname()!;
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [tab, setTab] = useState<"new" | "history">("new");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for annotation updates every 20s when panel is open
  const fetchAnnotations = useCallback(async () => {
    try {
      const result = await apiFetch<{ annotations?: Annotation[] }>(
        "/api/dev/annotate?status=all",
      );
      setAnnotations(result?.annotations ?? []);
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  useEffect(() => {
    if (open) {
      fetchAnnotations();
      pollRef.current = setInterval(fetchAnnotations, 20000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, fetchAnnotations]);

  const captureScreenshot = async () => {
    setCapturing(true);
    try {
      const { toPng } = await import("html-to-image");
      const main = document.querySelector("main") ?? document.body;
      const dataUrl = await toPng(main, {
        pixelRatio: 0.5,
        backgroundColor: "#ffffff",
      });
      setScreenshotData(dataUrl);
    } catch {
      // Screenshot is optional — fail silently
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/dev/annotate", {
        method: "POST",
        body: JSON.stringify({
          route: pathname,
          comment: comment.trim(),
          screenshotDataUrl: screenshotData,
          componentHint: null,
        }),
      });
      setComment("");
      setScreenshotData(null);
      setTab("history");
      await fetchAnnotations();
    } catch {
      // Silent — keep user's comment so they can retry
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = annotations.filter(
    (a) => a.status === "open" || a.status === "in_progress"
  ).length;

  const repliedCount = annotations.filter((a) => a.status === "replied").length;

  return (
    <>
      {/* Floating trigger button */}
      <div className="fixed bottom-16 right-4 z-[9999] flex flex-col items-end gap-2 sm:bottom-4">
        {repliedCount > 0 && !open && (
          <div className="border border-status-info/20 bg-status-info/10 text-status-info text-xs rounded-full px-2 py-0.5 animate-pulse">
            {repliedCount} reply{repliedCount > 1 ? " replies" : ""} from Claude
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="relative flex items-center gap-1.5 rounded-full border border-border bg-foreground px-3 py-2 text-xs font-medium text-background shadow-sm transition-colors hover:bg-foreground/90"
          title="Dev annotation bridge"
        >
          <span className="text-base">🤖</span>
          <span>Dev Bridge</span>
          {openCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 border border-status-warning/20 bg-status-warning/10 text-status-warning text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {openCount}
            </span>
          )}
        </Button>
      </div>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-28 right-4 z-[9999] w-96 bg-background border border-border rounded-xl shadow-sm flex flex-col overflow-hidden sm:bottom-16"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Dev Bridge</span>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                {pathname}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              ×
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTab("new")}
              className={`flex-1 rounded-none border-b-2 px-0 text-xs font-medium transition-colors ${
                tab === "new"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              + New annotation
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTab("history")}
              className={`relative flex-1 rounded-none border-b-2 px-0 text-xs font-medium transition-colors ${
                tab === "history"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              History
              {repliedCount > 0 && (
                <span className="absolute top-1 right-4 border border-status-info/20 bg-status-info/10 text-status-info text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {repliedCount}
                </span>
              )}
            </Button>
          </div>

          {/* New annotation tab */}
          {tab === "new" && (
            <div className="flex flex-col gap-3 p-4">
              <Textarea
                placeholder="Describe the issue or what you want Claude Code to look at..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none text-sm"
                style={{ minHeight: 100 }}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={captureScreenshot}
                  disabled={capturing}
                  className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {capturing ? "Capturing..." : screenshotData ? "✓ Screenshot captured" : "📷 Add screenshot"}
                </Button>
                {screenshotData && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScreenshotData(null)}
                    className="h-auto px-0 text-xs text-destructive hover:underline"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {screenshotData && (
                <img
                  src={screenshotData}
                  alt="Screenshot preview"
                  className="rounded border border-border w-full object-cover max-h-24"
                />
              )}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !comment.trim()}
                size="sm"
                className="w-full"
              >
                {submitting ? "Sending..." : "Send to Claude Code"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Claude Code will poll this, open the page in agent-browser, and reply here.
              </p>
            </div>
          )}

          {/* History tab */}
          {tab === "history" && (
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {annotations.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No annotations yet. Create one to get started.
                </div>
              )}
              {annotations.map((a) => (
                <div key={a.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-foreground leading-snug">{a.comment}</p>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        a.status === "replied"
                          ? "bg-status-info/10 text-status-info dark:bg-status-info/20 dark:text-status-info"
                          : a.status === "resolved"
                          ? "bg-status-success/10 text-status-success dark:bg-status-success/20 dark:text-status-success"
                          : "bg-status-warning/10 text-status-warning dark:bg-status-warning/20 dark:text-status-warning"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{a.route}</span>
                    <span className="text-[10px] text-muted-foreground">
                      · {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {a.ai_reply && (
                    <div className="bg-status-info/10 dark:bg-status-info/15 border border-status-info/20 dark:border-status-info/30 rounded-lg p-2.5 mt-1">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-medium text-status-info">
                          Claude Code
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          · {a.ai_replied_at ? new Date(a.ai_replied_at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {a.ai_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
