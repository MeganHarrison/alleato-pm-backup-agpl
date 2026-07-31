import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Missing triage config should fail loudly as blocked.",
  async test(t) {
    await t.send("Issue title: export button broken. Pretend the triage config is missing and explain the blocked state.");
    t.succeeded();
    t.calledTool("triage_issue");
    t.check(t.reply, includes("Path: blocked"));
  },
});
