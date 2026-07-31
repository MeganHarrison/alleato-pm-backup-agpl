/**
 * Web Search Tool — Powered by Tavily
 *
 * Provides real-time web research capability for the AI agents.
 * Used by VP BD for competitive/market intelligence, industry trends,
 * and any question requiring current external knowledge.
 *
 * Tavily is a search API purpose-built for AI agents — it returns
 * clean, pre-processed results rather than raw HTML, ideal for LLM consumption.
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";

type ToolTracePayload = {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  timestamp: string;
};

export type CreateWebSearchToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  toolName: string,
  options: CreateWebSearchToolsOptions,
  fn: (input: TInput) => Promise<TResult>,
) {
  return async (input: TInput): Promise<TResult> => {
    const timestamp = new Date().toISOString();
    try {
      const result = await fn(input);
      options.onTrace?.({
        tool: toolName,
        input,
        output: result,
        timestamp,
      });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      options.onTrace?.({
        tool: toolName,
        input,
        error,
        timestamp,
      });
      throw err;
    }
  };
}

export function createWebSearchTools(
  options: CreateWebSearchToolsOptions = {},
): ToolSet {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // Return empty tools if no key configured — agents degrade gracefully
    return {};
  }

  const client = tavily({ apiKey });

  return {
    /**
     * searchWeb — General web research.
     *
     * Use for: competitive analysis, industry trends, market intelligence,
     * company research, construction cost indices, regulatory updates,
     * technology news, or any question requiring current external knowledge.
     */
    searchWeb: tool({
      description:
        "Search the web for real-time information. Use this for competitive analysis, " +
        "industry trends, market intelligence, company research, construction cost data, " +
        "technology news, regulatory updates, or ANY question requiring current external " +
        "knowledge that isn't in our internal systems. Examples: 'What are competitors doing?', " +
        "'What's the current state of the construction market?', 'What is [company] known for?', " +
        "'What are the latest trends in construction technology?'",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search query. Be specific and targeted. Include relevant context " +
            "like industry ('construction GC'), location ('Indianapolis'), or " +
            "time frame ('2025 2026') to get more relevant results.",
          ),
        searchDepth: z
          .enum(["basic", "advanced"])
          .optional()
          .default("basic")
          .describe(
            "Search depth. Use 'basic' for quick facts. Use 'advanced' for " +
            "deep research, competitive analysis, or when you need comprehensive " +
            "coverage of a topic. Advanced uses more credits.",
          ),
        maxResults: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .default(5)
          .describe("Number of search results to return (1 to 10). Default 5."),
        includeAnswer: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Include a Tavily-generated AI answer summarizing the results. " +
            "Recommended: true. Gives a clean synthesized answer alongside raw sources.",
          ),
      }),
      execute: withTrace(
        "searchWeb",
        options,
        async ({ query, searchDepth, maxResults, includeAnswer }) => {
          try {
            const response = await client.search(query, {
              searchDepth: searchDepth ?? "basic",
              maxResults: maxResults ?? 5,
              includeAnswer: includeAnswer ?? true,
            });

            const results = response.results.map((r) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
              publishedDate: r.publishedDate ?? null,
            }));

            return {
              sourceRef: `[Source: Web Search — "${query}"]`,
              query,
              answer: response.answer ?? null,
              results,
              resultCount: results.length,
              note:
                "These are live web results. Cite specific sources when referencing this data. " +
                "Prioritize results with high relevance scores and recent publication dates.",
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              sourceRef: `[Source: Web Search — "${query}"]`,
              query,
              error: message,
              results: [],
              resultCount: 0,
              note: "Web search failed. Provide analysis based on available internal data and note the limitation.",
            };
          }
        },
      ),
    }),

    /**
     * researchCompany — Targeted company/competitor research.
     *
     * Use when asked about a specific company — who they are, what they build,
     * recent news, notable projects, market positioning, etc.
     */
    researchCompany: tool({
      description:
        "Research a specific company — competitor, client, subcontractor, or prospect. " +
        "Returns current info: what they do, recent news, project portfolio, " +
        "market positioning, and any notable developments. Use for: " +
        "'Tell me about [competitor]', 'What is [client] known for?', " +
        "'What recent projects has [GC] won?', 'How big is [company]?'",
      inputSchema: z.object({
        companyName: z
          .string()
          .describe("The company name to research"),
        context: z
          .string()
          .optional()
          .describe(
            "Optional context to narrow the research. E.g., 'construction GC in Indianapolis', " +
            "'commercial real estate developer', 'concrete subcontractor Indiana'",
          ),
        focusArea: z
          .enum(["general", "projects", "news", "financials", "competitive"])
          .optional()
          .default("general")
          .describe(
            "What aspect of the company to focus on. 'general' = overview, " +
            "'projects' = recent project wins/portfolio, 'news' = recent news, " +
            "'financials' = size/revenue/growth, 'competitive' = market position vs competitors",
          ),
      }),
      execute: withTrace(
        "researchCompany",
        options,
        async ({ companyName, context, focusArea }) => {
          try {
            const focusQueries: Record<string, string> = {
              general: `${companyName} ${context ?? "company"} overview what they do`,
              projects: `${companyName} recent construction projects won 2024 2025 2026`,
              news: `${companyName} ${context ?? ""} news 2025 2026`,
              financials: `${companyName} revenue size employees growth`,
              competitive: `${companyName} ${context ?? "construction"} competitive position differentiators`,
            };

            const query = focusQueries[focusArea ?? "general"];

            const response = await client.search(query, {
              searchDepth: "advanced",
              maxResults: 6,
              includeAnswer: true,
            });

            const results = response.results.map((r) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
              publishedDate: r.publishedDate ?? null,
            }));

            return {
              sourceRef: `[Source: Company Research — "${companyName}"]`,
              companyName,
              focusArea,
              summary: response.answer ?? null,
              results,
              resultCount: results.length,
              note:
                "Cite specific sources when making claims about this company. " +
                "Web data may not be perfectly current — note publication dates when relevant.",
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              sourceRef: `[Source: Company Research — "${companyName}"]`,
              companyName,
              error: message,
              results: [],
              resultCount: 0,
            };
          }
        },
      ),
    }),

    /**
     * searchConstructionMarket — Construction-specific market research.
     *
     * Pre-scoped to construction industry context for cleaner results.
     * Use for: labor costs, material prices, market conditions, regulatory changes,
     * construction technology trends, regional market activity.
     */
    searchConstructionMarket: tool({
      description:
        "Search for construction industry market intelligence: labor costs, material " +
        "prices (steel, concrete, lumber), regional market conditions, permit activity, " +
        "construction technology trends, union rates, ENR data, or regulatory changes. " +
        "Pre-scoped to construction so results are more relevant than a general search. " +
        "Use for: 'What are current steel prices?', 'How is the Indianapolis construction " +
        "market doing?', 'What AI tools are GCs using?', 'What's the labor market like?'",
      inputSchema: z.object({
        topic: z
          .string()
          .describe(
            "The market topic to research. Be specific: 'steel prices 2026', " +
            "'Indianapolis commercial construction market', 'AI construction technology GC', " +
            "'concrete labor costs midwest'",
          ),
        region: z
          .string()
          .optional()
          .describe(
            "Optional geographic focus. E.g., 'Indiana', 'Midwest', 'national'. " +
            "Leave blank for national/global scope.",
          ),
      }),
      execute: withTrace(
        "searchConstructionMarket",
        options,
        async ({ topic, region }) => {
          try {
            const regionClause = region ? ` ${region}` : " construction industry";
            const query = `${topic}${regionClause} 2025 2026`;

            const response = await client.search(query, {
              searchDepth: "advanced",
              maxResults: 6,
              includeAnswer: true,
            });

            const results = response.results.map((r) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
              publishedDate: r.publishedDate ?? null,
            }));

            return {
              sourceRef: `[Source: Construction Market Research — "${topic}"]`,
              topic,
              region: region ?? "national",
              marketSummary: response.answer ?? null,
              results,
              resultCount: results.length,
              note:
                "Always cite your sources for market data. Construction market conditions " +
                "can shift quickly — note publication dates and flag if data may be outdated.",
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              sourceRef: `[Source: Construction Market Research — "${topic}"]`,
              topic,
              error: message,
              results: [],
              resultCount: 0,
            };
          }
        },
      ),
    }),
  };
}
