import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { recomputeSourceIntelligence } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated dry-run for bounded source intelligence recompute. Requires sourceDocumentId or projectId.",
  inputSchema: z.object({
    sourceDocumentId: z.string().min(1).optional(),
    projectId: z.number().int().positive().optional(),
    dryRun: z.boolean().default(true),
  }),
  outputSchema: MaintainerReportSchema,
  approval: always(),
  async execute(input) {
    return await recomputeSourceIntelligence(input);
  },
});
