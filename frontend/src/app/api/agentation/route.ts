import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

type AgentationAnnotation = {
  id?: string;
  annotationId?: string;
  comment?: string;
  intent?: string;
  severity?: string;
  element?: string;
  elementPath?: string;
  reactComponents?: string;
  sessionId?: string;
  pageUrl?: string;
  pagePath?: string;
  url?: string;
};

type AgentationWebhookBody = {
  event?: string;
  url?: string;
  annotation?: AgentationAnnotation;
  annotations?: AgentationAnnotation[];
  item?: AgentationAnnotation;
  items?: AgentationAnnotation[];
};

function normalizeIncomingAnnotations(body: unknown): AgentationAnnotation[] {
  if (Array.isArray(body)) {
    return body as AgentationAnnotation[];
  }

  if (!body || typeof body !== "object") {
    return [];
  }

  const typed = body as AgentationWebhookBody & AgentationAnnotation;
  const collected: AgentationAnnotation[] = [];

  if (Array.isArray(typed.annotations)) {
    collected.push(...typed.annotations);
  }
  if (Array.isArray(typed.items)) {
    collected.push(...typed.items);
  }
  if (typed.annotation && typeof typed.annotation === "object") {
    collected.push(typed.annotation);
  }
  if (typed.item && typeof typed.item === "object") {
    collected.push(typed.item);
  }

  // Fallback for single annotation-shaped payloads.
  if (collected.length === 0 && (typed.id || typed.annotationId || typed.comment || typed.elementPath)) {
    collected.push(typed);
  }

  return collected;
}

function derivePagePath(pageUrl?: string, pagePath?: string) {
  if (pagePath && pagePath.trim().length > 0) {
    return pagePath;
  }

  if (pageUrl && pageUrl.trim().length > 0) {
    try {
      return new URL(pageUrl).pathname || "/";
    } catch {
      return "/";
    }
  }

  return "/";
}

function resolveAnnotationId(annotation: AgentationAnnotation) {
  return annotation.id || annotation.annotationId || null;
}

/**
 * Agentation webhook receiver + bidirectional status sync.
 *
 * Dev-only pipeline — saves to dev_annotations, NOT admin_feedback_items.
 * Client feedback uses AdminFeedbackWidget → /api/admin/feedback instead.
 *
 * POST  — Receives annotation events from the Agentation toolbar.
 *         Each annotation becomes a dev_annotations row for Claude Code triage.
 *
 * PATCH — Syncs MCP status changes back to dev_annotations.
 *         Called by the agentation-watch skill when resolving/dismissing annotations.
 *
 * Uses service role client since webhooks arrive without user auth session.
 */

// ---------------------------------------------------------------------------
// POST — Create dev_annotations rows from Agentation toolbar events
// ---------------------------------------------------------------------------

