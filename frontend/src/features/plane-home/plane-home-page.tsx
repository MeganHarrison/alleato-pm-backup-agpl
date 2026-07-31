/**
 * Adapted from Plane's workspace Home root, dashboard widget stack, recent
 * activity widget, and recent work-item row templates in makeplane/plane
 * revision 39856932cd6b9bd17eab0920506d628190b47af2.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md, /auth/source, and ./PLANE-SOURCE.md.
 */

"use client";

import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Circle,
  FileText,
  Plus,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DetailField, DetailFieldGrid } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { buildPlaneWorkItemsHref } from "@/features/plane-work-items-contracts";
import type { TasksRow } from "@/features/tasks/task-utils";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  loadPlaneHomeDailyLogs,
  loadPlaneHomeMeetings,
  loadPlaneHomeProject,
  loadPlaneHomeTasks,
} from "./plane-home-data";
import {
  buildHomeActivity,
  formatHomeDate,
  type PlaneHomeActivity,
  type PlaneHomeDailyLog,
  type PlaneHomeMeeting,
  type PlaneHomeProject,
  selectHomeTasks,
  taskHomeTitle,
} from "./plane-home-model";

type SectionKey = "project" | "tasks" | "activity";
type SectionErrors = Partial<Record<SectionKey, string>>;

function errorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ProjectHomeLoading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-5 py-8 sm:px-8"
      aria-label="Loading project home"
    >
      <div className="h-7 w-52 rounded bg-border" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-muted" />
      <div className="mt-10 h-4 w-28 rounded bg-border" />
      <div className="mt-3 divide-y divide-border">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 py-3">
            <div className="size-7 rounded bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineError({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 py-5 text-sm"
    >
      <div className="flex min-w-0 gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
        <RotateCcw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

