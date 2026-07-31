/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted directly from Plane project intake root, sidebar, list, filter, and
 * detail templates at revision 39856932cd6b9bd17eab0920506d628190b47af2.
 * Alleato's shared primitives and canonical APIs replace Plane's stores.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Flag,
  Inbox,
  ListFilter,
  PanelLeft,
  RotateCcw,
  Trash2,
  UserRound,
  Workflow,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusDot } from "@/components/ds/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SplitPage,
  SplitPageFrame,
  useSplitPage,
} from "@/components/ui/split-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import {
  getTaskSourceLabel,
  getTaskSourceTarget,
  type TasksRow,
} from "@/features/tasks/task-utils";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
} from "@/features/tasks/task-values";
import {
  PlaneIntakeActionBar,
  type PlaneIntakeActionResponse,
  type PlaneIntakeDuplicateCandidate,
} from "@/features/plane-intake-actions";
import { useProjects } from "@/hooks/use-projects";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import {
  PlaneAlertDialogContent,
  PlanePopoverContent,
  PlaneSelectContent,
} from "@/features/plane-work-items/plane-overlay";
import {
  formatIntakeIdentifier,
  intakeItemMatches,
  mergeIntakeItems,
  resolveAdjacentIntakeKey,
  type EmailIntakeItem,
  type IntakeItem,
  type IntakeTab,
  type OutlookIntakeEmail,
  type TaskIntakeItem,
} from "./intake-adapter";
import {
  buildPlaneIntakeRequestPolicy,
  resolvePlaneIntakeMutationPolicy,
  type PlaneIntakeAccess,
} from "./intake-access";

interface PlaneIntakeClientProps {
  projectId: string;
  access: PlaneIntakeAccess;
  accessError?: string | null;
}

interface TasksResponse {
  data: TasksRow[];
}

interface UserOption {
  id: string;
  full_name?: string | null;
  email?: string | null;
  person_id?: string | null;
}

export function buildPlaneOutlookIntakeUrl(
  projectId: string,
  matchStatus?: "ignored",
) {
  const searchParams = new URLSearchParams({ project_id: projectId });
  if (matchStatus) searchParams.set("match_status", matchStatus);
  return `/api/outlook-intake?${searchParams.toString()}`;
}

export function resolvePlaneIntakeLoadingState({
  tasksLoading,
  outlookEnabled,
  outlookOpenLoading,
  outlookClosedLoading,
}: {
  tasksLoading: boolean;
  outlookEnabled: boolean;
  outlookOpenLoading: boolean;
  outlookClosedLoading: boolean;
}) {
  return {
    listLoading: tasksLoading,
    countsSettled:
      !tasksLoading &&
      (!outlookEnabled || (!outlookOpenLoading && !outlookClosedLoading)),
  };
}

interface UsersResponse {
  users?: UserOption[];
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function taskLabel(task: TasksRow): string {
  return task.title?.trim() || task.description?.trim() || "Untitled task";
}

function IntakeRow({
  item,
  projectIdentifier,
  selected,
  onSelect,
}: {
  item: IntakeItem;
  projectIdentifier: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "h-auto w-full justify-start rounded-none border border-x-transparent border-t-transparent border-b-border/60 px-4 py-4 text-left font-normal transition-colors hover:bg-primary/[0.04] focus-visible:ring-inset",
        selected && "border-primary bg-primary/[0.04] hover:bg-primary/[0.04]",
      )}
      aria-pressed={selected}
    >
      <div className="w-full space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
              {formatIntakeIdentifier(item, projectIdentifier)}
            </span>
            <StatusDot
              status={item.status}
              className="shrink-0 text-[11px] capitalize [&>span:last-child]:text-[11px]"
            />
          </div>
          <div className="w-full truncate text-[13px] font-normal leading-5 text-foreground">
            {item.title}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <span>{formatDate(item.occurredAt)}</span>
            <span
              className="size-1 rounded-full bg-border"
              aria-hidden="true"
            />
            <span className="truncate">
              {item.source === "task"
                ? item.task.priority || item.task.assignee_name || "Unassigned"
                : item.email.fromName ||
                  item.email.fromEmail ||
                  "Unknown sender"}
            </span>
          </div>
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground"
            aria-hidden="true"
          >
            {(item.source === "task"
              ? item.task.assignee_name || "U"
              : item.email.fromName || item.email.fromEmail || "O"
            ).charAt(0)}
          </span>
        </div>
      </div>
    </Button>
  );
}

