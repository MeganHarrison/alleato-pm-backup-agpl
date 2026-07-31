/**
 * PROCORE DOCS — STREAMING CHAT API
 *
 * Streaming companion to /api/procore-docs/ask.
 * Uses the same RAG pipeline (query expansion + vector search) but returns
 * an AI SDK v6 UIMessage stream instead of a JSON blob.
 *
 * Embeddings use the shared OpenAI provider config. Chat completion uses AI SDK
 * streamText via getLanguageModel.
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient as createAuthClient, getApiRouteUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "@/lib/ai/provider-config";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { z } from "zod";

export const maxDuration = 60;

const PROCORE_DOCS_MODEL = "gpt-4o-mini";

// OpenAI client for embeddings.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const config = getOpenAICompatibleClientConfig("Procore docs chat embeddings");
    _openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }
  return _openai;
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

interface SearchResult {
  chunk_id: number;
  article_id: number;
  title: string;
  url: string;
  heading: string | null;
  chunk_text: string;
  category: string | null;
  similarity: number;
}

const ProcoreDocsChatSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
});

/** Extracts plain text from AI SDK UI message parts for model input. */
function extractTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

async function searchDocuments(
  supabase: ReturnType<typeof getServiceSupabase>,
  queries: string[],
  topK: number,
): Promise<SearchResult[]> {
  const openai = getOpenAI();
  // Generate all embeddings in parallel
  const embeddingResults = await Promise.all(
    queries.map((q) =>
      openai.embeddings.create({
        model: getOpenAIModelId("text-embedding-3-large"),
        dimensions: 3072,
        input: q.substring(0, 8000),
      }),
    ),
  );

  // Run all vector searches in parallel
  const searchResponses = await Promise.all(
    embeddingResults.map((embRes) =>
      supabase.rpc("search_support_articles", {
        query_embedding: embRes.data[0].embedding,
        match_count: topK,
        match_threshold: 0.3,
      }),
    ),
  );

  const allResults: SearchResult[] = [];
  const seen = new Set<string>();

  for (const { data: rows, error } of searchResponses) {
    if (!error && rows) {
      for (const r of rows) {
        const key = String(r.chunk_id);
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(r as SearchResult);
        }
      }
    }
  }

  return allResults
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK * 2);
}

const SYSTEM_PROMPT = `You are an expert Procore construction software assistant with deep knowledge of project management, budgeting, scheduling, and construction workflows.

## Response guidelines

- Provide clear, actionable answers with step-by-step instructions when relevant
- Cite sources inline using [Source N] notation when referencing retrieved docs
- Explain WHY things work the way they do, not just HOW
- When docs are incomplete, suggest related features or ask clarifying questions
- Never say "I don't have information on that" — always reason toward a helpful response`;

export const POST = withApiGuardrails(
  "/api/procore-docs/chat#POST",
  async ({ request }) => {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/procore-docs/chat#POST",
      message: "Unauthorized Procore docs chat request.",
      status: 401,
      severity: "medium",
    });
  }

  const { messages } = await parseJsonBody(
    request,
    ProcoreDocsChatSchema,
    "/api/procore-docs/chat#POST",
  ) as { messages: UIMessage[] };

  if (!messages?.length) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/procore-docs/chat#POST",
      message: "messages is required.",
      status: 400,
      severity: "low",
    });
  }

  // Extract query text from the last user message parts
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const query =
    lastUserMessage?.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";

  if (!query.trim()) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/procore-docs/chat#POST",
      message: "No query text in messages.",
      status: 400,
      severity: "low",
    });
  }

  const supabase = getServiceSupabase();

  const modelMessages = messages.flatMap((message): ModelMessage[] => {
    const content = extractTextFromMessage(message);
    if (!content) return [];
    if (message.role === "assistant" || message.role === "user") {
      return [{ role: message.role, content }];
    }
    return [];
  });

  // RAG: embed the user's question and run an indexed (HNSW) vector search.
  // An LLM query-expansion step used to run here but was removed: it added
  // ~6-7s of blocking latency AND degraded relevance (e.g. "publish drawings"
  // expanded to "publish artwork"/"illustrations", which don't exist in the
  // construction-docs corpus). Searching the literal question retrieves better.
  const tSearch = Date.now();
  const searchResults = await searchDocuments(supabase, [query], 10);
  console.log("[procore-docs/chat] retrieval timing", {
    searchMs: Date.now() - tSearch,
    resultCount: searchResults.length,
  });

  // Build system prompt with retrieved context
  let systemWithContext = SYSTEM_PROMPT;

  if (searchResults.length > 0) {
    const context = searchResults
      .slice(0, 10)
      .map((r, i) => {
        const heading = r.heading ? ` › ${r.heading}` : "";
        return `[Source ${i + 1}] (${Math.round(r.similarity * 100)}% relevance)\nTitle: ${r.title}${heading}\nURL: ${r.url}\nContent: ${r.chunk_text}`;
      })
      .join("\n\n---\n\n");

    systemWithContext += `\n\n### Retrieved Documentation\n${context}`;

    const hasStrongMatch = (searchResults[0]?.similarity ?? 0) > 0.7;
    if (!hasStrongMatch) {
      const topics = [
        ...new Set(searchResults.map((r) => r.category).filter(Boolean)),
      ];
      systemWithContext += `\n\n### Note\nNo perfect match found. Available topics: ${topics.join(", ")}. Use reasoning to provide a helpful response.`;
    }
  } else {
    systemWithContext += `\n\n### Note\nNo documentation matched this query. Use your construction expertise to assist the user.`;
  }

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // Stream tokens as they are produced. Buffering the whole answer with
      // generateText made the first byte arrive ~30-40s late, which the browser
      // surfaced as "Load failed" and pinned the dev server under memory pressure.
      const result = streamText({
        model: getLanguageModel(PROCORE_DOCS_MODEL),
        instructions: systemWithContext,
        messages: modelMessages.length > 0
          ? modelMessages
          : [{ role: "user", content: query }],
        maxOutputTokens: 1500,
        onError: ({ error }) => {
          console.error("[procore-docs/chat] streamText error", {
            message: error instanceof Error ? error.message : String(error),
          });
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: () =>
      "An error occurred while processing your request. Please try again.",
  });

  return createUIMessageStreamResponse({ stream });
},
);
