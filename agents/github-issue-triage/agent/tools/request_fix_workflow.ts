import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import { FixWorkflowApprovalSchema, FixWorkflowRequestSchema } from "../lib/result-schema.js";

export default defineTool({
  description:
    "Approval-gated bounded fix workflow contract for a triaged GitHub issue. Does not mutate the repository in v1.",
  inputSchema: FixWorkflowRequestSchema,
  outputSchema: FixWorkflowApprovalSchema,
  approval: always(),
  async execute(input) {
    return {
      boundedScopeSummary: input.boundedScopeSummary,
      deliveryMode: input.route === "direct-to-main" ? "main" : "pull-request",
      issueNumber: input.issueNumber,
      owner: input.owner,
      repo: input.repo,
      route: input.route,
      status: "approved" as const,
      verificationPlan: input.verificationPlan,
    };
  },
});
