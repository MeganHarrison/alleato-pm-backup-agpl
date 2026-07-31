"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Circle, Save, Zap } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DetailField } from "@/components/ds/DetailField";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";

import {
  type AiAgent,
  type AiAgentRun,
  STATUS_LABELS,
  STATUS_COLORS,
  IMPACT_COLORS,
} from "./ai-agents-table-config";

interface AiAgentDetailPanelProps {
  agent: AiAgent | null;
  onClose: () => void;
  onAgentUpdated: (agent: AiAgent) => void | Promise<void>;
}

type AiAgentStatus = AiAgent["status"];

interface AgentEditState {
  status: AiAgentStatus;
  approvalRequired: boolean;
  confidenceThreshold: string;
  failureBehavior: string;
  notes: string;
}

const STATUS_OPTIONS: AiAgentStatus[] = [
  "planned",
  "building",
  "beta",
  "production",
  "deprecated",
];
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  style: "percent",
});

function toEditState(agent: AiAgent): AgentEditState {
  return {
    status: agent.status,
    approvalRequired: agent.approval_required ?? true,
    confidenceThreshold:
      agent.confidence_threshold == null ? "" : String(agent.confidence_threshold),
    failureBehavior: agent.failure_behavior ?? "",
    notes: agent.notes ?? "",
  };
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function computeGapCount(agent: Pick<AiAgent, "success_metric" | "confidence_threshold" | "failure_behavior" | "output_destination">): number {
  return [
    !agent.success_metric,
    !agent.confidence_threshold,
    !agent.failure_behavior,
    !agent.output_destination,
  ].filter(Boolean).length;
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function runStatusClass(status: AiAgentRun["status"]): string {
  switch (status) {
    case "success":
      return "text-status-success";
    case "failure":
      return "text-status-error";
    case "partial":
      return "text-status-warning";
    case "skipped":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

function GapRow({ label, value }: { label: string; value: string | null | undefined }) {
  const missing = !value;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">
        {missing ? (
          <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
        )}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className={`text-sm ${missing ? "text-muted-foreground italic" : "text-foreground"}`}>
          {value ?? "Not defined"}
        </span>
      </div>
    </div>
  );
}

function RecentRunRow({
  run,
  expanded,
  onToggle,
}: {
  run: AiAgentRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  const metadata =
    run.metadata && typeof run.metadata === "object"
      ? JSON.stringify(run.metadata, null, 2)
      : null;

  return (
    <div className="border-b border-border last:border-0">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="grid h-auto w-full grid-cols-[1fr_auto] justify-normal gap-4 rounded-none px-0 py-2 text-left hover:bg-muted/40"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium capitalize ${runStatusClass(run.status)}`}>
              {run.status ?? "unknown"}
            </span>
            {run.confidence_score != null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatPercent(run.confidence_score)} confidence
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {run.error_message ?? `Completed ${formatDateTime(run.completed_at ?? run.created_at)}`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {run.output_count ?? 0} outputs
        </span>
      </Button>
      {expanded && (
        <div className="pb-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <DetailField label="Run ID" value={run.id} />
            <DetailField label="Project" value={run.project_id != null ? String(run.project_id) : "—"} />
            <DetailField label="Started" value={formatDateTime(run.started_at)} />
            <DetailField label="Completed" value={formatDateTime(run.completed_at)} />
            <DetailField label="Tokens" value={run.tokens_used != null ? String(run.tokens_used) : "—"} />
            <DetailField label="Created" value={formatDateTime(run.created_at)} />
          </div>
          {metadata && metadata !== "{}" && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {metadata}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function AiAgentDetailPanel({ agent, onClose, onAgentUpdated }: AiAgentDetailPanelProps) {
  const [editState, setEditState] = React.useState<AgentEditState | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditState(agent ? toEditState(agent) : null);
    setExpandedRunId(null);
  }, [agent]);

  if (!agent) return null;
  const currentEditState = editState ?? toEditState(agent);
  const hasEditChanges =
    currentEditState.status !== agent.status ||
    currentEditState.approvalRequired !== (agent.approval_required ?? true) ||
    currentEditState.confidenceThreshold !==
      (agent.confidence_threshold == null ? "" : String(agent.confidence_threshold)) ||
    currentEditState.failureBehavior !== (agent.failure_behavior ?? "") ||
    currentEditState.notes !== (agent.notes ?? "");

  async function handleSave() {
    if (!agent || !editState || isSaving) return;
    const confidenceThreshold =
      editState.confidenceThreshold.trim().length > 0
        ? Number(editState.confidenceThreshold)
        : null;

    if (
      confidenceThreshold != null &&
      (!Number.isFinite(confidenceThreshold) ||
        confidenceThreshold < 0 ||
        confidenceThreshold > 1)
    ) {
      toast.error("Confidence threshold must be between 0 and 1.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch<{ agent: Partial<AiAgent> }>("/api/admin/ai-agents", {
        method: "PATCH",
        body: JSON.stringify({
          id: agent.id,
          status: editState.status,
          approval_required: editState.approvalRequired,
          confidence_threshold: confidenceThreshold,
          failure_behavior: blankToNull(editState.failureBehavior),
          notes: blankToNull(editState.notes),
        }),
      });

      const updatedAgent: AiAgent = {
        ...agent,
        ...response.agent,
        status: (response.agent.status as AiAgentStatus | undefined) ?? editState.status,
        approval_required:
          response.agent.approval_required ?? editState.approvalRequired,
        confidence_threshold:
          response.agent.confidence_threshold ?? confidenceThreshold,
        failure_behavior:
          response.agent.failure_behavior ?? blankToNull(editState.failureBehavior),
        notes: response.agent.notes ?? blankToNull(editState.notes),
      };
      updatedAgent.gapCount = computeGapCount(updatedAgent);

      await onAgentUpdated(updatedAgent);
      toast.success("Agent registry updated");
    } catch (error) {
      handleFormError(error, { entity: "agent registry", action: "update" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open={!!agent} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[agent.status]}`}
            >
              {STATUS_LABELS[agent.status]}
            </span>
            {agent.domain && (
              <Badge variant="outline" className="text-xs capitalize">
                {agent.domain}
              </Badge>
            )}
            {agent.layer && (
              <Badge variant="outline" className="text-xs capitalize">
                {agent.layer}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg leading-snug mt-2">{agent.name}</SheetTitle>
          {agent.purpose && (
            <p className="text-sm text-muted-foreground leading-relaxed">{agent.purpose}</p>
          )}
        </SheetHeader>

        <section className="mb-6">
          <SectionRuleHeading
            label="Editable Controls"
            icon={<Save className="h-3.5 w-3.5" />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-status">Status</Label>
              <Select
                value={currentEditState.status}
                onValueChange={(value) =>
                  setEditState((state) => ({
                    ...(state ?? toEditState(agent)),
                    status: value as AiAgentStatus,
                  }))
                }
              >
                <SelectTrigger id="agent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-confidence">Confidence threshold</Label>
              <Input
                id="agent-confidence"
                placeholder="0.75"
                value={currentEditState.confidenceThreshold}
                onChange={(event) =>
                  setEditState((state) => ({
                    ...(state ?? toEditState(agent)),
                    confidenceThreshold: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Approval required
                </span>
                <span className="block text-xs text-muted-foreground">
                  High-impact agent output must be reviewed before it is trusted.
                </span>
              </span>
              <Switch
                checked={currentEditState.approvalRequired}
                onCheckedChange={(checked) =>
                  setEditState((state) => ({
                    ...(state ?? toEditState(agent)),
                    approvalRequired: checked,
                  }))
                }
              />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="agent-failure-behavior">Failure behavior</Label>
              <Textarea
                id="agent-failure-behavior"
                rows={3}
                value={currentEditState.failureBehavior}
                onChange={(event) =>
                  setEditState((state) => ({
                    ...(state ?? toEditState(agent)),
                    failureBehavior: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="agent-notes">Notes</Label>
              <Textarea
                id="agent-notes"
                rows={3}
                value={currentEditState.notes}
                onChange={(event) =>
                  setEditState((state) => ({
                    ...(state ?? toEditState(agent)),
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>

        {/* ── How it runs ────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionRuleHeading
            label="How it runs"
            icon={<Zap className="h-3.5 w-3.5" />}
          />
          <div className="space-y-0">
            <DetailField label="Trigger" value={agent.trigger_type ?? "—"} />
            <DetailField label="Detail" value={agent.trigger_detail ?? "—"} />
            <DetailField label="Freshness" value={agent.data_freshness_requirement ?? "—"} />
            <DetailField
              label="Approval"
              value={
                agent.approval_required == null
                  ? "—"
                  : agent.approval_required
                    ? "Required before output is trusted"
                    : "Auto-publishes"
              }
            />
          </div>
        </section>

        {/* ── Data ────────────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionRuleHeading label="Data" />
          <div className="space-y-0">
            <DetailField
              label="Sources"
              value={
                agent.data_sources?.length
                  ? agent.data_sources.join(", ")
                  : "—"
              }
            />
            <DetailField label="Output type" value={agent.output_type ?? "—"} />
            <DetailField label="Destination" value={agent.output_destination ?? "—"} />
          </div>
        </section>

        {/* ── Dependencies ─────────────────────────────────────────── */}
        {agent.dependencies?.length > 0 && (
          <section className="mb-6">
            <SectionRuleHeading label="Dependencies" />
            <div className="flex flex-wrap gap-1.5">
              {agent.dependencies.map((dep) => (
                <Badge key={dep} variant="secondary" className="text-xs font-mono">
                  {dep}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* ── Prioritization ────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionRuleHeading label="Prioritization" />
          <div className="space-y-0">
            <DetailField label="Priority score" value={agent.priority_score != null ? String(agent.priority_score) : "—"} />
            <DetailField
              label="Impact"
              value={
                agent.estimated_impact ? (
                  <span className={`capitalize ${IMPACT_COLORS[agent.estimated_impact]}`}>
                    {agent.estimated_impact}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailField label="Effort" value={agent.estimated_effort ?? "—"} />
          </div>
        </section>

        {/* ── Gap analysis ──────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionRuleHeading
            label="Gap Analysis"
            actions={
              agent.gapCount > 0 ? (
                <span className="text-xs font-normal text-status-warning">
                  {agent.gapCount} undefined
                </span>
              ) : null
            }
          />
          <div>
            <GapRow label="Success metric" value={agent.success_metric} />
            <GapRow label="Confidence threshold" value={agent.confidence_threshold != null ? String(agent.confidence_threshold) : null} />
            <GapRow label="Failure behavior" value={agent.failure_behavior} />
            <GapRow label="Output destination" value={agent.output_destination} />
          </div>
        </section>

        {/* ── Blockers ─────────────────────────────────────────────── */}
        {agent.blockers && (
          <section className="mb-6">
            <SectionRuleHeading
              label="Blockers"
              icon={<Circle className="h-3.5 w-3.5 fill-status-error text-status-error" />}
            />
            <p className="text-sm text-status-error leading-relaxed">
              {agent.blockers}
            </p>
          </section>
        )}

        {/* ── Runtime stats ─────────────────────────────────────────── */}
        <section className="mb-6">
          <SectionRuleHeading label="Runtime" />
          <div className="space-y-0">
            <DetailField
              label="Last run"
              value={
                agent.runStats.lastRun
                  ? new Date(agent.runStats.lastRun).toLocaleString()
                  : "Never recorded"
              }
            />
            <DetailField
              label="Success rate"
              value={
                agent.runStats.totalRuns > 0
                  ? `${agent.runStats.successRate}% (${agent.runStats.totalRuns} runs)`
                  : "No runs recorded"
              }
            />
          </div>
          {agent.recentRuns.length > 0 && (
            <div className="mt-3">
              <SectionRuleHeading label="Recent Runs" />
              <div className="divide-y divide-border">
                {agent.recentRuns.map((run) => (
                  <RecentRunRow
                    key={run.id}
                    run={run}
                    expanded={expandedRunId === run.id}
                    onToggle={() =>
                      setExpandedRunId((current) => (current === run.id ? null : run.id))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Notes ────────────────────────────────────────────────── */}
        {agent.notes && (
          <section>
            <SectionRuleHeading label="Notes" />
            <p className="text-sm text-muted-foreground leading-relaxed">{agent.notes}</p>
          </section>
        )}
        <SheetFooter className="sticky bottom-0 -mx-6 mt-6 border-t bg-background px-6 py-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasEditChanges || isSaving}
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
