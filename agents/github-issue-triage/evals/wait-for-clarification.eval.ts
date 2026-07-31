import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Ambiguous issues should wait for clarification instead of requesting approval.",
  async test(t) {
    await t.send("Investigate this unclear export thing. Not sure where it breaks or what exact page it is on.");
    t.succeeded();
    t.calledTool("triage_issue");
    t.check(t.reply, includes("wait-for-clarification"));
  },
});
