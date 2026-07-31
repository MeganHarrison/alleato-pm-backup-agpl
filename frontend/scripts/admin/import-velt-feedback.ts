import fs from "node:fs";
import path from "node:path";

import { mirrorVeltCommentToFeedback, type VeltMirrorInput } from "../../src/lib/admin-feedback/velt-feedback";
import { createServiceClient } from "../../src/lib/supabase/service";

function readEnvFile(file: string, out: Record<string, string>) {
  try {
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && out[match[1]] === undefined) {
        out[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // Ignore missing env files.
  }
}

function hydrateEnv() {
  const values: Record<string, string> = {};
  for (const relativeFile of [".env.local", ".env", "../.env"]) {
    readEnvFile(path.join(process.cwd(), relativeFile), values);
  }

  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

hydrateEnv();

const TARGET_USER_ID = "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0";
const TARGET_EMAIL = "megan@megankharrison.com";

function cleanText(raw: string | null | undefined) {
  return (raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchVeltPage(pageToken?: string) {
  const apiKey = process.env.NEXT_PUBLIC_VELT_API_KEY;
  const authToken = process.env.VELT_AUTH_TOKEN;
  if (!apiKey || !authToken) {
    throw new Error("Missing Velt credentials.");
  }

  const response = await fetch("https://api.velt.dev/v2/commentannotations/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-velt-api-key": apiKey,
      "x-velt-auth-token": authToken,
    },
    body: JSON.stringify({
      data: {
        organizationId: "alleato",
        groupByDocumentId: true,
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Velt request failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<{
    result?: {
      data?: Record<string, Array<Record<string, unknown>>>;
      nextPageToken?: string;
    };
  }>;
}

function pickCommentSource(commentText: string) {
  return commentText ? "velt_comment_reply" : "velt_comment_annotation";
}

async function collectMatches() {
  const items: VeltMirrorInput[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 25; page += 1) {
    const json = await fetchVeltPage(pageToken);
    const data = json.result?.data ?? {};

    for (const [documentId, annotations] of Object.entries(data)) {
      for (const annotation of annotations) {
        const comments = Array.isArray(annotation.comments) ? annotation.comments : [];
        for (const comment of comments as Array<Record<string, any>>) {
          const author = comment.from ?? annotation.from ?? {};
          const authorName = String(author.name ?? "");
          const authorEmail = String(author.email ?? "");
          const taggedUsers = [
            ...((comment.taggedUserContacts ?? []) as Array<Record<string, any>>).map(
              (entry) => entry.contact ?? {},
            ),
            ...((comment.to ?? []) as Array<Record<string, any>>),
          ];
          const text = cleanText(String(comment.commentText ?? comment.commentHtml ?? ""));
          const mentionsTarget =
            text.includes(`{{${TARGET_USER_ID}}}`) ||
            taggedUsers.some((user) => user.userId === TARGET_USER_ID || user.email === TARGET_EMAIL);
          const isBrandon =
            /brandon clymer/i.test(authorName) ||
            /bclymer@alleatogroup\.com/i.test(authorEmail);

          if (!isBrandon || !mentionsTarget) {
            continue;
          }

          items.push({
            annotationId: String(annotation.annotationId),
            commentId: String(comment.commentId),
            documentId,
            pageUrl: String(annotation.pageInfo?.commentUrl ?? annotation.pageInfo?.url ?? ""),
            pageTitle: String(annotation.pageInfo?.title ?? ""),
            commentText: typeof comment.commentText === "string" ? comment.commentText : null,
            commentHtml: typeof comment.commentHtml === "string" ? comment.commentHtml : null,
            createdAt: comment.createdAt ?? annotation.createdAt ?? null,
            lastUpdated: comment.lastUpdated ?? annotation.lastUpdated ?? null,
            attachments: Array.isArray(comment.attachments) ? comment.attachments : [],
            author: {
              userId: author.userId ?? null,
              name: author.name ?? null,
              email: author.email ?? null,
            },
            taggedUsers: taggedUsers.map((user) => ({
              userId: user.userId ?? null,
              name: user.name ?? user.clientUserName ?? null,
              email: user.email ?? null,
            })),
            targetElementId: annotation.targetElementId ?? null,
            targetElementPath: annotation.targetElement?.xpath ?? null,
            taggedElementPath: annotation.taggedElementPath ?? null,
            taggedElementRect: annotation.taggedElementRect ?? null,
            annotationContext:
              annotation.context && typeof annotation.context === "object"
                ? (annotation.context as Record<string, unknown>)
                : null,
            source: pickCommentSource(text),
          });
        }
      }
    }

    pageToken = json.result?.nextPageToken;
    if (!pageToken) {
      break;
    }
  }

  return items;
}

async function main() {
  const dryRun = !process.argv.includes("--create");
  const matches = await collectMatches();
  const supabase = createServiceClient();
  const commentIds = matches.map((match) => String(match.commentId));
  const { data: existingRows, error } = await supabase
    .from("admin_feedback_items")
    .select("id, github_issue_url, github_issue_number, status, metadata")
    .gte("created_at", "2026-06-29T00:00:00Z");

  if (error) {
    throw error;
  }

  const existingByCommentId = new Map<string, { id: string; githubIssueUrl: string | null; githubIssueNumber: number | null; status: string }>();
  for (const row of existingRows ?? []) {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : null;
    const commentId = typeof metadata?.veltCommentId === "string" ? metadata.veltCommentId : null;
    if (commentId && commentIds.includes(commentId)) {
      existingByCommentId.set(commentId, {
        id: row.id,
        githubIssueUrl: row.github_issue_url,
        githubIssueNumber: row.github_issue_number,
        status: row.status,
      });
    }
  }

  const stats = {
    totalMatches: matches.length,
    existing: 0,
    created: 0,
    repaired: 0,
    skipped: 0,
  };

  const results: Array<Record<string, unknown>> = [];

  for (const match of matches) {
    const existing = existingByCommentId.get(String(match.commentId));
    if (dryRun) {
      if (existing?.githubIssueUrl || existing?.githubIssueNumber) {
        stats.existing += 1;
      }
      results.push({
        commentId: match.commentId,
        documentId: match.documentId,
        action: existing ? "repair_or_existing" : "create",
      });
      continue;
    }

    const result = await mirrorVeltCommentToFeedback({
      ...match,
      source: "batch_import",
    });

    if (result.status === "existing") {
      stats.existing += 1;
    } else if (result.status === "repaired") {
      stats.repaired += 1;
    } else {
      stats.created += 1;
    }

    results.push({
      commentId: match.commentId,
      documentId: match.documentId,
      feedbackId: result.feedbackId,
      githubIssueUrl: result.githubIssueUrl,
      status: result.status,
      title: result.title,
    });
  }

  console.log(JSON.stringify({ dryRun, stats, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
