import { defineTool } from "eve/tools";
import { z } from "zod";

import { searchHelpArticles } from "../lib/app-help-articles.js";

export default defineTool({
  description:
    "Search Alleato PM app help articles for source-backed workflow, navigation, permission, feature-status, and training guidance. This is read-only.",
  inputSchema: z.object({
    query: z.string().min(2).describe("The app behavior, workflow, or feature question to search for."),
    limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of matching articles."),
  }),
  outputSchema: z.object({
    query: z.string(),
    resultCount: z.number().int(),
    results: z.array(
      z.object({
        slug: z.string(),
        title: z.string(),
        description: z.string(),
        module: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        relatedRoutes: z.array(z.string()),
        sourcePath: z.string(),
        score: z.number(),
        excerpt: z.string(),
      }),
    ),
  }),
  async execute({ query, limit }) {
    const results = await searchHelpArticles(query, limit);
    return {
      query,
      resultCount: results.length,
      results,
    };
  },
  toModelOutput(output) {
    if (output.resultCount === 0) {
      return {
        type: "text",
        value: `No app help articles matched "${output.query}". Say what was checked and ask for a more specific workflow or route.`,
      };
    }

    return {
      type: "json",
      value: {
        query: output.query,
        results: output.results.map((result) => ({
          title: result.title,
          sourcePath: result.sourcePath,
          relatedRoutes: result.relatedRoutes,
          excerpt: result.excerpt,
        })),
      },
    };
  },
});