function SectionHeading({
  title,
  href,
  actionLabel,
}: {
  title: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="flex h-8 items-center justify-between">
      <SectionRuleHeading
        as="h2"
        label={title}
        className="mb-0 h-8 flex-1 pb-0 [&>span]:text-sm [&>span]:font-semibold [&>span]:normal-case [&>span]:tracking-normal"
        actions={
          <Link
            href={href}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />
    </div>
  );
}

function TaskRow({
  projectId,
  task,
}: {
  projectId: string;
  task: TasksRow;
}) {
  const href = task.id
    ? buildPlaneWorkItemsHref(projectId, { peekId: task.id })
    : buildPlaneWorkItemsHref(projectId);

  return (
    <Link
      href={href}
      className="group flex min-h-12 items-center gap-3 px-2 py-2.5 hover:bg-accent"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-muted">
        <Circle className="size-3.5 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {taskHomeTitle(task)}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="capitalize">
            {(task.status ?? "open").replaceAll("_", " ")}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            {task.assignee_name || task.assignee_email || "Unassigned"}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-[11px] text-muted-foreground",
          task.due_date &&
            Date.parse(task.due_date) < Date.now() &&
            "font-medium text-destructive",
        )}
      >
        {task.due_date ? formatHomeDate(task.due_date) : "No due date"}
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function ActivityRow({ activity }: { activity: PlaneHomeActivity }) {
  return (
    <Link
      href={activity.href}
      className="group flex min-h-12 items-center gap-3 px-2 py-2.5 hover:bg-accent"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-muted">
        {activity.kind === "meeting" ? (
          <CalendarClock className="size-3.5 text-muted-foreground" />
        ) : (
          <FileText className="size-3.5 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {activity.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {activity.description ??
            (activity.kind === "meeting"
              ? "Meeting record"
              : "Daily project record")}
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {formatHomeDate(activity.occurredAt)}
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function PlaneHomePage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<PlaneHomeProject | null>(null);
  const [tasks, setTasks] = useState<TasksRow[]>([]);
  const [meetings, setMeetings] = useState<PlaneHomeMeeting[]>([]);
  const [dailyLogs, setDailyLogs] = useState<PlaneHomeDailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<SectionErrors>({});

  const loadProject = useCallback(async () => {
    try {
      const nextProject = await loadPlaneHomeProject(projectId);
      setProject(nextProject);
      setErrors((current) => ({ ...current, project: undefined }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        project: errorMessage(
          error,
          "The project summary could not be loaded.",
        ),
      }));
    }
  }, [projectId]);

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await loadPlaneHomeTasks(projectId));
      setErrors((current) => ({ ...current, tasks: undefined }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        tasks: errorMessage(error, "The project tasks could not be loaded."),
      }));
    }
  }, [projectId]);

  const loadActivity = useCallback(async () => {
    const [meetingResult, dailyLogResult] = await Promise.allSettled([
      loadPlaneHomeMeetings(projectId),
      loadPlaneHomeDailyLogs(projectId),
    ]);

    if (
      meetingResult.status === "rejected" &&
      dailyLogResult.status === "rejected"
    ) {
      setErrors((current) => ({
        ...current,
        activity: "Recent meetings and daily logs could not be loaded.",
      }));
      return;
    }

    setMeetings(
      meetingResult.status === "fulfilled" ? meetingResult.value : [],
    );
    setDailyLogs(
      dailyLogResult.status === "fulfilled" ? dailyLogResult.value : [],
    );
    setErrors((current) => ({
      ...current,
      activity:
        meetingResult.status === "rejected"
          ? "Meetings could not be loaded. Showing daily logs."
          : dailyLogResult.status === "rejected"
            ? "Daily logs could not be loaded. Showing meetings."
            : undefined,
    }));
  }, [projectId]);

  const loadHome = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadProject(), loadTasks(), loadActivity()]);
    setLoading(false);
  }, [loadActivity, loadProject, loadTasks]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const openTasks = useMemo(() => selectHomeTasks(tasks), [tasks]);
  const activity = useMemo(
    () => buildHomeActivity(projectId, meetings, dailyLogs),
    [dailyLogs, meetings, projectId],
  );

  if (loading && !project) return <ProjectHomeLoading />;

  if (!project) {
    return (
      <div className="mx-auto grid h-full w-full max-w-3xl place-items-center px-5">
        <InlineError
          title="Project Home is unavailable"
          detail={
            errors.project ??
            "The project summary did not return a usable record."
          }
          onRetry={() => void loadHome()}
        />
      </div>
    );
  }

  const projectNumber =
    project.project_number ?? project["job number"] ?? `Project ${project.id}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate text-muted-foreground">{project.name}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">Home</span>
        </div>
        <Button asChild size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
          <Link href={buildPlaneWorkItemsHref(projectId)}>
            <Plus className="size-3.5" />
            Add task
          </Link>
        </Button>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-medium text-muted-foreground">{projectNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">
            {project.name ?? `Project ${project.id}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {project.summary ||
              project.work_scope ||
              "Project work, recent activity, and the records that need attention."}
          </p>

          <section className="mt-9">
            <SectionHeading
              title="Open work"
              href={buildPlaneWorkItemsHref(projectId)}
              actionLabel="View all"
            />
            <div className="mt-1 divide-y divide-border">
              {errors.tasks ? (
                <InlineError
                  title="Tasks are unavailable"
                  detail={errors.tasks}
                  onRetry={() => void loadTasks()}
                />
              ) : openTasks.length ? (
                openTasks.map((task, index) => (
                  <TaskRow
                    key={task.id ?? `${task.description}-${index}`}
                    projectId={projectId}
                    task={task}
                  />
                ))
              ) : (
                <div className="py-6 text-sm text-muted-foreground">
                  No open tasks.{" "}
                  <Link
                    href={buildPlaneWorkItemsHref(projectId)}
                    className="font-medium text-foreground hover:underline"
                  >
                    Add the next task
                  </Link>
                  .
                </div>
              )}
            </div>
          </section>

          <section className="mt-9">
            <SectionHeading
              title="Recent activity"
              href={`/${projectId}/meetings`}
              actionLabel="View meetings"
            />
            <div className="mt-1 divide-y divide-border">
              {errors.activity && !activity.length ? (
                <InlineError
                  title="Recent activity is unavailable"
                  detail={errors.activity}
                  onRetry={() => void loadActivity()}
                />
              ) : activity.length ? (
                <>
                  {errors.activity ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 py-2 text-xs text-muted-foreground"
                    >
                      <AlertCircle className="size-3.5" />
                      {errors.activity}
                    </div>
                  ) : null}
                  {activity.map((item) => (
                    <ActivityRow key={item.id} activity={item} />
                  ))}
                </>
              ) : (
                <div className="py-6 text-sm text-muted-foreground">
                  No recent meetings or daily logs.
                </div>
              )}
            </div>
          </section>

          <section className="mt-9 pb-8">
            <SectionHeading
              title="Project details"
              href={`/${projectId}/setup`}
              actionLabel="Open settings"
            />
            <DetailFieldGrid columns={1} className="mt-4 gap-y-4">
              <DetailField label="Phase">
                {project.phase || project.stage || "Not set"}
              </DetailField>
              <DetailField label="Location">
                {project.address || "Not set"}
              </DetailField>
              <DetailField label="Schedule">
                {project["start date"]
                  ? `${formatHomeDate(project["start date"])}${
                      project["est completion"]
                        ? ` – ${formatHomeDate(project["est completion"])}`
                        : ""
                    }`
                  : project["est completion"]
                    ? `Completes ${formatHomeDate(project["est completion"])}`
                    : "Not set"}
              </DetailField>
            </DetailFieldGrid>
          </section>
        </div>
      </main>
    </div>
  );
}
