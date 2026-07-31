import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkProjectMapDrift } from "../lib/docs.js";
import { DocFindingSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Prove whether docs/architecture/PROJECT-MAP.md is stale by re-running `npm run map:project` and diffing. Side-effect-free: restores the file after comparing. Returns warn when regeneration would change it.",
  inputSchema: z.object({}),
  outputSchema: DocFindingSchema,
  async execute() {
    return await checkProjectMapDrift();
  },
});
