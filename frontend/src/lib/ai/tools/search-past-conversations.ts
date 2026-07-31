import { tool } from "ai";
import { z } from "zod";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";

type SearchPastConversationsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  sessionId?: string;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

type RpcSessionMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string | null;
  isAnchor?: boolean;
};

type SearchChatHistoryRow = {
  query: string;
  scope: {
    userId?: string;
    projectId?: number | null;
  } | null;
  result_count: number;
  status: "ok" | "empty";
  session_id: string | null;
  lineage_root_session_id: string | null;
  title: string | null;
  session_created_at: string | null;
  session_last_message_at: string | null;
  project_id: number | null;
  rank: number | null;
  headline: string | null;
  anchor_message_id: string | null;
  anchor_created_at: string | null;
  anchor_role: string | null;
  anchored_window: RpcSessionMessage[] | null;
  bookend_start: RpcSessionMessage[] | null;
  bookend_end: RpcSessionMessage[] | null;
};

export type SearchPastConversationsResult =
  | {
      ok: true;
      status: "ok";
      query: string;
      scope: {
        userId: string;
        projectId: number | null;
      };
      resultCount: number;
      results: Array<{
        sessionId: string;
        lineageRootSessionId: string;
        title: string | null;
        projectId: number | null;
        rank: number | null;
        headline: string | null;
        anchor: {
          messageId: string;
          role: string | null;
          createdAt: string | null;
        };
        anchoredWindow: RpcSessionMessage[];
        bookends: {
          start: RpcSessionMessage[];
          end: RpcSessionMessage[];
        };
        sourceRef: string;
      }>;
    }
  | {
      ok: true;
      status: "empty";
      query: string;
      scope: {
        userId: string;
        projectId: number | null;
      };
      resultCount: 0;
      results: [];
      message: string;
    }
  | {
      ok: false;
      status: "authorization_error";
      query: string;
      scope: {
        userId: string;
        projectId: number | null;
      };
      resultCount: 0;
      results: [];
      message: string;
    };

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: SearchPastConversationsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "Prior conversation recall failed. Say that session recall is unavailable for this answer and continue with current context.",
  );
}

function arrayValue(value: unknown): RpcSessionMessage[] {
  return Array.isArray(value) ? (value as RpcSessionMessage[]) : [];
}

function isAuthorizationError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("insufficient_privilege") ||
    normalized.includes("permission denied") ||
    normalized.includes("user scope") ||
    normalized.includes("authenticated user")
  );
}

function mapRowsToResult(input: {
  query: string;
  userId: string;
  projectId: number | null;
  rows: SearchChatHistoryRow[];
}): SearchPastConversationsResult {
  const first = input.rows[0];
  if (!first || first.status === "empty") {
    return {
      ok: true,
      status: "empty",
      query: input.query,
      scope: { userId: input.userId, projectId: input.projectId },
      resultCount: 0,
      results: [],
      message:
        first?.headline ??
        `No prior assistant conversations matched "${input.query}" for the requested scope.`,
    };
  }

  const results = input.rows
    .filter((row) => row.status === "ok" && row.session_id && row.anchor_message_id)
    .map((row) => ({
      sessionId: row.session_id as string,
      lineageRootSessionId: row.lineage_root_session_id ?? (row.session_id as string),
      title: row.title,
      projectId: row.project_id,
      rank: row.rank,
      headline: row.headline,
      anchor: {
        messageId: row.anchor_message_id as string,
        role: row.anchor_role,
        createdAt: row.anchor_created_at,
      },
      anchoredWindow: arrayValue(row.anchored_window),
      bookends: {
        start: arrayValue(row.bookend_start),
        end: arrayValue(row.bookend_end),
      },
      sourceRef: `[Source: Prior conversation - "${row.title ?? row.session_id}" - ${row.anchor_created_at ?? "undated"}]`,
    }));

  if (results.length === 0) {
    return {
      ok: true,
      status: "empty",
      query: input.query,
      scope: { userId: input.userId, projectId: input.projectId },
      resultCount: 0,
      results: [],
      message: `No prior assistant conversations matched "${input.query}" for the requested scope.`,
    };
  }

  return {
    ok: true,
    status: "ok",
    query: input.query,
    scope: { userId: input.userId, projectId: input.projectId },
    resultCount: first.result_count ?? results.length,
    results,
  };
}

export function createSessionSearchTools(
  userId: string,
  options: SearchPastConversationsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;

  return {
    searchPastConversations: tool({
      description:
        "Search this user's prior assistant chat messages using live chat_history full-text search. " +
        "Use for continuity questions such as what was discussed before, previous decisions, or when " +
        "the user references an earlier chat. Returns anchored message windows and session bookends. " +
        "This is not document search and must not be used for project files, meeting transcripts, or emails.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Keywords or natural language description of the prior chat topic to find."),
        projectId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional project ID to restrict recall to project-scoped conversations."),
        matchCount: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Maximum deduped conversation sessions to return."),
        windowSize: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .default(3)
          .describe("Neighboring messages to include before and after the anchor message."),
      }),
      execute: withTrace(
        "searchPastConversations",
        options,
        async ({ query, projectId, matchCount, windowSize }) => {
          const scopedProjectId =
            typeof projectId === "number" ? projectId : options.pinnedProjectId ?? null;

          const { data, error } = await supabase.rpc("search_chat_history", {
            p_query: query,
            p_user_id: userId,
            p_project_id: scopedProjectId ?? undefined,
            p_match_count: matchCount ?? 5,
            p_window_size: windowSize ?? 3,
          });

          if (error) {
            if (isAuthorizationError(error.message)) {
              return {
                ok: false,
                status: "authorization_error",
                query,
                scope: { userId, projectId: scopedProjectId },
                resultCount: 0,
                results: [],
                message: `Session recall is not authorized for user ${userId} and project scope ${scopedProjectId ?? "all"}.`,
              } satisfies SearchPastConversationsResult;
            }

            throw new Error(`searchPastConversations RPC failed: ${error.message}`);
          }

          return mapRowsToResult({
            query,
            userId,
            projectId: scopedProjectId,
            rows: (data ?? []) as SearchChatHistoryRow[],
          });
        },
      ),
    }),
  };
}

export const __test__ = {
  mapRowsToResult,
};
