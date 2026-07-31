"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2, Users } from "lucide-react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { calculateScheduleResourceAllocation } from "@/lib/scheduling/schedule-resource-allocation";
import { isWorkingDay, type ScheduleCalendar } from "@/lib/scheduling/schedule-calendar";
import type {
  ScheduleResource,
  ScheduleResourceCapacityProfile,
  ScheduleResourceCandidate,
  ScheduleResourceRosterResponse,
  ScheduleTask,
  ScheduleTaskAssignmentInput,
} from "@/types/scheduling";

interface TaskAssignmentsEditorProps {
  task: ScheduleTask;
  tasks: ScheduleTask[];
  roster: ScheduleResourceRosterResponse;
  calendar: ScheduleCalendar;
  onSave: (assignments: ScheduleTaskAssignmentInput[]) => Promise<void>;
  loadCapacityProfiles?: (start: string, finish: string) => Promise<ScheduleResourceCapacityProfile[]>;
  disabled?: boolean;
}

type DraftAssignment = ScheduleTaskAssignmentInput;

export function TaskAssignmentsEditor({
  task,
  tasks,
  roster,
  calendar,
  onSave,
  loadCapacityProfiles,
  disabled = false,
}: TaskAssignmentsEditorProps) {
  const persistedAssignments = useMemo(
    () => roster.assignments.filter((assignment) => assignment.task_id === task.id),
    [roster.assignments, task.id],
  );
  const [draft, setDraft] = useState<DraftAssignment[]>([]);
  const [personToAdd, setPersonToAdd] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityProfiles, setCapacityProfiles] = useState<ScheduleResourceCapacityProfile[]>([]);
  const [isCapacityLoading, setIsCapacityLoading] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(persistedAssignments.map((assignment) => ({
      person_id: assignment.person_id,
      allocation_percent: assignment.allocation_percent,
    })));
    setPersonToAdd("");
    setError(null);
  }, [persistedAssignments, task.id]);

  const peopleById = useMemo(() => {
    const entries: Array<readonly [string, ScheduleResource | ScheduleResourceCandidate]> = [
      ...roster.resources.map((resource) => [resource.person_id, resource] as const),
      ...roster.candidates.map((candidate) => [candidate.person_id, candidate] as const),
    ];
    return new Map(entries);
  }, [roster.candidates, roster.resources]);

  const unassignedCandidates = roster.candidates.filter(
    (candidate) => !draft.some((assignment) => assignment.person_id === candidate.person_id),
  );
  const taskStart = task.forecast_start_date ?? task.start_date;
  const taskFinish = task.forecast_finish_date ?? task.finish_date;

  useEffect(() => {
    let cancelled = false;
    if (!loadCapacityProfiles || !taskStart || !taskFinish || taskStart > taskFinish) {
      setCapacityProfiles([]);
      setCapacityError(null);
      setIsCapacityLoading(false);
      return () => { cancelled = true; };
    }
    setIsCapacityLoading(true);
    setCapacityError(null);
    void loadCapacityProfiles(taskStart, taskFinish)
      .then((profiles) => {
        if (!cancelled) setCapacityProfiles(profiles);
      })
      .catch((cause) => {
        if (!cancelled) {
          setCapacityProfiles([]);
          setCapacityError(cause instanceof Error ? cause.message : "Unable to load project capacity for this task span.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsCapacityLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadCapacityProfiles, taskFinish, taskStart]);

  const availabilityState = useMemo(() => {
    const availability = new Map<string, number | null>();
    if (!taskStart || !taskFinish || taskStart > taskFinish || isCapacityLoading || capacityError) {
      return { availability, calculationError: null };
    }
    try {
      const resourcesForAvailability = [
        ...roster.resources,
        ...roster.candidates
          .filter((candidate) => !candidate.resource_id)
          .map((candidate) => ({
            id: `candidate:${candidate.person_id}`,
            project_id: task.project_id,
            person_id: candidate.person_id,
            display_name: candidate.display_name,
            email: candidate.email,
            job_title: candidate.job_title,
            person_status: "active" as const,
            membership_status: "active" as const,
            eligible: true,
          })),
      ];
      const result = calculateScheduleResourceAllocation({
        resources: resourcesForAvailability,
        tasks,
        assignments: roster.assignments.filter((assignment) => assignment.task_id !== task.id),
        capacity_profiles: capacityProfiles,
        calendar,
        range: { start: taskStart, finish: taskFinish },
      });
      for (const resource of resourcesForAvailability) {
        const workingRows = result.daily.filter(
          (row) => row.resource_id === resource.id && isWorkingDay(row.date, calendar),
        );
        availability.set(
          resource.person_id,
          workingRows.length > 0
            ? Math.min(...workingRows.map((row) => row.available_percent))
            : null,
        );
      }
    } catch {
      return {
        availability: new Map<string, number | null>(),
        calculationError: "Unable to calculate availability for this task span.",
      };
    }
    return { availability, calculationError: null };
  }, [calendar, capacityError, capacityProfiles, isCapacityLoading, roster.assignments, roster.candidates, roster.resources, task.id, task.project_id, taskFinish, taskStart, tasks]);
  const availabilityByPersonId = availabilityState.availability;

  const addPerson = () => {
    if (!personToAdd || draft.some((assignment) => assignment.person_id === personToAdd)) return;
    setDraft((current) => [...current, { person_id: personToAdd, allocation_percent: 100 }]);
    setPersonToAdd("");
    setError(null);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save resource assignments.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="space-y-3 rounded-md border p-4"
      aria-label="Resource assignments"
      onKeyDown={(event) => {
        if (
          event.key === "Enter"
          && event.target instanceof HTMLInputElement
          && event.target.type === "number"
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionRuleHeading
            className="mb-1 pb-0"
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            label="Resource assignments"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Assign project-directory people and their daily allocation. Assignment changes do not move task dates.
          </p>
        </div>
      </div>

      {(task.assignee || task.assignee_person_id) && (
        <Alert variant="warning" role="status">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription>
            This task has a legacy single-assignee value. It is shown for review only and is not converted into an allocation.
          </AlertDescription>
        </Alert>
      )}

      {draft.length === 0 ? (
        <p className="text-sm text-muted-foreground">No people are assigned to this task.</p>
      ) : (
        <div className="space-y-2">
          {draft.map((assignment) => {
            const person = peopleById.get(assignment.person_id);
            const resource = roster.resources.find((item) => item.person_id === assignment.person_id);
            const name = person?.display_name ?? "Unknown project person";
            const available = availabilityByPersonId.get(assignment.person_id);
            return (
              <div key={assignment.person_id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isCapacityLoading
                        ? "Loading project capacity for this task span"
                        : available === undefined || available === null
                        ? "Availability unavailable for this task span"
                        : `${available}% available before this task`}
                    </p>
                    {resource && !resource.eligible && (
                      <Alert variant="destructive" className="mt-2 py-2" role="status">
                        <AlertDescription className="text-xs">
                        This person is no longer active in the project directory. Remove them before saving another change.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="w-full sm:w-36">
                    <NumberField
                      id={`allocation-${assignment.person_id}`}
                      label={`Allocation for ${name}`}
                      min={1}
                      max={100}
                      step={1}
                      value={assignment.allocation_percent}
                      disabled={disabled || isSaving || !roster.can_manage}
                      suffix="%"
                      onChange={(value) => {
                        setDraft((current) => current.map((item) =>
                          item.person_id === assignment.person_id
                            ? { ...item, allocation_percent: value ?? 0 }
                            : item,
                        ));
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${name}`}
                    disabled={disabled || isSaving || !roster.can_manage}
                    onClick={() => setDraft((current) => current.filter((item) => item.person_id !== assignment.person_id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Add project person"
            options={unassignedCandidates.map((candidate) => ({
              value: candidate.person_id,
              label: candidate.display_name,
            }))}
            placeholder="Select a person"
            value={personToAdd}
            disabled={disabled || isSaving || !roster.can_manage || unassignedCandidates.length === 0}
            onValueChange={setPersonToAdd}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!personToAdd || disabled || isSaving || !roster.can_manage}
          onClick={addPerson}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add resource
        </Button>
      </div>

      {!roster.can_manage && (
        <p className="text-xs text-muted-foreground">You can review resource load, but schedule-manager access is required to change assignments.</p>
      )}
      {(capacityError || availabilityState.calculationError) && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Resource availability is unavailable: {capacityError ?? availabilityState.calculationError}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={
            disabled
            || isSaving
            || !roster.can_manage
            || draft.some((assignment) => !Number.isInteger(assignment.allocation_percent)
              || assignment.allocation_percent < 1
              || assignment.allocation_percent > 100)
          }
          onClick={save}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save assignments
        </Button>
      </div>
    </section>
  );
}
