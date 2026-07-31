import { defineTool } from "eve/tools";
import { z } from "zod";

import { TriageDecisionSchema } from "../lib/result-schema.js";
import { triageIssue } from "../lib/triage.js";

export default defineTool({
  description:
    "Classify a GitHub issue into direct-to-main, pr-required, wait-for-clarification, or blocked using the repo's routing policy.",
  inputSchema: z.object({
    allowedRepos: z.array(z.string()).optional(),
    body: z.string().default(""),
    issueNumber: z.number().int().positive(),
    labels: z.array(z.string()).default([]),
    owner: z.string().min(1),
    repo: z.string().min(1),
    requiredLabels: z.array(z.string()).optional(),
    title: z.string().min(1),
  }),
  outputSchema: TriageDecisionSchema,
  async execute(input) {
    return triageIssue(input);
  },
});
