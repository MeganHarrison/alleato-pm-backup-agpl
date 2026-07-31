"use client";

/**
 * agenda-item-row
 *
 * Single agenda item inside `agenda-section.tsx`: number + title header row,
 * inline assignee/due/status/priority controls, an expandable description
 * textarea, the official-minutes textarea (minutes mode only), a Tasks
 * subsection ("+ Create Task" via `useCreateItemTask`, listing linked
 * tasks), a lazy "Previous Minutes" collapsible (`useItemHistory`), and an
 * attachments section that only renders once `meeting_item` is registered
 * as a Pattern C entity type (see `isMeetingItemAttachmentsEnabled` below —
 * that registration lives on another branch and is not duplicated here).
 *
 * Meetily-adoption note (Task 13 spec): only the editing cadence — low
 * friction inline editing, explicit dirty state, no data-loss saves — is
 * reused. No BlockNote / rich text here; item description and official
 * minutes remain plain text.
 */

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  GripVertical,
  MoreVertical,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableItemHandle } from "@/components/ui/sortable";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isPatternCEntityType,
  type PatternCEntityType,
} from "@/lib/documents/pattern-c-attachment-types";
import { apiFetch } from "@/lib/api-client";
import { useUsers } from "@/hooks/use-users";
import {
  meetingKeys,
  useCreateItemTask,
  useDeleteItem,
  useItemHistory,
  useUpdateItem,
  type MeetingDetailItem,
  type UpdateItemInput,
} from "@/hooks/use-meetings";
import type { Database } from "@/types/database.types";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

/**
 * Parses a `YYYY-MM-DD` due-date string as a local date (matching
 * `RHFDateField`'s parsing) so the Calendar popover never shows an
 * off-by-one day from a UTC interpretation.
 */
function parseDueDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return undefined;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

/**
 * Probes whether `meeting_item` has been registered as a Pattern C
 * attachment entity type. Registration happens on `feat/meetings-detail-ui`
 * and merges later — this check means the attachments section lights up
 * automatically post-merge with zero changes needed here. Do not register
 * `meeting_item` in `pattern-c-attachments.ts` from this branch.
 */
function isMeetingItemAttachmentsEnabled(): boolean {
  const candidate = "meeting_item";
  return isPatternCEntityType(candidate);
}

type AgendaSourceReference = {
  label: string;
  href: string;
  context: string | null;
};

function parseAgendaSourceReference(
  description: string | null,
): AgendaSourceReference | null {
  if (!description) return null;

  const sourceMatch = description.match(/^Source:\s*(.+?)\s*\((\/[^\s)]+)\)\s*$/m);
  if (!sourceMatch) return null;

  const label = sourceMatch[1]?.trim();
  const href = sourceMatch[2]?.trim();
  if (!label || !href) return null;

  const context = description.match(/^Context:\s*(.+?)\s*$/m)?.[1]?.trim() ?? null;
  return { label, href, context };
}

export interface AgendaItemRowProps {
  projectId: number;
  meetingId: string;
  item: MeetingDetailItem;
  mode: "agenda" | "minutes";
}