export const POST = withApiGuardrails(
  "agentation#POST",
  async ({ request }) => {
  const body = (await request.json()) as AgentationWebhookBody | AgentationAnnotation[] | AgentationAnnotation;

  // Ignore purely delete/clear events for ingestion.
  const eventName = !Array.isArray(body) && body && typeof body === "object" ? (body as AgentationWebhookBody).event : undefined;
  if (eventName === "annotation.delete" || eventName === "annotations.clear") {
    return NextResponse.json({ ignored: true, reason: eventName }, { status: 200 });
  }

  // Support both single annotations and batches
  const annotations = normalizeIncomingAnnotations(body).map((annotation) => {
    const inheritedUrl =
      !Array.isArray(body) && body && typeof body === "object" ? body.url : undefined;
    return {
      ...annotation,
      url: annotation.url || inheritedUrl,
      pageUrl: annotation.pageUrl || annotation.url || inheritedUrl,
    };
  });

  if (annotations.length === 0) {
    return NextResponse.json(
      { ignored: true, reason: "No annotations in payload", event: eventName || null },
      { status: 200 },
    );
  }


  // Resolve a system creator for dev annotation rows.
  const { data: adminProfile } = await serviceDb.from("user_profiles")
    .select("id")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: anyProfile } = adminProfile
    ? { data: null }
    : await serviceDb.from("user_profiles")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

  const creatorId = adminProfile?.id ?? anyProfile?.id ?? null;
  if (!creatorId) {
    return NextResponse.json(
      { error: "No user_profiles rows available" },
      { status: 500 },
    );
  }

  let created = 0;
  let skipped = 0;

  for (const ann of annotations) {
    const annotationId = resolveAnnotationId(ann);
    const pageUrl = ann.pageUrl || ann.url || "";
    const route = derivePagePath(pageUrl, ann.pagePath);

    if (annotationId) {
      // Deduplicate by agentation_id stored in metadata jsonb
      const { data: existing } = await serviceDb.from("dev_annotations")
        .select("id")
        .eq("agentation_id", annotationId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Sync comment updates
        if (eventName === "annotation.update" && ann.comment?.trim()) {
          await serviceDb.from("dev_annotations")
            .update({ comment: ann.comment })
            .eq("id", existing.id);
        }
        skipped += 1;
      } else {
        const componentHint = ann.reactComponents
          ? ann.reactComponents.split(">").map((s) => s.trim()).filter(Boolean).join(" > ")
          : ann.element || null;

        const { error: insertError } = await serviceDb.from("dev_annotations")
          .insert({
            route,
            comment: ann.comment || "No description",
            element_selector: ann.elementPath || ann.element || null,
            component_hint: componentHint,
            status: "open",
            created_by: creatorId,
            agentation_id: annotationId,
            metadata: {
              sessionId: ann.sessionId || null,
              intent: ann.intent || null,
              severity: ann.severity || null,
              element: ann.element || null,
              elementPath: ann.elementPath || null,
              reactComponents: ann.reactComponents || null,
              pageUrl,
              ingestEvent: eventName || "unknown",
            },
          });

        if (insertError) {
          return apiErrorResponse(insertError);
        }
        created += 1;
      }
    } else {
      // No annotationId — insert without dedup
      const componentHint = ann.reactComponents
        ? ann.reactComponents.split(">").map((s) => s.trim()).filter(Boolean).join(" > ")
        : ann.element || null;

      const { error: insertError } = await serviceDb.from("dev_annotations")
        .insert({
          route,
          comment: ann.comment || "No description",
          element_selector: ann.elementPath || ann.element || null,
          component_hint: componentHint,
          status: "open",
          created_by: creatorId,
          metadata: {
            sessionId: ann.sessionId || null,
            intent: ann.intent || null,
            severity: ann.severity || null,
            element: ann.element || null,
            pageUrl,
            ingestEvent: eventName || "unknown",
          },
        });

      if (insertError) {
        return apiErrorResponse(insertError);
      }
      created += 1;
    }
  }

  return NextResponse.json({ created, skipped }, { status: 201 });
  },
);

// ---------------------------------------------------------------------------
// PATCH — Bidirectional status sync (MCP resolve/dismiss → dev_annotations)
// ---------------------------------------------------------------------------

export const PATCH = withApiGuardrails(
  "agentation#PATCH",
  async ({ request }) => {
  const body = await request.json();
  const {
    agentationId,
    status,
    summary,
  }: {
    agentationId?: string;
    status?: "resolved" | "dismissed" | "in_progress";
    summary?: string;
  } = body;

  if (!agentationId) {
    return NextResponse.json({ error: "agentationId is required" }, { status: 400 });
  }


  // Map MCP status → dev_annotations status
  const statusMap: Record<string, string> = {
    resolved: "resolved",
    dismissed: "resolved",
    in_progress: "in_progress",
  };

  const newStatus = status ? statusMap[status] || "in_progress" : "in_progress";

  const { data: item, error: findError } = await serviceDb.from("dev_annotations")
    .select("id, status, metadata")
    .eq("agentation_id", agentationId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!item) {
    return NextResponse.json({ matched: false, message: "No matching dev annotation found" });
  }

  const existingMetadata =
    typeof item.metadata === "object" && item.metadata !== null && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};

  const updates: Record<string, unknown> = {
    status: newStatus,
    metadata: {
      ...existingMetadata,
      agentationId,
      ...(summary ? { resolution_summary: summary } : {}),
    },
  };

  if (newStatus === "resolved") {
    updates.resolved_at = new Date().toISOString();
    if (summary) {
      updates.ai_reply = summary;
      updates.ai_replied_at = new Date().toISOString();
    }
  }

  const { error: updateError } = await serviceDb.from("dev_annotations")
    .update(updates)
    .eq("id", item.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ matched: true, annotationId: item.id, newStatus });
  },
);
