import { defineTool } from "eve/tools";
import { z } from "zod";

import { summarizeDocFindings } from "../lib/docs.js";
import { DocReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Run every read-only freshness check (PROJECT-MAP drift, TABLE-LIST drift, AI-RAG-ARCHITECTURE staleness) and return one compact report. By default reports only warn/fail/blocked findings; set includeHealthy to also list passing artifacts.",
  inputSchema: z.object({
    includeHealthy: z.boolean().default(false),
  }),
  outputSchema: DocReportSchema,
  async execute({ includeHealthy }) {
    return await summarizeDocFindings({ includeHealthy });
  },
});
