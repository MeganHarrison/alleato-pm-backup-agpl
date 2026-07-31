import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { withoutLeadershipRestricted } from "@/lib/ai/leadership-restriction";
import { GuardrailError } from "@/lib/guardrails/errors";
import { formatAIProviderFailure } from "@/lib/ai/provider-config";
import { getLanguageModel } from "@/lib/ai/providers";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

const MODEL_ID = "openai/gpt-5.4-mini";
const WHERE = "projects/[projectId]/meetings/prep-suggestions#POST";
const AI_GENERATION_TIMEOUT_MS = 12_000;

const suggestionKindSchema = z.enum([
  "task",
  "rfi",
  "submittal",
  "change_event",
  "schedule",
  "context",
]);

const prioritySchema = z.enum(["low", "medium", "high"]);

const planningSuggestionSchema = z.object({
  id: z.string().min(1).max(120),
  kind: suggestionKindSchema,
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(320),
  href: z.string().min(1).max(240),
  sourceLabel: z.string().min(1).max(120),
  sourceContext: z.string().max(180).nullable().optional(),
  priority: prioritySchema.optional(),
});

const meetingRecapSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  date: z.string().nullable(),
  summary: z.string().min(1).max(360),
  openThreads: z.array(z.string().min(1).max(160)).max(4),
  decisions: z.array(z.string().min(1).max(160)).max(4),
  href: z.string().min(1).max(240),
});

const aiOutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        sourceIds: z.array(z.string().min(1).max(120)).min(1).max(3),
        kind: suggestionKindSchema,
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(260),
        priority: prioritySchema,
      }),
    )
    .max(8),
  meetingRecaps: z
    .array(
      z.object({
        sourceMeetingId: z.string().min(1).max(120),
        title: z.string().min(1).max(120),
        summary: z.string().min(1).max(280),
        openThreads: z.array(z.string().min(1).max(140)).max(3),
        decisions: z.array(z.string().min(1).max(140)).max(3),
      }),
    )
    .max(4),
});

const prepSuggestionRequestSchema = z.object({
  mode: z.enum(["source", "ai"]).optional(),
});

type PlanningSuggestion = z.infer<typeof planningSuggestionSchema>;
type MeetingRecap = z.infer<typeof meetingRecapSchema>;
type AiOutput = z.infer<typeof aiOutputSchema>;
type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "summary" | "stage" | "phase" | "health_status"
>;
type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "description" | "status" | "due_date" | "priority" | "assignee_name"
>;
type RfiRow = Pick<
  Database["public"]["Tables"]["rfis"]["Row"],
  "id" | "number" | "subject" | "status" | "due_date" | "ball_in_court" | "schedule_impact" | "cost_impact"
>;
type SubmittalRow = Pick<
  Database["public"]["Tables"]["submittals"]["Row"],
  | "id"
  | "submittal_number"
  | "title"
  | "status"
  | "final_due_date"
  | "required_approval_date"
  | "required_on_site_date"
  | "ball_in_court"
  | "lead_time"
  | "priority"
>;
type ChangeEventRow = Pick<
  Database["public"]["Tables"]["change_events"]["Row"],
  "id" | "number" | "title" | "status" | "scope" | "reason" | "type" | "expecting_revenue"
>;
type ScheduleTaskRow = Pick<
  Database["public"]["Tables"]["schedule_tasks"]["Row"],
  | "id"
  | "name"
  | "status"
  | "finish_date"
  | "percent_complete"
  | "is_milestone"
  | "constraint_date"
  | "constraint_type"
  | "assignee"
>;
type MeetingDocumentRow = Pick<
  Database["public"]["Tables"]["document_metadata"]["Row"],
  | "id"
  | "title"
  | "date"
  | "summary"
  | "overview"
  | "action_items"
  | "bullet_points"
  | "decisions"
  | "participants"
  | "created_at"
>;
type MeetingSegmentRow = Pick<
  Database["public"]["Tables"]["meeting_segments"]["Row"],
  | "id"
  | "metadata_id"
  | "title"
  | "summary"
  | "decisions"
  | "risks"
  | "tasks"
  | "project_ids"
  | "project_impact"
  | "segment_index"
