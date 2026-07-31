"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/forms/NumberField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import {
  formatTimestampInTimezoneForInput,
  localDateParts,
  timestampFromTimezoneInput,
  validateTaskScheduleSegments,
  zonedLocalTimestamp,
} from "@/lib/scheduling/schedule-hourly-leveling";
import type {
  ScheduleTask,
  ScheduleTaskSegmentInput,
  ScheduleTaskSegmentsResponse,
} from "@/types/scheduling";

interface TaskSegmentEditorProps {
  projectId: string;
  task: ScheduleTask;
  timezoneName: string;
  onScheduleChanged?: () => Promise<void> | void;
}

function initialSegment(task: ScheduleTask, timezoneName: string): ScheduleTaskSegmentInput {
  const localDate = task.start_date ?? localDateParts(Date.now(), timezoneName).date;
  const start = new Date(zonedLocalTimestamp(localDate, 480, timezoneName));
  const finish = new Date(start.getTime() + 4 * 60 * 60_000);
  return {
    segment_index: 0,
    starts_at: start.toISOString(),
    ends_at: finish.toISOString(),
    planned_minutes: 240,
    lock_reason: null,
  };
}

export function TaskSegmentEditor({
  projectId,
  task,
  timezoneName,
  onScheduleChanged,
}: TaskSegmentEditorProps) {
  const [response, setResponse] = useState<ScheduleTaskSegmentsResponse | null>(
    null,
  );
  const [segments, setSegments] = useState<ScheduleTaskSegmentInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeInputErrors, setTimeInputErrors] = useState<
    Record<string, string>
  >({});
  const isLocked =
    task.percent_complete > 0 ||
    task.status !== "not_started" ||
    Boolean(task.actual_start_date || task.actual_finish_date);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void apiFetch<{ data: ScheduleTaskSegmentsResponse }>(
      `/api/projects/${projectId}/scheduling/tasks/${task.id}/segments`,
      { cache: "no-store" },
    )
      .then((result) => {
        if (!active) return;
        setResponse(result.data);
        setSegments(
          result.data.state.segments.map(
            ({ id: _id, task_id: _taskId, ...segment }) => segment,
          ),
        );
        setTimeInputErrors({});
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load task segments.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, task.id]);

  const validationError = useMemo(() => {
    try {
      validateTaskScheduleSegments(
        segments.map((segment, index) => ({
          id: `draft:${index}`,
          task_id: task.id,
          ...segment,
        })),
      );
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : "Task segments are invalid.";
    }
  }, [segments, task.id]);

  const addSplit = () =>
    setSegments((current) => {
      if (current.length === 0) return [initialSegment(task, timezoneName)];
      const lastFinish = new Date(current.at(-1)!.ends_at).getTime();
      const start = new Date(lastFinish + 60 * 60_000);
      const finish = new Date(start.getTime() + 4 * 60 * 60_000);
      return [
        ...current,
        {
          segment_index: current.length,
          starts_at: start.toISOString(),
          ends_at: finish.toISOString(),
          planned_minutes: 240,
          lock_reason: null,
        },
      ];
    });

  const save = async () => {
    if (!response || validationError || isLocked) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ data: ScheduleTaskSegmentsResponse }>(
        `/api/projects/${projectId}/scheduling/tasks/${task.id}/segments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_task_version: response.task_version,
            segments,
          }),
        },
      );
      setResponse(result.data);
      setSegments(
        result.data.state.segments.map(
          ({ id: _id, task_id: _taskId, ...segment }) => segment,
        ),
      );
      try {
        await onScheduleChanged?.();
      } catch {
        setError(
          "Hourly segments were saved, but the refreshed schedule could not be loaded. Refresh before editing again.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save task segments.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="space-y-3 rounded-md border p-4"
      aria-label="Split task schedule"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Hourly work and splits</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Segments use 15-minute boundaries. Gaps between segments pause the
            task without consuming resource capacity.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading || isSaving || isLocked}
          onClick={addSplit}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add split
        </Button>
      </div>
      {isLocked && (
        <p className="text-sm text-muted-foreground">
          Progressed or actual-dated work is locked and cannot be split.
        </p>
      )}
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
          Loading segments...
        </p>
      ) : (
        <>
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hourly segments. The task currently uses its date range.
            </p>
          ) : (
            segments.map((segment, index) => (
              <div
                key={`${segment.segment_index}:${segment.starts_at}:${segment.ends_at}`}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label htmlFor={`segment-${index}-start`}>
                    Segment {index + 1} start
                  </Label>
                  <Input
                    key={`start:${segment.starts_at}`}
                    id={`segment-${index}-start`}
                    placeholder="2026-08-03T08:00"
                    disabled={isSaving || isLocked}
                    defaultValue={formatTimestampInTimezoneForInput(segment.starts_at, timezoneName)}
                    aria-invalid={Boolean(timeInputErrors[`${index}:start`])}
                    onChange={(event) => {
                      const key = `${index}:start`;
                      try {
                        const value = timestampFromTimezoneInput(event.target.value, timezoneName);
                        setSegments((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, starts_at: value }
                              : item,
                          ),
                        );
                        setTimeInputErrors((current) => {
                          const next = { ...current };
                          delete next[key];
                          return next;
                        });
                      } catch {
                        setTimeInputErrors((current) => ({
                          ...current,
                          [key]: `Segment ${index + 1} needs a valid start.`,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`segment-${index}-finish`}>
                    Segment {index + 1} finish
                  </Label>
                  <Input
                    key={`finish:${segment.ends_at}`}
                    id={`segment-${index}-finish`}
                    placeholder="2026-08-03T12:00"
                    disabled={isSaving || isLocked}
                    defaultValue={formatTimestampInTimezoneForInput(segment.ends_at, timezoneName)}
                    aria-invalid={Boolean(timeInputErrors[`${index}:finish`])}
                    onChange={(event) => {
                      const key = `${index}:finish`;
                      try {
                        const value = timestampFromTimezoneInput(event.target.value, timezoneName);
                        setSegments((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, ends_at: value }
                              : item,
                          ),
                        );
                        setTimeInputErrors((current) => {
                          const next = { ...current };
                          delete next[key];
                          return next;
                        });
                      } catch {
                        setTimeInputErrors((current) => ({
                          ...current,
                          [key]: `Segment ${index + 1} needs a valid finish.`,
                        }));
                      }
                    }}
                  />
                </div>
                <NumberField
                  id={`segment-${index}-minutes`}
                  label="Work minutes"
                  min={15}
                  step={15}
                  disabled={isSaving || isLocked}
                  value={segment.planned_minutes}
                  onChange={(value) =>
                    setSegments((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, planned_minutes: value ?? 15 }
                          : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove segment ${index + 1}`}
                  disabled={isSaving || isLocked}
                  onClick={() => {
                    setTimeInputErrors((current) =>
                      Object.fromEntries(
                        Object.entries(current).flatMap(([key, message]) => {
                          const [rawIndex, field] = key.split(":");
                          const errorIndex = Number(rawIndex);
                          if (errorIndex === index) return [];
                          const nextIndex = errorIndex > index ? errorIndex - 1 : errorIndex;
                          return [[`${nextIndex}:${field}`, message]];
                        }),
                      ),
                    );
                    setSegments((current) =>
                      current
                        .filter((_, itemIndex) => itemIndex !== index)
                        .map((item, itemIndex) => ({
                          ...item,
                          segment_index: itemIndex,
                        })),
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          {(Object.values(timeInputErrors)[0] || validationError || error) && (
            <p role="alert" className="text-sm text-destructive">
              {Object.values(timeInputErrors)[0] ?? validationError ?? error}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={
              !response ||
              isSaving ||
              isLocked ||
              Boolean(validationError) ||
              Object.keys(timeInputErrors).length > 0
            }
            onClick={() => void save()}
          >
            {isSaving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}{" "}
            Save hourly segments
          </Button>
        </>
      )}
    </section>
  );
}
