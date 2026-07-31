import { defineEval } from "eve/evals";

export default defineEval({
  description: "Freshness questions must call a maintainer tool, not guess drift from prompt text.",
  async test(t) {
    await t.send("Is docs/architecture/PROJECT-MAP.md out of date right now?");
    t.succeeded();
    t.calledTool("check_project_map_drift");
  },
});
