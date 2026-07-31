import { defineTool } from "eve/tools";
import { z } from "zod";

import { provePacketEvidence } from "../lib/maintenance.js";
import { MaintainerReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Run the existing Project Intelligence read-proof verifier to prove packet evidence traces to full source reads.",
  inputSchema: z.object({
    days: z.number().int().min(1).max(30).default(1),
    family: z.literal("fireflies").default("fireflies"),
  }),
  outputSchema: MaintainerReportSchema,
  async execute(input) {
    return await provePacketEvidence(input);
  },
});
