"use client";

import { CalendarClock, UserRound } from "lucide-react";

import {
  BoardView,
  type BoardColumnDefinition,
} from "@/components/tables/unified";
import { cn } from "@/lib/utils";
import { type TasksRow, getTaskSourceLabel } from "@/features/tasks/task-utils";

type TaskBoardStatus = "open" | "in_progress" | "done";

const DONE_STATUSES = new Set(["complete", "closed", "done", "cancelled"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "started", "active"]);

const TASK_BOARD_COLUMNS: BoardColumnDefinition[] = [
  {
    id: "open",
    label: "Open",
    laneClassName: "bg-background",
    countClassName: "bg-muted text-muted-foreground",
    emptyLabel: "No open tasks",
  },
  {
    id: "in_progress",
    label: "In Progress",
    laneClassName: "bg-background",
    countClassName: "bg-muted text-muted-foreground",
    emptyLabel: "Nothing in progress",
  },
  {
    id: "done",
    label: "Done",
    laneClassName: "bg-background",
    countClassName: "bg-muted text-muted-foreground",
    emptyLabel: "Nothing done yet",
  },
];

function toBoardStatus(status: string | null): TaskBoardStatus {
  const normalized = (status ?? "").toLowerCase();
  if (DONE_STATUSES.has(normalized)) return "done";
  if (IN_PROGRESS_STATUSES.has(normalized)) return "in_progress";
  return "open";
}

function formatShortDate(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function isOverdue(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function getTaskProjectLabel(item: TasksRow): string | null {
  if (item.project_name?.trim()) return item.project_name.trim();
  if (item.project_id != null) return `Project ${item.project_id}`;
  if (item.project_ids?.[0] != null) return `Project ${item.project_ids[0]}`;
  return null;
}

function renderTaskBoardCard(item: TasksRow, onOpen: (item: TasksRow) => void) {
  const title = item.description || item.title || "Untitled task";
  const projectLabel = getTaskProjectLabel(item);
  const assigneeLabel =
    item.assignee_name || item.assignee_email || "Unassigned";
  const sourceLabel = getTaskSourceLabel(item);
  const dueLabel = formatShortDate(item.due_date);
  const overdue =
    isOverdue(item.due_date) && toBoardStatus(item.status) !== "done";
  const priorityLabel = item.priority
    ? `${item.priority.charAt(0).toUpperCase()}${item.priority.slice(1).toLowerCase()}`
    : null;
  return (
    <div
      data-task-board-card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
      className="h-auto w-full justify-start rounded-md bg-muted/35 p-3 text-left font-normal transition-colors hover:bg-muted/55"
    >
      <p
        className={cn(
          "text-sm font-medium leading-snug text-foreground",
          toBoardStatus(item.status) === "done" &&
            "text-muted-foreground line-through decoration-muted-foreground/40",
        )}
      >
        {title}
      </p>
      {projectLabel && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {projectLabel}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{assigneeLabel}</span>
        </span>
        {dueLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue && "font-medium text-destructive",
            )}
          >
            <CalendarClock className="h-3 w-3 shrink-0" />
            {dueLabel}
          </span>
        ) : null}
        {priorityLabel ? <span>{priorityLabel}</span> : null}
        {sourceLabel ? <span>{sourceLabel}</span> : null}
      </div>
    </div>
  );
}

interface TasksBoardViewProps {
  items: TasksRow[];
  onOpen: (item: TasksRow) => void;
}

export function TasksBoardView({ items, onOpen }: TasksBoardViewProps) {
  return (
    <BoardView
      columns={TASK_BOARD_COLUMNS}
      items={items}
      getItemId={(item) =>
        item.id ??
        item.description ??
        item.title ??
        `task-${item.created_at ?? "unknown"}`
      }
      getColumnId={(item) => toBoardStatus(item.status)}
      renderCard={(item) => renderTaskBoardCard(item, onOpen)}
      sortItems={(columnItems) =>
        [...columnItems].sort((left, right) => {
          const leftDue = left.due_date
            ? new Date(left.due_date).getTime()
            : Number.POSITIVE_INFINITY;
          const rightDue = right.due_date
            ? new Date(right.due_date).getTime()
            : Number.POSITIVE_INFINITY;
          if (leftDue !== rightDue) return leftDue - rightDue;

          const leftCreated = left.created_at
            ? new Date(left.created_at).getTime()
            : Number.POSITIVE_INFINITY;
          const rightCreated = right.created_at
            ? new Date(right.created_at).getTime()
            : Number.POSITIVE_INFINITY;
          return leftCreated - rightCreated;
        })
      }
    />
  );
}
