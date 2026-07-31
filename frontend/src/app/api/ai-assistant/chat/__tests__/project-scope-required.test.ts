import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AI assistant selected-project scope guard", () => {
  const handler = readFileSync(
    resolve(__dirname, "..", "handler-v2.ts"),
    "utf8",
  );

  it("persists and renders a deterministic stop before retrieval can broaden scope", () => {
    const guardIndex = handler.indexOf(
      'if (plan.responseFormat === "project_scope_required")',
    );
    const retrievalIndex = handler.indexOf("executeRetrievalPlan(", guardIndex);

    expect(guardIndex).toBeGreaterThan(-1);
    expect(retrievalIndex).toBeGreaterThan(guardIndex);
    expect(handler).toContain('preventedFallback: "organization_wide_retrieval"');
    expect(handler).toContain('responseLabel: "project-scope-required"');
    expect(handler).toContain(
      "I stopped instead of searching every project and mixing unrelated meetings, messages, or files.",
    );
  });

  it("names direct source-specific traces from the actual reader kind", () => {
    expect(handler).toContain(
      "orchestrator: `retrieval-planner-v2-direct-${sourceSpecificKind}`",
    );
    expect(handler).not.toContain(
      'orchestrator: "retrieval-planner-v2-direct-recent-teams"',
    );
  });
});
