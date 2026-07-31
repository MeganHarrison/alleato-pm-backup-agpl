import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Stale packet questions should use maintainer tooling and distinguish packet generated time from source signal time.",
  async test(t) {
    await t.send("Find stale Project Intelligence packet data with a 36 hour threshold and explain the generated_at and last_signal_at fields.");
    t.succeeded();
    t.calledTool("check_stale_project_data");
    t.check(t.reply, includes("generated_at"));
    t.check(t.reply, includes("last_signal_at"));
  },
});
