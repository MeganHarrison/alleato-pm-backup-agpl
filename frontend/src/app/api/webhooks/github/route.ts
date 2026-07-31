import { createHmac, timingSafeEqual } from "crypto";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createOperationalServiceClient } from "@/lib/observability/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GitHubIdentity = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
};

type GitHubCommit = {
  id?: string;
  message?: string;
  timestamp?: string;
  url?: string;
  author?: GitHubIdentity | null;
  committer?: GitHubIdentity | null;
};

type GitHubPushPayload = {
  ref?: string;
  compare?: string;
  forced?: boolean;
  deleted?: boolean;
  commits?: GitHubCommit[];
  head_commit?: GitHubCommit | null;
  repository?: {
    full_name?: string;
  } | null;
  pusher?: GitHubIdentity | null;
  sender?: {
    login?: string;
  } | null;
};

function getWebhookSecret(): string {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Missing GITHUB_WEBHOOK_SECRET for GitHub push webhook verification.",
    );
  }
  return secret;
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", getWebhookSecret())
    .update(rawBody)
    .digest("hex")}`;

  const actualBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function branchFromRef(ref?: string): string {
  return ref?.replace(/^refs\/heads\//, "") || "unknown";
}

function parseTimestamp(value: string | undefined): string {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export const POST = withApiGuardrails(
  "/api/webhooks/github#POST",
  async ({ request }): Promise<Response> => {
    const rawBody = await request.text();
    const eventType = request.headers.get("x-github-event") ?? "unknown";
    const deliveryId = request.headers.get("x-github-delivery");

    if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return Response.json(
        { error: "Invalid GitHub webhook signature." },
        { status: 401 },
      );
    }

    if (eventType === "ping") {
      return Response.json({ ok: true, event: "ping" });
    }

    if (eventType !== "push") {
      return Response.json({ ok: true, ignored: eventType });
    }

    let payload: GitHubPushPayload;
    try {
      payload = JSON.parse(rawBody) as GitHubPushPayload;
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/webhooks/github#POST",
        message: "GitHub webhook body is not valid JSON.",
        status: 400,
      });
    }
    const repositoryFullName = payload.repository?.full_name;
    if (!repositoryFullName) {
      return Response.json(
        { error: "GitHub push payload is missing repository.full_name." },
        { status: 400 },
      );
    }

    const commits = payload.commits ?? [];
    if (commits.length === 0) {
      return Response.json({
        ok: true,
        inserted: 0,
        reason: "No commits in push payload.",
      });
    }

    const branch = branchFromRef(payload.ref);
    const rows = commits
      .filter((commit): commit is GitHubCommit & { id: string } => Boolean(commit.id))
      .map((commit) => ({
        repository_full_name: repositoryFullName,
        branch,
        commit_sha: commit.id,
        commit_message: commit.message ?? null,
        commit_url: commit.url ?? null,
        compare_url: payload.compare ?? null,
        commit_author_name: commit.author?.name ?? null,
        commit_author_email: commit.author?.email ?? null,
        commit_committer_name: commit.committer?.name ?? null,
        commit_committer_email: commit.committer?.email ?? null,
        pushed_by_username:
          payload.sender?.login ?? payload.pusher?.username ?? null,
        pushed_by_name: payload.pusher?.name ?? null,
        pushed_by_email: payload.pusher?.email ?? null,
        webhook_delivery_id: deliveryId,
        event_type: eventType,
        pushed_at: parseTimestamp(
          commit.timestamp ?? payload.head_commit?.timestamp,
        ),
        raw_payload: {
          forced: payload.forced ?? false,
          deleted: payload.deleted ?? false,
          ref: payload.ref ?? null,
        },
      }));

    const supabase = createOperationalServiceClient();

    const { error } = await supabase.from("developer_commit_log").upsert(rows, {
      onConflict: "repository_full_name,commit_sha",
      ignoreDuplicates: true,
    });

    if (error) {
      return Response.json(
        { error: `developer_commit_log insert failed: ${error.message}` },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, inserted: rows.length });
  },
);
