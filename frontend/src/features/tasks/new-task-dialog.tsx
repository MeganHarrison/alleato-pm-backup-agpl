"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { z } from "zod";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/unified-modal";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import {
  RHFComboboxField,
  RHFDateField,
  RHFSelectField,
  RHFTextareaField,
} from "@/components/forms";
import type { ComboboxOption } from "@/components/forms/fields/RHFComboboxField";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/features/tasks/task-values";
import { useCreateTask } from "@/hooks/use-create-task";
import { appToast as toast } from "@/lib/toast/app-toast";
import { getErrorDetail } from "@/lib/format-error";

interface ProjectLike {
  id: number;
  name: string | null;
  project_number?: string | null;
  "job number"?: string | null;
}

interface UserLike {
  id: string;
  full_name?: string | null;
  email?: string | null;
  person_id?: string | null;
}

interface NewTaskDialogProps {
  projects: ProjectLike[];
  users: UserLike[];
  /** Pre-selects this project (used on the project-scoped tasks page). */
  defaultProjectId?: number | null;
  /** Called after a task is created successfully so the list can refresh. */
  onCreated?: () => void;
  /** Custom trigger; defaults to an outline "New task" button. */
  trigger?: React.ReactNode;
  defaultTitle?: string;
  defaultDescription?: string;
}

const STATUS_LABELS: Record<TaskStatusValue, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<TaskPriorityValue, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// Statuses offered when creating a task (the full enum minus rarely-picked ones).
const CREATE_STATUS_VALUES: TaskStatusValue[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

const formSchema = z.object({
  description: z.string().trim().min(1, "Describe the task."),
  title: z.string().trim().max(200).optional(),
  project_id: z.string().nullable(),
  assignee_person_id: z.string().nullable(),
  due_date: z.string().nullable(),
  priority: z.enum(TASK_PRIORITY_VALUES),
  status: z.enum(TASK_STATUS_VALUES),
});

type FormValues = z.infer<typeof formSchema>;

function projectLabel(project: ProjectLike): string {
  const number = project.project_number ?? project["job number"] ?? null;
  const name = project.name ?? `Project ${project.id}`;
  return number ? `${number} - ${name}` : name;
}

export function NewTaskDialog({
  projects,
  users,
  defaultProjectId = null,
  onCreated,
  trigger,
  defaultTitle = "",
  defaultDescription = "",
}: NewTaskDialogProps) {
  const [open, setOpen] = React.useState(false);
  const createTask = useCreateTask();

  const defaultValues = React.useMemo<FormValues>(
    () => ({
      description: defaultDescription,
      title: defaultTitle,
      project_id: defaultProjectId != null ? String(defaultProjectId) : null,
      assignee_person_id: null,
      due_date: null,
      priority: "medium",
      status: "open",
    }),
    [defaultDescription, defaultProjectId, defaultTitle],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Reset to defaults each time the dialog opens (picks up a new defaultProjectId).
  React.useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const projectOptions = React.useMemo<ComboboxOption[]>(
    () =>
      projects
        .map((project) => ({
          value: String(project.id),
          label: projectLabel(project),
          keywords: [project.name ?? "", project.project_number ?? ""].filter(
            Boolean,
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [projects],
  );

  // Only users linked to a directory person can be assigned (we write people.id).
  const assigneeOptions = React.useMemo<ComboboxOption[]>(
    () =>
      users
        .filter((user) => Boolean(user.person_id))
        .map((user) => ({
          value: user.person_id as string,
          label: user.full_name || user.email || "Unnamed user",
          keywords: [user.email ?? ""].filter(Boolean),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users],
  );

  async function onSubmit(values: FormValues) {
    try {
      await createTask.mutateAsync({
        description: values.description,
        title: values.title?.trim() ? values.title.trim() : undefined,
        project_id: values.project_id ? Number(values.project_id) : null,
        assignee_person_id: values.assignee_person_id ?? null,
        due_date: values.due_date ?? null,
        priority: values.priority,
        status: values.status,
      });
      toast.success("Task created");
      setOpen(false);
      form.reset(defaultValues);
      onCreated?.();
    } catch (error) {
      toast.error("Could not create task", {
        description: getErrorDetail(error),
      });
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Plus />
            New task
          </Button>
        )}
      </ModalTrigger>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>New task</ModalTitle>
          <ModalDescription>
            Create a task by hand. It is not tied to a meeting or email.
          </ModalDescription>
        </ModalHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <RHFTextareaField
              control={form.control}
              name="description"
              label="Description"
              placeholder="What needs to be done?"
              rows={3}
            />
            <RHFTextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Optional — derived from the description if left blank"
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <RHFComboboxField
                control={form.control}
                name="project_id"
                label="Project"
                options={projectOptions}
                placeholder="Select project"
                searchPlaceholder="Search projects"
                emptyMessage="No projects found."
                clearable
              />
              <RHFComboboxField
                control={form.control}
                name="assignee_person_id"
                label="Assignee"
                options={assigneeOptions}
                placeholder="Unassigned"
                searchPlaceholder="Search people"
                emptyMessage="No people found."
                clearable
              />
              <RHFDateField
                control={form.control}
                name="due_date"
                label="Due date"
                nullable
              />
              <RHFSelectField
                control={form.control}
                name="priority"
                label="Priority"
                options={TASK_PRIORITY_VALUES.map((value) => ({
                  value,
                  label: PRIORITY_LABELS[value],
                }))}
              />
            </div>
            <RHFSelectField
              control={form.control}
              name="status"
              label="Status"
              options={CREATE_STATUS_VALUES.map((value) => ({
                value,
                label: STATUS_LABELS[value],
              }))}
            />

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createTask.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending && <Loader2 className="animate-spin" />}
                Create task
              </Button>
            </ModalFooter>
          </form>
        </Form>
      </ModalContent>
    </Modal>
  );
}
