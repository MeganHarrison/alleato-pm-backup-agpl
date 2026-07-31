import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Evidence proof questions should call the read-proof verifier and include read-back language.",
  async test(t) {
    await t.send("Prove recent Project Intelligence packet evidence for Fireflies has full-source read proof.");
    t.succeeded();
    t.calledTool("prove_packet_evidence");
    t.check(t.reply, includes("read-proof"));
  },
});
