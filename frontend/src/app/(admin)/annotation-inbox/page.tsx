"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Copy, Plus, RefreshCw, Send, Sparkles } from "lucide-react";
import { appToast as toast } from "@/lib/toast/app-toast";
import { apiFetch, ApiError } from "@/lib/api-client";

type AgentTarget = "codex" | "claude_code";
type StatusFilter = "all" | "open" | "in_progress" | "resolved";
type AssigneeFilter = "all" | AgentTarget | "unassigned";

type VerificationChecklist = {
  rootCause: boolean;
  tests: boolean;
  evidence: boolean;
};

type DispatchHistoryEntry = {
  target: AgentTarget;
  at: string;
  by: string;
  status: string;
  annotationId: string | null;
};

type FeedbackItem = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  comment: string;
  page_url: string;
  page_path: string;
  severity: string | null;
  status: string;
  target_selector: string;
  metadata: Record<string, unknown> | null;
};

type FeedbackComment = {
  id: string;
  body: string;
  created_at: string;
  author: {
    full_name: string | null;
    email: string;
  };
};

const OPEN_STATES = new Set(["open", "submitted", "github_failed"]);
const IN_PROGRESS_STATES = new Set(["in_progress", "triaged", "diagnosing", "fixing", "verifying", "in_review"]);
const RESOLVED_STATES = new Set(["resolved", "closed"]);

const EMPTY_CHECKLIST: VerificationChecklist = {
  rootCause: false,
  tests: false,
  evidence: false,
};

function displayBucket(status: string): Exclude<StatusFilter, "all"> {
  if (RESOLVED_STATES.has(status)) return "resolved";
  if (IN_PROGRESS_STATES.has(status)) return "in_progress";
  return "open";
}

function relativeTime(dateString: string) {
  const ms = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getMetadata(item: FeedbackItem) {
  if (item.metadata && typeof item.metadata === "object") {
    return item.metadata;
  }
  return {};
}

function getAgentationId(item: FeedbackItem) {
  const value = getMetadata(item).agentationId;
  if (typeof value === "string") return value;
  const legacy = getMetadata(item).annotationId;
  return typeof legacy === "string" ? legacy : null;
}

function getAssignedAgent(item: FeedbackItem): AgentTarget | null {
  const value = getMetadata(item).assignedAgent;
  if (value === "codex" || value === "claude_code") return value;
  return null;
}

function getVerificationChecklist(item: FeedbackItem): VerificationChecklist {
  const metadata = getMetadata(item);
  const value = metadata.verificationChecklist;
  if (!value || typeof value !== "object") return EMPTY_CHECKLIST;
  const record = value as Record<string, unknown>;
  return {
    rootCause: record.rootCause === true,
    tests: record.tests === true,
    evidence: record.evidence === true,
  };
}

function getDispatchHistory(item: FeedbackItem): DispatchHistoryEntry[] {
  const metadata = getMetadata(item);
  const value = metadata.dispatchHistory;
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        target: (record.target === "claude_code" ? "claude_code" : "codex") as AgentTarget,
        at: typeof record.at === "string" ? record.at : "",
        by: typeof record.by === "string" ? record.by : "",
        status: typeof record.status === "string" ? record.status : "",
        annotationId: typeof record.annotationId === "string" ? record.annotationId : null,
      };
    })
    .filter((entry) => entry.at.length > 0);
}

function agentLabel(target: AgentTarget) {
  return target === "codex" ? "Codex" : "Claude Code";
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateKey(item: FeedbackItem) {
  const selector = normalizeText(item.target_selector || "body");
  const summary = normalizeText(item.comment).slice(0, 80);
  return `${item.page_path}|${selector}|${summary}`;
}

function computePriorityScore(item: FeedbackItem, duplicateCount: number) {
  const severityScore =
    item.severity === "high" ? 50 : item.severity === "medium" ? 30 : item.severity === "low" ? 10 : 20;
  const statusScore =
    displayBucket(item.status) === "open" ? 20 : displayBucket(item.status) === "in_progress" ? 10 : 0;
  const duplicateScore = Math.min(30, Math.max(0, duplicateCount - 1) * 8);
  const ageDays = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000);
  const ageScore = Math.min(20, Math.max(0, ageDays));
  const assignmentBonus = getAssignedAgent(item) ? 0 : 5;
  return severityScore + statusScore + duplicateScore + ageScore + assignmentBonus;
}

