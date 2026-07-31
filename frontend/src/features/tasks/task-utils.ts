import type { Database } from "@/types/database.types";

type TaskTableRow = Database["public"]["Tables"]["tasks"]["Row"];
type ProjectMeta = {
  id: number | null;
  name: string | null;
};
type SourceMeta = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "title"
  | "type"
  | "source"
  | "source_system"
  | "url"
  | "source_web_url"
  | "fireflies_link"
  | "meeting_link"
  | "project_id"
  | "date"
  | "captured_at"
  | "created_at"
  | "content"
  | "raw_text"
  | "summary"
  | "action_items"
  | "bullet_points"
  | "notes"
>;

export type JoinedTaskRow = TaskTableRow & {
  projects?: ProjectMeta | null;
  document_metadata?: SourceMeta | null;
};

export interface TasksRow {
  id: string | null;
  metadata_id: string | null;
  segment_id: string | null;
  source_chunk_id: string | null;
  schedule_task_id: string | null;
  description: string | null;
  assignee_person_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  meeting_title: string | null;
  project_id: number | null;
  project_name: string | null;
  client_id: number | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  source_system: string | null;
  embedding: unknown;
  created_at: string | null;
  updated_at: string | null;
  project_ids: number[] | null;
  file_name: string | null;
  source_title: string | null;
  source_type: string | null;
  source_date: string | null;
  source_url: string | null;
  source_web_url: string | null;
  fireflies_link: string | null;
  meeting_link: string | null;
  source_context: string | null;
  title: string | null;
  assigned_by: string | null;
  extraction_source: string | null;
  extraction_model: string | null;
  extraction_prompt_version: string | null;
  extraction_metadata: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[_-]+/g, " ").trim();
  return normalized ? titleCase(normalized) : null;
}

function nullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "null" || normalized.toLowerCase() === "none") {
    return null;
  }
  return normalized;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSourceContextWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactTextWithOriginalIndices(value: string): { text: string; originalIndices: number[] } {
  let text = "";
  const originalIndices: number[] = [];
  let pendingWhitespaceIndex: number | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (/\s/.test(char)) {
      if (text.length > 0 && pendingWhitespaceIndex === null) {
        pendingWhitespaceIndex = index;
      }
      continue;
    }

    if (pendingWhitespaceIndex !== null) {
      text += " ";
      originalIndices.push(pendingWhitespaceIndex);
      pendingWhitespaceIndex = null;
    }

    text += char;
    originalIndices.push(index);
  }

  return { text, originalIndices };
}

function textFromJsonish(value: unknown): string | null {
  if (typeof value === "string") return nullableText(value);
  if (value == null) return null;

  try {
    return nullableText(JSON.stringify(value));
  } catch {
    return null;
  }
}

const SOURCE_CONTEXT_FALLBACK_CHARS = 5000;
const SOURCE_CONTEXT_BEFORE_MATCH_CHARS = 800;
const SOURCE_CONTEXT_AFTER_MATCH_CHARS = 4200;

function excerptAroundNeedle(sourceText: string | null, needles: Array<string | null | undefined>): string | null {
  if (!sourceText) return null;
  const source = normalizeSourceContextWhitespace(sourceText);
  if (!source) return null;

  const compactedSource = compactTextWithOriginalIndices(source);
  const normalized = compactedSource.text.toLowerCase();
  const meaningfulNeedles = needles
    .map((needle) => compactText(needle ?? ""))
    .filter((needle) => needle.length >= 12)
    .sort((left, right) => right.length - left.length);

  let matchIndex = -1;
  for (const needle of meaningfulNeedles) {
    matchIndex = normalized.indexOf(needle.toLowerCase());
    if (matchIndex >= 0) break;

    const firstWords = needle.split(" ").filter(Boolean).slice(0, 6).join(" ");
    if (firstWords.length >= 12) {
      matchIndex = normalized.indexOf(firstWords.toLowerCase());
      if (matchIndex >= 0) break;
    }
  }

  if (matchIndex < 0) {
    return source.length > SOURCE_CONTEXT_FALLBACK_CHARS
      ? `${source.slice(0, SOURCE_CONTEXT_FALLBACK_CHARS).trim()}...`
      : source;
  }

  const start = Math.max(0, matchIndex - SOURCE_CONTEXT_BEFORE_MATCH_CHARS);
  const end = Math.min(compactedSource.text.length, matchIndex + SOURCE_CONTEXT_AFTER_MATCH_CHARS);
  const originalStart = compactedSource.originalIndices[start] ?? 0;
  const originalEnd = end >= compactedSource.text.length
    ? source.length
    : compactedSource.originalIndices[end] ?? source.length;
  const prefix = start > 0 ? "... " : "";
  const suffix = end < compactedSource.text.length ? " ..." : "";

  return normalizeSourceContextWhitespace(`${prefix}${source.slice(originalStart, originalEnd).trim()}${suffix}`);
}

function buildTaskSourceContext(task: JoinedTaskRow): string | null {
  const metadata = task.document_metadata;
  if (!metadata) return null;

  const sourceText = [
    metadata.action_items,
    metadata.summary,
    metadata.bullet_points,
    metadata.content,
    metadata.raw_text,
    metadata.notes,
  ]
    .map(textFromJsonish)
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  return excerptAroundNeedle(sourceText, [task.description, task.title]);
}

function sourceDateFromMetadata(metadata: SourceMeta | null | undefined): string | null {
  return metadata?.date ?? metadata?.captured_at ?? metadata?.created_at ?? null;
}

