import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Weak source coverage should not be called healthy without running the lifecycle verifier.",
  async test(t) {
    await t.send("Tell me whether Project Intelligence source coverage is healthy for the last 2 days.");
    t.succeeded();
    t.calledTool("check_source_coverage");
    t.check(t.reply, includes("source lifecycle"));
  },
});
