import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Eve 0.22.6 documents `agent` as a built-in but rejects disableTool() for
 * that slug at runtime. Override it with a fail-closed implementation so no
 * child session can be dispatched. Remove this override when Eve supports the
 * same disable sentinel for `agent` that it supports for the other defaults.
 */
export default defineTool({
  description: "Subagent delegation is disabled for the Alleato Assistant.",
  inputSchema: z.object({}).strict(),
  execute() {
    throw new Error(
      "Subagent delegation is disabled for the Alleato Assistant.",
    );
  },
});
