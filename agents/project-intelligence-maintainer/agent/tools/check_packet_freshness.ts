import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkPacketFreshness } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Check Project Intelligence packet freshness using intelligence_packets.generated_at, separate from target last_signal_at.",
  inputSchema: z.object({
    projectId: z.number().int().positive().optional(),
    targetId: z.string().uuid().optional(),
    maxAgeHours: z.number().positive().default(36),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await checkPacketFreshness(input);
  },
});
