import { DEFAULT_POLICY, fetchWithGuardrails } from "@/lib/fetch-with-guardrails";

const VELT_ORGANIZATION_ID = "alleato";
const VELT_ENDPOINT = "https://api.velt.dev/v2/commentannotations/get";
const MAX_PAGES = 25;

interface VeltUser {
  userId?: string;
  name?: string;
  email?: string;
}

interface VeltComment {
  commentId?: string;
  commentText?: string;
  commentHtml?: string;
  from?: VeltUser;
  createdAt?: number;
  lastUpdated?: number | string;
}

interface VeltAnnotation {
  annotationId: string;
  annotationNumber?: number;
  lastUpdated?: number | string;
  createdAt?: number | string;
  from?: VeltUser;
  status?: { id?: string; name?: string };
  comments?: VeltComment[];
}

export interface AllCommentMessage {
  commentId: string;
  authorName: string;
  text: string;
  createdAt: number | null;
}

export interface AllCommentItem {
  documentId: string;
  annotationId: string;
  annotationNumber: number | null;
  authorName: string;
  preview: string;
  statusName: string | null;
  replyCount: number;
  lastUpdated: number | null;
  messages: AllCommentMessage[];
}

function toMillis(value: number | string | undefined): number | null {
  if (value == null) return null;
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function normalizeCommentMessage(
  comment: VeltComment,
  fallbackAuthorName: string,
  fallbackId: string,
): AllCommentMessage {
  const text = (comment.commentText ?? comment.commentHtml ?? "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return {
    commentId: comment.commentId ?? fallbackId,
    authorName: comment.from?.name ?? fallbackAuthorName,
    text: text || "(no text)",
    createdAt: toMillis(comment.lastUpdated ?? comment.createdAt),
  };
}

function normalize(documentId: string, annotation: VeltAnnotation): AllCommentItem {
  const first = annotation.comments?.[0];
  const fallbackAuthorName = annotation.from?.name ?? first?.from?.name ?? "Unknown";
  const messages = (annotation.comments ?? []).map((comment, index) =>
    normalizeCommentMessage(
      comment,
      fallbackAuthorName,
      `${annotation.annotationId}:${index}`,
    ),
  );
  const preview =
    messages[0]?.text ??
    (first?.commentText ?? first?.commentHtml ?? "").replace(/<[^>]*>/g, "").trim();

  return {
    documentId,
    annotationId: annotation.annotationId,
    annotationNumber: annotation.annotationNumber ?? null,
    authorName: fallbackAuthorName,
    preview: preview || "(no text)",
    statusName: annotation.status?.name ?? null,
    replyCount: Math.max((annotation.comments?.length ?? 1) - 1, 0),
    lastUpdated: toMillis(annotation.lastUpdated ?? annotation.createdAt),
    messages,
  };
}

export async function fetchAllComments(): Promise<AllCommentItem[]> {
  const veltApiKey = process.env.NEXT_PUBLIC_VELT_API_KEY;
  const veltAuthToken = process.env.VELT_AUTH_TOKEN;

  if (!veltApiKey || !veltAuthToken) {
    throw new Error("Server configuration error: missing Velt credentials");
  }

  const items: AllCommentItem[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchWithGuardrails(VELT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-velt-api-key": veltApiKey,
        "x-velt-auth-token": veltAuthToken,
      },
      body: JSON.stringify({
        data: {
          organizationId: VELT_ORGANIZATION_ID,
          groupByDocumentId: true,
          pageSize: 1000,
          ...(pageToken ? { pageToken } : {}),
        },
      }),
      requestId: crypto.randomUUID(),
      where: "api/comments/all",
      dependency: "velt",
      ...DEFAULT_POLICY,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Velt request failed (${response.status}): ${body.slice(0, 500)}`,
      );
    }

    const json = (await response.json()) as {
      result?: {
        data?: Record<string, VeltAnnotation[]> | VeltAnnotation[] | null;
        nextPageToken?: string;
      };
    };

    const data = json.result?.data;
    if (Array.isArray(data)) {
      data.forEach((annotation) => items.push(normalize("", annotation)));
    } else if (data && typeof data === "object") {
      for (const [documentId, annotations] of Object.entries(data)) {
        (annotations ?? []).forEach((annotation) =>
          items.push(normalize(documentId, annotation)),
        );
      }
    }

    pageToken = json.result?.nextPageToken || undefined;
    if (!pageToken) break;
  }

  return items;
}
