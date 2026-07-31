"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, UserPlus } from "lucide-react";
import {
  deleteExecutiveRelatedTaskAction,
  updateExecutiveRelatedTaskAction,
} from "@/app/(main)/actions/executive-briefing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InfoAlert } from "@/components/ds/InfoAlert";
import type { ExecutiveRelatedTask } from "@/components/executive/executive-signal-card";
import type { ExecutiveTaskAssigneeOption } from "@/components/executive/executive-task-draft-form";

const TASK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const TASK_PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

function normalizeDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function normalizedStatus(value: string) {
  return TASK_STATUSES.some((status) => status.value === value) ? value : "open";
}

function normalizedPriority(value: string | null) {
  return TASK_PRIORITIES.some((priority) => priority.value === value)
    ? (value as (typeof TASK_PRIORITIES)[number]["value"])
    : "medium";
}

function assigneeValue(
  task: ExecutiveRelatedTask,
  employees: ExecutiveTaskAssigneeOption[],
) {
  if (task.assigneePersonId) return task.assigneePersonId;
  const emailMatch = employees.find(
    (employee) =>
      employee.email &&
      task.assigneeEmail &&
      employee.email.toLowerCase() === task.assigneeEmail.toLowerCase(),
  );
  return emailMatch?.id ?? "__unassigned";
}

function ExecutiveRelatedTaskRow({
  task,
  employees,
}: {
  task: ExecutiveRelatedTask;
  employees: ExecutiveTaskAssigneeOption[];
}) {
  const router = useRouter();
  const [isSaving, startSavingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const initial = useMemo(
    () => ({
      taskText: task.title || task.description,
      assigneePersonId: assigneeValue(task, employees),
      status: normalizedStatus(task.status),
      priority: normalizedPriority(task.priority),
      dueDate: normalizeDate(task.dueDate),
    }),
    [employees, task],
  );
  const [assigneePersonId, setAssigneePersonId] = useState(
    initial.assigneePersonId,
  );
  const [taskText, setTaskText] = useState(initial.taskText);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [error, setError] = useState<string | null>(null);
  const taskLabel = taskText.trim() || initial.taskText;
  const isPending = isSaving || isDeleting;
  const isUnassigned = assigneePersonId === "__unassigned";
  const hasChanges =
    taskText !== initial.taskText ||
    assigneePersonId !== initial.assigneePersonId ||
    dueDate !== initial.dueDate;

  const saveTask = () => {
    const normalizedTaskText = taskText.replace(/\s+/g, " ").trim();
    if (!normalizedTaskText) {
      setError("Task name is required.");
      return;
    }

    const formData = new FormData();
    formData.set("taskId", task.id);
    formData.set("title", normalizedTaskText);
    formData.set(
      "assigneePersonId",
      assigneePersonId === "__unassigned" ? "" : assigneePersonId,
    );
    formData.set("status", initial.status);
    formData.set("priority", initial.priority ?? "");
    formData.set("dueDate", dueDate);

    setError(null);
    startSavingTransition(async () => {
      try {
        await updateExecutiveRelatedTaskAction(formData);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to update this task.",
        );
      }
    });
  };

  const deleteTask = () => {
    const shouldDelete = window.confirm(`Delete task "${taskLabel}"?`);
    if (!shouldDelete) return;

    const formData = new FormData();
    formData.set("taskId", task.id);

    setError(null);
    startDeletingTransition(async () => {
      try {
        await deleteExecutiveRelatedTaskAction(formData);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to delete this task.",
        );
      }
    });
  };

  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div
        className="grid min-w-full gap-3 px-0 py-2.5 lg:items-start"
        style={{
          gridTemplateColumns:
            "minmax(18rem,1fr) 10rem 8.5rem 4.5rem",
        }}
      >
        <div className="min-w-0 pr-2">
          <Textarea
            value={taskText}
            onChange={(event) => setTaskText(event.target.value)}
            className="min-h-9 resize-none border-0 bg-transparent px-0 py-0 text-sm leading-5 shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0"
            aria-label={`Task name for ${initial.taskText}`}
          />
        </div>
        <div className="min-w-0">
          <Select value={assigneePersonId} onValueChange={setAssigneePersonId}>
            <SelectTrigger
              variant="inline"
              size="sm"
              className={
                isUnassigned
                  ? "h-8 w-full px-0 text-xs font-medium text-primary hover:text-primary focus-visible:ring-0"
                  : "h-8 w-full px-0 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-0"
              }
              aria-label={`Assignee for ${taskLabel}`}
            >
              {isUnassigned ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 shrink-0" />
                  <span>Assign</span>
                </span>
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="__unassigned">No assignee</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-8 w-full border-0 bg-transparent px-0 py-0 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0"
            aria-label={`Due date for ${taskLabel}`}
          />
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-green-600 hover:bg-green-50 hover:text-green-700"
            disabled={!hasChanges || isPending}
            onClick={saveTask}
            aria-label={`Save ${taskLabel}`}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending}
            onClick={deleteTask}
            aria-label={`Delete ${taskLabel}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {error && (
        <div className="px-4 pb-3">
          <InfoAlert variant="error" className="text-xs">
            {error}
          </InfoAlert>
        </div>
      )}
    </div>
  );
}

export function ExecutiveRelatedTaskTable({
  tasks,
  employees,
}: {
  tasks: ExecutiveRelatedTask[];
  employees: ExecutiveTaskAssigneeOption[];
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        <div
          className="grid gap-3 border-b border-border/60 px-0 pb-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-primary"
          style={{
            gridTemplateColumns:
              "minmax(18rem,1fr) 10rem 8.5rem 4.5rem",
          }}
        >
          <div>Task</div>
          <div>Assignee</div>
          <div>Due</div>
          <div className="text-right">Actions</div>
        </div>
        <div>
          {tasks.map((task) => (
            <ExecutiveRelatedTaskRow
              key={task.id}
              task={task}
              employees={employees}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