>;
type ProjectTimelineEventRow = Pick<
  Database["public"]["Tables"]["project_intelligence_timeline_events"]["Row"],
  | "id"
  | "title"
  | "summary"
  | "why_it_matters"
  | "event_type"
  | "priority"
  | "current_status"
  | "confidence"
  | "event_at"
  | "source_document_id"
  | "related_record_id"
  | "related_record_type"
>;

type MeetingPrepContext = {
  project: ProjectRow;
  candidates: PlanningSuggestion[];
  recentMeetings: MeetingDocumentRow[];
  meetingSegments: MeetingSegmentRow[];
  intelligenceEvents: ProjectTimelineEventRow[];
  meetingRecaps: MeetingRecap[];
  previousPrep: string | null;
};

const OPEN_TASK_STATUSES = new Set(["open", "todo", "in_progress", "pending"]);
const OPEN_RFI_STATUSES = new Set(["draft", "open", "answered"]);
const OPEN_SUBMITTAL_STATUSES = new Set(["draft", "open", "distributed"]);
const OPEN_CHANGE_EVENT_STATUSES = new Set(["open", "pending", "draft"]);

export const POST = withApiGuardrails<{ projectId: string }>(
  WHERE,
  async ({ request, params }) => {
    const { projectId } = params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (!Number.isFinite(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Everything below reads with the service-role client (RLS bypassed), so
    // project membership must be enforced here: 401 unauthenticated, 403
    // authenticated non-member.
    const access = await verifyProjectAccess(numericProjectId);
    if (isAuthError(access)) {
      return access;
    }

    const mode = await readPrepSuggestionMode(request);
    const context = await loadMeetingPrepContext(numericProjectId);
    const candidates = dedupeCandidates(context.candidates);
    if (candidates.length === 0) {
      return NextResponse.json({
        generatedBy: "source",
        model: null,
        suggestions: [],
        meetingRecaps: context.meetingRecaps,
      });
    }

    if (mode === "source") {
      return NextResponse.json(buildSourceBackedResponse(candidates, context));
    }

    try {
      const result = await generateText({
        model: getLanguageModel(MODEL_ID),
        abortSignal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
        output: Output.object({
          schema: aiOutputSchema,
          name: "meetingPrepSuggestions",
          description: "Prioritized meeting prep suggestions for a construction project meeting.",
        }),
        instructions: [
          "You generate meeting prep suggestions for construction project meetings.",
          "Use only the provided source candidates. Do not invent links, records, people, dates, or facts.",
          "Use prior meeting context only to prioritize and phrase suggestions; do not cite a prior meeting unless it is represented as a source candidate.",
          "Every suggestion must cite one to three sourceIds from the normalized meeting prep source packets.",
          "Prefer transcript segment and project intelligence source packets when they identify a concrete carry-forward topic.",
          "Meeting recaps are supporting evidence for the user, not agenda items. Keep recap summaries compact and preserve source meeting IDs.",
          "Return empty arrays for meetingRecaps, openThreads, and decisions when no source-supported values apply.",
          "Merge duplicates when several source candidates point to the same discussion.",
          "Prefer agenda language that helps the meeting owner decide what must be discussed next.",
          "Return no more than six suggestions. Keep titles direct and descriptions specific.",
        ].join(" "),
        prompt: [
          `Project ID: ${numericProjectId}`,
          "Project context:",
          JSON.stringify(context.project, null, 2),
          "Recent meeting context:",
          JSON.stringify(context.recentMeetings.map(summarizeRecentMeeting), null, 2),
          "Transcript-derived meeting segments:",
          JSON.stringify(context.meetingSegments.map(summarizeMeetingSegment), null, 2),
          "Project intelligence timeline events:",
          JSON.stringify(context.intelligenceEvents.map(summarizeTimelineEvent), null, 2),
          "Previous meeting prep excerpt:",
          context.previousPrep ?? "None",
          "Normalized meeting prep source packets:",
          JSON.stringify(buildMeetingPrepSourcePackets(context, candidates), null, 2),
          "Existing compact meeting recaps:",
          JSON.stringify(context.meetingRecaps, null, 2),
          "Create the most useful meeting prep list from these source packets, and rewrite the compact recaps only when the source meeting IDs match the provided recaps.",
        ].join("\n\n"),
      });

      const output = result.output as AiOutput;
      const suggestions = normalizeAiSuggestions(output, candidates);
      const meetingRecaps = normalizeAiMeetingRecaps(output, context.meetingRecaps);
      return NextResponse.json({
        generatedBy: "ai",
        model: MODEL_ID,
        suggestions: suggestions.length > 0 ? suggestions : candidates.slice(0, 8),
        meetingRecaps: meetingRecaps.length > 0 ? meetingRecaps : context.meetingRecaps,
      });
    } catch (error) {
      const message = formatAIProviderFailure(error, "Meeting prep generation");
      console.error(
        JSON.stringify({
          event: "meeting_prep_generation_failed",
          projectId: numericProjectId,
          userId: access.membership.authUserId,
          model: MODEL_ID,
          error: message,
        }),
      );

      return NextResponse.json({
        ...buildSourceBackedResponse(candidates, context),
        model: MODEL_ID,
        fallbackReason: "AI prep is unavailable. Showing source-backed project suggestions.",
      });
    }
  },
);

async function readPrepSuggestionMode(request: Request): Promise<"source" | "ai"> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return "source";

  const text = await request.text();
  if (!text.trim()) return "source";

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Meeting prep suggestion request body must be valid JSON.",
      details: error,
    });
  }

  const parsed = prepSuggestionRequestSchema.safeParse(json);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Meeting prep suggestion mode must be either source or ai.",
      details: parsed.error.flatten(),
    });
  }

  return parsed.data.mode ?? "source";
}

