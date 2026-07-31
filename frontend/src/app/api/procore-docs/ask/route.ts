/**
 * PROCORE DOCS RAG API - ENHANCED VERSION
 *
 * Implements OpenAI's RAG best practices:
 * - Query expansion for better recall
 * - Intelligent reasoning when no exact match
 * - Clarifying questions instead of "not found"
 * - Context-aware responses with citations
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createClient as createAuthClient, getApiRouteUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "@/lib/ai/provider-config";
import { apiErrorResponse } from "@/lib/api-error";

const PROCORE_DOCS_MODEL = "gpt-4o-mini";

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// OpenAI client for embeddings.
let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const config = getOpenAICompatibleClientConfig("Procore docs embeddings");
    _openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }
  return _openai;
}

interface SearchResult {
  chunk_id: number;
  article_id: number;
  title: string;
  url: string;
  slug: string;
  heading: string | null;
  chunk_text: string;
  category: string | null;
  subcategory: string | null;
  breadcrumb: string[];
  similarity: number;
}

interface SourceResult {
  chunk_id: number;
  article_id: number;
  title: string;
  url: string;
  heading: string | null;
  chunk_text: string;
  category: string | null;
  similarity: number;
}

interface RAGResponse {
  answer: string;
  sources: SourceResult[];
  query: string;
  expandedQueries?: string[];
  reasoning?: string;
}

/**
 * Expand query using the AI Gateway — matches chat/route.ts pattern
 */
async function expandQuery(originalQuery: string): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: getLanguageModel(PROCORE_DOCS_MODEL),
      instructions: `You are a query expansion assistant for Procore construction software documentation.
Generate 2-3 alternative phrasings of the user's question that might match different wordings in the docs.
Include paraphrases using different terminology, technical terms, and related concepts.
Respond with ONLY valid JSON: { "queries": ["phrasing1", "phrasing2"] }`,
      prompt: originalQuery,
    });
    const parsed = JSON.parse(text) as { queries?: string[]; items?: string[] };
    const expanded = parsed.queries ?? parsed.items ?? [];
    return [originalQuery, ...expanded].slice(0, 4);
  } catch {
    return [originalQuery];
  }
}

/**
 * Search with multiple query variants — embeddings and searches run in parallel
 */