export function PlaneIntakeStatusTabs({
  tab,
  openCount,
  closedCount,
  countsSettled = true,
  onTabChange,
}: {
  tab: IntakeTab;
  openCount: number;
  closedCount: number;
  countsSettled?: boolean;
  onTabChange: (tab: IntakeTab) => void;
}) {
  return (
    <div
      className="flex h-full items-center"
      role="tablist"
      aria-label="Intake status"
    >
      {(
        [
          ["open", "Open", openCount],
          ["closed", "Closed", closedCount],
        ] as const
      ).map(([value, label, count]) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-full rounded-none px-3 text-[13px] font-medium hover:bg-transparent hover:text-foreground",
            tab === value ? "text-primary" : "text-muted-foreground",
          )}
          onClick={() => onTabChange(value)}
          role="tab"
          aria-selected={tab === value}
        >
          {label}
          {value === "open" && tab === value ? (
            <span
              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
              aria-label={
                countsSettled
                  ? `${label} count ${count}`
                  : `${label} count loading`
              }
            >
              {countsSettled ? count : "…"}
            </span>
          ) : null}
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 h-0.5 rounded-t",
              tab === value ? "bg-primary" : "bg-transparent",
            )}
            aria-hidden="true"
          />
        </Button>
      ))}
    </div>
  );
}

