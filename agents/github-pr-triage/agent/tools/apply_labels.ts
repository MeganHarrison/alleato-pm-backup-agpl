import { defineTool } from "eve/tools";
import { z } from "zod";
import { githubRequest, githubTargetFromAuth } from "#lib/github.js";

interface RepoLabel {
  readonly name: string;
}

export default defineTool({
  description:
    "Apply triage labels to the pull request that triggered this turn. Pass the exact label names " +
    "from the triage ruleset. Labels that don't exist in the repository are ignored. Call this once, " +
    "after deciding the labels from the diff.",
  inputSchema: z.object({
    labels: z.array(z.string().min(1)).min(1).describe("Exact label names from the triage ruleset to apply to this PR."),
  }),
  async execute({ labels }, ctx) {
    const target = githubTargetFromAuth(ctx.session.auth);
    const existing = await githubRequest<RepoLabel[]>({
      method: "GET",
      path: `/repos/${target.owner}/${target.repo}/labels?per_page=100`,
      installationId: target.installationId,
    });
    const existingNames = new Set(existing.map((label) => label.name));

    const requested = [...new Set(labels)];
    const applied = requested.filter((label) => existingNames.has(label));
    const skipped = requested.filter((label) => !existingNames.has(label));

    if (applied.length > 0) {
      await githubRequest({
        method: "POST",
        path: `/repos/${target.owner}/${target.repo}/issues/${target.issueNumber}/labels`,
        installationId: target.installationId,
        body: { labels: applied },
      });
    }

    return { applied, skipped };
  },
  toModelOutput(output) {
    const parts = [
      output.applied.length > 0 ? `Applied: ${output.applied.join(", ")}.` : "Applied no labels.",
    ];
    if (output.skipped.length > 0) {
      parts.push(`Ignored (no such label in repo): ${output.skipped.join(", ")}.`);
    }
    return { type: "text", value: parts.join(" ") };
  },
});
