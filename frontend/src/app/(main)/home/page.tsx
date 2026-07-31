"use client";

import * as React from "react";
import Link from "next/link";

import { DetailThreeColumnGrid, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useCollaborationNotifications } from "@/hooks/use-collaboration-notifications";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import {
  AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
  isAiApprovalQueueNotification,
} from "@/lib/collaboration/ai-approval-queue";
import { shouldInterruptAiWidget } from "@/lib/collaboration/ai-notification-routing";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getHomeAiApprovalMeta } from "./home-action-routing";
import type {
  HomeOutlookCalendarMeeting,
  HomeOutlookCalendarResponse,
} from "@/app/api/home/outlook-calendar/types";

type ProjectRow = {
  id: number | string;
  name: string | null;
  client?: string | null;
  phase?: string | null;
  state?: string | null;
  "job number"?: string | number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type ProjectsResponse = {
  data?: ProjectRow[];
  meta?: {
    isAdmin?: boolean;
  };
};

type TaskRow = {
  id: string | null;
  title: string | null;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  project_id: number | null;
  project_name: string | null;
  source_system: string | null;
  source_title: string | null;
  source_date: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type TasksResponse = {
  data?: TaskRow[];
};

type LoadState = {
  projects: ProjectRow[];
  tasks: TaskRow[];
  isAdmin: boolean;
};

type ActionRowProps = {
  title: string;
  meta?: string;
  href?: string;
  actionLabel?: string | null;
  muted?: boolean;
  eyebrow?: string;
};

const OPEN_TASK_STATUSES = new Set([
  "open",
  "todo",
  "new",
  "pending",
  "in_progress",
]);
const HOME_REQUIRED_SECTIONS = [
  "Upcoming meetings",
  "Work queue",
  "Resume projects",
  "Review queue",
  "Recent movement",
] as const;

function isOpenTask(task: TaskRow): boolean {
  const status = task.status?.trim().toLowerCase();
  return !status || OPEN_TASK_STATUSES.has(status);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function meetingTimeRange(meeting: HomeOutlookCalendarMeeting): string {
  if (meeting.isAllDay) {
    return `${formatDate(meeting.startDateTime) ?? "Upcoming"} · All day`;
  }

  const startDate = formatDate(meeting.startDateTime);
  const startTime = formatTime(meeting.startDateTime);
  const endTime = formatTime(meeting.endDateTime);

  return [
    startDate,
    startTime && endTime ? `${startTime} - ${endTime}` : startTime,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function meetingMeta(meeting: HomeOutlookCalendarMeeting): string {
  return [
    meeting.location,
    meeting.organizerName ? `Organizer: ${meeting.organizerName}` : null,
    meeting.attendeeCount > 0
      ? `${meeting.attendeeCount} attendee${meeting.attendeeCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function startsTodayOrLater(value: string | null | undefined): boolean {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const meetingDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return meetingDay.getTime() >= today.getTime();
}

function isDueTodayOrEarlier(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return dueDay.getTime() <= todayDay.getTime();
}

function getProjectId(project: ProjectRow): string {
  return String(project.id);
}

function getProjectJobNumber(project: ProjectRow): string | null {
  const value = project["job number"];
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function taskTitle(task: TaskRow): string {
  return task.title?.trim() || task.description?.trim() || "Untitled task";
}

function taskMeta(task: TaskRow): string {
  return [
    task.project_name,
    task.due_date ? `Due ${formatDate(task.due_date) ?? task.due_date}` : null,
    task.source_system ? `Source: ${task.source_system}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function projectMeta(project: ProjectRow): string {
  return [
    getProjectJobNumber(project) ? `#${getProjectJobNumber(project)}` : null,
    project.client,
    project.phase,
    project.updated_at
      ? `Updated ${formatDate(project.updated_at) ?? project.updated_at}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <HomePanel eyebrow={title} action={action}>
      <div className={cn("min-w-0", className)}>{children}</div>
    </HomePanel>
  );
}

function RowList({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: string;
}) {
  const items = React.Children.toArray(children).filter(Boolean);

  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {empty ?? "Nothing needs attention from this source right now."}
      </p>
    );
  }

  return <div className="divide-y divide-border/50">{items}</div>;
}

function ActionRow({
  title,
  meta,
  href,
  actionLabel = "Open",
  muted,
  eyebrow,
}: ActionRowProps) {
  const content = (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <p
          className={cn(
            "truncate text-sm font-medium",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {meta}
          </p>
        ) : null}
      </div>
      {href && actionLabel ? (
        <span className="shrink-0 text-xs font-medium text-primary">
          {actionLabel}
        </span>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block rounded-md transition-colors hover:bg-muted/40"
    >
      {content}
    </Link>
  );
}

function EmptyQueueAction({
  title,
  meta,
  href,
  actionLabel,
}: {
  title: string;
  meta: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">{meta}</p>
      <ActionRow title={title} href={href} actionLabel={actionLabel} />
    </div>
  );
}

function HomePanel({
  eyebrow,
  action,
  children,
}: {
  eyebrow: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
        {action}
      </div>
      <div className="border-t border-border/50">{children}</div>
    </section>
  );
}

function OutlookMeetingRow({
  meeting,
}: {
  meeting: HomeOutlookCalendarMeeting;
}) {
  const meta = meetingMeta(meeting);

  return (
    <div className="flex min-h-16 items-center gap-4 px-5 py-3">
      <div className="w-28 shrink-0 text-sm font-medium text-foreground">
        {meeting.isAllDay
          ? "All day"
          : formatTime(meeting.startDateTime) || "Upcoming"}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {meeting.subject || "Untitled meeting"}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(meeting.startDateTime)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[meetingTimeRange(meeting), meta].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
        {meeting.joinUrl ? (
          <a
            href={meeting.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary transition-colors hover:text-primary/80"
          >
            Join
          </a>
        ) : null}
        {meeting.webLink ? (
          <a
            href={meeting.webLink}
            target="_blank"
            rel="noreferrer"
            className="text-primary transition-colors hover:text-primary/80"
          >
            Outlook
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function HomeActionDashboardPage() {
  const { profile } = useCurrentUserProfile();
  const {
    notifications: aiApprovalNotifications,
    isLoading: isLoadingAiApprovals,
  } = useCollaborationNotifications({
    kind: AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
    unreadOnly: true,
    limit: 10,
  });
  const [state, setState] = React.useState<LoadState>({
    projects: [],
    tasks: [],
    isAdmin: false,
  });
  const [calendarState, setCalendarState] =
    React.useState<HomeOutlookCalendarResponse | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [projectsResponse, tasksResponse] = await Promise.all([
          apiFetch<ProjectsResponse>(
            "/api/projects?archived=false&page=1&limit=8&includeClient=true",
            { cache: "no-store" },
          ),
          apiFetch<TasksResponse>("/api/tasks?scope=mine", {
            cache: "no-store",
          }),
        ]);

        if (!isMounted) return;

        setState({
          projects: Array.isArray(projectsResponse.data)
            ? projectsResponse.data
            : [],
          tasks: Array.isArray(tasksResponse.data) ? tasksResponse.data : [],
          isAdmin: projectsResponse.meta?.isAdmin === true,
        });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Homepage data could not be loaded.";
        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadCalendar() {
      setIsCalendarLoading(true);

      try {
        const response = await apiFetch<HomeOutlookCalendarResponse>(
          "/api/home/outlook-calendar",
          { cache: "no-store" },
        );

        if (isMounted) {
          setCalendarState(response);
        }
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Outlook Calendar could not be loaded.";
        setCalendarState({
          ok: false,
          source: "microsoft-graph-live",
          error: message,
          window: {
            startIso: new Date().toISOString(),
            endIso: new Date().toISOString(),
          },
        });
      } finally {
        if (isMounted) {
          setIsCalendarLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      isMounted = false;
    };
  }, []);

  const openTasks = React.useMemo(
    () => state.tasks.filter(isOpenTask).slice(0, 5),
    [state.tasks],
  );

  const todayTasks = React.useMemo(
    () =>
      openTasks
        .filter((task) => isDueTodayOrEarlier(task.due_date))
        .slice(0, 3),
    [openTasks],
  );

  const aiApprovalCount = React.useMemo(
    () => aiApprovalNotifications.filter(isAiApprovalQueueNotification).length,
    [aiApprovalNotifications],
  );

  const interruptingAiApprovalCount = React.useMemo(
    () =>
      aiApprovalNotifications.filter(
        (notification) =>
          isAiApprovalQueueNotification(notification) &&
          shouldInterruptAiWidget(notification),
      ).length,
    [aiApprovalNotifications],
  );

  const aiApprovalMeta = getHomeAiApprovalMeta({
    isLoading: isLoadingAiApprovals,
    aiApprovalCount,
    interruptCount: interruptingAiApprovalCount,
  });

  const recentActivity = React.useMemo(() => {
    const taskItems = state.tasks.slice(0, 3).map((task) => ({
      key: `task-${task.id}`,
      title: taskTitle(task),
      meta: [
        "Task",
        task.project_name,
        formatDate(task.updated_at ?? task.created_at),
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · "),
      href: task.project_id ? `/${task.project_id}/tasks` : "/tasks",
      timestamp: task.updated_at ?? task.created_at,
    }));

    const projectItems = state.projects.slice(0, 3).map((project) => ({
      key: `project-${getProjectId(project)}`,
      title: project.name ?? `Project #${getProjectId(project)}`,
      meta: [
        "Project",
        project.client,
        formatDate(project.updated_at ?? project.created_at),
      ]
        .filter((value): value is string => Boolean(value))
        .join(" · "),
      href: `/${getProjectId(project)}/home`,
      timestamp: project.updated_at ?? project.created_at,
    }));

    return [...taskItems, ...projectItems]
      .sort((left, right) => {
        const leftTime = left.timestamp
          ? new Date(left.timestamp).getTime()
          : 0;
        const rightTime = right.timestamp
          ? new Date(right.timestamp).getTime()
          : 0;
        return rightTime - leftTime;
      })
      .slice(0, 5);
  }, [state.projects, state.tasks]);

  const visibleMeetings = React.useMemo(
    () =>
      calendarState?.ok
        ? calendarState.meetings
            .filter((meeting) => startsTodayOrLater(meeting.startDateTime))
            .slice(0, 8)
        : [],
    [calendarState],
  );

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = profile?.fullName?.trim().split(/\s+/)[0] || "there";

  return (
    <PageShell
      variant="dashboard"
      title="Home"
      showHeader={false}
      contentClassName="space-y-5"
      containerPaddingClassName="px-4 sm:px-6 lg:px-8 pt-6 pb-10"
    >
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {greeting}, {firstName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/daily-briefs">+ Daily report</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/accounting">Code expenses</Link>
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="space-y-2 bg-danger-subtle p-4 text-sm text-danger"
        >
          <p className="font-medium">Homepage data failed to load.</p>
          <p className="mt-1 text-muted-foreground">{errorMessage}</p>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-11 px-0 text-danger hover:text-danger"
          >
            Reload home
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Loading homepage actions.
        </p>
      ) : null}

      <DetailThreeColumnGrid className="gap-y-5 lg:gap-x-5">
        <div className="min-w-0 space-y-5">
          <Section
            title="My projects"
            action={
              <Link href="/" className="text-sm font-medium text-primary">
                Portfolio
              </Link>
            }
          >
            <RowList empty="No active projects were returned for this user.">
              {state.projects.slice(0, 6).map((project) => {
                const projectId = getProjectId(project);
                return (
                  <ActionRow
                    key={projectId}
                    title={project.name ?? `Project #${projectId}`}
                    meta={projectMeta(project)}
                    href={`/${projectId}/home`}
                    actionLabel={null}
                  />
                );
              })}
            </RowList>
          </Section>

          <Section title="Open items">
            <RowList>
              <ActionRow
                title="AI approvals"
                meta={aiApprovalMeta}
                href="/ai/approvals"
                actionLabel="Review"
              />
              <ActionRow
                title="AI profile"
                meta="Review what AI can use for role, memory, and approval context."
                href="/ai/profile"
                actionLabel="Manage"
              />
              <ActionRow
                title="AI actions"
                meta="Open the assistant action catalog and chat workspace."
                href="/ai"
                actionLabel="Open"
              />
              <ActionRow
                title="Daily Briefs"
                meta="Review the canonical source-backed Daily Executive Brief."
                href="/daily-briefs"
                actionLabel="Review"
              />
              <ActionRow
                title="Assignment inbox"
                meta="Open the shared assignment queue."
                href="/assignment-inbox"
                actionLabel="View"
              />
              <ActionRow
                title="Notifications"
                meta="Open the notification center."
                href="/notifications"
                actionLabel="View"
              />
            </RowList>
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section
            title={`Tasks · ${todayTasks.length} due today`}
            action={
              <Link href="/tasks" className="text-sm font-medium text-primary">
                All tasks
              </Link>
            }
          >
            {todayTasks.length > 0 ? (
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Due now
                  </p>
                  <RowList>
                    {todayTasks.map((task) => (
                      <ActionRow
                        key={task.id}
                        title={taskTitle(task)}
                        meta={taskMeta(task)}
                        href={
                          task.project_id
                            ? `/${task.project_id}/tasks`
                            : "/tasks"
                        }
                        actionLabel="Open"
                      />
                    ))}
                  </RowList>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Open assignments
                  </p>
                  <RowList empty="No other open assigned tasks were returned.">
                    {openTasks
                      .filter((task) => !todayTasks.includes(task))
                      .slice(0, 4)
                      .map((task) => (
                        <ActionRow
                          key={task.id}
                          title={taskTitle(task)}
                          meta={taskMeta(task)}
                          href={
                            task.project_id
                              ? `/${task.project_id}/tasks`
                              : "/tasks"
                          }
                          actionLabel="Open"
                        />
                      ))}
                  </RowList>
                </div>
              </div>
            ) : (
              <RowList>
                {openTasks.map((task) => (
                  <ActionRow
                    key={task.id}
                    title={taskTitle(task)}
                    meta={taskMeta(task)}
                    href={
                      task.project_id ? `/${task.project_id}/tasks` : "/tasks"
                    }
                    actionLabel="Open"
                  />
                ))}
                {openTasks.length === 0 ? (
                  <EmptyQueueAction
                    title="Open all tasks"
                    meta="No open assigned tasks came back from your task feed."
                    href="/tasks"
                    actionLabel="Review"
                  />
                ) : null}
              </RowList>
            )}
          </Section>

          <Section title="Card expenses · To code">
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="font-medium text-foreground">
                Card-expense transactions are not connected to Home yet.
              </p>
              <p className="text-muted-foreground">
                This workflow will appear here when its company-level
                transaction source is available.
              </p>
              <Link
                href="/accounting"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
              >
                Open accounting →
              </Link>
            </div>
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section title="Today’s schedule">
            {isCalendarLoading ? (
              <p className="py-4 text-sm text-muted-foreground">
                Checking Outlook Calendar.
              </p>
            ) : calendarState?.ok ? (
              <RowList empty="No upcoming Outlook meetings in the next 7 days.">
                {visibleMeetings.map((meeting) => (
                  <OutlookMeetingRow key={meeting.id} meeting={meeting} />
                ))}
              </RowList>
            ) : (
              <div role="status" className="py-4 text-sm">
                <p className="font-medium text-foreground">
                  Outlook Calendar is not available.
                </p>
                <p className="mt-1 text-muted-foreground">
                  {calendarState?.error ??
                    "Microsoft Graph calendar data could not be loaded."}
                </p>
              </div>
            )}
          </Section>
          <HomePanel eyebrow="Announcements">
            <div className="space-y-2 px-5 py-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Company announcements are not connected to Home yet.
              </p>
              <p>
                This space stays intentionally empty until there is an owned
                company-announcement source.
              </p>
            </div>
          </HomePanel>
          <HomePanel
            eyebrow="Knowledge base"
            action={
              <Link
                href="/knowledge/app"
                className="text-xs font-medium text-primary"
              >
                Browse →
              </Link>
            }
          >
            <RowList>
              <ActionRow
                title="Safety and compliance"
                meta="Company knowledge"
                href="/knowledge/app"
                actionLabel={null}
              />
              <ActionRow
                title="Process documentation"
                meta="Company knowledge"
                href="/knowledge/app"
                actionLabel={null}
              />
              <ActionRow
                title="Technical references"
                meta="Company knowledge"
                href="/knowledge/app"
                actionLabel={null}
              />
            </RowList>
          </HomePanel>
        </div>
      </DetailThreeColumnGrid>
    </PageShell>
  );
}
