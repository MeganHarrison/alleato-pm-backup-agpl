"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DetailField, DetailFieldGrid, ErrorState } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import type {
  ExecutiveAttentionFeed,
  ExecutiveAttentionItem,
} from "@/lib/executive/executive-attention";

type AttentionType =
  | "decision"
  | "approval"
  | "risk"
  | "financial_exposure"
  | "schedule_exception"
  | "cross_project";
type CreateForm = {
  type: AttentionType;
  title: string;
  summary: string;
  priority: "critical" | "high" | "medium" | "low";
  impactOfDelay: string;
  accountableOwnerLabel: string;
  dueAt: string;
};

export type ExecutiveAttentionDraft = Pick<
  CreateForm,
  "title" | "summary" | "priority"
>;

const EMPTY_FORM: CreateForm = {
  type: "decision",
  title: "",
  summary: "",
  priority: "high",
  impactOfDelay: "",
  accountableOwnerLabel: "",
  dueAt: "",
};

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ExecutiveAttentionWorkflow({
  draft,
}: {
  draft?: ExecutiveAttentionDraft | null;
}) {
  const [feed, setFeed] = useState<ExecutiveAttentionFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ExecutiveAttentionItem | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFeed(
        await apiFetch<ExecutiveAttentionFeed>("/api/executive/attention", {
          cache: "no-store",
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Executive attention could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!draft) return;
    setForm((current) => ({ ...current, ...draft }));
    setCreateOpen(true);
  }, [draft]);

  const openItems = useMemo(
    () =>
      (feed?.items ?? []).filter(
        (item) => !["resolved", "dismissed"].includes(item.lifecycle),
      ),
    [feed],
  );

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/executive/attention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          dueAt: new Date(form.dueAt).toISOString(),
        }),
      });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Executive attention could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(
    action: "acknowledge" | "start" | "escalate" | "resolve" | "dismiss",
  ) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/executive/attention/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "escalate"
            ? {
                action,
                escalationLevel: Math.min(selected.escalationLevel + 1, 3),
              }
            : action === "resolve" || action === "dismiss"
              ? { action, resolutionSummary: resolution }
              : { action },
        ),
      });
      setSelected(null);
      setResolution("");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Executive attention could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="mb-12 py-2"
      aria-labelledby="executive-attention-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div id="executive-attention-heading">
          <SectionRuleHeading label="Executive attention" className="mb-1" />
          <p className="mt-1 text-sm text-muted-foreground">
            Owned decisions and risks anchored to the current Daily Brief
            evidence.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create attention item
        </Button>
      </div>

      {error ? (
        <ErrorState
          title="Executive attention could not load"
          error={error}
          className="py-4"
        />
      ) : null}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Loading executive attention…
        </p>
      ) : null}
      {!loading && !error && openItems.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No open executive attention. Create an item when the current brief
          needs a named owner and due date.
        </p>
      ) : null}
      {!loading && openItems.length > 0 ? (
        <div className="mt-6 divide-y divide-border">
          {openItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => setSelected(item)}
              className="grid h-auto w-full min-w-0 justify-start gap-2 rounded-none px-0 py-4 text-left font-normal whitespace-normal hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
            >
              <span className="min-w-0 break-words">
                <span className="block text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {item.summary}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {label(item.attentionType)} · {item.accountableOwnerLabel} ·{" "}
                  {formatDate(item.dueAt)}
                </span>
              </span>
              <span className="text-sm font-medium text-foreground">
                {label(item.priority)}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create executive attention</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createItem}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type: value as AttentionType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                    <SelectItem value="financial_exposure">
                      Financial exposure
                    </SelectItem>
                    <SelectItem value="schedule_exception">
                      Schedule exception
                    </SelectItem>
                    <SelectItem value="cross_project">Cross-project</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      priority: value as CreateForm["priority"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Title">
              <Input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Why it needs attention">
              <Textarea
                required
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                className="min-h-24"
              />
            </Field>
            <Field label="Impact of delay">
              <Textarea
                required
                value={form.impactOfDelay}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    impactOfDelay: event.target.value,
                  }))
                }
                className="min-h-20"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Accountable owner">
                <Input
                  required
                  value={form.accountableOwnerLabel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      accountableOwnerLabel: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Due date">
                <Input
                  required
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueAt: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Creation attaches immutable evidence from the fresh current Daily
              Brief. Terminal outcomes require a named human rationale.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create attention item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setResolution("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">{selected.summary}</p>
                <DetailFieldGrid className="grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-5">
                  <DetailField label="Owner">
                    {selected.accountableOwnerLabel}
                  </DetailField>
                  <DetailField label="Due">
                    {formatDate(selected.dueAt)}
                  </DetailField>
                  <DetailField label="Impact of delay">
                    {selected.impactOfDelay}
                  </DetailField>
                  <DetailField label="Lifecycle">
                    {label(selected.lifecycle)}
                  </DetailField>
                </DetailFieldGrid>
                <div>
                  <SectionRuleHeading label="Evidence" className="mb-0" />
                  <div className="mt-2 divide-y divide-border">
                    {selected.evidence.map((evidence) => (
                      <p
                        className="py-2 text-xs text-muted-foreground"
                        key={evidence.id}
                      >
                        {label(evidence.sourceType)} · {evidence.sourceId}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionRuleHeading label="Audit history" className="mb-0" />
                  <div className="mt-2 divide-y divide-border">
                    {selected.history.map((entry) => (
                      <p
                        className="py-2 text-xs text-muted-foreground"
                        key={entry.id}
                      >
                        {label(entry.action)} by {entry.actorLabel} ·{" "}
                        {entry.rationale}
                      </p>
                    ))}
                  </div>
                </div>
                {!["resolved", "dismissed"].includes(selected.lifecycle) ? (
                  <>
                    <Field label="Resolution rationale">
                      <Textarea
                        value={resolution}
                        onChange={(event) => setResolution(event.target.value)}
                        placeholder="Required only to resolve or dismiss."
                        className="min-h-20"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void updateItem("acknowledge")}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void updateItem("start")}
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving || selected.escalationLevel >= 3}
                        onClick={() => void updateItem("escalate")}
                      >
                        Escalate
                      </Button>
                      <Button
                        size="sm"
                        disabled={saving || resolution.trim().length < 4}
                        onClick={() => void updateItem("resolve")}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={saving || resolution.trim().length < 4}
                        onClick={() => void updateItem("dismiss")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
