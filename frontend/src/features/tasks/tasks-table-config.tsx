import { ArrowUpRight, Eye, Trash2 } from "lucide-react";
import { TaskFeedbackButtons } from "@/components/ai/TaskFeedbackButtons";
import { Button } from "@/components/ui/button";
import {
  TableDateValue,
  TableAvatarUsers,
  TableRowActionsMenu,
  TableTagBadge,
  type TableColumn,
  type FilterConfig,
  type ColumnConfig,
} from "@/components/tables/unified";
import {
  type TasksRow,
  getTaskSourceLabel,
  getTaskSourceTarget,
  getTaskSourceTitle,
} from "@/features/tasks/task-utils";
import type { TaskSnapshot } from "@/lib/ai/task-feedback-types";

// ---------------------------------------------------------------------------
// Inline-edit types (exported so tasks-inbox can pass them in)
// ---------------------------------------------------------------------------

export type TaskPatch = {
  description?: string;
  status?: string;
  due_date?: string | null;
  project_id?: number | null;
  category?: string | null;
  priority?: string | null;
  assignee_user_id?: string | null;
};

export type TaskProjectOption = { id: number; name: string | null };
export type TaskUserOption = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  person_id?: string | null;
};

export interface TaskInlineEditOptions {
  onOpenPanel?: (item: TasksRow) => void;
  onUpdate?: (id: string, patch: TaskPatch) => void | Promise<void>;
  onDelete?: (id: string) => void;
  projects?: TaskProjectOption[];
  users?: TaskUserOption[];
}

// ---------------------------------------------------------------------------
// Column / Filter / Defaults
// ---------------------------------------------------------------------------

export const tasksColumns: ColumnConfig[] = [
  { id: "description", label: "Task Name", alwaysVisible: true },
  { id: "feedback", label: "Feedback", defaultVisible: true },
  { id: "assignee_name", label: "Assigned User", defaultVisible: true },
  { id: "project_name", label: "Project Name", defaultVisible: true },
  { id: "source_system", label: "Source", defaultVisible: true },
  { id: "source_record", label: "Created From", defaultVisible: true },
  { id: "source_date", label: "Source Date", defaultVisible: true },
  { id: "assignee_email", label: "Assignee Email", defaultVisible: false },
  { id: "created_at", label: "Created Date", defaultVisible: false },
  { id: "due_date", label: "Due Date", defaultVisible: true },
  { id: "priority", label: "Priority", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
];

export const tasksFilters: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { value: "To-Do", label: "to-do" },
      { value: "In-Progress", label: "in-progress" },
      { value: "Blocked", label: "blocked" },
      { value: "Complete", label: "complete" },
    ],
  },
];

