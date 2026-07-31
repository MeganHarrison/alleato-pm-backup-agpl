import { defineTool } from "eve/tools";
import { z } from "zod";

import { summarizeFindings } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Build a compact Project Intelligence maintainer report from target snapshots, source coverage, and packet evidence proof.",
  inputSchema: z.object({
    projectId: z.number().int().positive().optional(),
    targetId: z.string().uuid().optional(),
    maxPacketAgeHours: z.number().positive().default(36),
    includeHealthy: z.boolean().default(false),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await summarizeFindings(input);
  },
});
