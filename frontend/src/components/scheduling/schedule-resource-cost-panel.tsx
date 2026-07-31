"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BadgeDollarSign, Pencil, Plus, Trash2 } from "lucide-react";

import { DateField } from "@/components/forms/DateField";
import { MoneyField } from "@/components/forms/MoneyField";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import {
  calculateScheduleCost,
  type ScheduleCostAssignment,
  type ScheduleCostResource,
} from "@/lib/scheduling/schedule-resource-cost";
import type {
  ScheduleCostAssignmentRecord,
  ScheduleCostModelResponse,
  ScheduleCostResourceKind,
  ScheduleCostResourceRecord,
  ScheduleTask,
} from "@/types/scheduling";

interface ScheduleResourceCostPanelProps {
  projectId: string;
  tasks: ScheduleTask[];
}

type ResourceDraft = {
  id: string | null;
  resource_kind: ScheduleCostResourceKind;
  display_name: string;
  standard_rate: string;
  cost_per_use: string;
  cost_version: number | null;
};

type AssignmentDraft = {
  id: string | null;
  task_id: string;
  resource_id: string;
  allocation_percent: string;
  planned_units: string;
  actual_units: string;
  actual_rate: string;
  actual_cost: string;
  cost_version: number | null;
};

const emptyResourceDraft: ResourceDraft = {
  id: null,
  resource_kind: "equipment",
  display_name: "",
  standard_rate: "",
  cost_per_use: "",
  cost_version: null,
};

const emptyAssignmentDraft: AssignmentDraft = {
  id: null,
  task_id: "",
  resource_id: "",
  allocation_percent: "100",
  planned_units: "",
  actual_units: "",
  actual_rate: "",
  actual_cost: "",
  cost_version: null,
};

function nullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Cost values must be nonnegative numbers.");
  }
  return parsed;
}

function rateUnit(kind: ScheduleCostResourceKind) {
  return kind === "person" ? "hour" : kind === "equipment" ? "day" : "unit";
}