export function buildTasksFilters(items: TasksRow[]): FilterConfig[] {
  const sourceOptions = Array.from(
    new Set(items.map((item) => getTaskSourceLabel(item)).filter(Boolean)),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  return sourceOptions.length > 0
    ? [
        ...tasksFilters,
        {
          id: "source_system",
          label: "Source",
          type: "select" as const,
          options: sourceOptions,
        },
      ]
    : tasksFilters;
}

export const tasksDefaultVisibleColumns: string[] = tasksColumns
  .filter((c) => c.defaultVisible !== false)
  .map((c) => c.id);

const TASK_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const TASK_PRIORITY_OPTIONS = [
  { value: "__none__", label: "Not set" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ---------------------------------------------------------------------------
// Table columns (render / sort)
// ---------------------------------------------------------------------------

export function buildTasksTableColumns(
  projectId?: string | null,
  editOptions?: TaskInlineEditOptions,
): TableColumn<TasksRow>[] {
  const { onOpenPanel, onUpdate, onDelete, projects = [], users = [] } = editOptions ?? {};

  return tasksColumns.map((column) => {
    switch (column.id) {
      case "description":
        return {
          ...column,
          width: 380,
          render: (item) => (
            <Button
              type="button"
              variant="link"
              className="h-auto min-w-0 max-w-full justify-start whitespace-normal p-0 pr-2 text-left text-sm font-medium leading-5 text-foreground underline-offset-2 hover:text-primary"
              title={item.description ?? ""}
              onClick={() => onOpenPanel?.(item)}
            >
              {item.title || item.description || "Untitled Task"}
            </Button>
          ),
          sortValue: (item) => item.description ?? "",
          sortable: true,
        };
      case "feedback":
        return {
          ...column,
          width: 88,
          render: (item) => {
            const taskId = item.id;
            if (!taskId) {
              return <span className="text-xs text-muted-foreground">—</span>;
            }

            return (
              <div
                className="flex min-w-16 items-center"
                onClick={(event) => event.stopPropagation()}
              >
                <TaskFeedbackButtons
                  projectId={getTaskProjectId(item)}
                  taskId={taskId}
                  taskSnapshot={buildTaskFeedbackSnapshot(item)}
                  onRemove={onDelete ? () => onDelete(taskId) : undefined}
                />
              </div>
            );
          },
          sortValue: () => "",
          sortable: false,
        };
      case "assignee_name":
        return {
          ...column,
          width: 196,
          render: (item) => {
            return item.assignee_name ? (
              <span className="flex min-w-0 max-w-56 items-center gap-2">
                <TableAvatarUsers users={[item.assignee_name]} maxVisible={1} />
                <span className="truncate text-xs text-foreground">{item.assignee_name}</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            );
          },
          sortValue: (item) => item.assignee_name ?? "",
          sortable: true,
          editable: Boolean(onUpdate && users.length > 0),
          editValue: (item) => {
            const matchedUser =
              users.find((u) => u.person_id && item.assignee_person_id && u.person_id === item.assignee_person_id) ??
              users.find((u) => u.email && item.assignee_email && u.email.toLowerCase() === item.assignee_email?.toLowerCase());
            return matchedUser?.id ?? "__unassigned__";
          },
          onEdit: (item, value) =>
            onUpdate?.(item.id!, {
              assignee_user_id: value === "__unassigned__" ? null : value,
            }),
          editType: "select",
          editEmptyLabel: "Select assignee",
          editOptions: [
            { value: "__unassigned__", label: "Unassigned" },
            ...users.map((user) => ({
              value: user.id,
              label: user.full_name || user.email || user.id,
            })),
          ],
        };
      case "project_name":
        return {
          ...column,
          width: 196,
          render: (item) => {
            return (
              <span className="block max-w-56 text-xs text-foreground truncate">
                {item.project_name || "Unlinked"}
              </span>
            );
          },
          sortValue: (item) => item.project_name ?? "",
          sortable: true,
          editable: Boolean(onUpdate && projects.length > 0),
          editValue: (item) => item.project_id ? String(item.project_id) : "__none__",
          onEdit: (item, value) =>
            onUpdate?.(item.id!, {
              project_id: value === "__none__" ? null : Number(value),
            }),
          editType: "select",
          editEmptyLabel: "Select project",
          editOptions: [
            { value: "__none__", label: "Unlinked" },
            ...projects.map((project) => ({
              value: String(project.id),
              label: project.name ?? `Project ${project.id}`,
            })),
          ],
        };
      case "source_system":
        return {
          ...column,
          width: 112,
          render: (item) => (
            <TableTagBadge label={getTaskSourceLabel(item)} variant="outline" />
          ),
          sortValue: (item) => getTaskSourceLabel(item),
          sortable: true,
        };
      case "source_record":
        return {
          ...column,
          width: 220,
          render: (item) => {
            const target = getTaskSourceTarget(item, projectId);
            const label = getTaskSourceTitle(item);
            if (!target) {
              return (
                <span className="block max-w-72 truncate text-xs text-muted-foreground">
                  {label}
                </span>
              );
            }
            return (
              <a
                href={target.href}
                className="block max-w-72 truncate text-xs text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary transition-colors"
                onClick={(event) => event.stopPropagation()}
                rel={target.external ? "noreferrer" : undefined}
                target={target.external ? "_blank" : undefined}
                title={label}
              >
                {label}
              </a>
            );
          },
          sortValue: (item) => getTaskSourceTitle(item),
          sortable: true,
        };
      case "assignee_email":
        return {
          ...column,
          width: 220,
          render: (item) => (
            <span className="block max-w-44 text-xs text-muted-foreground truncate">
              {item.assignee_email || "—"}
            </span>
          ),
          sortValue: (item) => item.assignee_email ?? "",
          sortable: true,
        };
      case "source_date":
        return {
          ...column,
          width: 124,
          render: (item) => <TableDateValue value={item.source_date} />,
          sortValue: (item) => item.source_date ?? "",
          sortable: true,
        };
      case "due_date":
        return {
          ...column,
          width: 124,
          render: (item) => <TableDateValue value={item.due_date} />,
          sortValue: (item) => item.due_date ?? "",
          sortable: true,
          editable: Boolean(onUpdate),
          editInputType: "date",
          editValue: (item) => item.due_date?.split("T")[0] ?? "",
          onEdit: (item, value) => onUpdate?.(item.id!, { due_date: value || null }),
        };
      case "created_at":
        return {
          ...column,
          width: 124,
          render: (item) => <TableDateValue value={item.created_at} />,
          sortValue: (item) => item.created_at ?? "",
          sortable: true,
        };
      case "priority":
        return {
          ...column,
          width: 112,
          render: (item) => (
            <TableTagBadge
              label={item.priority}
              variant={item.priority?.toLowerCase().includes("high") ? "default" : "secondary"}
            />
          ),
          sortValue: (item) => item.priority ?? "",
          sortable: true,
          editable: Boolean(onUpdate),
          editValue: (item) => item.priority?.toLowerCase() ?? "__none__",
          onEdit: (item, value) =>
            onUpdate?.(item.id!, {
              priority: value === "__none__" ? null : value,
            }),
          editType: "select",
          editEmptyLabel: "Select priority",
          editOptions: TASK_PRIORITY_OPTIONS,
        };
      case "status":
        return {
          ...column,
          width: 120,
          render: (item) => (
            <TableTagBadge
              label={item.status}
              variant={item.status?.toLowerCase().includes("done") ? "default" : "outline"}
            />
          ),
          sortValue: (item) => item.status ?? "",
          sortable: true,
          editable: Boolean(onUpdate),
          editValue: (item) => item.status ?? "open",
          onEdit: (item, value) => onUpdate?.(item.id!, { status: value }),
          editType: "select",
          editEmptyLabel: "Select status",
          editOptions: TASK_STATUS_OPTIONS,
        };
      default:
        return {
          ...column,
          render: (item) => {
            const record = toTasksRecord(item);
            const value = record[column.id] ?? "—";
            return <span className="text-xs text-muted-foreground">{value}</span>;
          },
          sortValue: (item) => toTasksRecord(item)[column.id] ?? "",
          sortable: true,
        };
    }
  });
}

export function getTaskProjectId(item: TasksRow): number | null {
  return item.project_id ?? item.project_ids?.[0] ?? null;
}

export function buildTaskFeedbackSnapshot(item: TasksRow): TaskSnapshot {
  return {
    name: item.description || item.title || "Untitled task",
    assignee: item.assignee_name || item.assignee_email,
    dueDate: item.due_date,
    priority: item.priority ?? "medium",
    notes: item.assigned_by ? `Assigned by ${item.assigned_by}` : null,
    projectId: getTaskProjectId(item),
    source: getTaskSourceLabel(item),
    generatedBy: item.extraction_model,
  };
}

export function isAiGeneratedTask(item: TasksRow): boolean {
  return Boolean(
    item.extraction_source ||
      item.extraction_model ||
      item.extraction_prompt_version,
  );
}

function toTasksRecord(item: TasksRow): Record<string, string | null> {
  return item as unknown as Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// Card / List views
// ---------------------------------------------------------------------------

export function renderTasksCard(
  item: TasksRow,
  onView: (item: TasksRow) => void,
) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onView(item)}
      className="h-auto w-full flex-col items-start justify-start rounded-lg border border-border bg-background p-4 text-left font-normal hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <p className="max-w-64 truncate text-sm font-medium">{item.title || item.description || "Untitled Task"}</p>
      </div>
      {item.project_name && (
        <p className="max-w-60 truncate text-sm text-muted-foreground">{item.project_name}</p>
      )}
      <div className="flex w-full items-center justify-between gap-3 pt-2">
        <TableTagBadge
          label={item.priority}
          variant={item.priority?.toLowerCase().includes("high") ? "default" : "secondary"}
        />
        <div className="flex shrink-0 items-center gap-2">
          <TableDateValue value={item.source_date} />
          <TableDateValue value={item.due_date} />
        </div>
      </div>
    </Button>
  );
}

export function renderTasksList(
  item: TasksRow,
  onView: (item: TasksRow) => void,
) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onView(item)}
      className="h-auto w-full items-center justify-between rounded-md px-4 py-3 text-left font-normal hover:bg-muted/50"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="max-w-64 truncate text-sm font-medium">{item.title || item.description || "Untitled Task"}</span>
        </div>
        {item.project_name && (
          <span className="max-w-56 truncate text-sm text-muted-foreground">{item.project_name}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TableTagBadge
          label={item.priority}
          variant={item.priority?.toLowerCase().includes("high") ? "default" : "secondary"}
        />
        <TableDateValue value={item.source_date} />
        <TableDateValue value={item.due_date} />
      </div>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

export function renderTasksRowActions(
  item: TasksRow,
  onOpenSource: (item: TasksRow) => void,
  onDelete?: (item: TasksRow) => void,
  projectId?: string | null,
) {
  return (
    <TableRowActionsMenu
      items={[
        {
          key: "open-source",
          label: "Open source",
          icon: Eye,
          onSelect: () => onOpenSource(item),
        },
        ...(getTaskSourceTarget(item, projectId)
          ? [
              {
                key: "open-source-new-tab",
                label: "Open source in new tab",
                icon: ArrowUpRight,
                onSelect: () => {
                  const target = getTaskSourceTarget(item, projectId);
                  if (!target) return;
                  window.open(target.href, "_blank", "noopener,noreferrer");
                },
              },
            ]
          : []),
        ...(onDelete
          ? [
              {
                key: "delete",
                label: "Delete",
                icon: Trash2,
                onSelect: () => onDelete(item),
                destructive: true,
              },
            ]
          : []),
      ]}
    />
  );
}
