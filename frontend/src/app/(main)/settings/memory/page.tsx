"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertTriangle,
  Brain,
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/ds";
import { PageShell, PageTabs, SectionRuleHeading } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

type MemoryType = "fact" | "preference" | "lesson" | "commitment" | "context";
type MemoryTab = "all" | "team" | "project" | "recent" | "review";
type WrongReasonCategory =
  | "wrong"
  | "outdated"
  | "private"
  | "too_broad"
  | "duplicate"
  | "other";

interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  confidence: number;
  importance: number;
  project_id: number | null;
  source: string;
  visibility: string;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number | null;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  preference: "Preference",
  fact: "Fact",
  lesson: "Lesson",
  commitment: "Commitment",
  context: "Context",
};

const TYPE_COLORS: Record<MemoryType, string> = {
  preference: "bg-primary/10 text-primary border-primary/20",
  fact: "bg-primary/10 text-primary border-primary/20",
  lesson: "bg-warning/10 text-warning border-warning/20",
  commitment: "bg-destructive/10 text-destructive border-destructive/20",
  context: "bg-muted text-muted-foreground border-border",
};

const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All types" },
  { value: "preference", label: "Preferences" },
  { value: "fact", label: "Facts" },
  { value: "lesson", label: "Lessons" },
  { value: "commitment", label: "Commitments" },
  { value: "context", label: "Context" },
];

