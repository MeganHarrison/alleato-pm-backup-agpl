import { defineTool } from "eve/tools";
import { z } from "zod";

import { inspectTargets } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Read active Project Intelligence targets and latest packet/evidence/failed-job state. Use before making health claims.",
  inputSchema: z.object({
    projectId: z.number().int().positive().optional(),
    targetId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    maxPacketAgeHours: z.number().positive().default(36),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await inspectTargets(input);
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        status: output.status,
        summary: output.summary,
        findings: output.findings.slice(0, 10),
      },
    };
  },
});
