"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowUpRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type { Project } from "@/hooks/use-projects";
import type { MeetingTask } from "./meeting-detail-content";

// ─── Option sets ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

// Statuses the create endpoint accepts (a subset of the edit set).
const CREATE_STATUS_OPTIONS = STATUS_OPTIONS.filter((s) =>
  ["open", "in_progress", "blocked"].includes(s.value),
);
const CREATE_PRIORITY_OPTIONS = PRIORITY_OPTIONS.filter((p) =>
  ["low", "medium", "high"].includes(p.value),
);

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-destructive",
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const UNASSIGNED = "__unassigned__";
const NO_PROJECT = "__no_project__";

interface EmployeeOption {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  person_type?: string | null;
}

const SOURCE_OPTIONS = [
  { value: "meeting", label: "Meeting" },
  { value: "fireflies", label: "Fireflies" },
  { value: "teams", label: "Teams" },
  { value: "email", label: "Email" },
  { value: "document", label: "Document" },
  { value: "manual", label: "Manual" },
] as const;

function employeeLabel(employee: EmployeeOption): string {
  const name = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || employee.email || "Unnamed employee";
}

function projectLabel(project: Project): string {
  return project.project_number
    ? `${project.project_number} - ${project.name || "Unnamed Project"}`
    : project.name || `Project #${project.id}`;
}

function normalizeSourceValue(value: string | null | undefined): string {
  const normalized = value?.replace(/\s+/g, "_").toLowerCase().trim();
  if (!normalized) return "meeting";
  if (normalized.includes("fireflies")) return "fireflies";
  if (normalized.includes("team")) return "teams";
  if (normalized.includes("email") || normalized.includes("outlook")) return "email";
  if (normalized.includes("document") || normalized.includes("sharepoint") || normalized.includes("onedrive")) {
    return "document";
  }
  if (normalized.includes("manual")) return "manual";
  if (normalized.includes("meeting")) return "meeting";
  return normalized;
}

