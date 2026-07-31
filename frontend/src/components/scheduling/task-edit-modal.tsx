"use client";

/**
 * =============================================================================
 * TASK EDIT MODAL COMPONENT
 * =============================================================================
 *
 * Simple modal dialog for creating and editing schedule tasks.
 * Supports basic task creation and editing with essential fields.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  RelatedActionItemsList,
  RelatedActionItemsSummary,
  type RelatedScheduleActionItem,
} from "@/components/scheduling/related-action-items";
import {
  DependencyType,
  ScheduleTask,
  ScheduleTaskCreate,
  ScheduleTaskUpdate,
  TaskStatus,
  ConstraintType,
} from "@/types/scheduling";
import { TaskDependenciesEditor } from "@/components/scheduling/task-dependencies-editor";
import { TaskAssignmentsEditor } from "@/components/scheduling/task-assignments-editor";
import { TaskSegmentEditor } from "@/components/scheduling/task-segment-editor";
import { previewScheduleImpact } from "@/lib/scheduling/schedule-impact-preview";
import {
  defaultScheduleCalendar,
  type ScheduleCalendar,
} from "@/lib/scheduling/schedule-calendar";
import { apiFetch } from "@/lib/api-client";
import type {
  ScheduleResourceCapacityProfile,
  ScheduleResourceRosterResponse,
  ScheduleTaskAssignmentInput,
} from "@/types/scheduling";

// =============================================================================
// TYPES
// =============================================================================

interface TaskEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ScheduleTask | null;
  parentTaskId?: string | null;
  projectId: string;
  availableTasks?: ScheduleTask[];
  calendar?: ScheduleCalendar;
  relatedActionItems?: RelatedScheduleActionItem[];
  deadlineActions?: {
    onSave: (deadlineDate: string) => Promise<void>;
    onRemove: () => Promise<void>;
  };
  dependencyActions?: {
    onCreate: (input: {
      predecessor_task_id: string;
      dependency_type: DependencyType;
      lag_days: number;
    }) => Promise<void>;
    onRemove: (dependencyId: string) => Promise<void>;
    onUpdate: (
      dependencyId: string,
      input: {
        predecessor_task_id: string;
        dependency_type: DependencyType;
        lag_days: number;
      },
    ) => Promise<void>;
  };
  resourceAssignmentActions?: {
    roster: ScheduleResourceRosterResponse | null;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    onSave: (assignments: ScheduleTaskAssignmentInput[]) => Promise<void>;
    loadCapacityProfiles?: (
      start: string,
      finish: string,
    ) => Promise<ScheduleResourceCapacityProfile[]>;
  };
  fieldUpdateAction?: (input: {
    actual_start_date?: string;
    actual_finish_date?: string;
    forecast_start_date?: string;
    forecast_finish_date?: string;
    remaining_duration_days?: number;
    delay_reason?: string;
    note?: string;
    attachment_urls?: string[];
  }) => Promise<void>;
  linkedSubmittals?: Array<{ id: string; number: string; title: string }>;
  linkedSubmittalsError?: string;
  submittalRisk?: {
    status: "clear" | "at_risk";
    reason?: string;
    blocking_submittal_id?: string;
    dependency_context?: string[];
  } | null;
  onUnlinkSubmittal?: (submittalId: string) => Promise<void>;
  availableSubmittals?: Array<{ id: string; number: string; title: string }>;
  onLinkSubmittal?: (submittalId: string) => Promise<void>;
  onSave: (data: ScheduleTaskCreate | ScheduleTaskUpdate) => Promise<void>;
  onScheduleChanged?: () => Promise<void> | void;
}

interface FormData {
  name: string;
  start_date: string;
  finish_date: string;
  duration_days: number | null;
  percent_complete: number;
  status: TaskStatus;
  is_milestone: boolean;
  constraint_type: ConstraintType | null;
  constraint_date: string;
  wbs_code: string;
  parent_task_id: string | null;
  assignee_person_id: string | null;
}

interface FormErrors {
  name?: string;
  start_date?: string;
  finish_date?: string;
  duration_days?: string;
  constraint_date?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

const CONSTRAINT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "none", label: "No Constraint" },
  { value: "start_no_earlier_than", label: "Start No Earlier Than" },
  { value: "finish_no_later_than", label: "Finish No Later Than" },
  { value: "must_start_on", label: "Must Start On" },
  { value: "must_finish_on", label: "Must Finish On" },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TaskEditModal({
  open,
  onOpenChange,
  task,
  parentTaskId,
  projectId,
  availableTasks = [],
  calendar = defaultScheduleCalendar,
  relatedActionItems = [],
  deadlineActions,
  dependencyActions,
  resourceAssignmentActions,
  fieldUpdateAction,
  linkedSubmittals = [],
  linkedSubmittalsError,
  submittalRisk,
  onUnlinkSubmittal,
  availableSubmittals = [],
  onLinkSubmittal,
  onSave,
  onScheduleChanged,
}: TaskEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    start_date: "",
    finish_date: "",
    duration_days: null,
    percent_complete: 0,
    status: "not_started",
    is_milestone: false,
    constraint_type: null,
    constraint_date: "",
    wbs_code: "",
    parent_task_id: null,
    assignee_person_id: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [isSavingDeadline, setIsSavingDeadline] = useState(false);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [fieldUpdate, setFieldUpdate] = useState({
    actual_start_date: "",
    actual_finish_date: "",
    forecast_start_date: "",
    forecast_finish_date: "",
    remaining_duration_days: "",
    delay_reason: "",
    note: "",
    attachment_urls: "",
  });
  const [fieldUpdateError, setFieldUpdateError] = useState<string | null>(null);
  const [submittalToLink, setSubmittalToLink] = useState("");
  const [submittalLinkError, setSubmittalLinkError] = useState<string | null>(
    null,
  );
  const [assignablePeople, setAssignablePeople] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const isEditing = Boolean(task);
  const scheduleImpact = useMemo(() => {
    if (!task) return null;
    const hasSchedulingChange =
      formData.start_date !== (task.start_date ?? "") ||
      formData.finish_date !== (task.finish_date ?? "") ||
      formData.duration_days !== task.duration_days ||
      formData.constraint_type !== task.constraint_type ||
      formData.constraint_date !== (task.constraint_date ?? "");
    if (!hasSchedulingChange) return null;
    return previewScheduleImpact({
      taskId: task.id,
      tasks: availableTasks,
      dependencies: availableTasks.flatMap(
        (availableTask) => availableTask.dependencies ?? [],
      ),
      update: {
        start_date: formData.start_date || null,
        finish_date: formData.finish_date || null,
        duration_days: formData.duration_days,
        constraint_type: formData.constraint_type,
        constraint_date: formData.constraint_date || null,
      },
      calendar,
    });
  }, [
    availableTasks,
    calendar,
    formData.constraint_date,
    formData.constraint_type,
    formData.duration_days,
    formData.finish_date,
    formData.start_date,
    task,
  ]);

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        start_date: task.start_date || "",
        finish_date: task.finish_date || "",
        duration_days: task.duration_days,
        percent_complete: task.percent_complete,
        status: task.status,
        is_milestone: task.is_milestone,
        constraint_type: task.constraint_type,
        constraint_date: task.constraint_date || "",
        wbs_code: task.wbs_code || "",
        parent_task_id: task.parent_task_id,
        assignee_person_id: task.assignee_person_id ?? null,
      });
    } else {
      // Reset for new task
      setFormData({
        name: "",
        start_date: "",
        finish_date: "",
        duration_days: null,
        percent_complete: 0,
        status: "not_started",
        is_milestone: false,
        constraint_type: null,
        constraint_date: "",
        wbs_code: "",
        parent_task_id: parentTaskId || null,
        assignee_person_id: null,
      });
    }
    setErrors({});
    setDeadlineDate(task?.deadline?.deadline_date ?? "");
    setDeadlineError(null);
    setFieldUpdate({
      actual_start_date: "",
      actual_finish_date: "",
      forecast_start_date: "",
      forecast_finish_date: "",
      remaining_duration_days: "",
      delay_reason: "",
      note: "",
      attachment_urls: "",
    });
    setFieldUpdateError(null);
  }, [task, parentTaskId, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiFetch<Array<{ id: string; name: string }>>(
      `/api/projects/${projectId}/contacts`,
    )
      .then((people) => {
        if (!cancelled) setAssignablePeople(people);
      })
      .catch(() => {
        if (!cancelled) setAssignablePeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Handle input changes
  const handleChange = useCallback(
    (field: keyof FormData, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const handleDeadlineSave = useCallback(async () => {
    if (!deadlineActions) return;
    setIsSavingDeadline(true);
    setDeadlineError(null);
    try {
      if (deadlineDate) {
        await deadlineActions.onSave(deadlineDate);
      } else {
        await deadlineActions.onRemove();
      }
    } catch (cause) {
      setDeadlineError(
        cause instanceof Error
          ? cause.message
          : "Unable to update the schedule deadline.",
      );
    } finally {
      setIsSavingDeadline(false);
    }
  }, [deadlineActions, deadlineDate]);

  const handleFieldUpdateSave = useCallback(async () => {
    if (!fieldUpdateAction) return;
    const hasUpdate = Object.values(fieldUpdate).some(Boolean);
    if (!hasUpdate) return;
    setFieldUpdateError(null);
    try {
      await fieldUpdateAction({
        actual_start_date: fieldUpdate.actual_start_date || undefined,
        actual_finish_date: fieldUpdate.actual_finish_date || undefined,
        forecast_start_date: fieldUpdate.forecast_start_date || undefined,
        forecast_finish_date: fieldUpdate.forecast_finish_date || undefined,
        remaining_duration_days: fieldUpdate.remaining_duration_days
          ? Number(fieldUpdate.remaining_duration_days)
          : undefined,
        delay_reason: fieldUpdate.delay_reason || undefined,
        note: fieldUpdate.note || undefined,
        attachment_urls: fieldUpdate.attachment_urls
          ? fieldUpdate.attachment_urls
              .split(",")
              .map((url) => url.trim())
              .filter(Boolean)
          : undefined,
      });
      setFieldUpdate({
        actual_start_date: "",
        actual_finish_date: "",
        forecast_start_date: "",
        forecast_finish_date: "",
        remaining_duration_days: "",
        delay_reason: "",
        note: "",
        attachment_urls: "",
      });
    } catch (cause) {
      setFieldUpdateError(
        cause instanceof Error
          ? cause.message
          : "Unable to record field update.",
      );
    }
  }, [fieldUpdate, fieldUpdateAction]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Task name is required";
    }

    if (formData.start_date && formData.finish_date) {
      const start = new Date(formData.start_date);
      const finish = new Date(formData.finish_date);
      if (start > finish) {
        newErrors.finish_date = "Finish date must be after start date";
      }
    }

    if (
      formData.is_milestone &&
      formData.duration_days &&
      formData.duration_days !== 0
    ) {
      newErrors.duration_days = "Milestones must have zero duration";
    }

    if (
      formData.constraint_type &&
      formData.constraint_type !== "none" &&
      !formData.constraint_date
    ) {
      newErrors.constraint_date =
        "Constraint date is required for this constraint type";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) return;

      setIsSaving(true);

      try {
        const taskData = {
          name: formData.name.trim(),
          start_date: formData.start_date || null,
          finish_date: formData.finish_date || null,
          duration_days: formData.duration_days,
          percent_complete: formData.percent_complete,
          status: formData.status,
          is_milestone: formData.is_milestone,
          constraint_type: formData.constraint_type,
          constraint_date: formData.constraint_date || null,
          wbs_code: formData.wbs_code || null,
          parent_task_id: formData.parent_task_id,
          assignee_person_id: formData.assignee_person_id,
          ...(isEditing ? {} : { project_id: Number(projectId) }),
        };

        await onSave(taskData);
        onOpenChange(false);
      } catch (error) {
        reportNonCriticalFailure({
          area: "schedule-task-modal",
          operation: isEditing ? "update-task" : "create-task",
          error,
          userVisibleFallback: "Schedule task was not saved.",
          metadata: { projectId, taskId: task?.id ?? null },
        });
      } finally {
        setIsSaving(false);
      }
    },
    [formData, validateForm, isEditing, projectId, onSave, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify task details and settings"
              : "Add a new task to your project schedule"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Task Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Task Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter task name"
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* WBS Code */}
              <div className="space-y-2">
                <Label htmlFor="wbs_code">WBS Code</Label>
                <Input
                  id="wbs_code"
                  value={formData.wbs_code}
                  onChange={(e) => handleChange("wbs_code", e.target.value)}
                  placeholder="e.g. 1.2.3"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    handleChange("status", value as TaskStatus)
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  className={cn(errors.start_date && "border-destructive")}
                />
                {errors.start_date && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.start_date}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="finish_date">Finish Date</Label>
                <Input
                  id="finish_date"
                  type="date"
                  value={formData.finish_date}
                  onChange={(e) => handleChange("finish_date", e.target.value)}
                  className={cn(errors.finish_date && "border-destructive")}
                />
                {errors.finish_date && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.finish_date}
                  </p>
                )}
              </div>
            </div>

            {scheduleImpact?.status === "available" &&
              (scheduleImpact.affected.length > 0 ||
                scheduleImpact.constraint_conflicts.length > 0) && (
                <section
                  className="space-y-1 text-sm"
                  role="status"
                  aria-label="Schedule impact before save"
                >
                  <p className="font-medium">Schedule impact before save</p>
                  <p className="text-xs text-muted-foreground">
                    Calendar: {calendar.working_weekdays.join(", ")} working
                    weekdays
                    {calendar.non_working_dates.length
                      ? `; ${calendar.non_working_dates.length} exception${calendar.non_working_dates.length === 1 ? "" : "s"}`
                      : ""}
                    .
                  </p>
                  {scheduleImpact.affected.map((affectedTask) => (
                    <p
                      key={affectedTask.task_id}
                      className="text-muted-foreground"
                    >
                      {affectedTask.name}: {affectedTask.previous_start} →{" "}
                      {affectedTask.next_start}
                    </p>
                  ))}
                  {scheduleImpact.constraint_conflicts.map((conflict) => (
                    <p key={conflict.task_id} className="text-destructive">
                      {conflict.message}
                    </p>
                  ))}
                </section>
              )}
            {scheduleImpact?.status === "unavailable" && (
              <p
                role="status"
                className="text-sm text-destructive"
                aria-label="Schedule impact unavailable"
              >
                Schedule impact unavailable:{" "}
                {scheduleImpact.reason === "missing_dates"
                  ? "complete dates for every affected task."
                  : "remove the circular dependency before saving."}
              </p>
            )}

            {/* Duration and Milestone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration_days">Duration (days)</Label>
                <Input
                  id="duration_days"
                  type="number"
                  min="0"
                  value={formData.duration_days ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "duration_days",
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                  disabled={formData.is_milestone}
                  className={cn(errors.duration_days && "border-destructive")}
                />
                {errors.duration_days && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.duration_days}
                  </p>
                )}
                {formData.is_milestone && (
                  <p className="text-sm text-muted-foreground">
                    Milestones have zero duration
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Milestone</Label>
                <div className="flex items-center space-x-2 h-10 px-4 rounded-md border border-input">
                  <Checkbox
                    id="is_milestone"
                    checked={formData.is_milestone}
                    onCheckedChange={(checked) =>
                      handleChange("is_milestone", checked)
                    }
                  />
                  <Label
                    htmlFor="is_milestone"
                    className="text-sm font-normal cursor-pointer"
                  >
                    This is a milestone
                  </Label>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <Label>Progress: {formData.percent_complete}%</Label>
              <Slider
                value={[formData.percent_complete]}
                onValueChange={([value]) =>
                  handleChange("percent_complete", value)
                }
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Parent Task */}
            <div className="space-y-2">
              <Label htmlFor="assignee_person_id">Assigned to</Label>
              <Select
                value={formData.assignee_person_id ?? "unassigned"}
                onValueChange={(value) =>
                  handleChange(
                    "assignee_person_id",
                    value === "unassigned" ? null : value,
                  )
                }
              >
                <SelectTrigger id="assignee_person_id" aria-label="Assigned to">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignablePeople.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only active project members can receive published schedule
                activities.
              </p>
            </div>

            {availableTasks.length > 0 && (
              <div className="space-y-2">
                <Label>Parent Task</Label>
                <Select
                  value={formData.parent_task_id || "none"}
                  onValueChange={(value) =>
                    handleChange(
                      "parent_task_id",
                      value === "none" ? null : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (root task)</SelectItem>
                    {availableTasks
                      .filter((t) => t.id !== task?.id)
                      .map((availableTask) => (
                        <SelectItem
                          key={availableTask.id}
                          value={availableTask.id}
                        >
                          {availableTask.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Constraint */}
            <div className="space-y-2">
              <Label htmlFor="constraint_type">Constraint</Label>
              <Select
                value={formData.constraint_type || "none"}
                onValueChange={(value) =>
                  handleChange(
                    "constraint_type",
                    value === "none" ? null : (value as ConstraintType),
                  )
                }
              >
                <SelectTrigger id="constraint_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSTRAINT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Constraint Date */}
            {formData.constraint_type &&
              formData.constraint_type !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="constraint_date">Constraint Date</Label>
                  <Input
                    id="constraint_date"
                    type="date"
                    value={formData.constraint_date}
                    onChange={(e) =>
                      handleChange("constraint_date", e.target.value)
                    }
                    className={cn(
                      errors.constraint_date && "border-destructive",
                    )}
                  />
                  {errors.constraint_date && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.constraint_date}
                    </p>
                  )}
                </div>
              )}

            {isEditing && deadlineActions && (
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {/* This controlled modal is not backed by React Hook Form; retain the native date control until the whole modal is migrated. */}
                  {/* eslint-disable-next-line design-system/no-raw-date-input */}
                  <Input
                    id="deadline"
                    type="date"
                    value={deadlineDate}
                    onChange={(event) => setDeadlineDate(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSavingDeadline}
                    onClick={() => void handleDeadlineSave()}
                  >
                    Save deadline
                  </Button>
                </div>
                {deadlineError && (
                  <p role="alert" className="text-sm text-destructive">
                    {deadlineError}
                  </p>
                )}
              </div>
            )}

            {isEditing && fieldUpdateAction && (
              <section
                className="space-y-3 pt-2"
                aria-label="Field schedule update"
              >
                <Label className="text-sm font-medium">
                  Field schedule update
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["actual_start_date", "Actual start"],
                    ["actual_finish_date", "Actual finish"],
                    ["forecast_start_date", "Forecast start"],
                    ["forecast_finish_date", "Forecast finish"],
                  ].map(([key, label]) => (
                    <div className="space-y-1" key={key}>
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        type="date"
                        value={fieldUpdate[key as keyof typeof fieldUpdate]}
                        onChange={(e) =>
                          setFieldUpdate((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor="remaining_duration_days">
                      Remaining duration (days)
                    </Label>
                    <Input
                      id="remaining_duration_days"
                      type="number"
                      min="0"
                      value={fieldUpdate.remaining_duration_days}
                      onChange={(e) =>
                        setFieldUpdate((prev) => ({
                          ...prev,
                          remaining_duration_days: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="delay_reason">Delay reason</Label>
                    <Input
                      id="delay_reason"
                      value={fieldUpdate.delay_reason}
                      onChange={(e) =>
                        setFieldUpdate((prev) => ({
                          ...prev,
                          delay_reason: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="field_note">Field note</Label>
                  <Input
                    id="field_note"
                    value={fieldUpdate.note}
                    onChange={(e) =>
                      setFieldUpdate((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="attachment_urls">Attachment URLs</Label>
                  <Input
                    id="attachment_urls"
                    value={fieldUpdate.attachment_urls}
                    onChange={(e) =>
                      setFieldUpdate((prev) => ({
                        ...prev,
                        attachment_urls: e.target.value,
                      }))
                    }
                    placeholder="Comma-separated URLs"
                  />
                </div>
                {fieldUpdateError && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldUpdateError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleFieldUpdateSave()}
                >
                  Record field update
                </Button>
              </section>
            )}

            {isEditing && (
              <section
                className="space-y-2 pt-2"
                aria-label="Linked submittal risk"
              >
                <Label className="text-sm font-medium">Linked submittals</Label>
                {submittalRisk?.status === "at_risk" && (
                  <p role="alert" className="text-sm text-destructive">
                    {submittalRisk.reason}
                    {submittalRisk.dependency_context?.length
                      ? ` Affects: ${submittalRisk.dependency_context.join(", ")}.`
                      : ""}
                  </p>
                )}
                {linkedSubmittalsError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {linkedSubmittalsError}
                  </p>
                ) : linkedSubmittals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No submittals linked to this activity.
                  </p>
                ) : (
                  linkedSubmittals.map((submittal) => (
                    <div
                      key={submittal.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {submittal.number} · {submittal.title}
                      </span>
                      {onUnlinkSubmittal && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void onUnlinkSubmittal(submittal.id)}
                        >
                          Unlink
                        </Button>
                      )}
                    </div>
                  ))
                )}
                {submittalLinkError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submittalLinkError}
                  </p>
                )}
                {onLinkSubmittal && (
                  <div className="flex gap-2">
                    <select
                      aria-label="Link submittal"
                      className="min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                      value={submittalToLink}
                      onChange={(event) => {
                        setSubmittalToLink(event.target.value);
                        setSubmittalLinkError(null);
                      }}
                    >
                      <option value="">Select a project submittal</option>
                      {availableSubmittals
                        .filter(
                          (submittal) =>
                            !linkedSubmittals.some(
                              (linked) => linked.id === submittal.id,
                            ),
                        )
                        .map((submittal) => (
                          <option key={submittal.id} value={submittal.id}>
                            {submittal.number} · {submittal.title}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!submittalToLink}
                      onClick={() =>
                        void onLinkSubmittal(submittalToLink)
                          .then(() => {
                            setSubmittalToLink("");
                            setSubmittalLinkError(null);
                          })
                          .catch((error: unknown) =>
                            setSubmittalLinkError(
                              error instanceof Error
                                ? error.message
                                : "Unable to link submittal.",
                            ),
                          )
                      }
                    >
                      Link
                    </Button>
                  </div>
                )}
              </section>
            )}

            {isEditing &&
              task &&
              resourceAssignmentActions &&
              (resourceAssignmentActions.isLoading ? (
                <p
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading resource assignments…
                </p>
              ) : resourceAssignmentActions.error ? (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 p-3"
                  role="alert"
                >
                  <span className="text-sm text-destructive">
                    {resourceAssignmentActions.error}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resourceAssignmentActions.onRetry}
                  >
                    Retry
                  </Button>
                </div>
              ) : resourceAssignmentActions.roster ? (
                <TaskAssignmentsEditor
                  task={task}
                  tasks={availableTasks}
                  roster={resourceAssignmentActions.roster}
                  calendar={calendar}
                  loadCapacityProfiles={
                    resourceAssignmentActions.loadCapacityProfiles
                  }
                  onSave={resourceAssignmentActions.onSave}
                />
              ) : null)}

            {!isEditing && (
              <section
                className="rounded-md border p-4"
                aria-label="Resource assignments"
              >
                <p className="text-sm font-medium">Resource assignments</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create the task first, then reopen it to assign project people
                  and allocations.
                </p>
              </section>
            )}

            {isEditing && task && dependencyActions && (
              <TaskDependenciesEditor
                taskId={task.id}
                dependencies={task.dependencies ?? []}
                availableTasks={availableTasks}
                onCreate={dependencyActions.onCreate}
                onRemove={dependencyActions.onRemove}
                onUpdate={dependencyActions.onUpdate}
              />
            )}

            {isEditing && task && (
              <TaskSegmentEditor
                projectId={projectId}
                task={task}
                timezoneName={calendar.timezone_name ?? "America/Indiana/Indianapolis"}
                onScheduleChanged={onScheduleChanged}
              />
            )}

            {isEditing && (
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">
                    Related action items
                  </Label>
                  <RelatedActionItemsSummary items={relatedActionItems} />
                </div>
                <RelatedActionItemsList items={relatedActionItems} />
              </section>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
