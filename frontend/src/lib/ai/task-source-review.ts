import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TaskSummaryWidgetPayload } from "@/lib/ai/assistant-widgets";

type TaskSourceReviewRow = Record<string, unknown>;

export type TaskSourceReviewRequest = {
  taskTitle: string | null;
  dateScope: "today" | "recent";
};

export type TaskSourceReviewPacket = {
  request: TaskSourceReviewRequest;
  dateLabel: string;
  startIso: string;
  endIso: string;
  matchedTask: TaskSourceReviewRow | null;
  candidateCount: number;
  evidenceText: string;
  widget: TaskSummaryWidgetPayload | null;
  traceOutput: Record<string, unknown>;
};

const TASK_REVIEW_TERMS =
  /\b(task|tasks|action item|action items|follow-?up|follow-?ups|to-?do|to-?dos)\b/i;
const SOURCE_REVIEW_TERMS =
  /\b(meeting|transcript|source|context|discussion|review|actually|client|internal|team|owner)\b/i;
const CLASSIFICATION_TERMS =
  /\b(client|internal|our team|the team|owner|needs to|need to|actually|supposed to|responsible|responsibility)\b/i;
const TASK_WRITE_COMMAND_TERMS =
  /\b(remind me to|remind me about|add a task|add task|create a task|create task|make a task|log a task|log that I need to|flag (this |it )?for follow[- ]?up|throw (this |it )?on (my )?list|put (this |it )?on (my |the )?list|note for myself|action item:|get someone on|assign (this |that |it )?to|schedule a task|generate (a )?task|make (a )?task|add a task for)\b/i;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqTokens(value: string): string[] {
  return [...new Set(normalizeForMatch(value).split(" ").filter((token) => token.length > 2))];
}

function getEasternDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getEasternOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const value = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-05";
  const match = value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "-05:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${(match[3] ?? "00").padStart(2, "0")}`;
}

function addUtcDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return getEasternDateString(date);
}

function easternDayRange(date = new Date()) {
  const dateString = getEasternDateString(date);
  const nextDateString = addUtcDays(dateString, 1);
  const startOffset = getEasternOffset(new Date(`${dateString}T12:00:00Z`));
  const endOffset = getEasternOffset(new Date(`${nextDateString}T12:00:00Z`));
  return {
    dateString,
    startIso: new Date(`${dateString}T00:00:00${startOffset}`).toISOString(),
    endIso: new Date(`${nextDateString}T00:00:00${endOffset}`).toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
  };
}

export function extractTaskTitleFromReviewRequest(message: string): string | null {
  const quoted = message.match(/["“”']([^"“”']{12,240})["“”']/);
  if (quoted?.[1]) return quoted[1].trim();

  const named = message.match(
    /\b(?:named|called|titled)\s+(.+?)(?:\s+(?:can you|could you|please|from the|from this|in the|that was|created|generated|today)\b|[?.]|$)/i,
  );
  return named?.[1]?.trim() ?? null;
}

export function detectTaskSourceReviewRequest(message: string): TaskSourceReviewRequest | null {
  if (TASK_WRITE_COMMAND_TERMS.test(message)) return null;
  if (!TASK_REVIEW_TERMS.test(message)) return null;
  if (!SOURCE_REVIEW_TERMS.test(message)) return null;
  if (!CLASSIFICATION_TERMS.test(message)) return null;

  return {
    taskTitle: extractTaskTitleFromReviewRequest(message),
    dateScope: /\btoday\b/i.test(message) ? "today" : "recent",
  };
}

function taskTitle(row: TaskSourceReviewRow): string {
  return asString(row.title) ?? asString(row.description) ?? "Untitled task";
}

function taskProjectId(row: TaskSourceReviewRow): number | null {
  const metadata = asRecord(row.document_metadata);
  return typeof row.project_id === "number"
    ? row.project_id
    : typeof metadata.project_id === "number"
      ? metadata.project_id
      : null;
}