const WRONG_REASON_OPTIONS: Array<{ value: WrongReasonCategory; label: string }> = [
  { value: "wrong", label: "Incorrect" },
  { value: "outdated", label: "Outdated" },
  { value: "private", label: "Should stay private" },
  { value: "too_broad", label: "Too broad" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
];

function daysAgo(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return (Date.now() - time) / 86_400_000;
}

function isUsedRecently(memory: Memory) {
  const age = daysAgo(memory.last_accessed_at);
  return age !== null && age <= 7;
}

function memoryUsedLabel(memory: Memory) {
  const count = memory.access_count ?? 0;
  if (count <= 0) return "Not used yet";
  return `Used ${count}x`;
}

function MemoryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MemoryRow({
  memory,
  onDelete,
  onUpdate,
  onMarkWrong,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, importance: number) => Promise<void>;
  onMarkWrong: (memory: Memory) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(memory.content);
  const [importance, setImportance] = React.useState(memory.importance);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(memory.id, draft, importance);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(memory.content);
    setImportance(memory.importance);
    setEditing(false);
  }

  const typeColor = TYPE_COLORS[memory.type] ?? "bg-muted text-muted-foreground";

  return (
    <div className="group py-3.5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}
        >
          {TYPE_LABELS[memory.type]}
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-20 resize-none text-sm"
                autoFocus
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Importance: {Math.round(importance * 100)}%
                  </p>
                  <Slider
                    value={[importance]}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onValueChange={([value]) => setImportance(value)}
                    className="w-44"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !draft.trim()}
                    className="h-8 text-xs"
                  >
                    <Check />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    className="h-8 text-xs"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">{memory.content}</p>
          )}

          {!editing && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatDate(memory.created_at)}</span>
              <span>Importance {Math.round(memory.importance * 100)}%</span>
              <span>Confidence {Math.round(memory.confidence * 100)}%</span>
              <span>{memoryUsedLabel(memory)}</span>
              {memory.last_accessed_at && (
                <span>Last used {formatDate(memory.last_accessed_at)}</span>
              )}
              {memory.project_id && <span>Project {memory.project_id}</span>}
              {memory.visibility === "team" && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  Team
                </Badge>
              )}
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
              title="Edit memory"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-warning"
              onClick={() => onMarkWrong(memory)}
              title="Mark wrong"
            >
              <AlertTriangle />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(memory.id)}
              title="Delete memory"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function WrongMemoryDialog({
  memory,
  open,
  onOpenChange,
  onSubmit,
}: {
  memory: Memory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (memory: Memory, reason: string, reasonCategory: WrongReasonCategory) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [reasonCategory, setReasonCategory] =
    React.useState<WrongReasonCategory>("wrong");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setReasonCategory("wrong");
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!memory || !reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(memory, reason.trim(), reasonCategory);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Mark memory for review</ModalTitle>
          <ModalDescription>
            This creates a review item before the assistant uses the correction as
            durable behavior.
          </ModalDescription>
        </ModalHeader>

        {memory && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
              {memory.content}
            </div>
            <Select
              value={reasonCategory}
              onValueChange={(value) =>
                setReasonCategory(value as WrongReasonCategory)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRONG_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What should be corrected?"
              className="min-h-24"
            />
          </div>
        )}

        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !memory || !reason.trim()}
          >
            Create review item
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function MemorySettingsPage() {
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState<MemoryTab>("all");
  const [reviewMemory, setReviewMemory] = React.useState<Memory | null>(null);
  const [reviewCreatedIds, setReviewCreatedIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  async function loadMemories(type?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (type && type !== "all") params.set("type", type);
      const res = await fetch(`/api/ai-assistant/memories?${params}`);
      if (!res.ok) throw new Error("Failed to load memories");
      const data = await res.json();
      setMemories(data.memories ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setMemories([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadMemories(typeFilter);
  }, [typeFilter]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/ai-assistant/memories/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMemories((prev) => prev.filter((memory) => memory.id !== id));
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
    }
  }

  async function handleUpdate(id: string, content: string, importance: number) {
    const res = await fetch(`/api/ai-assistant/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, importance }),
    });
    if (res.ok) {
      setMemories((prev) =>
        prev.map((memory) =>
          memory.id === id ? { ...memory, content, importance } : memory,
        ),
      );
    }
  }

  async function handleMarkWrong(
    memory: Memory,
    reason: string,
    reasonCategory: WrongReasonCategory,
  ) {
    await apiFetch(`/api/ai-assistant/memories/${memory.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, reasonCategory }),
    });
    setReviewCreatedIds((prev) => new Set(prev).add(memory.id));
  }

  async function handleClearAll() {
    const confirmed = window.confirm(
      "Clear all active conversation memories for your account? This cannot be undone.",
    );
    if (!confirmed) return;

    const res = await fetch("/api/ai-assistant/memories", {
      method: "DELETE",
    });
    if (res.ok) {
      setMemories([]);
      setTotal(0);
      setReviewCreatedIds(new Set());
    }
  }

  const stats = React.useMemo(() => {
    const team = memories.filter((memory) => memory.visibility === "team").length;
    const project = memories.filter((memory) => memory.project_id !== null).length;
    const recent = memories.filter(isUsedRecently).length;
    return {
      total,
      team,
      project,
      recent,
      review: reviewCreatedIds.size,
    };
  }, [memories, reviewCreatedIds.size, total]);

  const visibleMemories = React.useMemo(() => {
    if (activeTab === "team") {
      return memories.filter((memory) => memory.visibility === "team");
    }
    if (activeTab === "project") {
      return memories.filter((memory) => memory.project_id !== null);
    }
    if (activeTab === "recent") {
      return memories.filter(isUsedRecently);
    }
    if (activeTab === "review") {
      return memories.filter((memory) => reviewCreatedIds.has(memory.id));
    }
    return memories;
  }, [activeTab, memories, reviewCreatedIds]);

  const grouped = React.useMemo(() => {
    const map = new Map<MemoryType, Memory[]>();
    for (const memory of visibleMemories) {
      if (!map.has(memory.type)) map.set(memory.type, []);
      map.get(memory.type)!.push(memory);
    }
    return map;
  }, [visibleMemories]);

  const typeOrder: MemoryType[] = [
    "preference",
    "commitment",
    "fact",
    "lesson",
    "context",
  ];

  return (
    <PageShell
      variant="dashboard"
      title="Memory Center"
      description="Review what Alleato AI remembers and flag anything that should change future behavior."
      actions={
        <Button asChild variant="outline">
          <Link href="/ai/teach">Teach Alleato</Link>
        </Button>
      }
    >
      <div className="max-w-5xl space-y-8 px-8 py-8">
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-5">
          <MemoryStat
            label="Active"
            value={stats.total}
            detail="available to future chats"
          />
          <MemoryStat
            label="Team"
            value={stats.team}
            detail="visible beyond you"
          />
          <MemoryStat
            label="Project"
            value={stats.project}
            detail="linked to project context"
          />
          <MemoryStat
            label="Used recently"
            value={stats.recent}
            detail="recalled in 7 days"
          />
          <MemoryStat
            label="Queued review"
            value={stats.review}
            detail="flagged this session"
          />
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PageTabs
              tabs={[
                { label: "All", href: "all", isActive: activeTab === "all" },
                { label: "Team", href: "team", isActive: activeTab === "team" },
                {
                  label: "Project",
                  href: "project",
                  isActive: activeTab === "project",
                },
                {
                  label: "Used recently",
                  href: "recent",
                  isActive: activeTab === "recent",
                },
                {
                  label: "Review queued",
                  href: "review",
                  isActive: activeTab === "review",
                },
              ]}
              variant="inline"
              className="mb-0"
              onTabClick={(href) => setActiveTab(href as MemoryTab)}
            />

            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadMemories(typeFilter)}
                className="gap-1.5 text-muted-foreground"
              >
                <RefreshCw />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={total === 0}
                className="gap-1.5"
              >
                <Trash2 />
                Clear
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading memories...
            </div>
          ) : visibleMemories.length === 0 ? (
            <EmptyState
              icon={<Brain />}
              title="No memories in this view"
              description="Memories appear here after the assistant captures durable preferences, lessons, facts, commitments, or context."
            />
          ) : (
            <div className="space-y-6">
              {typeOrder.map((type) => {
                const items = grouped.get(type);
                if (!items?.length) return null;
                return (
                  <div key={type} className="space-y-2">
                    <SectionRuleHeading
                      label={TYPE_LABELS[type]}
                      className="mb-0"
                      actions={
                        <span className="text-xs text-muted-foreground/60">
                          {items.length}
                        </span>
                      }
                    />
                    <div className="divide-y divide-border border-y border-border">
                      {items.map((memory) => (
                        <MemoryRow
                          key={memory.id}
                          memory={memory}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          onMarkWrong={setReviewMemory}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-border pt-4">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Alleato AI captures durable preferences, lessons, project facts,
            context, and commitments during conversations. Flagging a memory does
            does not rewrite behavior automatically; it creates a review item so the team can
            decide whether to edit, expire, deactivate, or convert it into a more
            precise skill.
          </p>
        </section>
      </div>

      <WrongMemoryDialog
        memory={reviewMemory}
        open={reviewMemory !== null}
        onOpenChange={(open) => {
          if (!open) setReviewMemory(null);
        }}
        onSubmit={handleMarkWrong}
      />
    </PageShell>
  );
}