function buildSourceBackedResponse(
  candidates: PlanningSuggestion[],
  context: MeetingPrepContext,
) {
  return {
    generatedBy: "source" as const,
    model: null,
    suggestions: candidates.slice(0, 8),
    meetingRecaps: context.meetingRecaps,
  };
}

function buildMeetingPrepSourcePackets(
  context: MeetingPrepContext,
  candidates: PlanningSuggestion[],
) {
  const segmentByCandidateId = new Map(
    context.meetingSegments.map((segment) => [`meeting-segment-${segment.id}`, segment]),
  );
  const intelligenceByCandidateId = new Map(
    context.intelligenceEvents.map((event) => [`intelligence-event-${event.id}`, event]),
  );
  const meetingByCandidateId = new Map(
    context.recentMeetings.map((meeting) => [`prior-meeting-${meeting.id}`, meeting]),
  );

  return candidates.map((candidate) => {
    const segment = segmentByCandidateId.get(candidate.id);
    const intelligenceEvent = intelligenceByCandidateId.get(candidate.id);
    const meeting = meetingByCandidateId.get(candidate.id);

    return {
      id: candidate.id,
      kind: candidate.kind,
      sourceType: classifySourcePacket(candidate.id),
      title: candidate.title,
      description: candidate.description,
      href: candidate.href,
      sourceLabel: candidate.sourceLabel,
      sourceContext: candidate.sourceContext,
      priority: candidate.priority ?? "medium",
      evidence:
        segment ? summarizeMeetingSegment(segment)
        : intelligenceEvent ? summarizeTimelineEvent(intelligenceEvent)
        : meeting ? summarizeRecentMeeting(meeting)
        : null,
    };
  });
}

function classifySourcePacket(candidateId: string) {
  if (candidateId.startsWith("meeting-segment-")) return "transcript_segment";
  if (candidateId.startsWith("prior-meeting-")) return "prior_meeting";
  if (candidateId.startsWith("intelligence-event-")) return "project_intelligence";
  if (candidateId.startsWith("task-")) return "task";
  if (candidateId.startsWith("rfi-")) return "rfi";
  if (candidateId.startsWith("submittal-")) return "submittal";
  if (candidateId.startsWith("change-event-")) return "change_event";
  if (candidateId.startsWith("schedule-")) return "schedule";
  return "project_context";
}

