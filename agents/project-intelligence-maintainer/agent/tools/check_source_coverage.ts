import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkSourceCoverage } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Run the existing source lifecycle verifier for synced, vectorized, project-assigned, task-extracted, and Project Intelligence-updated coverage.",
  inputSchema: z.object({
    days: z.number().int().min(1).max(180).default(2),
    maxPacketAgeHours: z.number().positive().default(36),
    sourceLimit: z.number().int().min(1).max(5000).default(1500),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await checkSourceCoverage(input);
  },
});
