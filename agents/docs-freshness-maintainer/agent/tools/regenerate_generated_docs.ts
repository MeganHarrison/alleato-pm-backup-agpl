import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { regenerateGeneratedDocs } from "../lib/docs.js";
import { DocReportSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated regeneration of the generated docs (PROJECT-MAP via map:project, TABLE-LIST via db:inventory). With dryRun=true (default) it reports the diff and restores the files. With dryRun=false it leaves the regenerated output staged in the working tree for a human to review and open a PR. It never commits or pushes.",
  inputSchema: z.object({
    dryRun: z.boolean().default(true),
  }),
  outputSchema: DocReportSchema,
  approval: always(),
  async execute({ dryRun }) {
    return await regenerateGeneratedDocs({ dryRun });
  },
});
