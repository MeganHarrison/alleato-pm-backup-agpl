"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Settings2,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/forms/NumberField";
import { ErrorState } from "@/components/ds/error-state";
import { InfoAlert } from "@/components/ds/InfoAlert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import {
  localDateParts,
  zonedLocalTimestamp,
  type HourlyLevelingResult,
} from "@/lib/scheduling/schedule-hourly-leveling";
import type { ScheduleCalendar } from "@/lib/scheduling/schedule-calendar";
import type {
  ScheduleEnterpriseCapacityResponse,
  ScheduleLevelingHistoryItem,
  ScheduleLevelingRunResponse,
  SchedulePersonWorkCalendar,
  ScheduleResource,
  ScheduleResourceRosterResponse,
  ScheduleWeeklyWorkInterval,
} from "@/types/scheduling";

interface EnterpriseSchedulingPanelProps {
  projectId: string;
  roster: ScheduleResourceRosterResponse;
  calendar: ScheduleCalendar;
  onScheduleChanged?: () => Promise<void> | void;
}

const DAY_MS = 86_400_000;
const DEFAULT_WEEKLY: ScheduleWeeklyWorkInterval[] = [1, 2, 3, 4, 5].flatMap(
  (weekday) => [
    { weekday, start_minute: 480, end_minute: 720, capacity_percent: 100 },
    { weekday, start_minute: 780, end_minute: 1020, capacity_percent: 100 },
  ],
);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ShiftDraft = Omit<ScheduleWeeklyWorkInterval, "start_minute" | "end_minute"> & {
  start_time: string;
  end_time: string;
};

function timeLabel(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) return "";
  if (minute === 1440) return "24:00";
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function parseTime(value: string, allowEndOfDay = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 24 || (hour === 24 && (minute !== 0 || !allowEndOfDay))) return null;
  return hour * 60 + minute;
}

function toShiftDraft(shift: ScheduleWeeklyWorkInterval): ShiftDraft {
  return {
    weekday: shift.weekday,
    start_time: timeLabel(shift.start_minute),
    end_time: timeLabel(shift.end_minute),
    capacity_percent: shift.capacity_percent,
  };
}

function rangeForPreview(timezone: string): { start: string; finish: string } {
  const startDate = localDateParts(Date.now(), timezone).date;
  const finishDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + 28 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return {
    start: new Date(zonedLocalTimestamp(startDate, 0, timezone)).toISOString(),
    finish: new Date(zonedLocalTimestamp(finishDate, 0, timezone)).toISOString(),
  };
}