function IntakeListPane({
  items,
  selectedKey,
  tab,
  query,
  loading,
  countsSettled,
  error,
  projectId,
  projects,
  onTabChange,
  onQueryChange,
  onSelect,
  onRetry,
}: {
  items: IntakeItem[];
  selectedKey: string | null;
  tab: IntakeTab;
  query: string;
  loading: boolean;
  countsSettled: boolean;
  error: string | null;
  projectId: number;
  projects: Array<{
    id: number;
    name: string | null;
    project_number?: string | null;
  }>;
  onTabChange: (tab: IntakeTab) => void;
  onQueryChange: (query: string) => void;
  onSelect: (item: IntakeItem) => void;
  onRetry: () => void;
}) {
  const splitPage = useSplitPage();
  const openCount = items.filter((item) => item.tab === "open").length;
  const closedCount = items.filter((item) => item.tab === "closed").length;
  const [oldestFirst, setOldestFirst] = React.useState(false);
  const visibleItems = items
    .filter((item) => item.tab === tab && intakeItemMatches(item, query))
    .sort((left, right) => {
      const comparison =
        new Date(right.occurredAt ?? 0).getTime() -
        new Date(left.occurredAt ?? 0).getTime();
      return oldestFirst ? -comparison : comparison;
    });
  const currentProject = projects.find((project) => project.id === projectId);
  const projectIdentifier =
    currentProject?.project_number?.trim() ||
    currentProject?.name?.trim().slice(0, 4).toUpperCase() ||
    String(projectId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center border-b border-border/70 px-2">
        <div className="flex h-full w-full items-center justify-between gap-2">
          <PlaneIntakeStatusTabs
            tab={tab}
            openCount={openCount}
            closedCount={closedCount}
            countsSettled={countsSettled}
            onTabChange={onTabChange}
          />
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 gap-1.5 px-2 text-[12px] font-normal text-muted-foreground shadow-none",
                    query && "border-primary/60 text-primary",
                  )}
                  aria-label="Filter intake"
                >
                  <ListFilter className="size-3.5" />
                  <span className="hidden min-[1280px]:inline">Filters</span>
                  <ChevronDown className="hidden size-3 min-[1280px]:block" />
                </Button>
              </PopoverTrigger>
              <PlanePopoverContent align="end" className="w-72 space-y-3 p-3">
                <div className="text-[12px] font-medium text-foreground">
                  Filter intake
                </div>
                <ExpandableSearch
                  value={query}
                  onChange={onQueryChange}
                  placeholder="Search intake"
                  ariaLabel="Search intake"
                  inputClassName="h-8 min-h-8 text-[13px]"
                />
                {query ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start text-[12px]"
                    onClick={() => onQueryChange("")}
                  >
                    <RotateCcw className="size-3.5" />
                    Clear filter
                  </Button>
                ) : null}
              </PlanePopoverContent>
            </Popover>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground"
              onClick={() => setOldestFirst((current) => !current)}
              aria-label={
                oldestFirst
                  ? "Sort intake newest first"
                  : "Sort intake oldest first"
              }
            >
              <ArrowDownWideNarrow
                className={cn("size-3.5", oldestFirst && "rotate-180")}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1 p-4" aria-label="Loading intake">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="max-w-sm space-y-2">
              <div className="text-sm font-medium text-foreground">
                Intake could not load
              </div>
              <div className="text-sm text-muted-foreground">{error}</div>
            </div>
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Inbox
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="text-sm font-medium text-foreground">
              {query
                ? "No matching intake"
                : tab === "open"
                  ? "Intake is clear"
                  : "No closed intake"}
            </div>
            <div className="max-w-xs text-sm text-muted-foreground">
              {query
                ? "Clear the search or try a different term."
                : tab === "open"
                  ? "New project tasks and matched Outlook records appear here."
                  : "Completed tasks and ignored emails appear here."}
            </div>
          </div>
        ) : (
          visibleItems.map((item) => (
            <IntakeRow
              key={item.key}
              item={item}
              projectIdentifier={projectIdentifier}
              selected={selectedKey === item.key}
              onSelect={() => {
                onSelect(item);
                splitPage.onClose();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskDetail({
  item,
  users,
  saving,
  onPatch,
  onDelete,
}: {
  item: TaskIntakeItem;
  users: UserOption[];
  saving: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const task = item.task;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-6 sm:px-8">
      <div className="space-y-4">
        <h1 className="break-words text-xl font-semibold leading-7 text-foreground">
          {taskLabel(task)}
        </h1>
        {item.summary ? (
          <div className="max-w-3xl whitespace-pre-wrap text-[13px] leading-6 text-foreground">
            {item.summary}
          </div>
        ) : null}
      </div>

      <section className="border-t border-border/60 pt-5">
        <div className="mb-3 text-[13px] font-medium text-foreground">
          Properties
        </div>
        <div className="divide-y divide-border/50">
          <label className="flex min-h-10 items-center gap-3 py-1 text-[13px]">
            <span className="flex w-2/5 shrink-0 items-center gap-1.5 text-muted-foreground">
              <Workflow className="size-4" />
              State
            </span>
            <Select
              value={task.status ?? "open"}
              disabled={saving}
              onValueChange={(status) => onPatch({ status })}
            >
              <SelectTrigger className="h-8 min-h-8 w-3/5 border-transparent px-2 text-[13px] shadow-none hover:bg-muted/60">
                <SelectValue />
              </SelectTrigger>
              <PlaneSelectContent>
                {TASK_STATUS_VALUES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </PlaneSelectContent>
            </Select>
          </label>

          <label className="flex min-h-10 items-center gap-3 py-1 text-[13px]">
            <span className="flex w-2/5 shrink-0 items-center gap-1.5 text-muted-foreground">
              <UserRound className="size-4" />
              Assignee
            </span>
            <Select
              value={task.assignee_person_id ?? "__none__"}
              disabled={saving}
              onValueChange={(personId) =>
                onPatch({
                  assignee_person_id: personId === "__none__" ? null : personId,
                })
              }
            >
              <SelectTrigger className="h-8 min-h-8 w-3/5 border-transparent px-2 text-[13px] shadow-none hover:bg-muted/60">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <PlaneSelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.person_id ?? user.id}>
                    {user.full_name || user.email || "Unnamed user"}
                  </SelectItem>
                ))}
              </PlaneSelectContent>
            </Select>
          </label>

          <label className="flex min-h-10 items-center gap-3 py-1 text-[13px]">
            <span className="flex w-2/5 shrink-0 items-center gap-1.5 text-muted-foreground">
              <Flag className="size-4" />
              Priority
            </span>
            <Select
              value={task.priority ?? "__none__"}
              disabled={saving}
              onValueChange={(priority) =>
                onPatch({ priority: priority === "__none__" ? null : priority })
              }
            >
              <SelectTrigger className="h-8 min-h-8 w-3/5 border-transparent px-2 text-[13px] shadow-none hover:bg-muted/60">
                <SelectValue />
              </SelectTrigger>
              <PlaneSelectContent>
                <SelectItem value="__none__">Not set</SelectItem>
                {TASK_PRIORITY_VALUES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </PlaneSelectContent>
            </Select>
          </label>

          <div className="flex min-h-10 items-center gap-3 py-1 text-[13px]">
            <span className="flex w-2/5 shrink-0 items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4" />
              Due date
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  className="h-8 min-h-8 w-3/5 justify-start border-transparent px-2 text-[13px] font-normal shadow-none hover:bg-muted/60"
                >
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {task.due_date ? formatDate(task.due_date) : "No due date"}
                </Button>
              </PopoverTrigger>
              <PlanePopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    task.due_date
                      ? new Date(`${task.due_date}T12:00:00`)
                      : undefined
                  }
                  onSelect={(date) => {
                    const dueDate = date
                      ? [
                          date.getFullYear(),
                          String(date.getMonth() + 1).padStart(2, "0"),
                          String(date.getDate()).padStart(2, "0"),
                        ].join("-")
                      : null;
                    onPatch({ due_date: dueDate });
                  }}
                />
                {task.due_date ? (
                  <div className="border-t border-border p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => onPatch({ due_date: null })}
                    >
                      Clear due date
                    </Button>
                  </div>
                ) : null}
              </PlanePopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      <section className="border-t border-border/60 pt-5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Added {formatDate(item.occurredAt)} from {getTaskSourceLabel(task)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}

function EmailDetail({ item }: { item: EmailIntakeItem }) {
  const email = item.email;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-6 sm:px-8">
      <div className="space-y-4">
        <h1 className="break-words text-xl font-semibold leading-7 text-foreground">
          {email.subject || "Untitled email"}
        </h1>
        <div className="divide-y divide-border/50 border-y border-border/60">
          {[
            ["From", email.fromName || email.fromEmail || "Unknown sender"],
            ["To", email.toList.join(", ") || "No recipients"],
            ["Date", formatDate(email.receivedAt ?? email.createdAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex min-h-9 items-center gap-3 py-1 text-[13px]"
            >
              <span className="w-2/5 shrink-0 text-muted-foreground">
                {label}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">
        {email.bodyText?.trim() ||
          email.body?.trim() ||
          "This message has no plain-text body."}
      </div>
    </div>
  );
}

function IntakeDetailPane({
  item,
  users,
  projectId,
  saving,
  currentIndex,
  itemCount,
  onNavigate,
  onPatchTask,
  onDeleteTask,
  duplicateCandidates,
  actionsDisabled,
  onActionCompleted,
}: {
  item: IntakeItem | null;
  users: UserOption[];
  projectId: string;
  saving: boolean;
  currentIndex: number;
  itemCount: number;
  onNavigate: (direction: "previous" | "next") => void;
  onPatchTask: (patch: Record<string, unknown>) => void;
  onDeleteTask: () => void;
  duplicateCandidates: PlaneIntakeDuplicateCandidate[];
  actionsDisabled: boolean;
  onActionCompleted: (
    result: PlaneIntakeActionResponse,
  ) => void | Promise<void>;
}) {
  const splitPage = useSplitPage();
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <Inbox
          className="size-12 text-muted-foreground/70"
          strokeWidth={1.25}
          aria-hidden="true"
        />
        <div className="text-[13px] font-medium text-foreground">
          Select an intake item
        </div>
      </div>
    );
  }

  const sourceTarget =
    item.source === "task" ? getTaskSourceTarget(item.task, projectId) : null;
  const outlookWebLink = item.source === "outlook" ? item.email.webLink : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-13 shrink-0 items-center gap-2 border-b border-border/70 px-3 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 lg:hidden"
          onClick={splitPage.onOpen}
          aria-label="Show intake list"
        >
          <PanelLeft className="size-4" />
        </Button>

        <div className="min-w-0 text-[14px] font-medium text-muted-foreground">
          <span className="hidden sm:inline">
            {item.source === "task" ? "TASK" : "OUTLOOK"}-
          </span>
          <span className="truncate">
            {item.source === "task" ? item.task.id?.slice(0, 8) : item.email.id}
          </span>
        </div>
        <StatusDot
          status={item.status}
          className="shrink-0 text-[11px] capitalize [&>span:last-child]:text-[11px]"
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={itemCount < 2 || currentIndex < 0}
            onClick={() => onNavigate("previous")}
            aria-label="Previous intake item"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={itemCount < 2 || currentIndex < 0}
            onClick={() => onNavigate("next")}
            aria-label="Next intake item"
          >
            <ChevronDown className="size-4" />
          </Button>

          {sourceTarget ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="ml-1 hidden h-8 sm:inline-flex"
            >
              <Link
                href={sourceTarget.href}
                target={sourceTarget.external ? "_blank" : undefined}
                rel={sourceTarget.external ? "noreferrer" : undefined}
              >
                Open
                {sourceTarget.external ? (
                  <ArrowUpRight className="size-3.5" />
                ) : null}
              </Link>
            </Button>
          ) : outlookWebLink ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="ml-1 hidden h-8 sm:inline-flex"
            >
              <Link href={outlookWebLink} target="_blank" rel="noreferrer">
                Outlook
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          ) : null}

          {item.source === "outlook" || item.task.id ? (
            <PlaneIntakeActionBar
              source={item.source}
              sourceId={
                item.source === "task"
                  ? (item.task.id as string)
                  : String(item.email.id)
              }
              projectId={Number.parseInt(projectId, 10)}
              decision={item.decision}
              snoozedUntil={item.snoozedUntil}
              duplicateCandidates={duplicateCandidates}
              disabled={actionsDisabled}
              onCompleted={onActionCompleted}
            />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {item.source === "task" ? (
          <TaskDetail
            item={item}
            users={users}
            saving={saving}
            onPatch={onPatchTask}
            onDelete={onDeleteTask}
          />
        ) : (
          <EmailDetail item={item} />
        )}
      </div>
    </div>
  );
}

export function PlaneIntakeClient({
  projectId,
  access,
  accessError = null,
}: PlaneIntakeClientProps) {
  const numericProjectId = Number.parseInt(projectId, 10);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<IntakeTab>("open");
  const [query, setQuery] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { projects } = useProjects({ limit: 250 });
  const requestPolicy = React.useMemo(
    () => buildPlaneIntakeRequestPolicy(projectId, access),
    [access, projectId],
  );

  const tasksQuery = useQuery<TasksResponse>({
    queryKey: ["plane-intake", "tasks", projectId, access.taskScope],
    queryFn: ({ signal }) =>
      apiFetch<TasksResponse>(requestPolicy.tasksUrl, {
        signal,
      }),
  });
  const outlookOpenQuery = useQuery<OutlookIntakeEmail[]>({
    queryKey: ["plane-intake", "outlook", projectId, "open"],
    queryFn: ({ signal }) =>
      apiFetch<OutlookIntakeEmail[]>(buildPlaneOutlookIntakeUrl(projectId), {
        signal,
      }),
    enabled: requestPolicy.outlookQueriesEnabled,
  });
  const outlookClosedQuery = useQuery<OutlookIntakeEmail[]>({
    queryKey: ["plane-intake", "outlook", projectId, "closed"],
    queryFn: ({ signal }) =>
      apiFetch<OutlookIntakeEmail[]>(
        buildPlaneOutlookIntakeUrl(projectId, "ignored"),
        { signal },
      ),
    enabled: requestPolicy.outlookQueriesEnabled,
  });
  const usersQuery = useQuery<UsersResponse>({
    queryKey: ["plane-intake", "users"],
    queryFn: ({ signal }) => apiFetch<UsersResponse>("/api/users", { signal }),
  });

  const items = React.useMemo(
    () =>
      mergeIntakeItems(
        tasksQuery.data?.data ?? [],
        [...(outlookOpenQuery.data ?? []), ...(outlookClosedQuery.data ?? [])],
        numericProjectId,
      ),
    [
      numericProjectId,
      outlookClosedQuery.data,
      outlookOpenQuery.data,
      tasksQuery.data?.data,
    ],
  );
  const duplicateCandidates = React.useMemo<
    PlaneIntakeDuplicateCandidate[]
  >(() => {
    const currentProject = projects.find(
      (project) => project.id === numericProjectId,
    );
    const projectIdentifier =
      currentProject?.project_number?.trim() ||
      currentProject?.name?.trim().slice(0, 4).toUpperCase() ||
      String(numericProjectId);

    return (tasksQuery.data?.data ?? [])
      .filter((task): task is TasksRow & { id: string } => Boolean(task.id))
      .map((task) => ({
        id: task.id,
        identifier: `${projectIdentifier}-${task.id.slice(0, 6)}`,
        title: taskLabel(task),
        status: task.status,
      }));
  }, [numericProjectId, projects, tasksQuery.data?.data]);
  const selectedItem =
    items.find((item) => item.key === selectedKey) ?? null;
  const loadingState = resolvePlaneIntakeLoadingState({
    tasksLoading: tasksQuery.isLoading,
    outlookEnabled: requestPolicy.outlookQueriesEnabled,
    outlookOpenLoading: outlookOpenQuery.isLoading,
    outlookClosedLoading: outlookClosedQuery.isLoading,
  });
  const mutationPolicy = resolvePlaneIntakeMutationPolicy(
    selectedItem?.source ?? null,
    access,
    saving,
  );
  const visibleItems = React.useMemo(
    () =>
      items.filter(
        (item) => item.tab === tab && intakeItemMatches(item, query),
      ),
    [items, query, tab],
  );
  const selectedIndex = selectedItem
    ? visibleItems.findIndex((item) => item.key === selectedItem.key)
    : -1;
  const sourceErrors = [
    tasksQuery.error ? `Tasks: ${getErrorDetail(tasksQuery.error)}` : null,
    accessError,
    access.canAccessOutlookIntake && outlookOpenQuery.error
      ? `Outlook open: ${getErrorDetail(outlookOpenQuery.error)}`
      : null,
    access.canAccessOutlookIntake && outlookClosedQuery.error
      ? `Outlook closed: ${getErrorDetail(outlookClosedQuery.error)}`
      : null,
  ].filter(Boolean);
  const fatalError =
    Boolean(tasksQuery.error) &&
    (!access.canAccessOutlookIntake ||
      (Boolean(outlookOpenQuery.error) && Boolean(outlookClosedQuery.error)))
      ? sourceErrors.join(" ")
      : null;

  React.useEffect(() => {
    const firstVisibleKey = visibleItems[0]?.key ?? null;
    if (!selectedKey || selectedIndex < 0) {
      setSelectedKey(firstVisibleKey);
    }
  }, [selectedIndex, selectedKey, visibleItems]);

  function navigateSelected(direction: "previous" | "next") {
    if (visibleItems.length < 2) return;
    setSelectedKey(
      resolveAdjacentIntakeKey(visibleItems, selectedKey, direction),
    );
  }

  async function refresh() {
    const invalidations = [
      queryClient.invalidateQueries({
        queryKey: ["plane-intake", "tasks", projectId],
      }),
    ];
    if (access.canAccessOutlookIntake) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: ["plane-intake", "outlook", projectId],
        }),
      );
    }
    await Promise.all(invalidations);
  }

  async function patchSelectedTask(patch: Record<string, unknown>) {
    if (
      !mutationPolicy.canPatchTask ||
      selectedItem?.source !== "task" ||
      !selectedItem.task.id
    )
      return;
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${selectedItem.task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await refresh();
      toast.success("Task updated");
    } catch (error) {
      toast.error("Task update failed", { description: getErrorDetail(error) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedTask() {
    if (
      !mutationPolicy.canDeleteTask ||
      selectedItem?.source !== "task" ||
      !selectedItem.task.id
    )
      return;
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${selectedItem.task.id}`, {
        method: "DELETE",
      });
      setSelectedKey(null);
      setDeleteOpen(false);
      await refresh();
      toast.success("Task deleted");
    } catch (error) {
      toast.error("Task deletion failed", {
        description: getErrorDetail(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PlaneIntakeLayout
        listPane={
          <IntakeListPane
            items={items}
            selectedKey={selectedKey}
            tab={tab}
            query={query}
            loading={loadingState.listLoading}
            countsSettled={loadingState.countsSettled}
            error={fatalError}
            projectId={numericProjectId}
            projects={projects}
            onTabChange={setTab}
            onQueryChange={setQuery}
            onSelect={(item) => setSelectedKey(item.key)}
            onRetry={() => void refresh()}
          />
        }
        detailPane={
          <IntakeDetailPane
            item={selectedItem}
            users={usersQuery.data?.users ?? []}
            projectId={projectId}
            saving={saving}
            currentIndex={selectedIndex}
            itemCount={visibleItems.length}
            onNavigate={navigateSelected}
            onPatchTask={(patch) => void patchSelectedTask(patch)}
            onDeleteTask={() => setDeleteOpen(true)}
            duplicateCandidates={duplicateCandidates}
            actionsDisabled={
              selectedItem?.source === "outlook"
                ? !mutationPolicy.canToggleOutlook
                : saving
            }
            onActionCompleted={async () => {
              await refresh();
            }}
          />
        }
      />

      {sourceErrors.length > 0 && !fatalError ? (
        <Alert
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-md shadow-sm"
        >
          <div className="min-w-0 pr-20">
            <AlertTitle>One intake source failed</AlertTitle>
            <AlertDescription>{sourceErrors[0]}</AlertDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-3 top-3"
            onClick={() => {
              if (accessError) {
                window.location.reload();
                return;
              }
              void refresh();
            }}
          >
            {accessError ? "Reload" : "Retry"}
          </Button>
        </Alert>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <PlaneAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task from the project and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void deleteSelectedTask();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </PlaneAlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PlaneIntakeLayout({
  listPane,
  detailPane,
}: {
  listPane: React.ReactNode;
  detailPane: React.ReactNode;
}) {
  return (
    <SplitPageFrame
      height="fill"
      className="border-t border-border/60"
      data-plane-intake-list-width="33.333333%"
    >
      <SplitPage
        breakpoint="lg"
        firstPaneWidth="33.333333%"
        className="bg-muted/[0.08]"
        firstPaneClassName="border-r border-border/70"
      >
        {listPane}
        {detailPane}
      </SplitPage>
    </SplitPageFrame>
  );
}