async function loadMeetingPrepContext(projectId: number): Promise<MeetingPrepContext> {
  const supabase = createServiceClient();

  const projectResult = await supabase
    .from("projects")
    .select("id, name, summary, stage, phase, health_status")
    .eq("id", projectId)
    .maybeSingle();

  if (projectResult.error) {
    throw new Error(`Failed to load project for meeting prep: ${projectResult.error.message}`);
  }
  if (!projectResult.data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: WHERE,
      message: "Project not found.",
    });
  }

  const [
    tasksResult,
    rfisResult,
    submittalsResult,
    changeEventsResult,
    scheduleTasksResult,
    meetingsResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, due_date, priority, assignee_name")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("rfis")
      .select("id, number, subject, status, due_date, ball_in_court, schedule_impact, cost_impact")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("submittals")
      .select(
        "id, submittal_number, title, status, final_due_date, required_approval_date, required_on_site_date, ball_in_court, lead_time, priority",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("final_due_date", { ascending: true, nullsFirst: false })
      .limit(12),
    supabase
      .from("change_events")
      .select("id, number, title, status, scope, reason, type, expecting_revenue")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("schedule_tasks")
      .select(
        "id, name, status, finish_date, percent_complete, is_milestone, constraint_date, constraint_type, assignee",
      )
      .eq("project_id", projectId)
      .order("finish_date", { ascending: true, nullsFirst: false })
      .limit(12),
    // Service-role client bypasses RLS: leadership-restricted meetings
    // (Annual Reviews) are excluded from prep context unconditionally.
    withoutLeadershipRestricted(
      supabase
        .from("document_metadata")
        .select("id, title, date, summary, overview, action_items, bullet_points, decisions, participants, created_at")
        .eq("project_id", projectId)
        .eq("type", "meeting")
        .is("deleted_at", null),
      false,
    )
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(3),
  ]);

  assertQuery(tasksResult, "tasks");
  assertQuery(rfisResult, "rfis");
  assertQuery(submittalsResult, "submittals");
  assertQuery(changeEventsResult, "change_events");
  assertQuery(scheduleTasksResult, "schedule_tasks");
  assertQuery(meetingsResult, "document_metadata meetings");

  const recentMeetings = (meetingsResult.data ?? []) as MeetingDocumentRow[];
  const recentMeetingIds = recentMeetings.map((meeting) => meeting.id);
  let meetingSegments: MeetingSegmentRow[] = [];
  if (recentMeetingIds.length > 0) {
    const segmentsResult = await supabase
      .from("meeting_segments")
      .select(
        "id, metadata_id, title, summary, decisions, risks, tasks, project_ids, project_impact, segment_index",
      )
      .in("metadata_id", recentMeetingIds)
      .order("segment_index", { ascending: true })
      .limit(12);
    assertQuery(segmentsResult, "meeting_segments");
    meetingSegments = (segmentsResult.data ?? []) as MeetingSegmentRow[];
  }

  const intelligenceEventsResult = await supabase
    .from("project_intelligence_timeline_events")
    .select(
      "id, title, summary, why_it_matters, event_type, priority, current_status, confidence, event_at, source_document_id, related_record_id, related_record_type",
    )
    .eq("project_id", projectId)
    .order("event_at", { ascending: false })
    .limit(8);
  assertQuery(intelligenceEventsResult, "project_intelligence_timeline_events");

  const intelligenceEvents = (intelligenceEventsResult.data ?? []) as ProjectTimelineEventRow[];
  const meetingRecaps = buildMeetingRecaps(projectId, recentMeetings, meetingSegments);
  const previousPrep = await loadPreviousPrep(supabase, recentMeetings[0]?.id);
  const candidates = [
    ...buildTaskSuggestions(projectId, (tasksResult.data ?? []) as TaskRow[]),
    ...buildRfiSuggestions(projectId, (rfisResult.data ?? []) as RfiRow[]),
    ...buildSubmittalSuggestions(projectId, (submittalsResult.data ?? []) as SubmittalRow[]),
    ...buildChangeEventSuggestions(projectId, (changeEventsResult.data ?? []) as ChangeEventRow[]),
    ...buildScheduleSuggestions(projectId, (scheduleTasksResult.data ?? []) as ScheduleTaskRow[]),
    ...buildPriorMeetingSuggestions(projectId, recentMeetings),
    ...buildSegmentCarryForwardSuggestions(projectId, recentMeetings, meetingSegments),
    ...buildIntelligenceEventSuggestions(projectId, intelligenceEvents),
    {
      id: "context-project-changes",
      kind: "context" as const,
      title: "Review project changes since the prior meeting",
      description:
        "Use recent documents, RFIs, change events, schedule updates, and prior meeting notes to confirm what changed.",
      href: `/${projectId}/documents`,
      sourceLabel: "Project documents",
      sourceContext: "Recent documents, RFIs, changes, schedule updates, and prior meeting notes.",
      priority: "medium" as const,
    },
  ];

  return {
    project: projectResult.data as ProjectRow,
    candidates: candidates.slice(0, 12),
    recentMeetings,
    meetingSegments,
    intelligenceEvents,
    meetingRecaps,
    previousPrep,
  };
}