function scoreLabel(score: number) {
  if (score >= 90) return "Critical";
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export default function AnnotationInboxPage() {
  // ── Panel resize / collapse ────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 280;
    return Number(localStorage.getItem("annotation-inbox-left-width") ?? 280);
  });
  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === "undefined") return 224;
    return Number(localStorage.getItem("annotation-inbox-right-width") ?? 224);
  });
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("annotation-inbox-left-collapsed") === "true";
  });
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("annotation-inbox-right-collapsed") === "true";
  });
  const leftDragRef = useRef(false);
  const rightDragRef = useRef(false);

  const startLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    leftDragRef.current = true;
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      if (!leftDragRef.current) return;
      const next = Math.max(180, Math.min(480, startW + ev.clientX - startX));
      setLeftWidth(next);
      localStorage.setItem("annotation-inbox-left-width", String(next));
    };
    const onUp = () => {
      leftDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  const startRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    rightDragRef.current = true;
    const startX = e.clientX;
    const startW = rightWidth;
    const onMove = (ev: MouseEvent) => {
      if (!rightDragRef.current) return;
      const next = Math.max(160, Math.min(400, startW - (ev.clientX - startX)));
      setRightWidth(next);
      localStorage.setItem("annotation-inbox-right-width", String(next));
    };
    const onUp = () => {
      rightDragRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightWidth]);

  const toggleLeft = () => {
    const next = !leftCollapsed;
    setLeftCollapsed(next);
    localStorage.setItem("annotation-inbox-left-collapsed", String(next));
  };
  const toggleRight = () => {
    const next = !rightCollapsed;
    setRightCollapsed(next);
    localStorage.setItem("annotation-inbox-right-collapsed", String(next));
  };

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<AgentTarget>("codex");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [, setLoadingComments] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [resolvingCluster, setResolvingCluster] = useState(false);
  const [lastDispatchCommand, setLastDispatchCommand] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newSeverity, setNewSeverity] = useState<"blocking" | "important" | "nit">("important");
  const [newAssignee, setNewAssignee] = useState<AgentTarget | "unassigned">("unassigned");

  function resetCreateForm() {
    setNewTitle("");
    setNewDetails("");
    setNewRoute("");
    setNewSeverity("important");
    setNewAssignee("unassigned");
  }

  async function createTask() {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setCreating(true);
    try {
      const result = await apiFetch<{ id?: string }>("/api/agentation/inbox", {
        method: "POST",
        body: JSON.stringify({
          title,
          details: newDetails.trim() || undefined,
          route: newRoute.trim() || undefined,
          severity: newSeverity,
          assignedAgent: newAssignee === "unassigned" ? undefined : newAssignee,
        }),
      });
      resetCreateForm();
      setCreateOpen(false);
      await loadItems();
      if (result?.id) setSelectedId(result.id);
      toast.success("Task created");
    } catch (error) {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function loadItems() {
    setLoading(true);
    let primaryError: ApiError | null = null;
    try {
      try {
        const data = await apiFetch<{ items?: FeedbackItem[] }>(
          "/api/agentation/inbox?limit=500",
        );
        const all = Array.isArray(data.items) ? data.items : [];
        setItems(all.filter((item) => getAgentationId(item) !== null));
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          primaryError = err;
        } else {
          throw err;
        }
      }

      // Fallback path: use the admin feedback endpoint and filter to annotation records.
      try {
        const data = await apiFetch<{ items?: FeedbackItem[] }>(
          "/api/admin/feedback?limit=500",
        );
        const all = Array.isArray(data.items) ? data.items : [];
        setItems(all.filter((item) => getAgentationId(item) !== null));
        return;
      } catch (fallbackErr) {
        const message =
          (fallbackErr instanceof Error ? fallbackErr.message : null) ||
          (primaryError ? primaryError.message : null) ||
          "Failed to load annotations";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function patchFeedback(
    id: string,
    payload: { status?: "open" | "in_progress" | "resolved"; metadata?: Record<string, unknown> },
  ) {
    await apiFetch("/api/agentation/inbox", {
      method: "PATCH",
      body: JSON.stringify({ id, ...payload }),
    });
  }

  useEffect(() => {
    void loadItems();
  }, []);

  const duplicateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = duplicateKey(item);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (statusFilter !== "all" && displayBucket(item.status) !== statusFilter) return false;
        if (assigneeFilter !== "all") {
          const assigned = getAssignedAgent(item);
          if (assigneeFilter === "unassigned" && assigned) return false;
          if ((assigneeFilter === "codex" || assigneeFilter === "claude_code") && assigned !== assigneeFilter) {
            return false;
          }
        }
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.comment.toLowerCase().includes(q) ||
          (getAgentationId(item) || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const scoreA = computePriorityScore(a, duplicateCounts.get(duplicateKey(a)) || 1);
        const scoreB = computePriorityScore(b, duplicateCounts.get(duplicateKey(b)) || 1);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [items, search, statusFilter, assigneeFilter, duplicateCounts]);

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setAssignedAgent(getAssignedAgent(selected) || "codex");
    } else {
      setSelectedId(null);
      setAssignedAgent("codex");
    }
  }, [selected?.id]);

  useEffect(() => {
    // Replies are stored in dev_annotations.ai_reply — no separate comments table.
    // Pre-populate the reply box with any existing AI reply so it's visible.
    if (selected) {
      const aiReply = selected.metadata?.aiReply;
      if (typeof aiReply === "string" && aiReply.trim()) {
        setComments([
          {
            id: `ai-${selected.id}`,
            body: aiReply,
            created_at: selected.updated_at,
            author: { full_name: "AI Reply", email: "" },
          },
        ]);
      } else {
        setComments([]);
      }
    } else {
      setComments([]);
    }
    setLoadingComments(false);
  }, [selected?.id, selected?.metadata?.aiReply]);

  const counts = useMemo(
    () => ({
      total: items.length,
      open: items.filter((item) => displayBucket(item.status) === "open").length,
      inProgress: items.filter((item) => displayBucket(item.status) === "in_progress").length,
      resolved: items.filter((item) => displayBucket(item.status) === "resolved").length,
      unassigned: items.filter((item) => !getAssignedAgent(item)).length,
    }),
    [items],
  );

  const selectedDuplicateCluster = useMemo(() => {
    if (!selected) return [];
    const key = duplicateKey(selected);
    return items.filter((item) => duplicateKey(item) === key);
  }, [items, selected?.id]);

  const selectedScore = selected
    ? computePriorityScore(selected, duplicateCounts.get(duplicateKey(selected)) || 1)
    : 0;
  const selectedDispatchHistory = selected ? getDispatchHistory(selected) : [];

  async function updateStatus(status: "open" | "in_progress" | "resolved") {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await patchFeedback(selected.id, { status });
      await loadItems();
      toast.success("Status updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function saveAssignment() {
    if (!selected) return;
    setSavingAssignment(true);
    try {
      await patchFeedback(selected.id, {
        metadata: {
          assignedAgent,
          assignedAt: new Date().toISOString(),
        },
      });
      await loadItems();
      toast.success(`Assigned to ${assignedAgent === "codex" ? "Codex" : "Claude Code"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save assignment";
      toast.error(message);
    } finally {
      setSavingAssignment(false);
    }
  }

  async function submitReply() {
    if (!selected || !replyBody.trim()) return;
    setSavingReply(true);
    try {
      await apiFetch("/api/dev/annotate", {
        method: "PATCH",
        body: JSON.stringify({
          id: selected.id,
          reply: replyBody.trim(),
          status: "replied",
        }),
      });
    } catch (error) {
      setSavingReply(false);
      toast.error("Failed to post reply");
      return;
    }
    setSavingReply(false);

    setComments([
      {
        id: `ai-${selected.id}`,
        body: replyBody.trim(),
        created_at: new Date().toISOString(),
        author: { full_name: "AI Reply", email: "" },
      },
    ]);
    setReplyBody("");
    await loadItems();
    toast.success("Reply posted");
  }

  async function dispatchToAgent() {
    if (!selected) return;
    setDispatching(true);
    try {
      // Mark in-progress in dev_annotations
      await patchFeedback(selected.id, { status: "in_progress", metadata: {
        assignedAgent,
        assignedAt: new Date().toISOString(),
      }});

      // Build a prompt Claude Code / Codex can act on directly
      const agentationId = getAgentationId(selected);
      const prompt = [
        `Fix annotation: ${selected.title}`,
        `Page: ${selected.page_path}`,
        selected.comment !== selected.title ? `Details: ${selected.comment}` : "",
        selected.target_selector ? `Element: ${selected.target_selector}` : "",
        agentationId ? `Annotation ID: ${agentationId}` : "",
      ].filter(Boolean).join("\n");

      const cliCommand = `claude "${prompt.replace(/"/g, '\\"')}"`;
      setLastDispatchCommand(cliCommand);
      await loadItems();
      void navigator.clipboard.writeText(prompt);
      toast.success(`Copied prompt for ${agentLabel(assignedAgent)}`);
    } catch {
      toast.error("Dispatch failed");
    } finally {
      setDispatching(false);
    }
  }

  function copyLastCommand() {
    if (!lastDispatchCommand) return;
    void navigator.clipboard.writeText(lastDispatchCommand);
    toast.success("Dispatch command copied");
  }

  async function resolveDuplicateCluster() {
    if (!selected || selectedDuplicateCluster.length <= 1) return;
    setResolvingCluster(true);
    try {
      await Promise.all(
        selectedDuplicateCluster.map(async (item) => {
          await patchFeedback(item.id, { status: "resolved" });
        }),
      );
      await loadItems();
      toast.success(`Resolved ${selectedDuplicateCluster.length} duplicate items`);
    } catch {
      toast.error("Failed to resolve duplicate cluster");
    } finally {
      setResolvingCluster(false);
    }
  }

  async function toggleChecklist(nextChecklist: VerificationChecklist) {
    if (!selected) return;
    try {
      await patchFeedback(selected.id, {
        metadata: {
          verificationChecklist: nextChecklist,
          verificationUpdatedAt: new Date().toISOString(),
        },
      });
      await loadItems();
    } catch {
      toast.error("Failed to update verification checklist");
    }
  }

  // Linear-style status dot colours
  function statusDot(status: string) {
    const bucket = displayBucket(status);
    if (bucket === "resolved") return "bg-green-500";
    if (bucket === "in_progress") return "bg-primary";
    return "bg-amber-400";
  }

  function priorityDot(score: number) {
    if (score >= 90) return "bg-red-600";
    if (score >= 70) return "bg-orange-500";
    if (score >= 45) return "bg-amber-400";
    return "bg-blue-400";
  }

  function severityColor(sev: string | null) {
    if (sev === "high" || sev === "blocking") return "text-red-500";
    if (sev === "medium" || sev === "important") return "text-amber-500";
    return "text-muted-foreground";
  }

  return (
    <>
    <div className="flex h-full flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 h-10 shrink-0">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList variant="default">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open {counts.open > 0 && <span className="ml-1 opacity-60 text-[10px]">{counts.open}</span>}</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress {counts.inProgress > 0 && <span className="ml-1 opacity-60 text-[10px]">{counts.inProgress}</span>}</TabsTrigger>
              <TabsTrigger value="resolved">Done {counts.resolved > 0 && <span className="ml-1 opacity-60 text-[10px]">{counts.resolved}</span>}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void loadItems()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New issue
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Issue list */}
          <section
            className="relative flex flex-col border-r border-border shrink-0 overflow-hidden transition-[width] duration-150"
             
            style={{ width: leftCollapsed ? 0 : leftWidth, minWidth: leftCollapsed ? 0 : undefined }}
          >
            {/* Search + filters */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs border-0 bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v as AssigneeFilter)}>
                <SelectTrigger className="h-7 w-32 text-xs border-0 bg-muted/30 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="claude_code">Claude Code</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                  Loading...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">No issues found.</div>
              )}
              {!loading && filtered.map((item) => {
                const duplicateCount = duplicateCounts.get(duplicateKey(item)) || 1;
                const score = computePriorityScore(item, duplicateCount);
                const isActive = selected?.id === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedId(item.id)}
                    className={`group flex w-full items-center gap-2.5 px-3 h-9 justify-start rounded-none border-b border-border/40 last:border-0 transition-colors ${
                      isActive ? "bg-primary/8" : ""
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot(score)}`} />
                    <span className="flex-1 truncate text-left text-xs text-foreground">{item.title}</span>
                    {duplicateCount > 1 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">{duplicateCount}×</span>
                    )}
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(item.updated_at)}</span>
                  </Button>
                );
              })}
            </div>
          </section>

          {/* Left resize handle + collapse toggle */}
          <div className="relative flex shrink-0 items-stretch">
            {!leftCollapsed && (
              <div
                className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                onMouseDown={startLeftResize}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={toggleLeft}
              className="absolute -right-2.5 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
              aria-label={leftCollapsed ? "Expand left panel" : "Collapse left panel"}
            >
              {leftCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          </div>

          {/* Detail panel */}
          <section className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {!selected ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Select an issue
              </div>
            ) : (
              <div className="flex h-full min-h-0">
                {/* Main content */}
                <div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
                  {/* Title */}
                  <h1 className="text-lg font-semibold text-foreground leading-snug mb-1">{selected.title}</h1>
                  <p className="text-sm text-muted-foreground mb-6">{selected.comment}</p>

                  {/* Activity label */}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Activity</p>

                  {/* Dispatch history */}
                  {selectedDispatchHistory.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {selectedDispatchHistory.map((entry, idx) => (
                        <div key={`${entry.at}-${idx}`} className="flex gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Send className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-foreground">
                              Dispatched to <span className="font-medium">{agentLabel(entry.target)}</span>
                              {entry.by && <> by {entry.by}</>}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{relativeTime(entry.at)} · {entry.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedDispatchHistory.length === 0 && (
                    <p className="text-xs text-muted-foreground mb-4">No dispatches yet.</p>
                  )}

                  {/* Replies */}
                  {comments.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary">AI</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-foreground">{comment.author.full_name || "AI Reply"}</span>
                              <span className="text-[11px] text-muted-foreground">{relativeTime(comment.created_at)}</span>
                            </div>
                            <p className="text-xs text-foreground">{comment.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Duplicates */}
                  {selectedDuplicateCluster.length > 1 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Related ({selectedDuplicateCluster.length})</p>
                      <div className="space-y-1">
                        {selectedDuplicateCluster
                          .filter((item) => item.id !== selected.id)
                          .slice(0, 5)
                          .map((item) => (
                            <Button
                              key={item.id}
                              type="button"
                              variant="ghost"
                              onClick={() => setSelectedId(item.id)}
                              className="flex items-center gap-2 w-full justify-start px-2 h-7 rounded text-xs"
                            >
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(item.status)}`} />
                              <span className="text-foreground truncate">{item.title}</span>
                            </Button>
                          ))}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs" onClick={resolveDuplicateCluster} disabled={resolvingCluster}>
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        {resolvingCluster ? "Resolving..." : "Resolve cluster"}
                      </Button>
                    </div>
                  )}

                  {/* Reply box */}
                  <div className="mt-4 border border-border/60 rounded-lg overflow-hidden">
                    <Textarea
                      placeholder="Reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={3}
                      className="border-0 resize-none text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/60">
                      <div className="flex gap-1">
                        {(["rootCause", "tests", "evidence"] as const).map((key) => {
                          const checklist = getVerificationChecklist(selected);
                          const shortLabels = { rootCause: "Root cause", tests: "Tests", evidence: "Evidence" };
                          const checkId = `checklist-${selected.id}-${key}`;
                          return (
                            <label key={key} htmlFor={checkId} className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                id={checkId}
                                checked={checklist[key]}
                                className="h-3 w-3"
                                onCheckedChange={(checked) =>
                                  void toggleChecklist({ ...checklist, [key]: checked === true })
                                }
                              />
                              <span className="text-[11px] text-muted-foreground">{shortLabels[key]}</span>
                            </label>
                          );
                        })}
                      </div>
                      <Button size="sm" className="h-6 px-3 text-xs" onClick={() => void submitReply()} disabled={savingReply || !replyBody.trim()}>
                        {savingReply ? "Sending..." : "Comment"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right resize handle + collapse toggle */}
                <div className="relative flex shrink-0 items-stretch">
                  <button
                    type="button"
                    onClick={toggleRight}
                    className="absolute -left-2.5 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                    aria-label={rightCollapsed ? "Expand right panel" : "Collapse right panel"}
                  >
                    {rightCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {!rightCollapsed && (
                    <div
                      className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
                      onMouseDown={startRightResize}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Properties sidebar — Linear-style right rail */}
                <aside
                  className="shrink-0 border-l border-border overflow-y-auto py-4 px-1 overflow-hidden transition-[width] duration-150"
                   
                  style={{ width: rightCollapsed ? 0 : rightWidth, minWidth: rightCollapsed ? 0 : undefined }}
                >
                  <div className="space-y-0.5">
                    {/* Status */}
                    <div className="flex items-center h-8 px-3 gap-3 rounded hover:bg-muted/40 group">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">Status</span>
                      <Select
                        value={displayBucket(selected.status)}
                        onValueChange={(v) => void updateStatus(v as "open" | "in_progress" | "resolved")}
                        disabled={updatingStatus}
                      >
                        <SelectTrigger className="h-6 border-0 p-0 text-xs bg-transparent focus:ring-0 shadow-none gap-1">
                          <span className={`h-2 w-2 rounded-full ${statusDot(selected.status)}`} />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center h-8 px-3 gap-3 rounded">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">Priority</span>
                      <span className={`text-xs font-medium ${severityColor(selected.severity)}`}>
                        {selected.severity ?? "medium"}
                      </span>
                    </div>

                    {/* Agent */}
                    <div className="flex items-center h-8 px-3 gap-3 rounded hover:bg-muted/40">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">Assignee</span>
                      <Select value={assignedAgent} onValueChange={(v) => setAssignedAgent(v as AgentTarget)}>
                        <SelectTrigger className="h-6 border-0 p-0 text-xs bg-transparent focus:ring-0 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="codex">Codex</SelectItem>
                          <SelectItem value="claude_code">Claude Code</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Score */}
                    <div className="flex items-center h-8 px-3 gap-3 rounded">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">Score</span>
                      <span className="text-xs text-foreground">{selectedScore} · {scoreLabel(selectedScore)}</span>
                    </div>

                    {/* Annotation ID */}
                    <div className="flex items-center h-8 px-3 gap-3 rounded">
                      <span className="w-20 text-xs text-muted-foreground shrink-0">ID</span>
                      <span className="text-xs text-foreground font-mono truncate">{getAgentationId(selected)}</span>
                    </div>

                    {/* Page */}
                    {selected.page_path && (
                      <div className="flex items-center h-8 px-3 gap-3 rounded">
                        <span className="w-20 text-xs text-muted-foreground shrink-0">Page</span>
                        <span className="text-xs text-foreground truncate">{selected.page_path}</span>
                      </div>
                    )}

                    <div className="my-2 mx-3 border-t border-border/50" />

                    {/* Actions */}
                    <div className="px-3 space-y-1.5 pt-1">
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs justify-start"
                        onClick={dispatchToAgent}
                        disabled={dispatching}
                      >
                        <Send className="h-3 w-3 mr-2" />
                        {dispatching ? "Dispatching..." : `Dispatch`}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs justify-start"
                        onClick={saveAssignment}
                        disabled={savingAssignment}
                      >
                        {savingAssignment ? "Saving..." : "Save assignment"}
                      </Button>
                      {selected.page_url && (
                        <Button asChild variant="ghost" size="sm" className="w-full h-7 text-xs justify-start">
                          <a href={selected.page_url} target="_blank" rel="noreferrer">
                            <ArrowRight className="h-3 w-3 mr-2" />
                            Open page
                          </a>
                        </Button>
                      )}
                      {lastDispatchCommand && (
                        <Button variant="ghost" size="sm" className="w-full h-7 text-xs justify-start" onClick={copyLastCommand}>
                          <Copy className="h-3 w-3 mr-2" />
                          Copy command
                        </Button>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Add a task to the annotation inbox. It will appear alongside annotations captured from the in-app overlay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-task-title" className="text-xs">Title</Label>
              <Input
                id="new-task-title"
                placeholder="Short summary of the task..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-task-details" className="text-xs">Details (optional)</Label>
              <Textarea
                id="new-task-details"
                placeholder="Context, repro steps, expected behavior..."
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                rows={4}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-task-route" className="text-xs">Page path (optional)</Label>
                <Input
                  id="new-task-route"
                  placeholder="/767/budget"
                  value={newRoute}
                  onChange={(e) => setNewRoute(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Severity</Label>
                <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as "blocking" | "important" | "nit")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blocking">Blocking (high)</SelectItem>
                    <SelectItem value="important">Important (medium)</SelectItem>
                    <SelectItem value="nit">Nit (low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign to</Label>
              <Select value={newAssignee} onValueChange={(v) => setNewAssignee(v as AgentTarget | "unassigned")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                  <SelectItem value="claude_code">Claude Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void createTask()} disabled={creating || !newTitle.trim()}>
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
