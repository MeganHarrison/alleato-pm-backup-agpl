"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
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
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

type ProjectOption = {
  id: number;
  name: string | null;
};

type EmployeeOption = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

function employeeLabel(employee: EmployeeOption): string {
  const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim();
  return fullName || employee.email || "Unnamed employee";
}

function normalizeTaskDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function TeamsConversationReviewActions({
  sourceDocumentId,
  sourceTitle,
  sourceSummary,
  projectId,
  projectName,
  relatedTaskCount,
}: {
  sourceDocumentId: string;
  sourceTitle: string;
  sourceSummary: string | null;
  projectId: number | null;
  projectName: string | null;
  relatedTaskCount: number;
}) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    projectId ? String(projectId) : "",
  );
  const [taskTitle, setTaskTitle] = React.useState(() =>
    sourceTitle ? `Follow up: ${sourceTitle}` : "Follow up on Teams conversation",
  );
  const [taskDescription, setTaskDescription] = React.useState(() =>
    normalizeTaskDescription(
      sourceSummary || `Review and follow up on the Teams conversation: ${sourceTitle}.`,
    ),
  );
  const [assigneePersonId, setAssigneePersonId] = React.useState("__unassigned");
  const [priority, setPriority] = React.useState("medium");
  const [status, setStatus] = React.useState("open");
  const [dueDate, setDueDate] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [isCreatingTask, setIsCreatingTask] = React.useState(false);

  React.useEffect(() => {
    setSelectedProjectId(projectId ? String(projectId) : "");
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [projectResult, employeeResult] = await Promise.all([
          apiFetch<{ data?: ProjectOption[]; projects?: ProjectOption[] } | ProjectOption[]>(
            "/api/projects?fields=id,name",
            { cache: "no-store" },
          ),
          apiFetch<EmployeeOption[]>("/api/employees", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        const projectList = Array.isArray(projectResult)
          ? projectResult
          : (projectResult.data ?? projectResult.projects ?? []);

        setProjects(projectList);
        setEmployees(employeeResult ?? []);
      } catch (error) {
        reportNonCriticalFailure({
          area: "teams-conversation-detail",
          operation: "load-review-action-options",
          error,
          userVisibleFallback: "Review actions could not load assignment options.",
        });
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAssign = async () => {
    if (!selectedProjectId) {
      toast.error("Select a project first.");
      return;
    }

    setIsAssigning(true);
    try {
      await apiFetch(`/api/documents/${sourceDocumentId}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ project_id: Number(selectedProjectId) }),
      });
      setAssignOpen(false);
      toast.success("Conversation assigned to project.");
      router.refresh();
    } catch (error) {
      handleFormError(error, { entity: "conversation", action: "update" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateTask = async () => {
    const trimmedTitle = taskTitle.trim();
    const trimmedDescription = normalizeTaskDescription(taskDescription);

    if (!projectId) {
      toast.error("Assign this conversation to a project before creating a task.");
      return;
    }
    if (!trimmedTitle || !trimmedDescription) {
      toast.error("Task title and description are required.");
      return;
    }

    setIsCreatingTask(true);
    try {
      await apiFetch(`/api/documents/${sourceDocumentId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          assigneePersonId:
            assigneePersonId === "__unassigned" ? null : assigneePersonId,
          dueDate: dueDate || null,
          priority,
          status,
        }),
      });
      setTaskOpen(false);
      toast.success("Task created from conversation.");
      router.refresh();
    } catch (error) {
      handleFormError(error, {
        entity: "task",
        action: "create",
        duplicateMessage: "A matching task already exists for this conversation.",
      });
    } finally {
      setIsCreatingTask(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
          {projectId ? "Reassign Project" : "Assign to Project"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => setTaskOpen(true)}
          disabled={!projectId}
        >
          Create Task
        </Button>
        {projectId ? (
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href={`/${projectId}/tasks`}>Open Project Tasks</Link>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">
            Assign a project before creating downstream tasks.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>
          Project: {projectId ? projectName || `Project #${projectId}` : "Unassigned"}
        </span>
        <span>
          Related tasks: {relatedTaskCount}
        </span>
      </div>

      <Modal open={assignOpen} onOpenChange={setAssignOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Assign conversation to project</ModalTitle>
            <ModalDescription>
              Link this compiled Teams thread to the project it belongs to.
            </ModalDescription>
          </ModalHeader>
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name || `Project #${project.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={isAssigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isAssigning}>
              {isAssigning ? "Saving..." : "Save"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={taskOpen} onOpenChange={setTaskOpen}>
        <ModalContent size="form">
          <ModalHeader>
            <ModalTitle>Create task from conversation</ModalTitle>
            <ModalDescription>
              Draft a follow-up task linked back to this Teams conversation.
            </ModalDescription>
          </ModalHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="teams-task-title">Title</Label>
              <Input
                id="teams-task-title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="teams-task-description">Description</Label>
              <Textarea
                id="teams-task-description"
                rows={5}
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select value={assigneePersonId} onValueChange={setAssigneePersonId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__unassigned">Unassigned</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeLabel(employee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teams-task-due-date">Due date</Label>
                <Input
                  id="teams-task-due-date"
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
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
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
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)} disabled={isCreatingTask}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreatingTask || !projectId}>
              {isCreatingTask ? "Creating..." : "Create task"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