function sourceLabel(value: string): string {
  return SOURCE_OPTIONS.find((option) => option.value === value)?.label ??
    value
      .replace(/[_-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
}

function isDone(status: string): boolean {
  return status === "done" || status === "completed";
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggleDone,
  onOpen,
  busy,
}: {
  task: MeetingTask;
  onToggleDone: (task: MeetingTask) => void;
  onOpen: (task: MeetingTask) => void;
  busy: boolean;
}) {
  const done = isDone(task.status);
  const priority = (task.priority ?? "").toLowerCase();

  return (
    <li className="group flex items-start gap-3">
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggleDone(task)}
        disabled={busy}
        aria-label={done ? "Mark task as open" : "Mark task as done"}
        className="mt-0.5 shrink-0"
      />

      <Button
        type="button"
        variant="ghost"
        onClick={() => onOpen(task)}
        className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal rounded-sm px-0 py-0 text-left font-normal hover:bg-transparent"
      >
        <p
          className={`text-sm leading-snug ${
            done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title || task.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
          <span className="text-xs text-muted-foreground">
            {task.assignee_name || task.assignee_email || "Unassigned"}
          </span>
          {priority && priority !== "normal" && (
            <span
              className={`text-xs font-medium capitalize ${PRIORITY_TEXT[priority] ?? "text-muted-foreground"}`}
            >
              {priority}
            </span>
          )}
          {task.due_date && (
            <span className="text-xs text-muted-foreground">
              Due {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      </Button>
    </li>
  );
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export function MeetingTasksManager({
  meetingId,
  initialTasks,
  projectId,
  projects,
  projectsLoading,
  defaultSourceSystem,
  allTasksHref,
}: {
  meetingId: string;
  initialTasks: MeetingTask[];
  projectId: number | null;
  projects: Project[];
  projectsLoading: boolean;
  defaultSourceSystem: string | null;
  allTasksHref: string;
}) {
  const [tasks, setTasks] = React.useState<MeetingTask[]>(initialTasks);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = React.useState(false);
  const [mode, setMode] = React.useState<"closed" | "view" | "create">("closed");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = React.useState<string | null>(null);

  // Keep local state in sync when the server re-renders with fresh props.
  React.useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  const loadEmployees = React.useCallback(async () => {
    if (employeesLoaded) return;
    try {
      const result = await apiFetch<EmployeeOption[]>("/api/employees");
      setEmployees(result);
    } catch (error) {
      reportNonCriticalFailure({
        area: "meeting-tasks",
        operation: "load-task-employee-assignee-options",
        error,
        userVisibleFallback:
          "The assignee picker will keep showing stored assignee names until employees can be loaded.",
        metadata: { meetingId },
      });
    } finally {
      setEmployeesLoaded(true);
    }
  }, [employeesLoaded, meetingId]);

  const patchTask = React.useCallback(
    async (taskId: string, patch: Record<string, unknown>) => {
      const { task } = await apiFetch<{ task: Partial<MeetingTask> }>(
        `/api/tasks/${taskId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...task } : t)),
      );
    },
    [],
  );

  const handleToggleDone = React.useCallback(
    async (task: MeetingTask) => {
      const next = isDone(task.status) ? "open" : "done";
      setRowBusyId(task.id);
      // Optimistic.
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
      );
      try {
        await patchTask(task.id, { status: next });
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
        );
        toast.error("Couldn't update the task status");
      } finally {
        setRowBusyId(null);
      }
    },
    [patchTask],
  );

  const openTask = React.useCallback(
    (task: MeetingTask) => {
      setActiveId(task.id);
      setMode("view");
      void loadEmployees();
    },
    [loadEmployees],
  );

  const openCreate = React.useCallback(() => {
    setMode("create");
    void loadEmployees();
  }, [loadEmployees]);

  const closeSheet = React.useCallback(() => {
    setMode("closed");
    setActiveId(null);
  }, []);

  const handleDelete = React.useCallback(
    async (taskId: string) => {
      try {
        await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        toast.success("Task deleted");
        closeSheet();
      } catch {
        toast.error("Couldn't delete the task");
      }
    },
    [closeSheet],
  );

  const handleCreate = React.useCallback(
    async (draft: {
      title: string;
      description: string;
      priority: string;
      status: string;
      due_date: string;
      assignee_person_id: string | null;
      project_id: number | null;
      source_system: string;
    }) => {
      const payload = {
        title: draft.title.trim(),
        description: (draft.description.trim() || draft.title.trim()),
        priority: draft.priority,
        status: draft.status,
        dueDate: draft.due_date || null,
        assigneePersonId: draft.assignee_person_id,
        projectId: draft.project_id,
        sourceSystem: draft.source_system,
      };
      try {
        const result = await apiFetch<{ taskId: string }>(
          `/api/documents/${meetingId}/tasks`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        const selectedEmployee = employees.find(
          (employee) => employee.id === draft.assignee_person_id,
        );
        const created: MeetingTask = {
          id: result.taskId,
          title: payload.title,
          description: payload.description,
          assignee_person_id: payload.assigneePersonId,
          assignee_name: selectedEmployee ? employeeLabel(selectedEmployee) : null,
          assignee_email: selectedEmployee?.email ?? null,
          status: payload.status,
          priority: payload.priority,
          due_date: payload.dueDate,
          segment_id: null,
        };
        setTasks((prev) => [...prev, created]);
        toast.success("Task added");
        closeSheet();
      } catch (error) {
        const message =
          error instanceof Error && /already exists/i.test(error.message)
            ? "A matching task already exists for this meeting"
            : "Couldn't create the task";
        toast.error(message);
      }
    },
    [meetingId, closeSheet, employees],
  );

  return (
    <div className="space-y-4">
      {tasks.length > 0 ? (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              busy={rowBusyId === task.id}
              onToggleDone={handleToggleDone}
              onOpen={openTask}
            />
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-between py-1 text-sm text-muted-foreground">
          <span>No tasks yet</span>
          <Button size="sm" variant="ghost" className="-mr-2 h-auto px-2 py-1" onClick={openCreate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="-ml-2 h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add task
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="-mr-2 h-auto px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            <Link href={allTasksHref}>
              View all tasks
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <SidePanel
        open={mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SidePanelContent>
          {mode === "create" ? (
            <CreateTaskForm
              employees={employees}
              employeesLoaded={employeesLoaded}
              projects={projects}
              projectsLoading={projectsLoading}
              defaultProjectId={projectId}
              defaultSourceSystem={defaultSourceSystem}
              onSubmit={handleCreate}
              onCancel={closeSheet}
            />
          ) : activeTask ? (
            <TaskDetailPanel
              task={activeTask}
              employees={employees}
              employeesLoaded={employeesLoaded}
              projectId={projectId}
              allTasksHref={allTasksHref}
              onPatch={patchTask}
              onDelete={handleDelete}
            />
          ) : null}
        </SidePanelContent>
      </SidePanel>
    </div>
  );
}

// ─── Detail panel (per-field auto-save) ──────────────────────────────────────

function TaskDetailPanel({
  task,
  employees,
  employeesLoaded,
  projectId,
  allTasksHref,
  onPatch,
  onDelete,
}: {
  task: MeetingTask;
  employees: EmployeeOption[];
  employeesLoaded: boolean;
  projectId: number | null;
  allTasksHref: string;
  onPatch: (taskId: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => void;
}) {
  const [description, setDescription] = React.useState(task.description ?? "");
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  React.useEffect(() => {
    setDescription(task.description ?? "");
    setConfirmingDelete(false);
  }, [task.id, task.description]);

  const currentAssignee =
    employees.find((employee) => employee.id === task.assignee_person_id) ??
    employees.find(
      (employee) =>
        employee.email &&
        task.assignee_email &&
        employee.email.toLowerCase() === task.assignee_email.toLowerCase(),
    );

  const save = async (patch: Record<string, unknown>) => {
    try {
      await onPatch(task.id, patch);
    } catch {
      toast.error("Couldn't save the change");
    }
  };

  return (
    <>
      <SidePanelHeader>
        <SidePanelTitle>
          {task.title || "Task"}
        </SidePanelTitle>
      </SidePanelHeader>

      <SidePanelBody className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="task-description" className="text-xs text-muted-foreground">
            Description
          </Label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const next = description.trim();
              if (next && next !== task.description) {
                void save({ description: next });
              } else {
                setDescription(task.description ?? "");
              }
            }}
            rows={4}
            className="resize-none text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={task.status}
              onValueChange={(value) => void save({ status: value })}
            >
              <SelectTrigger>
                <SelectValue>{statusLabel(task.status)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select
              value={(task.priority ?? "medium").toLowerCase()}
              onValueChange={(value) => void save({ priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assignee</Label>
          <Select
            value={currentAssignee?.id ?? UNASSIGNED}
            onValueChange={(value) =>
              void save({ assignee_person_id: value === UNASSIGNED ? null : value })
            }
            disabled={!employeesLoaded}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  task.assignee_name || task.assignee_email || "Unassigned"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employeeLabel(employee)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!currentAssignee && task.assignee_name && (
            <p className="text-xs text-muted-foreground">
              Currently {task.assignee_name}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-due" className="text-xs text-muted-foreground">
            Due date
          </Label>
          <Input
            id="task-due"
            type="date"
            defaultValue={task.due_date ?? ""}
            onChange={(e) => void save({ due_date: e.target.value || "" })}
            className="text-sm"
          />
        </div>
      </SidePanelBody>

      <SidePanelFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(task.id)}
            >
              Confirm delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
          <Link href={allTasksHref}>
            {projectId ? "Project tasks" : "All tasks"}
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </SidePanelFooter>
    </>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateTaskForm({
  employees,
  employeesLoaded,
  projects,
  projectsLoading,
  defaultProjectId,
  defaultSourceSystem,
  onSubmit,
  onCancel,
}: {
  employees: EmployeeOption[];
  employeesLoaded: boolean;
  projects: Project[];
  projectsLoading: boolean;
  defaultProjectId: number | null;
  defaultSourceSystem: string | null;
  onSubmit: (draft: {
    title: string;
    description: string;
    priority: string;
    status: string;
    due_date: string;
    assignee_person_id: string | null;
    project_id: number | null;
    source_system: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [status, setStatus] = React.useState("open");
  const [dueDate, setDueDate] = React.useState("");
  const [assigneePersonId, setAssigneePersonId] = React.useState(UNASSIGNED);
  const [projectValue, setProjectValue] = React.useState(
    defaultProjectId ? String(defaultProjectId) : NO_PROJECT,
  );
  const [sourceSystem, setSourceSystem] = React.useState(
    normalizeSourceValue(defaultSourceSystem),
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setProjectValue(defaultProjectId ? String(defaultProjectId) : NO_PROJECT);
  }, [defaultProjectId]);

  React.useEffect(() => {
    setSourceSystem(normalizeSourceValue(defaultSourceSystem));
  }, [defaultSourceSystem]);

  const sourceOptions = React.useMemo(() => {
    if (SOURCE_OPTIONS.some((option) => option.value === sourceSystem)) {
      return SOURCE_OPTIONS;
    }
    return [{ value: sourceSystem, label: sourceLabel(sourceSystem) }, ...SOURCE_OPTIONS];
  }, [sourceSystem]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const selectedProjectId =
      projectValue === NO_PROJECT ? null : Number.parseInt(projectValue, 10);
    setSubmitting(true);
    await onSubmit({
      title,
      description,
      priority,
      status,
      due_date: dueDate,
      assignee_person_id: assigneePersonId === UNASSIGNED ? null : assigneePersonId,
      project_id: Number.isFinite(selectedProjectId) ? selectedProjectId : null,
      source_system: sourceSystem,
    });
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SidePanelHeader>
        <SidePanelTitle>Add Task</SidePanelTitle>
      </SidePanelHeader>

      <SidePanelBody className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="new-task-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id="new-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen?"
            autoFocus
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="new-task-description"
            className="text-xs text-muted-foreground"
          >
            Description
          </Label>
          <Textarea
            id="new-task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional detail (defaults to the title)"
            rows={4}
            className="resize-none text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATE_PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assignee</Label>
          <Select
            value={assigneePersonId}
            onValueChange={setAssigneePersonId}
            disabled={!employeesLoaded || submitting}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={employeesLoaded ? "Unassigned" : "Loading employees..."}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employeeLabel(employee)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={projectValue}
            onValueChange={setProjectValue}
            disabled={projectsLoading || submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder={projectsLoading ? "Loading projects..." : "No project"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT}>No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {projectLabel(project)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select
            value={sourceSystem}
            onValueChange={setSourceSystem}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((source) => (
                <SelectItem key={source.value} value={source.value}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-task-due" className="text-xs text-muted-foreground">
            Due date
          </Label>
          <Input
            id="new-task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-sm"
          />
        </div>

      </SidePanelBody>

      <SidePanelFooter className="flex-row justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitting ? "Adding..." : "Add task"}
        </Button>
      </SidePanelFooter>
    </form>
  );
}
