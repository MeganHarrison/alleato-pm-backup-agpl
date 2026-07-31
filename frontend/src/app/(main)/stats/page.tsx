import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, SectionRuleHeading } from "@/components/layout";
import { KpiRow } from "@/components/ds";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";

export const metadata: Metadata = {
  title: "Today's Stats",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIME_ZONE = "America/Indiana/Indianapolis";
const MAX_LIST_ITEMS = 8;
const MAX_ACTIVITY_ROWS = 12;

type DocumentRecord = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "title"
  | "file_name"
  | "project"
  | "project_id"
  | "date"
  | "created_at"
  | "captured_at"
  | "duration_minutes"
  | "fireflies_link"
  | "source_web_url"
  | "url"
  | "category"
  | "type"
>;

type TaskProjectRef = {
  id: number;
  name: string | null;
  project_number: string | null;
};

type TaskRecord = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "status" | "created_at" | "project_id"
> & {
  project: TaskProjectRef | TaskProjectRef[] | null;
};

type MeetingItem = {
  id: string;
  title: string;
  at: string | null;
  durationMinutes: number | null;
  projectLabel: string | null;
  href: string;
};

type SourceItem = {
  id: string;
  title: string;
  at: string | null;
  projectLabel: string | null;
  href: string;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  at: string;
  projectId: number | null;
  projectLabel: string | null;
  href: string;
};

type ActivityGroup = {
  key: string;
  projectLabel: string;
  meetingCount: number;
  taskCount: number;
  emailCount: number;
  documentCount: number;
  teamsCount: number;
  latestAt: string | null;
  href: string;
};

function normalizeOffset(value: string) {
  if (value === "GMT" || value === "UTC") return "+00:00";
  const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return "+00:00";
  const [, sign, hourText, minuteText] = match;
  const hour = hourText.padStart(2, "0");
  const minute = (minuteText ?? "00").padStart(2, "0");
  return `${sign}${hour}:${minute}`;
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    offset: normalizeOffset(read("timeZoneName")),
  };
}

function getTodayKey(timeZone: string) {
  const { year, month, day } = getTimeZoneParts(new Date(), timeZone);
  return `${year}-${month}-${day}`;
}

function getTodayStartIso(timeZone: string) {
  const { year, month, day, offset } = getTimeZoneParts(new Date(), timeZone);
  return `${year}-${month}-${day}T00:00:00${offset}`;
}

function getDateKey(value: string | null | undefined, timeZone: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { year, month, day } = getTimeZoneParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

function formatLongDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatTime(value: string | null | undefined, timeZone: string) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeMoment(value: string | null | undefined, timeZone: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";
  const dayKey = getDateKey(value, timeZone);
  const todayKey = getTodayKey(timeZone);
  if (dayKey === todayKey) {
    return formatTime(value, timeZone);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function sentenceCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDocumentMoment(record: DocumentRecord) {
  return record.date ?? record.captured_at ?? record.created_at ?? null;
}

function isMeetingRecord(record: DocumentRecord) {
  return (
    record.category === "meeting" ||
    record.type === "meeting" ||
    record.type === "meeting_transcript"
  );
}

function getDocumentTitle(record: DocumentRecord) {
  return (
    record.title?.trim() ||
    record.file_name?.trim() ||
    sentenceCase(record.category ?? record.type)
  );
}

function sortByMomentDescending<T extends { at: string | null }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.at ? new Date(left.at).getTime() : 0;
    const rightTime = right.at ? new Date(right.at).getTime() : 0;
    return rightTime - leftTime;
  });
}

function sortMeetingsChronologically(items: MeetingItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.at ? new Date(left.at).getTime() : 0;
    const rightTime = right.at ? new Date(right.at).getTime() : 0;
    return leftTime - rightTime;
  });
}

function getMeetingHref(record: DocumentRecord) {
  if (record.project_id) {
    return `/${record.project_id}/meetings/${record.id}`;
  }
  return `/meetings/${record.id}`;
}

function getTaskProjectRef(project: TaskRecord["project"]): TaskProjectRef | null {
  if (!project) return null;
  if (Array.isArray(project)) {
    return project[0] ?? null;
  }
  return project;
}

function buildProjectLabel(projectId: number | null, name: string | null, projectNumber?: string | null) {
  const trimmedName = name?.trim() ?? null;
  const trimmedNumber = projectNumber?.trim() ?? null;
  if (trimmedNumber && trimmedName) return `${trimmedNumber} - ${trimmedName}`;
  if (trimmedName) return trimmedName;
  if (trimmedNumber) return trimmedNumber;
  if (projectId) return `Project ${projectId}`;
  return null;
}