function formatMoney(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIndex(value: number | null): string {
  return value === null ? "Unavailable" : value.toFixed(3);
}

function today(): string {
  return isoFromDate(new Date());
}

function dateFromIso(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoFromDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function numberFromDraft(value: string): number | undefined {
  return value.trim() ? Number(value) : undefined;
}

type PendingDelete =
  | { kind: "resource"; resource: ScheduleCostResourceRecord }
  | { kind: "assignment"; assignment: ScheduleCostAssignmentRecord }
  | null;

export function ScheduleResourceCostPanel({
  projectId,
  tasks,
}: ScheduleResourceCostPanelProps) {
  const [model, setModel] = useState<ScheduleCostModelResponse | null>(null);
  const [statusDate, setStatusDate] = useState(today);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(
    emptyResourceDraft,
  );
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>(
    emptyAssignmentDraft,
  );
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setModel(await apiFetch<ScheduleCostModelResponse>(
        `/api/projects/${projectId}/scheduling/resources?view=cost`,
        { cache: "no-store" },
      ));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load schedule cost data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (!model) return null;
    const resources: ScheduleCostResource[] = model.resources.map((resource) => ({
      id: resource.id,
      display_name: resource.display_name,
      standard_rate: resource.standard_rate,
      cost_per_use: resource.cost_per_use,
      rate_unit: resource.rate_unit,
    }));
    const assignments: ScheduleCostAssignment[] = model.assignments.map(
      (assignment) => ({
        id: assignment.id,
        task_id: assignment.task_id,
        resource_id: assignment.resource_id,
        planned_units: assignment.planned_units,
        actual_units: assignment.actual_units,
        actual_rate: assignment.actual_rate,
        actual_cost: assignment.actual_cost,
      }),
    );
    return calculateScheduleCost({
      resources,
      assignments,
      tasks,
      status_date: statusDate,
    });
  }, [model, statusDate, tasks]);

  const saveResource = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const body = {
        id: resourceDraft.id,
        resource_kind: resourceDraft.resource_kind,
        display_name: resourceDraft.display_name.trim(),
        standard_rate: nullableNumber(resourceDraft.standard_rate),
        cost_per_use: nullableNumber(resourceDraft.cost_per_use),
        rate_unit: rateUnit(resourceDraft.resource_kind),
        expected_cost_version: resourceDraft.cost_version,
      };
      await apiFetch(
        `/api/projects/${projectId}/scheduling/resources?${
          resourceDraft.id ? "view" : "operation"
        }=cost-resource`,
        {
          method: resourceDraft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setResourceDraft(emptyResourceDraft);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save resource.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAssignment = async () => {
    if (!assignmentDraft.task_id || !assignmentDraft.resource_id) {
      setError("Choose both an activity and a resource.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const allocation = Number(assignmentDraft.allocation_percent);
      if (!Number.isInteger(allocation) || allocation < 1 || allocation > 100) {
        throw new Error("Allocation must be a whole number from 1 through 100.");
      }
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${assignmentDraft.task_id}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource_id: assignmentDraft.resource_id,
            allocation_percent: allocation,
            planned_units: nullableNumber(assignmentDraft.planned_units),
            actual_units: nullableNumber(assignmentDraft.actual_units),
            actual_rate: nullableNumber(assignmentDraft.actual_rate),
            actual_cost: nullableNumber(assignmentDraft.actual_cost),
            expected_cost_version: assignmentDraft.cost_version,
          }),
        },
      );
      setAssignmentDraft(emptyAssignmentDraft);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save cost assignment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const editResource = (resource: ScheduleCostResourceRecord) => {
    setResourceDraft({
      id: resource.id,
      resource_kind: resource.resource_kind,
      display_name: resource.display_name,
      standard_rate: resource.standard_rate?.toString() ?? "",
      cost_per_use: resource.cost_per_use?.toString() ?? "",
      cost_version: resource.cost_version,
    });
  };

  const editAssignment = (assignment: ScheduleCostAssignmentRecord) => {
    setAssignmentDraft({
      id: assignment.id,
      task_id: assignment.task_id,
      resource_id: assignment.resource_id,
      allocation_percent: assignment.allocation_percent.toString(),
      planned_units: assignment.planned_units?.toString() ?? "",
      actual_units: assignment.actual_units?.toString() ?? "",
      actual_rate: assignment.actual_rate?.toString() ?? "",
      actual_cost: assignment.actual_cost?.toString() ?? "",
      cost_version: assignment.cost_version,
    });
  };

  const deleteResource = async (resource: ScheduleCostResourceRecord) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/scheduling/resources`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resource.id,
          expected_cost_version: resource.cost_version,
        }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete resource.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAssignment = async (assignment: ScheduleCostAssignmentRecord) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/tasks/${assignment.task_id}/assignments`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id: assignment.id,
            expected_cost_version: assignment.cost_version,
          }),
        },
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete assignment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const resourcesById = useMemo(
    () => new Map((model?.resources ?? []).map((resource) => [resource.id, resource])),
    [model?.resources],
  );

  return (
    <section className="space-y-5 rounded-lg border bg-muted/20 p-4" aria-label="Cost and earned value">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionRuleHeading
            as="h3"
            className="mb-0 pb-0"
            icon={<BadgeDollarSign className="size-5 text-primary" aria-hidden />}
            label="Cost and earned value"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Rates, planned units, and actual cost are explicit schedule facts.
          </p>
        </div>
        <DateField
          label="Status date"
          value={dateFromIso(statusDate)}
          onChange={(date) => {
            if (date) setStatusDate(isoFromDate(date));
          }}
          className="w-44"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Schedule cost action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading cost facts…</p>}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["BAC", formatMoney(summary.budget_at_completion)],
              ["PV", formatMoney(summary.planned_value)],
              ["EV", formatMoney(summary.earned_value)],
              ["AC", formatMoney(summary.actual_cost)],
              ["CV", formatMoney(summary.cost_variance)],
              ["SV", formatMoney(summary.schedule_variance)],
              ["CPI", formatIndex(summary.cost_performance_index)],
              ["SPI", formatIndex(summary.schedule_performance_index)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {summary.diagnostics.length > 0 && (
            <InfoAlert variant="warning" role="status">
              <div>
                <p className="font-medium">Incomplete cost facts</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {summary.diagnostics.map((diagnostic, index) => (
                    <li key={`${diagnostic.code}:${diagnostic.assignment_id ?? diagnostic.task_id ?? index}`}>
                      {diagnostic.message}
                    </li>
                  ))}
                </ul>
              </div>
            </InfoAlert>
          )}
        </>
      )}

      {model && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <SectionRuleHeading
                className="mb-0 pb-0"
                label="Resources and rates"
                actions={(
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResourceDraft(emptyResourceDraft)}
                    disabled={!model.can_manage || isSaving}
                  >
                    <Plus className="size-4" />
                    New resource
                  </Button>
                )}
              />
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {model.resources.map((resource) => (
                  <div key={resource.id} className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{resource.display_name}</p>
                      <p className="text-muted-foreground">
                        {resource.resource_kind} ·{" "}
                        {resource.standard_rate === null
                          ? "rate missing"
                          : `${formatMoney(resource.standard_rate)}/${resource.rate_unit ?? "unit"}`}
                      </p>
                    </div>
                    {model.can_manage && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => editResource(resource)} aria-label={`Edit ${resource.display_name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        {resource.resource_kind !== "person" && (
                            <Button size="icon" variant="ghost" onClick={() => setPendingDelete({ kind: "resource", resource })} aria-label={`Delete ${resource.display_name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              {model.can_manage && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Resource type
                    <Select
                      value={resourceDraft.resource_kind}
                      onValueChange={(value) => setResourceDraft((current) => ({
                        ...current,
                        resource_kind: value as ScheduleCostResourceKind,
                      }))}
                      disabled={resourceDraft.id !== null}
                    >
                      <SelectTrigger aria-label="Resource type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {resourceDraft.id && resourceDraft.resource_kind === "person" && <SelectItem value="person">Person</SelectItem>}
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Name
                    <Input
                      value={resourceDraft.display_name}
                      onChange={(event) => setResourceDraft((current) => ({ ...current, display_name: event.target.value }))}
                      disabled={resourceDraft.resource_kind === "person"}
                      placeholder="Tower crane"
                    />
                  </label>
                  <MoneyField
                    label={`Rate per ${rateUnit(resourceDraft.resource_kind)}`}
                    value={numberFromDraft(resourceDraft.standard_rate)}
                    onChange={(value) => setResourceDraft((current) => ({
                      ...current,
                      standard_rate: value?.toString() ?? "",
                    }))}
                  />
                  <MoneyField
                    label="Cost per use"
                    value={numberFromDraft(resourceDraft.cost_per_use)}
                    onChange={(value) => setResourceDraft((current) => ({
                      ...current,
                      cost_per_use: value?.toString() ?? "",
                    }))}
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <Button onClick={() => void saveResource()} disabled={isSaving || !resourceDraft.display_name.trim()}>
                      Save resource
                    </Button>
                    {resourceDraft.id && (
                      <Button variant="outline" onClick={() => setResourceDraft(emptyResourceDraft)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <SectionRuleHeading
                className="mb-0 pb-0"
                label="Activity cost assignment"
              />
              {model.can_manage && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Activity
                    <Select
                      value={assignmentDraft.task_id}
                      onValueChange={(value) => setAssignmentDraft((current) => ({ ...current, task_id: value }))}
                      disabled={assignmentDraft.id !== null}
                    >
                      <SelectTrigger aria-label="Activity">
                        <SelectValue placeholder="Choose activity" />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Resource
                    <Select
                      value={assignmentDraft.resource_id}
                      onValueChange={(value) => setAssignmentDraft((current) => ({ ...current, resource_id: value }))}
                      disabled={assignmentDraft.id !== null}
                    >
                      <SelectTrigger aria-label="Resource">
                        <SelectValue placeholder="Choose resource" />
                      </SelectTrigger>
                      <SelectContent>
                        {model.resources.map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Allocation %
                    <NumberInput
                      min="1"
                      max="100"
                      step="1"
                      decimals={0}
                      value={assignmentDraft.allocation_percent}
                      onChange={(event) => setAssignmentDraft((current) => ({
                        ...current,
                        allocation_percent: event.target.value,
                      }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Planned units
                    <NumberInput
                      min="0"
                      step="0.01"
                      value={assignmentDraft.planned_units}
                      onChange={(event) => setAssignmentDraft((current) => ({
                        ...current,
                        planned_units: event.target.value,
                      }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Actual units
                    <NumberInput
                      min="0"
                      step="0.01"
                      value={assignmentDraft.actual_units}
                      onChange={(event) => setAssignmentDraft((current) => ({
                        ...current,
                        actual_units: event.target.value,
                      }))}
                    />
                  </label>
                  <MoneyField
                    label="Actual rate"
                    value={numberFromDraft(assignmentDraft.actual_rate)}
                    onChange={(value) => setAssignmentDraft((current) => ({
                      ...current,
                      actual_rate: value?.toString() ?? "",
                    }))}
                  />
                  <MoneyField
                    label="Explicit actual cost"
                    value={numberFromDraft(assignmentDraft.actual_cost)}
                    onChange={(value) => setAssignmentDraft((current) => ({
                      ...current,
                      actual_cost: value?.toString() ?? "",
                    }))}
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <Button onClick={() => void saveAssignment()} disabled={isSaving}>
                      Save assignment
                    </Button>
                    {assignmentDraft.id && (
                      <Button variant="outline" onClick={() => setAssignmentDraft(emptyAssignmentDraft)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Planned</th>
                  <th className="px-3 py-2">Actual units</th>
                  <th className="px-3 py-2">Actual cost</th>
                  <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {model.assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-t">
                    <td className="px-3 py-2">{tasksById.get(assignment.task_id)?.name ?? "Missing activity"}</td>
                    <td className="px-3 py-2">{resourcesById.get(assignment.resource_id)?.display_name ?? "Missing resource"}</td>
                    <td className="px-3 py-2">{assignment.planned_units ?? "Missing"}</td>
                    <td className="px-3 py-2">{assignment.actual_units ?? "Missing"}</td>
                    <td className="px-3 py-2">{assignment.actual_cost === null ? "Calculated from units" : formatMoney(assignment.actual_cost)}</td>
                    <td className="px-3 py-2">
                      {model.can_manage && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => editAssignment(assignment)} aria-label="Edit cost assignment">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setPendingDelete({ kind: "assignment", assignment })} aria-label="Delete cost assignment">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {model.assignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No cost assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "resource"
            ? `Delete ${pendingDelete.resource.display_name}?`
            : "Delete cost assignment?"
        }
        description={
          pendingDelete?.kind === "resource"
            ? "This permanently removes the resource. Delete its task assignments first; this action cannot be undone."
            : "This permanently removes the resource cost facts from this activity. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isSaving}
        onConfirm={async () => {
          if (pendingDelete?.kind === "resource") {
            await deleteResource(pendingDelete.resource);
          } else if (pendingDelete?.kind === "assignment") {
            await deleteAssignment(pendingDelete.assignment);
          }
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
