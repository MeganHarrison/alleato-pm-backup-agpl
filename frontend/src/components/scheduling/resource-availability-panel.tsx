"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Settings2,
  Users,
  WandSparkles,
} from "lucide-react";
import { DateField } from "@/components/forms/DateField";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { ResourceCalendarDialog } from "@/components/scheduling/resource-calendar-dialog";
import { EnterpriseSchedulingPanel } from "@/components/scheduling/enterprise-scheduling-panel";
import { ScheduleResourceCostPanel } from "@/components/scheduling/schedule-resource-cost-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { calculateScheduleResourceAllocation } from "@/lib/scheduling/schedule-resource-allocation";
import {
  addWorkingDays,
  formatLocalScheduleDate,
  isWorkingDay,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";
import type {
  ResourceAllocationDiagnostic,
  ScheduleResource,
  ScheduleResourceCapacityProfile,
  ScheduleResourceCapacityProfileInput,
  ScheduleResourceCapacityRangeResponse,
  ScheduleResourceLevelingPreviewResult,
  ScheduleResourceRosterResponse,
  ScheduleTask,
} from "@/types/scheduling";

interface ResourceAvailabilityPanelProps {
  projectId?: string;
  roster: ScheduleResourceRosterResponse | null;
  tasks: ScheduleTask[];
  calendar: ScheduleCalendar;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  today?: string;
  defaultOpen?: boolean;
  calendarReady?: boolean;
  capacityRange?: ScheduleResourceCapacityRangeResponse | null;
  isCapacityRangeLoading?: boolean;
  capacityRangeError?: string | null;
  onLoadCapacityRange?: (
    start: string,
    finish: string,
  ) => Promise<ScheduleResourceCapacityRangeResponse>;
  selectedCapacityProfile?: ScheduleResourceCapacityProfile | null;
  isCapacityProfileLoading?: boolean;
  capacityProfileError?: string | null;
  onLoadCapacityProfile?: (
    resourceId: string,
  ) => Promise<ScheduleResourceCapacityProfile>;
  onSaveCapacityProfile?: (
    resourceId: string,
    input: ScheduleResourceCapacityProfileInput,
  ) => Promise<ScheduleResourceCapacityProfile>;
  levelingPreview?: ScheduleResourceLevelingPreviewResult | null;
  isLevelingPreviewLoading?: boolean;
  levelingPreviewError?: string | null;
  onPreviewLeveling?: (
    horizonDays?: number,
  ) => Promise<ScheduleResourceLevelingPreviewResult>;
  onScheduleChanged?: () => Promise<void> | void;
}

const DAY_MS = 86_400_000;

function toUtc(value: string): number {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : Number.NaN;
}

function nextWorkingDay(value: string, calendar: ScheduleCalendar): string {
  if (isWorkingDay(value, calendar)) return value;
  return addWorkingDays(value, 1, calendar);
}

function dateFromIso(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : undefined;
}

function diagnosticLabel(diagnostic: ResourceAllocationDiagnostic): string {
  const labels: Partial<Record<ResourceAllocationDiagnostic["code"], string>> =
    {
      missing_task: "Task record is missing",
      missing_resource: "Resource record is missing",
      inactive_resource: "Resource is inactive",
      unscheduled_task: "Task needs start and finish dates",
      invalid_date_range: "Task finish is before its start",
      invalid_capacity_fact: "Capacity fact is invalid",
      duplicate_capacity_fact: "Capacity fact is duplicated",
      duplicate_capacity_profile: "Capacity profile is duplicated",
      uncovered_capacity_range: "Capacity coverage is incomplete",
    };
  return (
    diagnostic.message ??
    labels[diagnostic.code] ??
    "Resource allocation could not be calculated"
  );
}

function reasonLabel(reason: string): string {
  return (
    {
      project_calendar: "project calendar",
      dependency: "dependency",
      constraint: "constraint",
      resource_capacity: "resource capacity",
    }[reason] ?? reason
  );
}

export function ResourceAvailabilityPanel({
  projectId,
  roster,
  tasks,
  calendar,
  isLoading = false,
  error = null,
  onRetry,
  today = formatLocalScheduleDate(),
  defaultOpen = false,
  calendarReady = true,
  capacityRange = null,
  isCapacityRangeLoading = false,
  capacityRangeError = null,
  onLoadCapacityRange,
  selectedCapacityProfile = null,
  isCapacityProfileLoading = false,
  capacityProfileError = null,
  onLoadCapacityProfile,
  onSaveCapacityProfile,
  levelingPreview = null,
  isLevelingPreviewLoading = false,
  levelingPreviewError = null,
  onPreviewLeveling,
  onScheduleChanged,
}: ResourceAvailabilityPanelProps) {
  const initialStart = useMemo(
    () => nextWorkingDay(today, calendar),
    [calendar, today],
  );
  const initialFinish = useMemo(
    () => addWorkingDays(initialStart, 9, calendar),
    [calendar, initialStart],
  );
  const [open, setOpen] = useState(defaultOpen);
  const [start, setStart] = useState(initialStart);
  const [finish, setFinish] = useState(initialFinish);
  const [rangeTouched, setRangeTouched] = useState(false);
  const [editingResource, setEditingResource] =
    useState<ScheduleResource | null>(null);

  useEffect(() => {
    if (!rangeTouched) {
      setStart(initialStart);
      setFinish(initialFinish);
    }
  }, [initialFinish, initialStart, rangeTouched]);

  const rangeError = useMemo(() => {
    const startTime = toUtc(start);
    const finishTime = toUtc(finish);
    if (!Number.isFinite(startTime) || !Number.isFinite(finishTime))
      return "Choose valid start and finish dates.";
    if (finishTime < startTime)
      return "Project resource-load finish must not be before its start.";
    if ((finishTime - startTime) / DAY_MS > 91)
      return "Project resource-load ranges are limited to 92 calendar days.";
    return null;
  }, [finish, start]);

  useEffect(() => {
    if (!open || rangeError || !calendarReady || !onLoadCapacityRange) return;
    void onLoadCapacityRange(start, finish).catch(() => undefined);
  }, [calendarReady, finish, onLoadCapacityRange, open, rangeError, start]);

  const hasCurrentCapacityRange =
    !onLoadCapacityRange ||
    (capacityRange?.range.start === start &&
      capacityRange.range.finish === finish);
  const allocationState = useMemo(() => {
    if (!calendarReady || !roster || rangeError || !hasCurrentCapacityRange) {
      return { allocation: null, calculationError: null };
    }
    try {
      return {
        allocation: calculateScheduleResourceAllocation({
          resources: roster.resources,
          tasks,
          assignments: roster.assignments,
          capacity_profiles: capacityRange?.profiles ?? [],
          calendar,
          range: { start, finish },
        }),
        calculationError: null,
      };
    } catch (cause) {
      return {
        allocation: null,
        calculationError:
          cause instanceof Error
            ? cause.message
            : "Unable to calculate project resource load.",
      };
    }
  }, [
    calendar,
    calendarReady,
    capacityRange,
    finish,
    hasCurrentCapacityRange,
    rangeError,
    roster,
    start,
    tasks,
  ]);
  const allocation = allocationState.allocation;

  const taskNamesById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.name])),
    [tasks],
  );
  const resourceNamesById = useMemo(
    () =>
      new Map(
        (roster?.resources ?? []).map((resource) => [
          resource.id,
          resource.display_name,
        ]),
      ),
    [roster?.resources],
  );

  const allocationView = useMemo(() => {
    if (!allocation) return null;
    const dates: string[] = [];
    const seenDates = new Set<string>();
    const rowsByResource = new Map<string, typeof allocation.daily>();
    for (const row of allocation.daily) {
      if (!seenDates.has(row.date)) {
        seenDates.add(row.date);
        dates.push(row.date);
      }
      const rows = rowsByResource.get(row.resource_id) ?? [];
      rows.push(row);
      rowsByResource.set(row.resource_id, rows);
    }
    return {
      dates,
      rowsByResource,
      summariesByResource: new Map(
        allocation.summaries.map((summary) => [summary.resource_id, summary]),
      ),
    };
  }, [allocation]);

  const combinedLoading =
    isLoading ||
    isCapacityRangeLoading ||
    (Boolean(onLoadCapacityRange) &&
      !hasCurrentCapacityRange &&
      !capacityRangeError);
  const combinedError =
    error ?? capacityRangeError ?? allocationState.calculationError;
  const retry =
    capacityRangeError && onLoadCapacityRange
      ? () => {
          void onLoadCapacityRange(start, finish).catch(() => undefined);
        }
      : onRetry;

  return (
    <section
      className="border-y py-3"
      aria-label="Project resource availability"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls="schedule-resource-load-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        Project resource load
        {open ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>

      {open && (
        <div id="schedule-resource-load-panel" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DateField
              label="Start"
              value={dateFromIso(start)}
              onChange={(date) => {
                setRangeTouched(true);
                setStart(date ? formatLocalScheduleDate(date) : "");
              }}
            />
            <DateField
              label="Finish"
              value={dateFromIso(finish)}
              onChange={(date) => {
                setRangeTouched(true);
                setFinish(date ? formatLocalScheduleDate(date) : "");
              }}
            />
            <div className="max-w-xl text-xs text-muted-foreground">
              Capacity defaults to 100% on project working days. Overrides and
              exceptions apply only to this project; cross-project availability
              is not included.
            </div>
          </div>

          {rangeError && (
            <Alert variant="destructive">
              <AlertDescription>{rangeError}</AlertDescription>
            </Alert>
          )}
          {combinedError && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{combinedError}</span>
                {retry && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={retry}
                  >
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {combinedLoading && (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading project
              resource load...
            </p>
          )}

          {!combinedLoading &&
            !combinedError &&
            roster &&
            roster.resources.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Assign a project person to a task to begin resource-load
                tracking.
              </p>
            )}

          {!combinedLoading &&
            !combinedError &&
            roster &&
            roster.legacy_assignment_count > 0 && (
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription>
                  {roster.legacy_assignment_count}{" "}
                  {roster.legacy_assignment_count === 1
                    ? "task has"
                    : "tasks have"}{" "}
                  a legacy single-assignee value that is excluded from
                  resource-load totals until it is reviewed and saved as a
                  canonical allocation.
                </AlertDescription>
              </Alert>
            )}

          {allocation && allocation.diagnostics.length > 0 && (
            <Alert variant="warning">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription>
                <p>
                  {allocation.diagnostics.length} resource-load{" "}
                  {allocation.diagnostics.length === 1
                    ? "fact needs"
                    : "facts need"}{" "}
                  attention.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {allocation.diagnostics.map((diagnostic, index) => (
                    <li
                      key={`${diagnostic.assignment_id ?? diagnostic.resource_id ?? "diagnostic"}:${diagnostic.code}:${index}`}
                    >
                      {diagnosticLabel(diagnostic)}
                      {diagnostic.task_id
                        ? `: ${taskNamesById.get(diagnostic.task_id) ?? diagnostic.task_id}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {allocation &&
            allocationView &&
            roster &&
            roster.resources.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="sticky left-0 min-w-56 bg-muted/40 px-3 py-2 font-medium">
                        Resource
                      </th>
                      {allocationView.dates.map((date) => (
                        <th
                          key={date}
                          className="min-w-36 px-3 py-2 font-medium"
                        >
                          {date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.resources.map((resource) => {
                      const rows =
                        allocationView.rowsByResource.get(resource.id) ?? [];
                      const summary = allocationView.summariesByResource.get(
                        resource.id,
                      );
                      return (
                        <tr
                          key={resource.id}
                          className="border-b last:border-0"
                        >
                          <th className="sticky left-0 bg-background px-3 py-3 align-top font-medium">
                            <span className="block">
                              {resource.display_name}
                            </span>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              Peak {summary?.peak_assigned_percent ?? 0}% /{" "}
                              {summary?.overallocated_dates.length ?? 0}{" "}
                              overallocated day(s)
                            </span>
                            {roster.can_manage &&
                              onLoadCapacityProfile &&
                              onSaveCapacityProfile && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() => setEditingResource(resource)}
                                >
                                  <Settings2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />{" "}
                                  Edit project capacity
                                </Button>
                              )}
                          </th>
                          {rows.map((row) => (
                            <td
                              key={row.date}
                              className={`px-3 py-3 align-top ${row.capacity_percent === 0 ? "bg-muted/30 text-muted-foreground" : ""}`}
                            >
                              <span className="block text-xs text-muted-foreground">
                                Capacity {row.capacity_percent}%
                              </span>
                              {row.capacity_percent === 0 ? (
                                <span>
                                  No capacity
                                  {row.capacity_reason
                                    ? `: ${row.capacity_reason}`
                                    : ""}
                                </span>
                              ) : (
                                <>
                                  <span className="block">
                                    {row.assigned_percent}% assigned
                                  </span>
                                  <span
                                    className={
                                      row.overallocated_percent > 0
                                        ? "font-medium text-destructive"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {row.overallocated_percent > 0
                                      ? `${row.overallocated_percent}% over capacity`
                                      : `${row.available_percent}% available`}
                                  </span>
                                </>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          {onPreviewLeveling && (
            <section
              className="space-y-3 rounded-md border p-4"
              aria-label="Resource leveling preview"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionRuleHeading
                    className="mb-1"
                    label="Resource leveling preview"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shows deterministic delay-only suggestions. Previewing never
                    changes schedule dates.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isLevelingPreviewLoading}
                  onClick={() =>
                    void onPreviewLeveling().catch(() => undefined)
                  }
                >
                  {isLevelingPreviewLoading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <WandSparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  Preview leveling
                </Button>
              </div>
              {levelingPreviewError && (
                <Alert variant="destructive">
                  <AlertDescription>{levelingPreviewError}</AlertDescription>
                </Alert>
              )}
              {levelingPreview && (
                <div className="space-y-3" aria-live="polite">
                  <Alert>
                    <AlertDescription>
                      {levelingPreview.notice} Status: {levelingPreview.status}.{" "}
                      {levelingPreview.proposals.length} date-change{" "}
                      {levelingPreview.proposals.length === 1
                        ? "proposal"
                        : "proposals"}
                      .
                    </AlertDescription>
                  </Alert>
                  {levelingPreview.proposals.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b bg-muted/40">
                          <tr>
                            <th className="px-3 py-2">Task</th>
                            <th className="px-3 py-2">Current</th>
                            <th className="px-3 py-2">Proposed</th>
                            <th className="px-3 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelingPreview.proposals.map((proposal) => (
                            <tr
                              key={proposal.task_id}
                              className="border-b last:border-0"
                            >
                              <th className="px-3 py-2 font-medium">
                                {proposal.task_name}
                              </th>
                              <td className="px-3 py-2">
                                {proposal.previous_start_date} -{" "}
                                {proposal.previous_finish_date}
                              </td>
                              <td className="px-3 py-2">
                                {proposal.proposed_start_date} -{" "}
                                {proposal.proposed_finish_date} (+
                                {proposal.delay_working_days} working days)
                              </td>
                              <td className="px-3 py-2">
                                {proposal.reasons.map(reasonLabel).join(", ")}
                                {proposal.constraining_resource_ids.length > 0
                                  ? `: ${proposal.constraining_resource_ids.map((id) => resourceNamesById.get(id) ?? id).join(", ")}`
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {levelingPreview.diagnostics.length > 0 && (
                    <Alert variant="warning">
                      <AlertTriangle aria-hidden="true" />
                      <AlertDescription>
                        <p>
                          {levelingPreview.diagnostics.length} leveling{" "}
                          {levelingPreview.diagnostics.length === 1
                            ? "diagnostic"
                            : "diagnostics"}
                          :
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                          {levelingPreview.diagnostics.map(
                            (diagnostic, index) => (
                              <li
                                key={`${diagnostic.code}:${diagnostic.task_id ?? diagnostic.resource_id ?? index}`}
                              >
                                {diagnostic.message}
                              </li>
                            ),
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </section>
          )}

          {projectId && roster && (
            <>
              <ScheduleResourceCostPanel projectId={projectId} tasks={tasks} />
              <EnterpriseSchedulingPanel
                projectId={projectId}
                roster={roster}
                calendar={calendar}
                onScheduleChanged={onScheduleChanged}
              />
            </>
          )}
        </div>
      )}

      {onLoadCapacityProfile && onSaveCapacityProfile && (
        <ResourceCalendarDialog
          open={Boolean(editingResource)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingResource(null);
          }}
          resource={editingResource}
          profile={selectedCapacityProfile}
          isLoading={isCapacityProfileLoading}
          error={capacityProfileError}
          onLoad={onLoadCapacityProfile}
          onSave={onSaveCapacityProfile}
        />
      )}
    </section>
  );
}
