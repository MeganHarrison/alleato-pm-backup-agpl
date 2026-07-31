"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { SectionRuleHeading } from "@/components/layout/spacing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DependencyType, ScheduleDependency, ScheduleTask } from "@/types/scheduling";

interface TaskDependenciesEditorProps {
  taskId: string;
  dependencies: ScheduleDependency[];
  availableTasks: ScheduleTask[];
  onCreate: (input: {
    predecessor_task_id: string;
    dependency_type: DependencyType;
    lag_days: number;
  }) => Promise<void>;
  onRemove: (dependencyId: string) => Promise<void>;
  onUpdate: (dependencyId: string, input: {
    predecessor_task_id: string;
    dependency_type: DependencyType;
    lag_days: number;
  }) => Promise<void>;
}

const dependencyTypes: Array<{ value: DependencyType; label: string }> = [
  { value: "finish_to_start", label: "Finish-to-Start" },
  { value: "start_to_start", label: "Start-to-Start" },
  { value: "finish_to_finish", label: "Finish-to-Finish" },
  { value: "start_to_finish", label: "Start-to-Finish" },
];

function formatLeadOrLag(days: number): string {
  const absoluteDays = Math.abs(days);
  const unit = absoluteDays === 1 ? "day" : "days";
  return `${absoluteDays} ${unit} ${days < 0 ? "lead" : "lag"}`;
}

export function TaskDependenciesEditor({
  taskId,
  dependencies,
  availableTasks,
  onCreate,
  onRemove,
  onUpdate,
}: TaskDependenciesEditorProps) {
  const [predecessorTaskId, setPredecessorTaskId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("finish_to_start");
  const [lagDays, setLagDays] = useState("0");
  const [editingDependencyId, setEditingDependencyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskNames = useMemo(
    () => new Map(availableTasks.map((task) => [task.id, task.name])),
    [availableTasks],
  );
  const eligibleTasks = availableTasks.filter((task) => task.id !== taskId);

  const saveDependency = async () => {
    const parsedLag = Number(lagDays);
    if (!predecessorTaskId) {
      setError("Select a predecessor before adding a dependency.");
      return;
    }
    if (!Number.isInteger(parsedLag) || parsedLag < -365 || parsedLag > 365) {
      setError("Lead or lag must be a whole number from -365 to 365 working days.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const input = {
        predecessor_task_id: predecessorTaskId,
        dependency_type: dependencyType,
        lag_days: parsedLag,
      };
      if (editingDependencyId) {
        await onUpdate(editingDependencyId, input);
      } else {
        await onCreate(input);
      }
      setPredecessorTaskId("");
      setLagDays("0");
      setEditingDependencyId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add dependency.");
    } finally {
      setIsSaving(false);
    }
  };

  const beginEdit = (dependency: ScheduleDependency) => {
    setEditingDependencyId(dependency.id);
    setPredecessorTaskId(dependency.predecessor_task_id);
    setDependencyType(dependency.dependency_type);
    setLagDays(String(dependency.lag_days));
    setError(null);
  };

  const removeDependency = async (dependencyId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await onRemove(dependencyId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove dependency.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 border-t pt-5" aria-label="Predecessors">
      <div className="space-y-1">
        <SectionRuleHeading label="Predecessors" className="mb-1 pb-0" />
        <p className="text-sm text-muted-foreground">Tasks that must be scheduled before this task.</p>
      </div>

      {dependencies.length > 0 && (
        <ul className="divide-y" aria-label="Current predecessors">
          {dependencies.map((dependency) => {
            const predecessorName = taskNames.get(dependency.predecessor_task_id) ?? "Unavailable task";
            const dependencyLabel = dependencyTypes.find((type) => type.value === dependency.dependency_type)?.label ?? dependency.dependency_type;
            return (
              <li key={dependency.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{predecessorName}</p>
                  <p className="text-sm text-muted-foreground">{dependencyLabel}{dependency.lag_days ? ` · ${formatLeadOrLag(dependency.lag_days)}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    aria-label={`Edit ${predecessorName} predecessor`}
                    onClick={() => beginEdit(dependency)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    aria-label={`Remove ${predecessorName} predecessor`}
                    onClick={() => void removeDependency(dependency.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_128px_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="predecessor-task">Predecessor task</Label>
          <Select value={predecessorTaskId} onValueChange={setPredecessorTaskId}>
            <SelectTrigger id="predecessor-task"><SelectValue placeholder="Select task" /></SelectTrigger>
            <SelectContent>
              {eligibleTasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dependency-type">Relationship</Label>
          <Select value={dependencyType} onValueChange={(value) => setDependencyType(value as DependencyType)}>
            <SelectTrigger id="dependency-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {dependencyTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dependency-lag">Lead or lag days</Label>
          <NumberInput id="dependency-lag" min="-365" max="365" decimals={0} value={lagDays} aria-describedby="dependency-lead-lag-help" onChange={(event) => setLagDays(event.target.value)} />
          <p id="dependency-lead-lag-help" className="text-xs text-muted-foreground">Negative is lead; positive is lag.</p>
        </div>
        <Button type="button" disabled={isSaving} onClick={() => void saveDependency()}>{editingDependencyId ? "Update" : "Add"}</Button>
      </div>

      {/* ErrorState is a page-level recovery surface; this inline validation must preserve the modal workflow. */}
      {/* eslint-disable-next-line design-system/require-error-state */}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