function previewTimestamp(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ShiftCalendarDialog({
  open,
  onOpenChange,
  projectId,
  resource,
  calendar,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  resource: ScheduleResource | null;
  calendar: SchedulePersonWorkCalendar | null;
  onSaved: () => Promise<void>;
}) {
  const [timezone, setTimezone] = useState("America/Indiana/Indianapolis");
  const [shifts, setShifts] = useState<ShiftDraft[]>(
    DEFAULT_WEEKLY.map(toShiftDraft),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAwaitingRefresh, setSavedAwaitingRefresh] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTimezone(calendar?.timezone_name ?? "America/Indiana/Indianapolis");
    setShifts(
      (calendar?.calendar_id ? calendar.weekly_intervals : DEFAULT_WEEKLY).map(toShiftDraft),
    );
    setError(null);
    setSavedAwaitingRefresh(false);
  }, [calendar, open]);

  const shiftError = useMemo(() => {
    if (
      shifts.some(
        (shift) =>
          parseTime(shift.start_time) === null ||
          parseTime(shift.end_time, true) === null ||
          parseTime(shift.start_time) === parseTime(shift.end_time, true) ||
          parseTime(shift.start_time)! % 15 !== 0 ||
          parseTime(shift.end_time, true)! % 15 !== 0,
      )
    ) {
      return "Every shift must have distinct start and finish times on the 15-minute grid.";
    }
    return null;
  }, [shifts]);

  const save = async () => {
    if (!resource || !calendar || shiftError || savedAwaitingRefresh) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/person-work-calendars/${resource.person_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timezone_name: timezone,
            expected_version: calendar.version,
            weekly_intervals: shifts.map((shift) => ({
              weekday: shift.weekday,
              start_minute: parseTime(shift.start_time)!,
              end_minute: parseTime(shift.end_time, true)!,
              capacity_percent: shift.capacity_percent,
            })),
            date_intervals: calendar.date_intervals,
          }),
        },
      );
      try {
        await onSaved();
        onOpenChange(false);
      } catch {
        setSavedAwaitingRefresh(true);
        setError(
          "Work shifts were saved, but the refreshed calendar could not be loaded. Close and refresh this page before editing again.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save the work calendar.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) onOpenChange(next);
      }}
    >
      <DialogContent
        size="form"
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            Work shifts{resource ? `: ${resource.display_name}` : ""}
          </DialogTitle>
          <DialogDescription>
            These reusable person-level shifts constrain every project that
            assigns this person. Overnight shifts may finish earlier than they
            start and are normalized at save.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="person-timezone">Time zone</Label>
            <Input
              id="person-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            {shifts.map((shift, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[7rem_1fr_1fr_7rem_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label htmlFor={`shift-day-${index}`}>Day</Label>
                  <Select
                    disabled={isSaving || savedAwaitingRefresh}
                    value={String(shift.weekday)}
                    onValueChange={(value) =>
                      setShifts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, weekday: Number(value) }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger id={`shift-day-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day, weekday) => (
                        <SelectItem key={day} value={String(weekday)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`shift-start-${index}`}>Start</Label>
                  <Input
                    id={`shift-start-${index}`}
                    placeholder="08:00"
                    disabled={isSaving || savedAwaitingRefresh}
                    value={shift.start_time}
                    onChange={(event) =>
                      setShifts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                start_time: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`shift-finish-${index}`}>Finish</Label>
                  <Input
                    id={`shift-finish-${index}`}
                    placeholder="17:00"
                    disabled={isSaving || savedAwaitingRefresh}
                    value={shift.end_time}
                    onChange={(event) =>
                      setShifts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                end_time: event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <NumberField
                  id={`shift-capacity-${index}`}
                  label="Capacity percent"
                  min={0}
                  max={100}
                  step={1}
                  disabled={isSaving || savedAwaitingRefresh}
                  value={shift.capacity_percent}
                  onChange={(value) =>
                    setShifts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, capacity_percent: value ?? 0 }
                          : item,
                      ),
                    )
                  }
                  suffix="%"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove shift ${index + 1}`}
                  disabled={isSaving || savedAwaitingRefresh}
                  onClick={() =>
                    setShifts((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving || savedAwaitingRefresh}
            onClick={() =>
              setShifts((current) => [
                ...current,
                {
                  weekday: 1,
                  start_time: "08:00",
                  end_time: "17:00",
                  capacity_percent: 100,
                },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Add shift
          </Button>
          {(shiftError || error) && (
            <ErrorState
              error={shiftError ?? error ?? "Unable to edit work shifts."}
              className="py-4"
            />
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {savedAwaitingRefresh ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={
              isSaving ||
              savedAwaitingRefresh ||
              shifts.length > 100 ||
              Boolean(shiftError)
            }
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save work
            shifts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnterpriseSchedulingPanel({
  projectId,
  roster,
  calendar,
  onScheduleChanged,
}: EnterpriseSchedulingPanelProps) {
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] =
    useState<ScheduleEnterpriseCapacityResponse | null>(null);
  const [history, setHistory] = useState<ScheduleLevelingHistoryItem[]>([]);
  const [preview, setPreview] = useState<HourlyLevelingResult | null>(null);
  const [run, setRun] = useState<ScheduleLevelingRunResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingResource, setEditingResource] =
    useState<ScheduleResource | null>(null);
  const [confirmedDiagnostics, setConfirmedDiagnostics] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewTimezone, setPreviewTimezone] = useState(
    calendar.timezone_name ?? "America/Indiana/Indianapolis",
  );
  const previewRange = useMemo(
    () => rangeForPreview(calendar.timezone_name ?? "America/Indiana/Indianapolis"),
    [calendar.timezone_name],
  );

  const loadCapacity = useCallback(async () => {
    if (roster.resources.length === 0) return null;
    const query = new URLSearchParams({
      person_ids: roster.resources
        .map((resource) => resource.person_id)
        .join(","),
      start: previewRange.start,
      finish: previewRange.finish,
    });
    const result = await apiFetch<{ data: ScheduleEnterpriseCapacityResponse }>(
      `/api/projects/${projectId}/scheduling/enterprise-capacity?${query}`,
      { cache: "no-store" },
    );
    setCapacity(result.data);
    return result.data;
  }, [previewRange.finish, previewRange.start, projectId, roster.resources]);

  const loadHistory = useCallback(async () => {
    const result = await apiFetch<{ data: ScheduleLevelingHistoryItem[] }>(
      `/api/projects/${projectId}/scheduling/resource-leveling-runs?limit=25`,
      { cache: "no-store" },
    );
    setHistory(result.data);
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setIsBusy(true);
    setError(null);
    void Promise.all([loadCapacity(), loadHistory()])
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load enterprise scheduling data.",
        ),
      )
      .finally(() => setIsBusy(false));
  }, [loadCapacity, loadHistory, open]);

  const createPreview = async () => {
    setIsBusy(true);
    setError(null);
    setRun(null);
    setConfirmedDiagnostics(false);
    setSuccessMessage(null);
    try {
      const saved = await apiFetch<{
        data: {
          preview: HourlyLevelingResult;
          run: ScheduleLevelingRunResponse | null;
          timezone_name: string;
        };
      }>(`/api/projects/${projectId}/scheduling/resource-leveling-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range_start: previewRange.start,
          range_finish: previewRange.finish,
        }),
      });
      setPreview(saved.data.preview);
      setRun(saved.data.run);
      setPreviewTimezone(saved.data.timezone_name);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create the hourly leveling preview.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const applyRun = async () => {
    if (!run) return;
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: "resource_leveling_run",
            action: "apply",
            entity_id: run.run.id,
            payload: { reason: "Resolve enterprise resource overallocation" },
          }),
        },
      );
      setRun(null);
      setPreview(null);
      setSuccessMessage("Leveling was applied and audited.");
      try {
        await Promise.all([
          loadCapacity(),
          loadHistory(),
          onScheduleChanged?.(),
        ]);
      } catch {
        setError(
          "Leveling was applied, but the refreshed schedule could not be loaded. Refresh this page before making another change.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to apply leveling.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const undo = async (eventId: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${projectId}/scheduling/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: "resource_leveling_event",
            action: "undo",
            entity_id: eventId,
            payload: { reason: "Restore schedule before leveling" },
          }),
        },
      );
      setSuccessMessage("The leveling application was undone and audited.");
      try {
        await Promise.all([
          loadCapacity(),
          loadHistory(),
          onScheduleChanged?.(),
        ]);
      } catch {
        setError(
          "Leveling was undone, but the refreshed schedule could not be loaded. Refresh this page before making another change.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to undo leveling.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const externalByPerson = useMemo(
    () =>
      new Map(
        roster.resources.map((resource) => {
          const reservations =
            capacity?.reservations.filter(
              (reservation) =>
                reservation.person_id === resource.person_id &&
                reservation.project_id !== Number(projectId),
            ) ?? [];
          const hours = reservations.reduce(
            (sum, reservation) =>
              sum +
              ((Math.max(
                0,
                Date.parse(reservation.ends_at) -
                  Date.parse(reservation.starts_at),
              ) /
                3_600_000) *
                reservation.allocation_percent) /
                100,
            0,
          );
          return [
            resource.person_id,
            {
              hours,
              count: reservations.length,
              redacted: reservations.filter(
                (reservation) => reservation.redacted,
              ).length,
            },
          ];
        }),
      ),
    [capacity?.reservations, projectId, roster.resources],
  );
  const selectedCalendar = editingResource
    ? (capacity?.calendars.find(
        (calendar) => calendar.person_id === editingResource.person_id,
      ) ?? null)
    : null;
  const blockingDiagnostics =
    preview?.diagnostics.filter(
      (diagnostic) => diagnostic.code !== "fixed_task",
    ) ?? [];

  return (
    <section
      className="rounded-md border"
      aria-label="Enterprise resource scheduling"
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between gap-3 rounded-none px-4 py-3 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="enterprise-scheduling-content"
      >
        <span>
          <span className="block text-sm font-medium">
            Enterprise capacity and audited leveling
          </span>
          <span className="block text-xs text-muted-foreground">
            Cross-project workload, person shifts, 15-minute leveling, apply and
            undo history
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      {open && (
        <div
          id="enterprise-scheduling-content"
          className="space-y-5 border-t p-4"
        >
          {error && <ErrorState error={error} className="py-4" />}
          {successMessage && (
            <InfoAlert variant="success">{successMessage}</InfoAlert>
          )}
          {isBusy && (
            <p
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Updating enterprise
              schedule...
            </p>
          )}
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Other-project demand (28 days)</th>
                  <th className="px-3 py-2">Work calendar</th>
                </tr>
              </thead>
              <tbody>
                {roster.resources.map((resource) => {
                  const external = externalByPerson.get(resource.person_id);
                  const calendar = capacity?.calendars.find(
                    (item) => item.person_id === resource.person_id,
                  );
                  return (
                    <tr key={resource.id} className="border-b last:border-0">
                      <th className="px-3 py-2 font-medium">
                        {resource.display_name}
                      </th>
                      <td className="px-3 py-2">
                        {formatNumber(external?.hours ?? 0, 1)} h across{" "}
                        {external?.count ?? 0} reservation(s)
                        {external?.redacted
                          ? `; ${external.redacted} private`
                          : ""}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={
                            !roster.can_manage_enterprise_calendars || !calendar
                          }
                          title={
                            roster.can_manage_enterprise_calendars
                              ? undefined
                              : "Only application administrators can change enterprise person calendars."
                          }
                          onClick={() => setEditingResource(resource)}
                        >
                          <Settings2 className="h-4 w-4" />{" "}
                          {calendar?.weekly_intervals.length
                            ? "Edit shifts"
                            : "Set shifts"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <section
            className="space-y-3 rounded-md border p-4"
            aria-label="Hourly resource leveling"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  15-minute resource leveling
                </p>
                <p className="text-xs text-muted-foreground">
                  Uses person shifts and all visible or redacted cross-project
                  reservations. The saved preview expires and is
                  conflict-checked before apply.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy || !roster.can_manage}
                onClick={() => void createPreview()}
              >
                <WandSparkles className="h-4 w-4" /> Preview and save run
              </Button>
            </div>
            {preview && (
              <div className="space-y-3 text-sm" aria-live="polite">
                <p>
                  {preview.proposals.length} task placement(s);{" "}
                  {preview.diagnostics.length} diagnostic(s).
                </p>
                {preview.proposals.map((proposal) => (
                  <article
                    key={proposal.task_id}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <p className="font-medium">{proposal.task_name}</p>
                    <p className="text-muted-foreground">
                      Before:{" "}
                      {proposal.previous_start_at
                        ? previewTimestamp(proposal.previous_start_at, previewTimezone)
                        : "unscheduled"}{" "}
                      to{" "}
                      {proposal.previous_finish_at
                        ? previewTimestamp(proposal.previous_finish_at, previewTimezone)
                        : "unscheduled"}
                    </p>
                    <ol className="space-y-1">
                      {proposal.segments.map((segment) => (
                        <li key={segment.segment_index}>
                          Segment {segment.segment_index + 1}:{" "}
                          {previewTimestamp(segment.starts_at, previewTimezone)} to{" "}
                          {previewTimestamp(segment.ends_at, previewTimezone)} (
                          {segment.planned_minutes} min)
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
                {preview.diagnostics.length > 0 && (
                  <InfoAlert variant="warning">
                    <p className="font-medium">Review diagnostics</p>
                    <ul className="list-disc pl-5">
                      {preview.diagnostics.map((diagnostic) => (
                        <li key={`${diagnostic.code}:${diagnostic.task_id}`}>
                          {diagnostic.message}
                        </li>
                      ))}
                    </ul>
                  </InfoAlert>
                )}
              </div>
            )}
            {run && (
              <InfoAlert variant="success">
                <div className="space-y-3">
                  <p>
                    Saved run with {run.changes.length} task change(s). Applying
                    creates before/after schedule revisions.
                  </p>
                  {blockingDiagnostics.length > 0 && (
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={confirmedDiagnostics}
                        onCheckedChange={(checked) =>
                          setConfirmedDiagnostics(checked === true)
                        }
                      />{" "}
                      <span>
                        I reviewed the unresolved diagnostics and want to apply
                        the feasible task changes.
                      </span>
                    </label>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      isBusy ||
                      (blockingDiagnostics.length > 0 && !confirmedDiagnostics)
                    }
                    onClick={() => void applyRun()}
                  >
                    Apply leveling
                  </Button>
                </div>
              </InfoAlert>
            )}
          </section>
          <section className="space-y-2" aria-label="Leveling history">
            <p className="flex items-center gap-2 text-sm font-medium">
              <History className="h-4 w-4" /> Leveling history
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No applied leveling events.
              </p>
            ) : (
              history.map((item) => (
                <div
                  key={item.event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <span>
                    <span className="font-medium capitalize">
                      {item.event.event_type}
                    </span>{" "}
                    {item.change_count} task(s) on{" "}
                    {new Date(item.event.created_at).toLocaleString()}
                    {item.event.reason ? ` — ${item.event.reason}` : ""}
                  </span>
                  {item.can_undo && roster.can_manage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => void undo(item.event.id)}
                    >
                      <RotateCcw className="h-4 w-4" /> Undo
                    </Button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      )}
      <ShiftCalendarDialog
        open={Boolean(editingResource)}
        onOpenChange={(next) => {
          if (!next) setEditingResource(null);
        }}
        projectId={projectId}
        resource={editingResource}
        calendar={selectedCalendar}
        onSaved={async () => {
          await loadCapacity();
        }}
      />
    </section>
  );
}
