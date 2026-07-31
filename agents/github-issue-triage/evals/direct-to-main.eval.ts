import { defineEval } from "eve/evals";

export default defineEval({
  description: "Small export-style fixes should route to direct-to-main and pause for approval.",
  async test(t) {
    await t.send(
      "Commitment export is broken on the detail page. Fix the export button so the exact commitment export works again with targeted verification only.",
    );
    t.calledTool("triage_issue");
    t.requireInputRequest();
  },
});
