"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Link2, Loader2, Play, Wrench } from "lucide-react";
import {
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";

import type { FeedbackItem, ToolContextData, ToolOption } from "../types";
import { notifyFeedbackInboxFailure } from "../helpers";

export function ToolContextSection({
  item,
  showSectionChrome = true,
  onAssignmentChanged,
}: {
  item: FeedbackItem;
  showSectionChrome?: boolean;
  onAssignmentChanged?: () => void;
}) {
  const [tools, setTools] = useState<ToolOption[]>([]);
  const [assignedToolId, setAssignedToolId] = useState<number | null>(null);
  const [suggestedToolId, setSuggestedToolId] = useState<number | null>(null);
  const [context, setContext] = useState<ToolContextData | null>(null);
  const [suggestedContext, setSuggestedContext] = useState<ToolContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        const [toolsResult, matchResult] = await Promise.allSettled([
          apiFetch<{ tools?: ToolOption[] }>(
            "/api/admin/feedback/tools?action=list",
          ),
          apiFetch<{
            match?: { id: number };
            context?: ToolContextData | null;
          }>(`/api/admin/feedback/tools?action=match&feedbackId=${item.id}`),
        ]);

        if (cancelled) return;

        if (toolsResult.status === "fulfilled") {
          setTools(toolsResult.value.tools ?? []);
        } else {
          reportNonCriticalFailure({
            area: "feedback-inbox",
            operation: "load-feedback-tools",
            error: toolsResult.reason,
            userVisibleFallback: "Tool assignment options could not be loaded.",
            metadata: { feedbackId: item.id },
          });
        }

        if (matchResult.status === "fulfilled") {
          const data = matchResult.value;
          if (item.tool_id) {
            setAssignedToolId(item.tool_id);
            try {
              const assignedData = await apiFetch<{ context?: ToolContextData | null }>(
                `/api/admin/feedback/tools?action=resolve&toolId=${item.tool_id}`,
              );
              if (!cancelled) {
                setContext(assignedData.context ?? null);
              }
            } catch (err) {
              reportNonCriticalFailure({
                area: "feedback-inbox",
                operation: "load-saved-tool-context",
                error: err,
                userVisibleFallback: "Saved tool context could not be loaded.",
                metadata: { feedbackId: item.id, toolId: item.tool_id },
              });
            }
          } else if (data.match) {
            setSuggestedToolId(data.match.id);
            setSuggestedContext(data.context ?? null);
          }
        } else {
          reportNonCriticalFailure({
            area: "feedback-inbox",
            operation: "match-feedback-tool",
            error: matchResult.reason,
            userVisibleFallback: "Feedback tool auto-match could not be loaded.",
            metadata: { feedbackId: item.id },
          });
        }
      } catch (error) {
        reportNonCriticalFailure({
          area: "feedback-inbox",
          operation: "initialize-tool-context",
          error,
          userVisibleFallback: "Tool context could not be initialized.",
          metadata: { feedbackId: item.id },
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.tool_id]);

  async function handleAssign(toolId: number | null) {
    setLoading(true);
    try {
      await apiFetch("/api/admin/feedback/tools", {
        method: "POST",
        body: JSON.stringify({ feedbackId: item.id, toolId }),
      });
      setAssignedToolId(toolId);
      if (toolId) {
        try {
          const data = await apiFetch<{ context?: ToolContextData | null }>(
            `/api/admin/feedback/tools?action=resolve&toolId=${toolId}`,
          );
          setContext(data.context ?? null);
        } catch (err) {
          reportNonCriticalFailure({
            area: "feedback-inbox",
            operation: "load-assigned-tool-context",
            error: err,
            userVisibleFallback: "Tool assignment saved, but context could not be loaded.",
            metadata: { feedbackId: item.id, toolId },
          });
        }
      } else {
        setContext(null);
      }
      onAssignmentChanged?.();
      toast.success(toolId ? "Tool assigned" : "Tool cleared");
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "assign-tool",
        title: "Could not assign tool",
        fallback: "The feedback tool assignment could not be saved.",
        error: err,
        metadata: { feedbackId: item.id, toolId },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoMatch() {
    setLoading(true);
    try {
      const data = await apiFetch<{ item?: { tool_id?: number | null } }>(
        "/api/admin/feedback/tools",
        {
          method: "POST",
          body: JSON.stringify({ feedbackId: item.id, toolId: null, auto: true }),
        },
      );
      const newToolId = data.item?.tool_id;
      setAssignedToolId(newToolId ?? null);
      setSuggestedToolId(newToolId ?? null);
      if (newToolId) {
        try {
          const ctxData = await apiFetch<{ context?: ToolContextData | null }>(
            `/api/admin/feedback/tools?action=resolve&toolId=${newToolId}`,
          );
          setContext(ctxData.context ?? null);
          setSuggestedContext(ctxData.context ?? null);
        } catch (err) {
          reportNonCriticalFailure({
            area: "feedback-inbox",
            operation: "load-auto-matched-tool-context",
            error: err,
            userVisibleFallback: "Tool auto-match saved, but context could not be loaded.",
            metadata: { feedbackId: item.id, toolId: newToolId },
          });
        }
        onAssignmentChanged?.();
        toast.success("Tool auto-matched");
      } else {
        setContext(null);
        setSuggestedContext(null);
        toast("No matching tool found", { description: "Assign one manually." });
      }
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "auto-match-tool",
        title: "Could not auto-match tool",
        fallback: "The feedback tool could not be auto-matched.",
        error: err,
        metadata: { feedbackId: item.id },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCrawl() {
    if (!context) return;
    const slug = tools.find((t) => t.id === assignedToolId)?.slug;
    if (!slug) return;

    setCrawling(true);
    try {
      await apiFetch("/api/admin/feedback/crawl", {
        method: "POST",
        body: JSON.stringify({ slug }),
      });
      toast.success("Procore crawl complete", {
        description: `Manifest saved for ${slug}`,
      });
    } catch (err) {
      notifyFeedbackInboxFailure({
        operation: "crawl-tool-context",
        title: "Could not crawl Procore context",
        fallback: "The Procore context crawl failed.",
        error: err,
        metadata: {
          feedbackId: item.id,
          toolSlug: slug,
        },
      });
    } finally {
      setCrawling(false);
    }
  }

  const assignedTool = tools.find((t) => t.id === assignedToolId);
  const suggestedTool =
    suggestedToolId && suggestedToolId !== assignedToolId
      ? tools.find((t) => t.id === suggestedToolId) ?? null
      : null;
  const activeContext = assignedToolId ? context : suggestedContext;

  return (
    <div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Select
              value={assignedToolId ? String(assignedToolId) : "unassigned"}
              onValueChange={(value) => {
                if (value === "unassigned") {
                  void handleAssign(null);
                  return;
                }
                void handleAssign(Number(value));
              }}
              disabled={loading}
            >
              <SelectTrigger className="h-8 text-xs">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Assign tool" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">No assigned tool</SelectItem>
                {tools.map((tool) => (
                  <SelectItem key={tool.id} value={String(tool.id)}>
                    {tool.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAutoMatch}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Auto-detect tool from feedback content"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Auto-match
          </Button>
        </div>

        {suggestedTool ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>Suggested:</span>
            <span className="font-medium text-foreground">{suggestedTool.name}</span>
            <span aria-hidden className="text-border">
              /
            </span>
            <span>{suggestedTool.category}</span>
          </div>
        ) : null}

        {assignedTool ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{assignedTool.name}</span>
            <span aria-hidden className="text-border">
              /
            </span>
            <span>{assignedTool.category}</span>
            {activeContext ? (
              <>
                <span aria-hidden className="text-border">
                  /
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-auto px-0 py-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => setShowDetails((value) => !value)}
                >
                  {showDetails ? "Hide tool details" : "Show tool details"}
                  <ChevronDown
                    className={cn(
                      "ml-1 h-3 w-3 transition-transform",
                      showDetails && "rotate-180",
                    )}
                  />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeContext && showDetails ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {activeContext.procore_url ? (
            <a
              href={activeContext.procore_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {activeContext.procore_url.replace(/https?:\/\/[^/]+/, "")}
              </span>
            </a>
          ) : null}
          <div className="space-y-1 text-xs text-muted-foreground">
            {activeContext.prp_path ? (
              <p className="truncate">
                <span className="font-medium text-foreground">PRP:</span>{" "}
                <code>{activeContext.prp_path}</code>
              </p>
            ) : null}
            <p className="truncate">
              <span className="font-medium text-foreground">Research:</span>{" "}
              <code>{activeContext.research_folder}</code>
            </p>
            <p className="truncate">
              <span className="font-medium text-foreground">Manifest:</span>{" "}
              <code>{activeContext.manifest_path}</code>
            </p>
          </div>
        </div>
      ) : null}

      {activeContext ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCrawl}
            disabled={crawling}
            className="h-auto px-0 py-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            {crawling ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1 h-3 w-3" />
            )}
            {crawling ? "Crawling Procore..." : "Refresh tool context"}
          </Button>
        </div>
      ) : null}

      {!activeContext && !loading && showSectionChrome && (
        <EmptyState
          icon={<Wrench />}
          title={suggestedTool ? "Tool suggestion available" : "No tool matched"}
          description={
            suggestedTool
              ? "Review the suggestion or assign the correct tool manually."
              : "Assign one manually or click Auto-match."
          }
        />
      )}
    </div>
  );
}
