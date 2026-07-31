import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkRagDocsStaleness } from "../lib/docs.js";
import { DocFindingSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    'Prove whether docs/architecture/AI-RAG-ARCHITECTURE.md is stale: read its "Last verified" date, then list commits since that date touching RAG-gated paths (frontend/src/lib/ai, backend pipeline/intelligence/graph, alleato-ai tools) that did NOT also update the doc or tables.yaml. Read-only.',
  inputSchema: z.object({
    maxCommits: z.number().int().min(1).max(50).default(12),
  }),
  outputSchema: DocFindingSchema,
  async execute({ maxCommits }) {
    return await checkRagDocsStaleness(maxCommits);
  },
});
