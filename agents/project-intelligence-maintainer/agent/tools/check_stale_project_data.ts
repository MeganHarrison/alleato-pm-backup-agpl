import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkStaleProjectData } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Find active Project Intelligence targets with missing, stale, partial, failed, or weakly evidenced packets.",
  inputSchema: z.object({
    maxPacketAgeHours: z.number().positive().default(36),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await checkStaleProjectData(input);
  },
});