async function loadPreviousPrep(
  supabase: ReturnType<typeof createServiceClient>,
  meetingDocumentId: string | undefined,
) {
  if (!meetingDocumentId) return null;
  const { data, error } = await supabase
    .from("meeting_preps")
    .select("content")
    .eq("meeting_id", meetingDocumentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load previous meeting prep: ${error.message}`);
  }
  return truncateText(data?.content, 1_200);
}

function assertQuery<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string,
) {
  if (result.error) {
    throw new Error(`Failed to load ${label} for meeting prep: ${result.error.message}`);
  }
}

function dedupeCandidates(candidates: PlanningSuggestion[]): PlanningSuggestion[] {
  const seen = new Set<string>();
  const deduped: PlanningSuggestion[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped.slice(0, 12);
}

function isOpenStatus(status: string | null | undefined, openStatuses: Set<string>) {
  if (!status) return true;
  return openStatuses.has(status.trim().toLowerCase());
}

function buildTaskSuggestions(projectId: number, tasks: TaskRow[]): PlanningSuggestion[] {
  return tasks
    .filter((task) => isOpenStatus(task.status, OPEN_TASK_STATUSES))
    .sort(bySoonestDate((task) => task.due_date))
    .slice(0, 3)
    .map((task) => ({
      id: `task-${task.id}`,
      kind: "task",
      title: task.title || task.description || "Review open project task",
      description: [
        task.due_date ? `Open task due ${task.due_date}.` : "Open project task needs owner follow-up.",
        task.assignee_name ? `Assigned to ${task.assignee_name}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/${projectId}/tasks`,
      sourceLabel: "Project task",
      sourceContext: null,
      priority: normalizePriority(task.priority),
    }));
}

function buildRfiSuggestions(projectId: number, rfis: RfiRow[]): PlanningSuggestion[] {
  return rfis
    .filter((rfi) => isOpenStatus(rfi.status, OPEN_RFI_STATUSES))
    .sort(bySoonestDate((rfi) => rfi.due_date))
    .slice(0, 2)
    .map((rfi) => ({
      id: `rfi-${rfi.id}`,
      kind: "rfi",
      title: rfi.subject || "Review open RFI",
      description: [
        rfi.due_date ? `RFI ${rfi.number} due ${rfi.due_date}.` : `RFI ${rfi.number} needs discussion.`,
        rfi.ball_in_court ? `Ball in court: ${rfi.ball_in_court}.` : null,
        rfi.schedule_impact ? `Schedule impact: ${rfi.schedule_impact}.` : null,
        rfi.cost_impact ? `Cost impact: ${rfi.cost_impact}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/${projectId}/rfis`,
      sourceLabel: rfi.number ? `RFI ${rfi.number}` : "RFI",
      sourceContext: null,
      priority: rfi.due_date || rfi.schedule_impact ? "high" : "medium",
    }));
}

function buildSubmittalSuggestions(
  projectId: number,
  submittals: SubmittalRow[],
): PlanningSuggestion[] {
  return submittals
    .filter((submittal) => isOpenStatus(submittal.status, OPEN_SUBMITTAL_STATUSES))
    .sort(bySoonestDate((submittal) => submittal.final_due_date ?? submittal.required_approval_date))
    .slice(0, 2)
    .map((submittal) => ({
      id: `submittal-${submittal.id}`,
      kind: "submittal",
      title: submittal.title || "Review pending submittal",
      description: [
        submittal.final_due_date || submittal.required_approval_date
          ? `Submittal ${submittal.submittal_number} has an upcoming due date.`
          : `Submittal ${submittal.submittal_number} is still open.`,
        submittal.ball_in_court ? `Ball in court: ${submittal.ball_in_court}.` : null,
        submittal.lead_time ? `Lead time: ${submittal.lead_time} days.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/${projectId}/submittals`,
      sourceLabel: submittal.submittal_number
        ? `Submittal ${submittal.submittal_number}`
        : "Submittal",
      sourceContext: null,
      priority: normalizePriority(submittal.priority),
    }));
}

function buildChangeEventSuggestions(
  projectId: number,
  changeEvents: ChangeEventRow[],
): PlanningSuggestion[] {
  return changeEvents
    .filter((changeEvent) => isOpenStatus(changeEvent.status, OPEN_CHANGE_EVENT_STATUSES))
    .slice(0, 2)
    .map((changeEvent) => ({
      id: `change-event-${changeEvent.id}`,
      kind: "change_event",
      title: changeEvent.title || "Review open change event",
      description: [
        `Change event ${changeEvent.number} is ${changeEvent.scope}.`,
        changeEvent.status ? `Status: ${changeEvent.status}.` : null,
        changeEvent.reason ? `Reason: ${changeEvent.reason}.` : null,
        changeEvent.expecting_revenue ? "Potential revenue impact." : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/${projectId}/change-events`,
      sourceLabel: changeEvent.number ? `Change event ${changeEvent.number}` : "Change event",
      sourceContext: null,
      priority: changeEvent.expecting_revenue ? "high" : "medium",
    }));
}

