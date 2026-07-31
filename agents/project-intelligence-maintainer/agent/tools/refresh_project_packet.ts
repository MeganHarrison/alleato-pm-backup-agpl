import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { refreshProjectPacket } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated bounded refresh for one Project Intelligence packet. Requires projectId or targetId and read-back proof.",
  inputSchema: z.object({
    projectId: z.number().int().positive().optional(),
    targetId: z.string().uuid().optional(),
    reason: z.string().min(5),
    dryRun: z.boolean().default(true),
  }),
  outputSchema: MaintainerReportSchema,
  approval: always(),
  async execute(input) {
    return await refreshProjectPacket(input);
  },
});
