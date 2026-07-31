import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  addGitHubIssueComment,
  addGitHubIssueLabels,
  createGitHubIssue,
} from "@/lib/admin-feedback/github";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const schema = z.object({
  id: z.string().uuid(),
  target: z.enum(["codex", "claude_code"]),
  markInProgress: z.boolean().default(true),
});

type FeedbackCommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type DispatchHistoryEntry = {
  target: "codex" | "claude_code";
  at: string;
  by: string;
  status: string;
  annotationId: string | null;
  trigger: "github" | "metadata_queue";
  githubIssueUrl: string | null;
};


async function requireAdminUser() {
  const requestUser = await getApiRouteUser();
  if (!requestUser) return null;

  const supabase = createServiceClient();
  const { data: profile, error } = await serviceDb.from("user_profiles")
    .select("id, is_admin")
    .eq("id", requestUser.id)
    .maybeSingle();

  if (error || !profile?.is_admin) return null;
  return requestUser;
}

function escapeDoubleQuotes(text: string) {
  return text.replace(/"/g, '\\"');
}

function buildPrompt(input: {
  annotationId: string | null;
  title: string;
  comment: string;
  status: string;
  severity: string | null;
  pageUrl: string;
  pagePath: string;
  comments: { author: string; body: string }[];
}) {
  const thread =
    input.comments.length > 0
      ? input.comments.map((c) => `- ${c.author}: ${c.body}`).join("\n")
      : "- No replies yet";

  return [
    "Please resolve this Agentation annotation:",
    "",
    `Annotation ID: ${input.annotationId || "N/A"}`,
    `Title: ${input.title}`,
    `Status: ${input.status}`,
    `Severity: ${input.severity || "medium"}`,
    `Page: ${input.pageUrl || input.pagePath}`,
    "",
    "Original annotation:",
    input.comment,
    "",
    "Reply thread:",
    thread,
    "",
    "Output requirements:",
    "1. Root cause",
    "2. Exact code changes",
    "3. Verification evidence",
  ].join("\n");
}

export const POST = withApiGuardrails("/api/admin/feedback/dispatch#POST", async ({ request }) => {
  const user = await requireAdminUser();
  if (!user) throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/feedback/dispatch#POST", message: "Admin access required.", status: 403 });

  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, target, markInProgress } = parsed.data;
  const supabase = createServiceClient();

  const { data: item, error: itemError } = await serviceDb.from("admin_feedback_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (itemError || !item) {
    return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
  }

  const { data: commentRows } = await serviceDb.from("admin_feedback_comments")
    .select("id, author_id, body, created_at")
    .eq("feedback_item_id", id)
    .order("created_at", { ascending: true });

  const comments = (commentRows ?? []) as FeedbackCommentRow[];
  const authorIds = [...new Set(comments.map((c) => c.author_id))];

  let profilesById: Record<string, { full_name: string | null; email: string | null }> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await serviceDb.from("user_profiles")
      .select("id, full_name, email")
      .in("id", authorIds);

    profilesById = Object.fromEntries(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          full_name: profile.full_name,
          email: profile.email,
        },
      ]),
    );
  }

  const annotationId =
    item.metadata && typeof item.metadata === "object" && "agentationId" in item.metadata
      ? String((item.metadata as Record<string, unknown>).agentationId ?? "")
      : null;

  const prompt = buildPrompt({
    annotationId,
    title: item.title,
    comment: item.comment,
    status: item.status,
    severity: item.severity,
    pageUrl: item.page_url,
    pagePath: item.page_path,
    comments: comments.map((comment) => {
      const profile = profilesById[comment.author_id];
      return {
        author: profile?.full_name || profile?.email || comment.author_id,
        body: comment.body,
      };
    }),
  });

  const cliCommand =
    target === "codex"
      ? `codex --print "${escapeDoubleQuotes(prompt)}"`
      : `claude --print "${escapeDoubleQuotes(prompt)}"`;

  // Both engines are label-driven: the issue is created (or reused), the
  // dispatch context is added as a comment, and the engine label
  // (`codex:fix` / `claude:fix`) triggers the Autofix Issue workflow.
  const engineLabel = target === "codex" ? "codex:fix" : "claude:fix";
  const missingConfigMessage =
    "GitHub integration is not configured. Agent dispatch requires GITHUB_FEEDBACK_REPO_OWNER, GITHUB_FEEDBACK_REPO_NAME, and GITHUB_FEEDBACK_TOKEN.";

  let githubIssue:
    | { number: number; url: string; state: string }
    | null = null;
  const trigger = "github" as const;

  if (item.github_issue_number) {
    githubIssue = {
      number: item.github_issue_number,
      url: item.github_issue_url ?? "",
      state: item.github_issue_state ?? "open",
    };
  } else {
    githubIssue = await createGitHubIssue({
      title: item.title,
      comment: item.comment,
      pageUrl: item.page_url,
      pagePath: item.page_path,
      pageTitle: item.page_title ?? null,
      requestType: item.request_type as Parameters<typeof createGitHubIssue>[0]["requestType"],
      severity: (item.severity ?? "medium") as Parameters<typeof createGitHubIssue>[0]["severity"],
      targetId: item.target_id ?? null,
      targetSelector: item.target_selector,
      targetTag: item.target_tag ?? null,
      targetText: item.target_text ?? null,
      domPath: item.dom_path ?? null,
      screenshotUrl: item.screenshot_url ?? null,
      projectId: item.project_id ?? null,
      metadata: (item.metadata as Record<string, unknown>) ?? {},
    });

    if (!githubIssue) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/admin/feedback/dispatch#POST",
        message: missingConfigMessage,
      });
    }
  }

  const commented = await addGitHubIssueComment(
    githubIssue.number,
    [
      `Dispatched from the Feedback Inbox to the ${target === "codex" ? "Codex" : "Claude Code"} autofix lane.`,
      "",
      "```text",
      prompt,
      "```",
    ].join("\n"),
  );
  if (!commented) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/feedback/dispatch#POST",
      message: missingConfigMessage,
    });
  }

  const labeled = await addGitHubIssueLabels(githubIssue.number, [engineLabel]);
  if (!labeled) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/feedback/dispatch#POST",
      message: missingConfigMessage,
    });
  }

  const currentMetadata =
    item.metadata && typeof item.metadata === "object"
      ? (item.metadata as Record<string, unknown>)
      : {};

  const existingHistoryRaw = currentMetadata.dispatchHistory;
  const existingHistory: DispatchHistoryEntry[] = Array.isArray(existingHistoryRaw)
    ? (existingHistoryRaw
        .filter((entry) => typeof entry === "object" && entry !== null)
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          return {
            target: record.target === "claude_code" ? "claude_code" : "codex",
            at: typeof record.at === "string" ? record.at : new Date().toISOString(),
            by: typeof record.by === "string" ? record.by : user.id,
            status: typeof record.status === "string" ? record.status : item.status,
            annotationId:
              typeof record.annotationId === "string" ? record.annotationId : null,
            trigger: record.trigger === "github" ? "github" : "metadata_queue",
            githubIssueUrl:
              typeof record.githubIssueUrl === "string" ? record.githubIssueUrl : null,
          } as DispatchHistoryEntry;
        }) as DispatchHistoryEntry[])
    : [];

  const dispatchEvent: DispatchHistoryEntry = {
    target,
    at: new Date().toISOString(),
    by: user.id,
    status: markInProgress ? "in_progress" : item.status,
    annotationId,
    trigger,
    githubIssueUrl: githubIssue?.url ?? item.github_issue_url ?? null,
  };

  const nextMetadata = {
    ...currentMetadata,
    assignedAgent: target,
    assignedAt: new Date().toISOString(),
    assignedBy: user.id,
    dispatchStatus: "dispatched",
    dispatchTrigger: trigger,
    dispatchPrompt: prompt,
    dispatchCliCommand: cliCommand,
    dispatchedAt: new Date().toISOString(),
    dispatchedBy: user.id,
    lastDispatchTarget: target,
    dispatchCount: existingHistory.length + 1,
    dispatchHistory: [dispatchEvent, ...existingHistory].slice(0, 30),
  };

  const nextStatus = markInProgress ? "in_progress" : item.status;

  const { error: updateError } = await serviceDb.from("admin_feedback_items")
    .update({
      metadata: nextMetadata,
      status: nextStatus,
      github_issue_number: githubIssue?.number ?? item.github_issue_number ?? null,
      github_issue_url: githubIssue?.url ?? item.github_issue_url ?? null,
      github_issue_state: githubIssue?.state ?? item.github_issue_state ?? null,
    })
    .eq("id", id);

  if (updateError) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/feedback/dispatch#POST", message: updateError.message });
  }

  return NextResponse.json({
    success: true,
    id,
    target,
    prompt,
    cliCommand,
    trigger,
    githubIssue,
    status: nextStatus,
    dispatchEvent,
  });
});