function buildScheduleSuggestions(
  projectId: number,
  scheduleTasks: ScheduleTaskRow[],
): PlanningSuggestion[] {
  return scheduleTasks
    .filter((task) => task.status?.toLowerCase() !== "complete")
    .sort(bySoonestDate((task) => task.finish_date ?? task.constraint_date))
    .slice(0, 2)
    .map((task) => ({
      id: `schedule-${task.id}`,
      kind: "schedule",
      title: task.name || "Review upcoming schedule milestone",
      description: [
        task.finish_date ? `Schedule item finishes ${task.finish_date}.` : "Upcoming schedule work needs coordination.",
        task.constraint_date ? `Constraint ${task.constraint_type ?? "date"}: ${task.constraint_date}.` : null,
        typeof task.percent_complete === "number" ? `${task.percent_complete}% complete.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `/${projectId}/schedule`,
      sourceLabel: task.is_milestone ? "Schedule milestone" : "Schedule",
      sourceContext: null,
      priority: task.is_milestone || task.constraint_date ? "high" : "medium",
    }));
}

function buildPriorMeetingSuggestions(
  projectId: number,
  recentMeetings: MeetingDocumentRow[],
): PlanningSuggestion[] {
  return recentMeetings.slice(0, 1).flatMap((meeting) => {
    const meetingTitle = meeting.title || "previous meeting";
    const description =
      truncateText(meeting.action_items, 220) ||
      truncateText(meeting.bullet_points, 220) ||
      truncateText(meeting.summary, 220) ||
      truncateText(meeting.overview, 220);
    if (!description) return [];
    return [
      {
        id: `prior-meeting-${meeting.id}`,
        kind: "context" as const,
        title: `Carry forward open items from ${meetingTitle}`,
        description,
        href: `/${projectId}/meetings`,
        sourceLabel: "Prior meeting",
        sourceContext: meetingTitle,
        priority: "medium" as const,
      },
    ];
  });
}

function buildSegmentCarryForwardSuggestions(
  projectId: number,
  recentMeetings: MeetingDocumentRow[],
  segments: MeetingSegmentRow[],
): PlanningSuggestion[] {
  const meetingTitleById = new Map(
    recentMeetings.map((meeting) => [meeting.id, meeting.title || "previous meeting"]),
  );

  return segments
    .flatMap((segment) => {
      const tasks = jsonToStrings(segment.tasks, 2);
      const risks = jsonToStrings(segment.risks, 2);
      const details = [...tasks, ...risks].slice(0, 2);
      if (details.length === 0 && !segment.summary) return [];

      const meetingTitle = meetingTitleById.get(segment.metadata_id) ?? "previous meeting";
      return [
        {
          id: `meeting-segment-${segment.id}`,
          kind: "context" as const,
          title: segment.title || `Follow up from ${meetingTitle}`,
          description:
            details.length > 0
              ? details.join(" ")
              : truncateText(segment.summary, 220) ?? `Review carry-forward context from ${meetingTitle}.`,
          href: sourceDocumentHref(
            projectId,
            segment.metadata_id,
            meetingSegmentAnchorId(segment.id),
          ),
          sourceLabel: `Transcript topic ${segment.segment_index + 1}`,
          sourceContext: meetingTitle,
          priority: risks.length > 0 ? ("high" as const) : ("medium" as const),
        },
      ];
    })
    .slice(0, 2);
}

function buildIntelligenceEventSuggestions(
  projectId: number,
  events: ProjectTimelineEventRow[],
): PlanningSuggestion[] {
  return events
    .filter((event) => event.current_status.toLowerCase() !== "resolved")
    .slice(0, 3)
    .map((event) => ({
      id: `intelligence-event-${event.id}`,
      kind: "context" as const,
      title: event.title,
      description:
        truncateText(event.why_it_matters, 220) ||
        truncateText(event.summary, 220) ||
        `${event.event_type} captured ${event.event_at}.`,
      href: event.source_document_id
        ? sourceDocumentHref(projectId, event.source_document_id)
        : `/${projectId}/intelligence`,
      sourceLabel: "Project intelligence",
      sourceContext: `${humanizeSourceLabel(event.event_type)} · ${formatSourceDate(event.event_at)}`,
      priority: normalizePriority(event.priority),
    }));
}

function buildMeetingRecaps(
  projectId: number,
  recentMeetings: MeetingDocumentRow[],
  segments: MeetingSegmentRow[],
): MeetingRecap[] {
  const segmentsByMeetingId = new Map<string, MeetingSegmentRow[]>();
  for (const segment of segments) {
    const current = segmentsByMeetingId.get(segment.metadata_id) ?? [];
    current.push(segment);
    segmentsByMeetingId.set(segment.metadata_id, current);
  }

  return recentMeetings
    .slice(0, 4)
    .flatMap((meeting) => {
      const meetingSegments = segmentsByMeetingId.get(meeting.id) ?? [];
      const segmentSummaries = meetingSegments
        .map((segment) => truncateText(segment.summary, 120))
        .filter(isNonNullable);
      const openThreads = [
        ...jsonToStrings(meeting.action_items, 2),
        ...meetingSegments.flatMap((segment) => jsonToStrings(segment.tasks, 2)),
        ...meetingSegments.flatMap((segment) => jsonToStrings(segment.risks, 1)),
      ].slice(0, 4);
      const decisions = [
        ...jsonToStrings(meeting.decisions, 2),
        ...meetingSegments.flatMap((segment) => jsonToStrings(segment.decisions, 2)),
      ].slice(0, 4);
      const summary =
        truncateText(meeting.summary, 300) ||
        truncateText(meeting.overview, 300) ||
        truncateText(meeting.bullet_points, 300) ||
        truncateText(segmentSummaries.join(" "), 300);

      if (!summary && openThreads.length === 0 && decisions.length === 0) return [];

      return [
        {
          id: meeting.id,
          title: meeting.title || "Previous meeting",
          date: meeting.date,
          summary: summary ?? "Recent meeting has structured transcript context available.",
          openThreads,
          decisions,
          href: sourceDocumentHref(projectId, meeting.id),
        },
      ];
    });
}

function bySoonestDate<T>(getDate: (item: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const aDate = getDate(a);
    const bDate = getDate(b);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  };
}

function normalizePriority(value: string | null | undefined): "low" | "medium" | "high" {
  const normalized = value?.toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function truncateText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = sanitizeTextContent(value);
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed;
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function sourceDocumentHref(
  projectId: number,
  sourceDocumentId: string,
  anchorId?: string,
) {
  const href = `/${projectId}/intelligence/sources/${encodeURIComponent(sourceDocumentId)}`;
  return anchorId ? `${href}#${encodeURIComponent(anchorId)}` : href;
}

function meetingSegmentAnchorId(segmentId: string) {
  return `meeting-segment-${segmentId}`;
}

function humanizeSourceLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSourceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function jsonToStrings(value: unknown, maxItems: number): string[] {
  if (!value || maxItems <= 0) return [];
  if (typeof value === "string") {
    const trimmed = sanitizeTextContent(value);
    return trimmed ? [truncateForList(trimmed)] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => jsonToStrings(item, 1)).slice(0, maxItems);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct =
      record.text ?? record.title ?? record.summary ?? record.description ?? record.value;
    if (typeof direct === "string" && direct.trim()) {
      return [truncateForList(direct)];
    }
    return Object.values(record).flatMap((item) => jsonToStrings(item, 1)).slice(0, maxItems);
  }
  return [];
}

function truncateForList(value: string) {
  const trimmed = sanitizeTextContent(value);
  return trimmed.length > 160 ? `${trimmed.slice(0, 159)}...` : trimmed;
}

function sanitizeTextContent(value: string) {
  const trimmed = value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]" || trimmed.toLowerCase() === "null") {
    return "";
  }
  return trimmed;
}

function summarizeRecentMeeting(meeting: MeetingDocumentRow) {
  return {
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    summary: truncateText(meeting.summary, 500),
    overview: truncateText(meeting.overview, 300),
    actionItems: truncateText(meeting.action_items, 500),
    decisions: meeting.decisions,
    participants: truncateText(meeting.participants, 220),
  };
}

function summarizeMeetingSegment(segment: MeetingSegmentRow) {
  return {
    id: segment.id,
    meetingId: segment.metadata_id,
    title: segment.title,
    summary: truncateText(segment.summary, 300),
    tasks: jsonToStrings(segment.tasks, 3),
    risks: jsonToStrings(segment.risks, 3),
    decisions: jsonToStrings(segment.decisions, 3),
    projectImpact: segment.project_impact?.slice(0, 3) ?? [],
  };
}

function summarizeTimelineEvent(event: ProjectTimelineEventRow) {
  return {
    id: event.id,
    title: event.title,
    eventAt: event.event_at,
    type: event.event_type,
    status: event.current_status,
    priority: event.priority,
    confidence: event.confidence,
    summary: truncateText(event.summary, 240),
    whyItMatters: truncateText(event.why_it_matters, 240),
    sourceDocumentId: event.source_document_id,
    relatedRecord: event.related_record_type
      ? `${event.related_record_type}:${event.related_record_id ?? "unknown"}`
      : null,
  };
}

function normalizeAiSuggestions(
  output: AiOutput,
  candidates: PlanningSuggestion[],
): PlanningSuggestion[] {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const normalized: PlanningSuggestion[] = [];
  const seenTitles = new Set<string>();

  for (const suggestion of output.suggestions) {
    const source = suggestion.sourceIds
      .map((sourceId) => candidateById.get(sourceId))
      .find(Boolean);
    if (!source) continue;

    const titleKey = suggestion.title.trim().toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    normalized.push({
      id: `ai-${source.id}`,
      kind: suggestion.kind,
      title: suggestion.title.trim(),
      description: suggestion.description.trim(),
      href: source.href,
      sourceLabel: source.sourceLabel,
      sourceContext: source.sourceContext,
      priority: suggestion.priority,
    });
  }

  return normalized.slice(0, 8);
}

function normalizeAiMeetingRecaps(output: AiOutput, sourceRecaps: MeetingRecap[]): MeetingRecap[] {
  if (!output.meetingRecaps?.length) return [];

  const sourceById = new Map(sourceRecaps.map((recap) => [recap.id, recap]));
  const normalized: MeetingRecap[] = [];

  for (const recap of output.meetingRecaps) {
    const source = sourceById.get(recap.sourceMeetingId);
    if (!source) continue;

    normalized.push({
      ...source,
      title: recap.title.trim(),
      summary: recap.summary.trim(),
      openThreads: (recap.openThreads ?? source.openThreads).slice(0, 4),
      decisions: (recap.decisions ?? source.decisions).slice(0, 4),
    });
  }

  return normalized.slice(0, 4);
}
