import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { retryFailedPacketJobs } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated dry-run for retrying failed packet jobs. Requires projectId or targetId and a bounded limit.",
  inputSchema: z.object({
    projectId: z.number().int().positive().optional(),
    targetId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(25).default(10),
    dryRun: z.boolean().default(true),
  }),
  outputSchema: MaintainerReportSchema,
  approval: always(),
  async execute(input) {
    return await retryFailedPacketJobs(input);
  },
});
