"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExecutiveTaskDraftAction } from "@/app/(main)/actions/executive-briefing-actions";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

export type ExecutiveTaskAssigneeOption = {
  id: string;
  label: string;
  email: string | null;
};

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

function normalizeTaskDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function ExecutiveTaskDraftForm({
  sourceId,
  title,
  description,
  employees,
  hasMatchingTask,
}: {
  sourceId: string | null | undefined;
  title: string;
  description: string;
  employees: ExecutiveTaskAssigneeOption[];
  hasMatchingTask: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [taskTitle, setTaskTitle] = useState(title);
  const [taskDescription, setTaskDescription] = useState(
    normalizeTaskDescription(description),
  );
  const [assigneePersonId, setAssigneePersonId] = useState<string>("");
  const [priority, setPriority] = useState("high");
  const [status, setStatus] = useState("open");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!sourceId) return null;

  if (hasMatchingTask) {
    return (
      <span className="inline-flex h-9 items-center rounded-md bg-muted px-3 text-xs font-medium text-muted-foreground">
        Related task already exists
      </span>
    );
  }

  const submitTask = () => {
    const trimmedTitle = taskTitle.trim();
    const trimmedDescription = normalizeTaskDescription(taskDescription);

    if (!trimmedTitle || !trimmedDescription) {
      setError("Task title and description are required.");
      return;
    }

    const formData = new FormData();
    formData.set("sourceId", sourceId);
    formData.set("title", trimmedTitle);
    formData.set("description", trimmedDescription);
    formData.set("assigneePersonId", assigneePersonId);
    formData.set("priority", priority);
    formData.set("status", status);
    formData.set("dueDate", dueDate);

    setError(null);
    startTransition(async () => {
      try {
        await createExecutiveTaskDraftAction(formData);
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Failed to create executive task.",
        );
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-md px-3 text-xs"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Create task
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>Create executive task</DialogTitle>
            <DialogDescription>
              Edit the task before it is added to the task list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="executive-task-title">Title</Label>
              <Input
                id="executive-task-title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="executive-task-description">Description</Label>
              <Textarea
                id="executive-task-description"
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                rows={5}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select
                  value={assigneePersonId || "__unassigned"}
                  onValueChange={(value) =>
                    setAssigneePersonId(value === "__unassigned" ? "" : value)
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="executive-task-due-date">Due date</Label>
                <Input
                  id="executive-task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <InfoAlert variant="error">{error}</InfoAlert>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitTask} disabled={isPending}>
              {isPending ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
