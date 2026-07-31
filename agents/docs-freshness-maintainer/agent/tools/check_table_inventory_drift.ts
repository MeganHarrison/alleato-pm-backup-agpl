import { defineTool } from "eve/tools";
import { z } from "zod";

import { checkTableInventoryDrift } from "../lib/docs.js";
import { DocFindingSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Prove whether docs/architecture/TABLE-LIST.md is stale by re-running `npm run db:inventory` (regenerates from tables.yaml) and diffing. Side-effect-free: restores the file after comparing. Returns blocked when the generator cannot reach the database.",
  inputSchema: z.object({}),
  outputSchema: DocFindingSchema,
  async execute() {
    return await checkTableInventoryDrift();
  },
});