export function mapTaskRow(task: JoinedTaskRow): TasksRow {
  return {
    id: task.id ?? null,
    metadata_id: task.metadata_id ?? null,
    segment_id: task.segment_id ?? null,
    source_chunk_id: task.source_chunk_id ?? null,
    schedule_task_id: task.schedule_task_id ?? null,
    description: nullableText(task.description),
    assignee_person_id: task.assignee_person_id ?? null,
    assignee_name: nullableText(task.assignee_name),
    assignee_email: nullableText(task.assignee_email),
    meeting_title: task.document_metadata?.title ?? null,
    project_id: task.project_id ?? task.document_metadata?.project_id ?? null,
    project_name: task.projects?.name ?? null,
    client_id: task.client_id ?? null,
    due_date: task.due_date ?? null,
    priority: nullableText(task.priority),
    status: nullableText(task.status),
    source_system: nullableText(task.source_system) ?? nullableText(task.document_metadata?.source_system),
    embedding: task.embedding ?? null,
    created_at: task.created_at ?? null,
    updated_at: task.updated_at ?? null,
    project_ids: task.project_ids ?? null,
    file_name: nullableText(task.file_name),
    source_title: task.document_metadata?.title ?? null,
    source_type: task.document_metadata?.type ?? null,
    source_date: sourceDateFromMetadata(task.document_metadata),
    source_url: task.document_metadata?.url ?? task.document_metadata?.source ?? null,
    source_web_url: task.document_metadata?.source_web_url ?? null,
    fireflies_link: task.document_metadata?.fireflies_link ?? null,
    meeting_link: task.document_metadata?.meeting_link ?? null,
    source_context: buildTaskSourceContext(task),
    title: nullableText(task.title),
    assigned_by: nullableText(task.assigned_by),
    extraction_source: nullableText(task.extraction_source),
    extraction_model: nullableText(task.extraction_model),
    extraction_prompt_version: nullableText(task.extraction_prompt_version),
    extraction_metadata: task.extraction_metadata ?? null,
  };
}

export function getTaskSourceLabel(task: Pick<TasksRow, "source_system" | "source_type" | "source_url">): string {
  const normalized = `${task.source_system ?? ""} ${task.source_type ?? ""} ${task.source_url ?? ""}`.toLowerCase();

  if (normalized.includes("team")) return "Teams";
  if (normalized.includes("outlook") || normalized.includes("email")) return "Email";
  if (normalized.includes("fireflies") || normalized.includes("meeting")) return "Meeting";
  if (normalized.includes("manual")) return "Manual";
  if (
    normalized.includes("sharepoint") ||
    normalized.includes("onedrive") ||
    normalized.includes("document")
  ) {
    return "Document";
  }

  return humanizeToken(task.source_system) ?? humanizeToken(task.source_type) ?? "Unknown";
}

export function getTaskSourceTitle(
  task: Pick<TasksRow, "source_title" | "meeting_title" | "file_name" | "metadata_id">,
): string {
  return (
    task.source_title ??
    task.meeting_title ??
    task.file_name ??
    (task.metadata_id ? `Source ${task.metadata_id}` : "Source record")
  );
}

export function getTaskCategory(
  task: Pick<
    TasksRow,
    | "description"
    | "title"
    | "source_title"
    | "source_type"
    | "source_system"
    | "file_name"
    | "extraction_metadata"
  >,
): string {
  if (isRecord(task.extraction_metadata)) {
    const explicitCategory = task.extraction_metadata.task_category;
    if (typeof explicitCategory === "string" && explicitCategory.trim()) {
      return explicitCategory.trim();
    }
  }

  const normalized = [
    task.description,
    task.title,
    task.source_title,
    task.source_type,
    task.source_system,
    task.file_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(acumatica|accounting|invoice|invoices|payment|payments|payroll|retainage|transaction|transactions|bank|chase|amex|cash flow|deposit|deposits|check|checks|coded|coding)\b/.test(
      normalized,
    )
  ) {
    return "Accounting";
  }

  if (/\b(permit|coi|insurance|contract|certificate|signature|w9)\b/.test(normalized)) {
    return "Compliance";
  }

  if (/\b(pricing|proposal|quote|estimate|cost|budget|sov|change order|co\b)\b/.test(normalized)) {
    return "Estimating";
  }

  if (/\b(drawing|drawings|design|submittal|submittals|shop drawing)\b/.test(normalized)) {
    return "Design";
  }

  if (/\b(schedule|install|installation|onsite|site|delivery|field|labor)\b/.test(normalized)) {
    return "Operations";
  }

  return "General";
}

export function getTaskSourceTarget(
  task: Pick<
    TasksRow,
    | "metadata_id"
    | "source_type"
    | "source_system"
    | "source_url"
    | "source_web_url"
    | "fireflies_link"
    | "meeting_link"
  >,
  projectId?: string | null,
): { href: string; external: boolean } | null {
  const normalized = `${task.source_system ?? ""} ${task.source_type ?? ""}`.toLowerCase();
  const externalHref =
    task.meeting_link ?? task.fireflies_link ?? task.source_web_url ?? task.source_url;

  if (task.metadata_id && (normalized.includes("meeting") || normalized.includes("fireflies"))) {
    return {
      href: projectId ? `/${projectId}/meetings/${task.metadata_id}` : `/meetings/${task.metadata_id}`,
      external: false,
    };
  }

  if (externalHref && /^https?:\/\//i.test(externalHref)) {
    return { href: externalHref, external: true };
  }

  return null;
}
