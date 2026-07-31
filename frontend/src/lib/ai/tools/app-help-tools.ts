import { tool } from "ai";
import { z } from "zod";
import { getHelpActionsForIds } from "@/lib/help-actions";
import { searchHelpArticles } from "@/lib/help-articles";
import {
  searchAppSurface,
  appSurfaceStats,
} from "@/lib/app-surface/search";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";

type CreateAppHelpToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateAppHelpToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

export function createAppHelpTools(options: CreateAppHelpToolsOptions = {}) {
  return {
    searchAppHelp: tool({
      description:
        "Search the controlled Alleato OS help center for instructions on how " +
        "to use this application. Use this first for questions like 'how do I', " +
        "'where do I', 'show me how to', app setup, user management, profile " +
        "settings, permissions, and feature walkthroughs. Only published " +
        "AI-visible help articles are returned.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The user's app-help question or feature name to search for."),
        category: z
          .string()
          .optional()
          .describe("Optional help category filter when the user names a category."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .default(5)
          .describe("Maximum number of help articles to return."),
      }),
      execute: withTrace(
        "searchAppHelp",
        options,
        async ({ query, category, limit }) => {
          const matches = await searchHelpArticles(query, {
            defaultAiHelpOnly: true,
            category,
            limit,
          });

          return {
            query,
            category: category ?? "all",
            resultCount: matches.length,
            results: matches.map(({ article, score, excerpt }) => ({
              sourceLabel: "App Help",
              knowledgeType: "app_help",
              title: article.frontmatter.title,
              description: article.frontmatter.description,
              href: article.href,
              module: article.frontmatter.module,
              category: article.frontmatter.category,
              tags: article.frontmatter.tags,
              relatedRoutes: article.frontmatter.related_routes,
              relatedActions: article.frontmatter.related_actions,
              actionCapabilities: getHelpActionsForIds(
                article.frontmatter.related_actions,
              ).map((action) => ({
                id: action.id,
                label: action.label,
                description: action.description,
                status: action.status,
                safetyLevel: action.safetyLevel,
                toolName: action.toolName ?? null,
                unavailableReason: action.unavailableReason ?? null,
              })),
              score,
              excerpt,
            })),
            message:
              matches.length > 0
                ? `Found ${matches.length} app help article(s).`
                : "No AI-visible help article matched that question yet.",
          };
        },
      ),
    }),

    findAppPage: tool({
      description:
        "Find which page, screen, or AI tool in this application does something, " +
        "by purpose. Use for 'where do I…', 'what page shows…', 'does the app " +
        "have a…', 'which screen lets me…'. Searches the generated inventory of " +
        "every production route and AI tool (not just curated help articles), matching on what " +
        "each page does — so it finds pages even when the user doesn't know the " +
        "name. Returns route URLs you can link the user to. Prefer searchAppHelp " +
        "for step-by-step instructions; use this to locate a page or capability.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "What the user is trying to do or find, in plain words (e.g. 'run internal workflows', 'see project budget', 'change order page').",
          ),
        kind: z
          .enum(["page", "tool", "any"])
          .optional()
          .default("any")
          .describe("Restrict to UI pages, AI tools, or both (default)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(15)
          .optional()
          .default(8)
          .describe("Maximum number of matches to return."),
      }),
      execute: withTrace(
        "findAppPage",
        options,
        async ({ query, kind, limit }) => {
          const kinds =
            kind === "any" || !kind
              ? (["page", "tool"] as const)
              : ([kind] as const);
          const results = searchAppSurface(query, {
            limit,
            kinds: [...kinds],
          });
          const stats = appSurfaceStats();

          return {
            query,
            resultCount: results.length,
            results: results.map((r) => ({
              knowledgeType: "app_surface",
              kind: r.kind,
              title: r.title,
              description: r.description,
              href: r.kind === "page" ? r.ref : null,
              toolName: r.kind === "tool" ? r.ref : null,
              score: r.score,
            })),
            coverage: `Index covers ${stats.pages} pages (${stats.describedPages} with a description) and ${stats.tools} AI tools.`,
            message:
              results.length > 0
                ? `Found ${results.length} matching ${kind === "tool" ? "tool" : kind === "page" ? "page" : "surface"}(s).`
                : "No page or tool matched. The target page may exist but lack a description in the index — say so rather than asserting it doesn't exist.",
          };
        },
      ),
    }),
  };
}
