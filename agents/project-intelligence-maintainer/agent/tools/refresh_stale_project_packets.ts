import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { refreshStaleProjectPackets } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated dry-run for a bounded batch of stale Project Intelligence packet refreshes. No automatic mutation in v1.",
  inputSchema: z.object({
    maxPacketAgeHours: z.number().positive().default(36),
    limit: z.number().int().min(1).max(25).default(10),
    dryRun: z.boolean().default(true),
  }),
  outputSchema: MaintainerReportSchema,
  approval: always(),
  async execute(input) {
    return await refreshStaleProjectPackets(input);
  },
});