function projectMatches(row: TaskSourceReviewRow, selectedProjectId: number): boolean {
  const metadata = asRecord(row.document_metadata);
  const projectIds = Array.isArray(row.project_ids) ? row.project_ids : [];
  return (
    row.project_id === selectedProjectId ||
    metadata.project_id === selectedProjectId ||
    projectIds.includes(selectedProjectId)
  );
}

function scoreTaskMatch(row: TaskSourceReviewRow, requestedTitle: string | null): number {
  if (!requestedTitle) return 0.1;
  const requested = normalizeForMatch(requestedTitle);
  const title = normalizeForMatch(taskTitle(row));
  const description = normalizeForMatch(asString(row.description));
  const haystack = `${title} ${description}`;

  if (title === requested) return 1;
  if (title.includes(requested) || requested.includes(title)) return 0.92;

  const requestedTokens = uniqTokens(requested);
  if (requestedTokens.length === 0) return 0;
  const matches = requestedTokens.filter((token) => haystack.includes(token)).length;
  return matches / requestedTokens.length;
}

function pickBestTask(rows: TaskSourceReviewRow[], requestedTitle: string | null): TaskSourceReviewRow | null {
  if (rows.length === 0) return null;
  const scored = rows
    .map((row) => ({ row, score: scoreTaskMatch(row, requestedTitle) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  if (!requestedTitle) return best.row;
  return best.score >= 0.55 ? best.row : null;
}

function sourceTextForTask(row: TaskSourceReviewRow): string {
  const metadata = asRecord(row.document_metadata);
  return [
    asString(metadata.title) ? `Meeting/source title: ${asString(metadata.title)}` : null,
    asString(metadata.date) ? `Meeting/source date: ${asString(metadata.date)}` : null,
    asString(metadata.participants) ? `Participants: ${asString(metadata.participants)}` : null,
    asString(metadata.summary) ? `Summary: ${asString(metadata.summary)}` : null,
    asString(metadata.action_items) ? `Action items: ${asString(metadata.action_items)}` : null,
    asString(metadata.decisions) ? `Decisions: ${asString(metadata.decisions)}` : null,
    asString(metadata.bullet_points) ? `Bullet points: ${asString(metadata.bullet_points)}` : null,
    asString(metadata.notes) ? `Notes: ${asString(metadata.notes)}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function excerptAroundTask(sourceText: string, row: TaskSourceReviewRow): string {
  const compact = compactText(sourceText) ?? "";
  if (!compact) return "";
  const needles = [taskTitle(row), asString(row.description)]
    .map((value) => normalizeForMatch(value))
    .filter((value) => value.length >= 16);
  const normalized = normalizeForMatch(compact);
  const matchIndex = needles.reduce((found, needle) => {
    if (found >= 0) return found;
    return normalized.indexOf(needle.split(" ").slice(0, 8).join(" "));
  }, -1);

  if (matchIndex < 0) return compact.slice(0, 14000);
  const start = Math.max(0, matchIndex - 3500);
  return compact.slice(start, start + 14000);
}

function buildTaskWidget(row: TaskSourceReviewRow, dateLabel: string): TaskSummaryWidgetPayload {
  const metadata = asRecord(row.document_metadata);
  const project = asRecord(row.projects);
  const id = asString(row.id) ?? "matched-task";
  const projectId = taskProjectId(row);
  return {
    type: "task_summary",
    id: "task-source-review",
    title: "Matched task source review",
    subtitle: "Direct task row joined to its source meeting record",
    totalCount: 1,
    dateLabel,
    items: [
      {
        id,
        title: taskTitle(row),
        description: asString(row.description),
        status: asString(row.status),
        priority: asString(row.priority),
        dueDate: asString(row.due_date),
        assigneeName: asString(row.assignee_name) ?? asString(row.assignee_email),
        projectId,
        projectName: asString(project.name),
        sourceTitle: asString(metadata.title) ?? asString(row.file_name),
        sourceSystem: asString(row.source_system) ?? asString(metadata.source_system),
        sourceDate: asString(metadata.date) ?? asString(metadata.captured_at) ?? asString(metadata.created_at),
        createdAt: asString(row.created_at) ?? new Date().toISOString(),
        href: `${projectId ? `/${projectId}/tasks` : "/tasks"}?task=${encodeURIComponent(id)}`,
      },
    ],
  };
}

export function buildTaskSourceReviewPrompt(packet: TaskSourceReviewPacket): string {
  if (!packet.matchedTask) {
    return [
      "The user asked whether a generated task belongs to the internal team or the client.",
      "No matching task row was found. Answer plainly that the task/source could not be verified from public.tasks, and do not guess.",
      `Requested task title: ${packet.request.taskTitle ?? "not provided"}`,
      `Task rows searched: ${packet.candidateCount}`,
    ].join("\n");
  }

  const metadata = asRecord(packet.matchedTask.document_metadata);
  return [
    "You are reviewing one generated Tasks page row and its source meeting evidence.",
    "Answer the user's actual question: was this an internal Alleato/team task, a client/owner responsibility, or just a meeting outcome that should not have become an internal task?",
    "Be direct and concise. Start with the verdict. Then give the evidence and the recommended correction if the task ownership/category is wrong.",
    "Do not say you only checked the task table; you have the task row and source meeting evidence below.",
    "",
    "# Matched task row",
    JSON.stringify(
      {
        id: packet.matchedTask.id,
        title: packet.matchedTask.title,
        description: packet.matchedTask.description,
        assigneeName: packet.matchedTask.assignee_name,
        assigneeEmail: packet.matchedTask.assignee_email,
        dueDate: packet.matchedTask.due_date,
        status: packet.matchedTask.status,
        priority: packet.matchedTask.priority,
        projectId: taskProjectId(packet.matchedTask),
        createdAt: packet.matchedTask.created_at,
        sourceTitle: metadata.title,
        sourceDate: metadata.date ?? metadata.captured_at ?? metadata.created_at,
      },
      null,
      2,
    ),
    "",
    "# Source meeting evidence excerpt",
    packet.evidenceText || "No transcript/context text was stored on the source meeting record.",
  ].join("\n");
}

export async function loadTaskSourceReviewPacket(params: {
  supabase: SupabaseClient<Database>;
  selectedProjectId?: number | null;
  message: string;
}): Promise<TaskSourceReviewPacket | null> {
  const request = detectTaskSourceReviewRequest(params.message);
  if (!request) return null;

  const range = easternDayRange();
  const { data, error } = await params.supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      status,
      due_date,
      priority,
      project_id,
      project_ids,
      assignee_name,
      assignee_email,
      source_system,
      created_at,
      file_name,
      projects (id, name),
      document_metadata:tasks_metadata_id_fkey (
        id,
        title,
        source,
        source_system,
        type,
        category,
        date,
        captured_at,
        created_at,
        project_id,
        participants,
        action_items,
        decisions,
        bullet_points,
        notes,
        summary,
        fireflies_link,
        meeting_link,
        source_web_url
      )
    `)
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Task source review lookup failed: ${error.message}`);
  }

  const rows = ((data ?? []) as TaskSourceReviewRow[]).filter((row) =>
    params.selectedProjectId == null ? true : projectMatches(row, params.selectedProjectId),
  );
  const matchedTask = pickBestTask(rows, request.taskTitle);
  const sourceText = matchedTask ? sourceTextForTask(matchedTask) : "";
  const evidenceText = matchedTask ? excerptAroundTask(sourceText, matchedTask) : "";

  return {
    request,
    dateLabel: range.label,
    startIso: range.startIso,
    endIso: range.endIso,
    matchedTask,
    candidateCount: rows.length,
    evidenceText,
    widget: matchedTask ? buildTaskWidget(matchedTask, range.label) : null,
    traceOutput: {
      sourceOfTruth: "public.tasks joined to tasks_metadata_id_fkey document_metadata",
      requestedTaskTitle: request.taskTitle,
      startIso: range.startIso,
      endIso: range.endIso,
      candidateCount: rows.length,
      matchedTaskId: matchedTask ? asString(matchedTask.id) : null,
      matchedTaskTitle: matchedTask ? taskTitle(matchedTask) : null,
      sourceTitle: matchedTask ? asString(asRecord(matchedTask.document_metadata).title) : null,
      evidenceChars: evidenceText.length,
    },
  };
}