async function searchWithExpansion(
  supabase: ReturnType<typeof getServiceSupabase>,
  queries: string[],
  topK: number,
): Promise<SearchResult[]> {
  const openai = getOpenAIClient();

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

/**
 * Enhanced system prompt that encourages helpful behavior
 */
const SYSTEM_PROMPT = `You are an expert Procore construction software assistant with deep knowledge of project management, budgeting, scheduling, and construction workflows.

Your goal is to be GENUINELY HELPFUL, not just a search engine. Follow these principles:

## When you have relevant documentation:
- Provide clear, actionable answers
- Cite specific sources with [Source N] notation
- Include step-by-step instructions when relevant
- Explain WHY things work the way they do, not just HOW

## When documentation is incomplete or unclear:
- DO NOT just say "I don't have information on that"
- Instead, use reasoning to:
  1. Suggest related features or concepts you DO have docs for
  2. Ask clarifying questions to understand what they're really trying to accomplish
  3. Explain what Procore CAN do that might solve their underlying need
  4. Provide best practices based on similar scenarios

## Examples of GOOD responses when docs are limited:
- "I don't have specific documentation on X, but based on similar workflows, you might want to look into Y feature. Can you tell me more about what you're trying to accomplish?"
- "While I don't see direct documentation on that specific workflow, Procore's Z feature handles similar scenarios. Here's how it works..."
- "That's not directly covered in the docs I have, but typically in construction project management, you'd approach this by..."

## Examples of BAD responses:
- "I couldn't find any relevant information" (too dismissive)
- "The documentation doesn't cover that" (unhelpful)
- Just listing unrelated docs (not thoughtful)

Remember: You're an intelligent assistant with construction expertise, not just a document retriever.`;

/**
 * POST /api/procore-docs/ask
 *
 * Query the Procore documentation using enhanced RAG
 */
export const POST = withApiGuardrails(
  "procore-docs/ask#POST",
  async ({ request }) => {
  
    const supabase = getServiceSupabase();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "procore-docs/ask#POST", message: "Authentication required." });
    }
    const body = await request.json();
    const { query, topK = 5, conversationHistory = [] } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 },
      );
    }

    // Step 1: Expand + convert history in parallel (both are independent)
    const expandedQueries = await expandQuery(query);
    // Step 2: Search with all query variants (embeddings + searches parallelized internally)
    const searchResults = await searchWithExpansion(
      supabase,
      expandedQueries,
      topK,
    );
    // Step 3: Build context - even if results are limited
    const hasStrongMatch =
      searchResults.length > 0 && searchResults[0].similarity > 0.7;
    const hasWeakMatch =
      searchResults.length > 0 && searchResults[0].similarity > 0.5;

    let context = "";
    let availableTopics: string[] = [];

    if (searchResults.length > 0) {
      context = searchResults
        .slice(0, 10)
        .map((result: SearchResult, idx: number) => {
          const heading = result.heading ? ` › ${result.heading}` : "";
          return `[Source ${idx + 1}] (Relevance: ${(result.similarity * 100).toFixed(1)}%)\nTitle: ${result.title}${heading}\nURL: ${result.url}\nContent: ${result.chunk_text}`;
        })
        .join("\n\n---\n\n");

      // Extract topics from category field (now available directly)
      availableTopics = [
        ...new Set(
          searchResults
            .map((r) => r.category)
            .filter(Boolean) as string[],
        ),
      ];
    }

    // Step 4: Build conversation history (last 6 exchanges)
    type HistoryMsg = { role: "user" | "assistant"; content: string };
    const history: HistoryMsg[] = conversationHistory
      .slice(-6)
      .filter(
        (m: HistoryMsg) => m.role === "user" || m.role === "assistant",
      )
      .map((m: HistoryMsg) => ({ role: m.role, content: m.content }));

    // Add current query with injected RAG context
    let userMessage = `Question: ${query}`;

    if (searchResults.length > 0) {
      userMessage += `\n\n### Retrieved Documentation\n${context}`;

      if (!hasStrongMatch) {
        userMessage += `\n\n### Note
The search didn't find perfect matches. The results above are the most similar content available.
Available topics in the knowledge base include: ${availableTopics.join(", ")}.
Please use your reasoning to provide a helpful response even if the docs don't directly answer the question.`;
      }
    } else {
      userMessage += `\n\n### Note
No documentation was found matching this query. However, the knowledge base contains information about:
- Procore budget management and cost tracking
- Client contracts and commitments
- Change orders and change events
- Invoicing and billing
- Project management tools (drawings, emails, materials, meetings, photos, documents)
- Project directory and equipment
- Procore API documentation

Please use your expertise to:
1. Ask clarifying questions to understand what they're trying to accomplish
2. Suggest related Procore features that might help
3. Provide general best practices if applicable`;
    }

    // Step 5: Generate response via AI Gateway
    const { text: answer } = await generateText({
      model: getLanguageModel(PROCORE_DOCS_MODEL),
      instructions: SYSTEM_PROMPT,
      messages: [...history, { role: "user" as const, content: userMessage }],
    });

    // Step 6: Return enhanced response
    const response: RAGResponse = {
      answer,
      sources: searchResults.slice(0, 5).map((result: SearchResult) => ({
        chunk_id: result.chunk_id,
        article_id: result.article_id,
        title: result.title,
        url: result.url,
        heading: result.heading,
        chunk_text: result.chunk_text.substring(0, 300) + "...",
        category: result.category,
        similarity: result.similarity,
      })),
      query,
      expandedQueries: expandedQueries.slice(1), // Don't include original query
      reasoning: hasStrongMatch
        ? "Found strong matches in documentation"
        : hasWeakMatch
          ? `Partial matches found. Available topics: ${availableTopics.join(", ")}`
          : `No direct matches. Providing guidance based on available knowledge about: ${availableTopics.slice(0, 5).join(", ")}`,
    };

    return NextResponse.json(response);
    },
);
