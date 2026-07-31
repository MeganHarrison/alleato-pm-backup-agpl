import { defineTool } from "eve/tools";
import { z } from "zod";

import { inspectDocTargets } from "../lib/docs.js";
import { DocReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "List the tracked documentation artifacts (PROJECT-MAP, TABLE-LIST, AI-RAG-ARCHITECTURE), their generators, last commit dates, and whether the RAG doc has a freshness watermark. Read-only.",
  inputSchema: z.object({}),
  outputSchema: DocReportSchema,
  async execute() {
    return await inspectDocTargets();
  },
});
