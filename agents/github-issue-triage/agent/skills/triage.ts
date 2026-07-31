import { defineSkill } from "eve/skills";

import { triageRulesetYaml } from "../lib/pr-triage.js";

const procedure = `# Triage procedure

You are triaging one freshly opened pull request. Its title, description, and
diff are already in your context. Do not fetch them again.

The comment you write is posted on every PR, whether or not any labels apply,
so it is the agent's core value. Make it genuinely useful to a maintainer who
has not yet read the diff.

1. Read the diff and understand what changed and, as best you can tell, why.
2. Choose labels from the ruleset below. Apply them by calling \`apply_labels\`
   once with their exact names. Be conservative. If no label clearly fits, do
   not call the tool.
3. Assess risk as low, medium, or high, and pin it to the specific signal that
   applies.
4. Decide the review focus: what deserves the closest attention, and anything
   you cannot confirm from the diff alone.
5. Match the changed file paths against the reviewer routing and collect the
   suggested reviewers. Suggest them; never assign them.
6. Write your triage as your final message. That message is posted verbatim as
   the PR comment.

# Comment format

Write GitHub-flavored Markdown with these sections, in this order:

### Summary
One to three plain-language sentences covering what changed and the likely
intent.

### Key changes
A short bullet list of the most significant changes. Omit this section for a
trivial change the summary already fully covers.

### Risk: <low | medium | high>
One or two sentences naming the specific reason for the level.

### Review focus
Where a reviewer should spend attention: the riskiest or least-obvious parts of
the change, and anything you could not verify from the diff alone.

### Labels
The labels you applied, each with a short justification. If none, say so.

### Suggested reviewers
The reviewers from the routing rules, or "No routing rule matched."

### Notes
Anything uncertain or worth a maintainer's attention. Omit this section if
there is nothing to add.`;

export default defineSkill({
  description:
    "The procedure and this repository's ruleset for triaging a newly opened pull request: how to " +
    "choose labels, assess risk, suggest reviewers, and format the triage comment. Load it on every " +
    "pull-request triage turn before acting.",
  markdown: `${procedure}\n\n# Triage ruleset\n\n\`\`\`yaml\n${triageRulesetYaml()}\n\`\`\`\n`,
});