export function AgendaItemRow({
  projectId,
  meetingId,
  item,
  mode,
}: AgendaItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(item.description ?? "");
  const [minutesDraft, setMinutesDraft] = useState(item.official_minutes ?? "");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [minutesDirty, setMinutesDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [taskAssigneeDraft, setTaskAssigneeDraft] = useState(
    item.assignee_person_id ?? "unassigned",
  );
  const [taskDueDateDraft, setTaskDueDateDraft] = useState<string | null>(item.due_date);

  const updateItem = useUpdateItem(String(projectId), meetingId);
  const deleteItem = useDeleteItem(String(projectId), meetingId);
  const createItemTask = useCreateItemTask(String(projectId), meetingId);
  const { users } = useUsers({ personType: "all" });
  const sourceReference = parseAgendaSourceReference(item.description);

  const itemHistory = useItemHistory(String(projectId), meetingId, item.id, {
    enabled: historyOpen,
  });

  const tasksQuery = useQuery<{ tasks: TaskRow[] }>({
    queryKey: [...meetingKeys.detail(String(projectId), meetingId), "items", item.id, "tasks"],
    queryFn: async () =>
      apiFetch<{ tasks: TaskRow[] }>(
        `/api/projects/${projectId}/meetings/${meetingId}/items/${item.id}/tasks`,
      ),
    enabled: expanded,
  });

  const assigneeName = item.assignee_person_id
    ? (() => {
        const person = users.find((user) => user.id === item.assignee_person_id);
        if (!person) return null;
        return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email;
      })()
    : null;

  function commitDescription() {
    if (!descriptionDirty) return;
    updateItem.mutate(
      { itemId: item.id, data: { description: descriptionDraft } },
      { onSuccess: () => setDescriptionDirty(false) },
    );
  }

  function commitMinutes() {
    if (!minutesDirty) return;
    updateItem.mutate(
      { itemId: item.id, data: { official_minutes: minutesDraft } },
      { onSuccess: () => setMinutesDirty(false) },
    );
  }

  function handleAssigneeChange(value: string) {
    updateItem.mutate({
      itemId: item.id,
      data: { assignee_person_id: value === "unassigned" ? null : value },
    });
  }

  function handleDueDateChange(date: Date | undefined) {
    updateItem.mutate({
      itemId: item.id,
      data: { due_date: date ? format(date, "yyyy-MM-dd") : null },
    });
  }

  function handleStatusChange(value: string) {
    updateItem.mutate({
      itemId: item.id,
      data: { status: value as NonNullable<UpdateItemInput["status"]> },
    });
  }

  function handlePriorityChange(value: string) {
    updateItem.mutate({
      itemId: item.id,
      data: {
        priority: value === "none" ? null : (value as NonNullable<UpdateItemInput["priority"]>),
      },
    });
  }

  function handleCreateTask() {
    const title = taskTitleDraft.trim();
    createItemTask.mutate(
      {
        itemId: item.id,
        data: {
          title: title || undefined,
          assignee_person_id:
            taskAssigneeDraft === "unassigned" ? null : taskAssigneeDraft,
          due_date: taskDueDateDraft,
        },
      },
      {
        onSuccess: () => {
          setTaskTitleDraft("");
          setTaskAssigneeDraft(item.assignee_person_id ?? "unassigned");
          setTaskDueDateDraft(item.due_date);
          setTaskFormOpen(false);
          tasksQuery.refetch();
        },
      },
    );
  }

  function openTaskForm() {
    setTaskAssigneeDraft(item.assignee_person_id ?? "unassigned");
    setTaskDueDateDraft(item.due_date);
    setTaskFormOpen((value) => !value);
  }

  return (
    <div
      className="flex flex-col gap-2 py-2"
      data-testid="agenda-item-row"
      data-item-id={item.id}
    >
      <div className="flex items-start gap-2">
        <SortableItemHandle
          className="mt-1 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={`Reorder ${item.title}`}
        >
          <GripVertical className="h-4 w-4" />
        </SortableItemHandle>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse item" : "Expand item"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        <span className="mt-1 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {item.agenda_number}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {item.title}
            </span>

            {sourceReference ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={sourceReference.href}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Open source: ${sourceReference.label}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  {sourceReference.context
                    ? `${sourceReference.label} · ${sourceReference.context}`
                    : sourceReference.label}
                </TooltipContent>
              </Tooltip>
            ) : null}

            <Select value={item.status} onValueChange={handleStatusChange}>
              <SelectTrigger size="sm" className="h-7 w-36 text-xs">
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

            <Select value={item.priority ?? "none"} onValueChange={handlePriorityChange}>
              <SelectTrigger size="sm" className="h-7 w-28 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No priority</SelectItem>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={item.assignee_person_id ?? "unassigned"}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger size="sm" className="h-7 w-36 text-xs">
                <SelectValue placeholder="Unassigned">
                  {assigneeName ?? "Unassigned"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-40 justify-start text-xs font-normal"
                  aria-label="Due date"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {item.due_date ? format(parseDueDate(item.due_date)!, "PP") : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDueDate(item.due_date)}
                  onSelect={handleDueDateChange}
                  initialFocus
                />
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDueDateChange(undefined)}
                  >
                    Clear date
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Item actions"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => deleteItem.mutate(item.id)}
                >
                  Delete item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="ml-14 flex flex-col gap-4">
          <Textarea
            value={descriptionDraft}
            placeholder="Add a description…"
            onChange={(event) => {
              setDescriptionDraft(event.target.value);
              setDescriptionDirty(true);
            }}
            onBlur={commitDescription}
            className="min-h-16 text-sm"
          />

          {mode === "minutes" ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Official Minutes
              </span>
              <Textarea
                value={minutesDraft}
                placeholder="Record the official minutes for this item…"
                onChange={(event) => {
                  setMinutesDraft(event.target.value);
                  setMinutesDirty(true);
                }}
                onBlur={commitMinutes}
                className="min-h-16 text-sm"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tasks{item.task_count > 0 ? ` (${item.task_count})` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={openTaskForm}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Create task"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {taskFormOpen ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_9rem_9rem_auto] sm:items-center">
                <Input
                  value={taskTitleDraft}
                  onChange={(event) => setTaskTitleDraft(event.target.value)}
                  placeholder={`Task: ${item.title}`}
                  className="h-7 text-xs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleCreateTask();
                    if (event.key === "Escape") setTaskFormOpen(false);
                  }}
                  autoFocus
                />
                <Select value={taskAssigneeDraft} onValueChange={setTaskAssigneeDraft}>
                  <SelectTrigger size="sm" className="h-7 text-xs" aria-label="Task owner">
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                          user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 justify-start text-xs font-normal"
                      aria-label="Task due date"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {taskDueDateDraft
                        ? format(parseDueDate(taskDueDateDraft)!, "PP")
                        : "Due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDueDate(taskDueDateDraft)}
                      onSelect={(date) =>
                        setTaskDueDateDraft(date ? format(date, "yyyy-MM-dd") : null)
                      }
                      initialFocus
                    />
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setTaskDueDateDraft(null)}
                      >
                        Clear date
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button type="button" size="sm" className="h-7" onClick={handleCreateTask}>
                  Create
                </Button>
              </div>
            ) : null}

            {tasksQuery.data?.tasks.length ? (
              <ul className="flex flex-col gap-1">
                {tasksQuery.data.tasks.map((task) => (
                  <li key={task.id} className="text-xs text-muted-foreground">
                    {task.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
              {historyOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Previous Minutes
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 flex flex-col gap-2">
              {itemHistory.isLoading ? (
                <span className="text-xs text-muted-foreground">Loading history…</span>
              ) : itemHistory.data?.history.length ? (
                itemHistory.data.history.map((entry) => (
                  <div key={entry.meeting_id} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      Meeting #{entry.meeting_number}
                      {entry.meeting_date ? ` — ${entry.meeting_date}` : ""}
                    </span>
                    {entry.official_minutes ? (
                      <p className="text-xs text-muted-foreground">{entry.official_minutes}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No previous minutes.</span>
              )}
            </CollapsibleContent>
          </Collapsible>

          {isMeetingItemAttachmentsEnabled() ? (
            <MeetingItemAttachments itemId={item.id} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * MeetingItemAttachments
 * Only rendered when `meeting_item` is registered as a Pattern C entity
 * type (see `isMeetingItemAttachmentsEnabled`). Kept as a separate
 * component so the dynamic import below only happens once the gate is
 * open — the registering branch is expected to add `"meeting_item"` to
 * `DocumentPickerEntityType` in `document-picker.tsx`; until then this
 * component is unreachable dead code that never renders.
 */
// Deriving the type from the module itself means the dynamic import assigns
// with no cast, and prop usage typechecks against the real components.
type DocumentPickerExports = typeof import("@/components/ds/document-picker");

function MeetingItemAttachments({ itemId }: { itemId: string }) {
  const [documentPickerModule, setDocumentPickerModule] = useState<DocumentPickerExports | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void import("@/components/ds/document-picker").then((module) => {
      if (!cancelled) {
        setDocumentPickerModule(module);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!documentPickerModule) return null;

  const { DocumentPicker, LinkedDocumentsList } = documentPickerModule;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attachments
      </span>
      <LinkedDocumentsList entityType="meeting_item" entityId={itemId} />
      <DocumentPicker entityType="meeting_item" entityId={itemId} />
    </div>
  );
}

export const __private = { isMeetingItemAttachmentsEnabled };