function buildEmailHref(projectId: number | null) {
  return projectId ? `/${projectId}/emails` : "/emails";
}

function buildDocumentHref(projectId: number | null) {
  return projectId ? `/${projectId}/documents` : "/documents";
}

function buildTeamsHref() {
  return "/teams-conversations";
}

function buildTaskHref(projectId: number | null) {
  return projectId ? `/${projectId}/tasks` : "/tasks";
}

function buildProjectHref(projectId: number | null) {
  return projectId ? `/${projectId}/home` : "/projects";
}

function buildActivitySummary(group: ActivityGroup) {
  const parts = [
    group.meetingCount > 0 ? countLabel(group.meetingCount, "meeting") : null,
    group.taskCount > 0 ? countLabel(group.taskCount, "task") : null,
    group.emailCount > 0 ? countLabel(group.emailCount, "email") : null,
    group.documentCount > 0 ? countLabel(group.documentCount, "document") : null,
    group.teamsCount > 0 ? countLabel(group.teamsCount, "Teams message") : null,
  ].filter(Boolean);

  return parts.join(", ");
}

function EmptySection({ message }: { message: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{message}</p>;
}

function SectionLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary">
      Open
    </Link>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionRuleHeading label={title} actions={<SectionLink href={href} />} />
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

async function loadDailyStats() {
    const todayStartIso = getTodayStartIso(TIME_ZONE);
  const todayKey = getTodayKey(TIME_ZONE);
  const todayWindowFilter = `date.gte.${todayStartIso},created_at.gte.${todayStartIso},captured_at.gte.${todayStartIso}`;

  const [
    meetingsCountResult,
    emailsCountResult,
    documentsCountResult,
    teamsCountResult,
    tasksCountResult,
    recordsResult,
    tasksResult,
  ] = await Promise.all([
    serviceDb.from("document_metadata")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .or("type.eq.meeting,category.eq.meeting,type.eq.meeting_transcript")
      .or(todayWindowFilter),
    serviceDb.from("document_metadata")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("category", "email")
      .or(todayWindowFilter),
    serviceDb.from("document_metadata")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("category", "document")
      .or(todayWindowFilter),
    serviceDb.from("document_metadata")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("category", "teams_message")
      .or(todayWindowFilter),
    serviceDb.from("tasks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStartIso),
    serviceDb.from("document_metadata")
      .select(
        "id,title,file_name,project,project_id,date,created_at,captured_at,duration_minutes,fireflies_link,source_web_url,url,category,type",
      )
      .is("deleted_at", null)
      .or(
        "type.eq.meeting,category.eq.meeting,type.eq.meeting_transcript,category.eq.email,category.eq.document,category.eq.teams_message",
      )
      .or(todayWindowFilter)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(250),
    serviceDb.from("tasks")
      .select("id,title,status,created_at,project_id,project:projects(id,name,project_number)")
      .gte("created_at", todayStartIso)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  if (meetingsCountResult.error) {
    throw new Error(`Failed to load today's meeting count: ${meetingsCountResult.error.message}`);
  }
  if (emailsCountResult.error) {
    throw new Error(`Failed to load today's email count: ${emailsCountResult.error.message}`);
  }
  if (documentsCountResult.error) {
    throw new Error(`Failed to load today's document count: ${documentsCountResult.error.message}`);
  }
  if (teamsCountResult.error) {
    throw new Error(`Failed to load today's Teams count: ${teamsCountResult.error.message}`);
  }
  if (tasksCountResult.error) {
    throw new Error(`Failed to load today's task count: ${tasksCountResult.error.message}`);
  }
  if (recordsResult.error) {
    throw new Error(`Failed to load today's source records: ${recordsResult.error.message}`);
  }
  if (tasksResult.error) {
    throw new Error(`Failed to load today's tasks: ${tasksResult.error.message}`);
  }

  const allRecords = ((recordsResult.data ?? []) as DocumentRecord[]).filter(
    (record) => getDateKey(getDocumentMoment(record), TIME_ZONE) === todayKey,
  );

  const meetings = sortMeetingsChronologically(
    allRecords
      .filter(isMeetingRecord)
      .map((record) => ({
        id: record.id,
        title: getDocumentTitle(record),
        at: getDocumentMoment(record),
        durationMinutes: record.duration_minutes,
        projectLabel: buildProjectLabel(record.project_id, record.project),
        href: getMeetingHref(record),
      })),
  ).slice(0, MAX_LIST_ITEMS);

  const emails = sortByMomentDescending(
    allRecords
      .filter((record) => record.category === "email")
      .map((record) => ({
        id: record.id,
        title: getDocumentTitle(record),
        at: getDocumentMoment(record),
        projectLabel: buildProjectLabel(record.project_id, record.project),
        href: buildEmailHref(record.project_id),
      })),
  ).slice(0, MAX_LIST_ITEMS);

  const documents = sortByMomentDescending(
    allRecords
      .filter((record) => record.category === "document")
      .map((record) => ({
        id: record.id,
        title: getDocumentTitle(record),
        at: getDocumentMoment(record),
        projectLabel: buildProjectLabel(record.project_id, record.project),
        href: buildDocumentHref(record.project_id),
      })),
  ).slice(0, MAX_LIST_ITEMS);

  const teamsMessages = sortByMomentDescending(
    allRecords
      .filter((record) => record.category === "teams_message")
      .map((record) => ({
        id: record.id,
        title: getDocumentTitle(record),
        at: getDocumentMoment(record),
        projectLabel: buildProjectLabel(record.project_id, record.project),
        href: buildTeamsHref(),
      })),
  ).slice(0, MAX_LIST_ITEMS);

  const tasks = ((tasksResult.data ?? []) as TaskRecord[])
    .filter((task) => getDateKey(task.created_at, TIME_ZONE) === todayKey)
    .map((task) => {
      const project = getTaskProjectRef(task.project);
      const projectLabel = buildProjectLabel(
        task.project_id,
        project?.name ?? null,
        project?.project_number ?? null,
      );

      return {
        id: task.id,
        title: task.title?.trim() || "Untitled task",
        status: sentenceCase(task.status),
        at: task.created_at,
        projectId: task.project_id,
        projectLabel,
        href: buildTaskHref(task.project_id),
      } satisfies TaskItem;
    })
    .slice(0, MAX_LIST_ITEMS);

  const activityMap = new Map<string, ActivityGroup>();

  const ensureGroup = (
    projectId: number | null,
    projectLabel: string | null,
    href: string,
  ) => {
    const key = projectId ? `project:${projectId}` : `project:${projectLabel ?? "unlinked"}`;
    const existing = activityMap.get(key);
    if (existing) return existing;
    const created: ActivityGroup = {
      key,
      projectLabel: projectLabel ?? "Unlinked activity",
      meetingCount: 0,
      taskCount: 0,
      emailCount: 0,
      documentCount: 0,
      teamsCount: 0,
      latestAt: null,
      href,
    };
    activityMap.set(key, created);
    return created;
  };

  for (const record of allRecords) {
    const at = getDocumentMoment(record);
    const projectLabel = buildProjectLabel(record.project_id, record.project);
    const group = ensureGroup(
      record.project_id,
      projectLabel,
      buildProjectHref(record.project_id),
    );

    if (isMeetingRecord(record)) group.meetingCount += 1;
    else if (record.category === "email") group.emailCount += 1;
    else if (record.category === "document") group.documentCount += 1;
    else if (record.category === "teams_message") group.teamsCount += 1;

    if (!group.latestAt || (at && new Date(at).getTime() > new Date(group.latestAt).getTime())) {
      group.latestAt = at;
    }
  }

  for (const task of tasks) {
    const group = ensureGroup(
      task.projectId,
      task.projectLabel,
      buildProjectHref(task.projectId),
    );
    group.taskCount += 1;
    if (!group.latestAt || new Date(task.at).getTime() > new Date(group.latestAt).getTime()) {
      group.latestAt = task.at;
    }
  }

  const projectActivity = [...activityMap.values()]
    .filter(
      (group) =>
        group.meetingCount +
          group.taskCount +
          group.emailCount +
          group.documentCount +
          group.teamsCount >
        0,
    )
    .sort((left, right) => {
      const leftTotal =
        left.meetingCount +
        left.taskCount +
        left.emailCount +
        left.documentCount +
        left.teamsCount;
      const rightTotal =
        right.meetingCount +
        right.taskCount +
        right.emailCount +
        right.documentCount +
        right.teamsCount;

      if (rightTotal !== leftTotal) return rightTotal - leftTotal;
      const leftTime = left.latestAt ? new Date(left.latestAt).getTime() : 0;
      const rightTime = right.latestAt ? new Date(right.latestAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, MAX_ACTIVITY_ROWS);

  return {
    counts: {
      meetings: meetingsCountResult.count ?? meetings.length,
      tasks: tasksCountResult.count ?? tasks.length,
      emails: emailsCountResult.count ?? emails.length,
      documents: documentsCountResult.count ?? documents.length,
      teamsMessages: teamsCountResult.count ?? teamsMessages.length,
      activeProjects: projectActivity.length,
    },
    meetings,
    tasks,
    emails,
    documents,
    teamsMessages,
    projectActivity,
  };
}

function MeetingRows({ items }: { items: MeetingItem[] }) {
  if (items.length === 0) {
    return <EmptySection message="No meetings recorded today." />;
  }

  return items.map((meeting) => (
    <div key={meeting.id} className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <Link href={meeting.href} className="block text-sm font-medium text-foreground hover:text-primary">
          {meeting.title}
        </Link>
        <div className="text-xs text-muted-foreground">
          {meeting.projectLabel ?? "No project linked"}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <div>{formatTime(meeting.at, TIME_ZONE)}</div>
        {formatDuration(meeting.durationMinutes) ? (
          <div>{formatDuration(meeting.durationMinutes)}</div>
        ) : null}
      </div>
    </div>
  ));
}

function TaskRows({ items }: { items: TaskItem[] }) {
  if (items.length === 0) {
    return <EmptySection message="No tasks were generated today." />;
  }

  return items.map((task) => (
    <div key={task.id} className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <Link href={task.href} className="block text-sm font-medium text-foreground hover:text-primary">
          {task.title}
        </Link>
        <div className="text-xs text-muted-foreground">
          {task.projectLabel ?? "No project linked"}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <div>{task.status}</div>
        <div>{formatRelativeMoment(task.at, TIME_ZONE)}</div>
      </div>
    </div>
  ));
}

function SourceRows({
  items,
  emptyMessage,
}: {
  items: SourceItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <EmptySection message={emptyMessage} />;
  }

  return items.map((item) => (
    <div key={item.id} className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <Link href={item.href} className="block text-sm font-medium text-foreground hover:text-primary">
          {item.title}
        </Link>
        <div className="text-xs text-muted-foreground">
          {item.projectLabel ?? "No project linked"}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {formatRelativeMoment(item.at, TIME_ZONE)}
      </div>
    </div>
  ));
}

function ProjectActivityRows({ items }: { items: ActivityGroup[] }) {
  if (items.length === 0) {
    return <EmptySection message="No project activity has been captured today." />;
  }

  return items.map((group) => (
    <div key={group.key} className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 space-y-1">
        <Link href={group.href} className="block text-sm font-medium text-foreground hover:text-primary">
          {group.projectLabel}
        </Link>
        <div className="text-xs text-muted-foreground">{buildActivitySummary(group)}</div>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        {formatRelativeMoment(group.latestAt, TIME_ZONE)}
      </div>
    </div>
  ));
}

export default async function TodayStatsPage() {
  const dailyStats = await loadDailyStats();

  return (
    <PageShell
      variant="dashboard"
      title="Today's Stats"
      eyebrow={formatLongDate(new Date(), TIME_ZONE)}
    >
      <div className="space-y-10">
        <KpiRow
          size="small"
          metrics={[
            {
              label: "Meetings",
              value: dailyStats.counts.meetings.toLocaleString(),
              context: "Recorded today",
            },
            {
              label: "Tasks",
              value: dailyStats.counts.tasks.toLocaleString(),
              context: "Generated today",
            },
            {
              label: "Emails",
              value: dailyStats.counts.emails.toLocaleString(),
              context: "Synced today",
            },
            {
              label: "Documents",
              value: dailyStats.counts.documents.toLocaleString(),
              context: "Synced today",
            },
            {
              label: "Teams",
              value: dailyStats.counts.teamsMessages.toLocaleString(),
              context: "Messages synced today",
            },
            {
              label: "Projects",
              value: dailyStats.counts.activeProjects.toLocaleString(),
              context: "With activity today",
            },
          ]}
        />

        <Section title="Project Activity" href="/projects">
          <ProjectActivityRows items={dailyStats.projectActivity} />
        </Section>

        <div className="grid gap-10 xl:grid-cols-2">
          <Section title="Meetings" href="/meetings">
            <MeetingRows items={dailyStats.meetings} />
          </Section>

          <Section title="Tasks Generated" href="/tasks">
            <TaskRows items={dailyStats.tasks} />
          </Section>

          <Section title="Emails Synced" href="/emails">
            <SourceRows
              items={dailyStats.emails}
              emptyMessage="No emails have been synced today."
            />
          </Section>

          <Section title="Documents Synced" href="/documents">
            <SourceRows
              items={dailyStats.documents}
              emptyMessage="No documents have been synced today."
            />
          </Section>

          <Section title="Teams Messages" href="/teams-conversations">
            <SourceRows
              items={dailyStats.teamsMessages}
              emptyMessage="No Teams messages have been synced today."
            />
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
