import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateExecutiveSynthesis } from "../brief-v3.mjs";

const fixture = {
  patterns: [{ id: "schedule-drift", statement: "Pattern: two milestone updates moved the handoff date.", sourceIds: ["S247"], confidence: "high" }],
  rootCauses: [{ id: "late-design-input", statement: "Inference: late design input is contributing to handoff drift.", sourceIds: ["S247"], confidence: "medium" }],
  facts: [{ id: "handoff-moved", statement: "The handoff date moved twice.", sourceIds: ["S247"], confidence: "high" }],
  inferences: [{ id: "execution-risk", statement: "Inference: the current float may be consumed.", sourceIds: ["S247"], confidence: "low" }],
  recommendations: [{ id: "confirm-recovery", statement: "Confirm the recovery date with the project team.", owner: "You", rationale: "A dated recovery path is needed before approving the next commitment.", sourceIds: ["S247"], confidence: "medium" }],
  risks: [], opportunities: [], financial: [], schedule: [], decisions: [],
  evidenceCoverage: { eligibleSourceCount: 2, citedSourceCount: 1, uncoveredSourceIds: ["S126"], note: null },
};

describe("evidence-backed executive synthesis contract", () => {
  it("accepts typed claims with claim-to-source references", () => {
    assert.deepEqual(validateExecutiveSynthesis(fixture), []);
  });

  it("rejects uncited claims and impossible coverage", () => {
    const noEvidence = { ...fixture, facts: [{ ...fixture.facts[0], sourceIds: [] }] };
    assert.match(validateExecutiveSynthesis(noEvidence).join("\n"), /needs cited sourceIds/);
    const impossibleCoverage = { ...fixture, evidenceCoverage: { ...fixture.evidenceCoverage, citedSourceCount: 3 } };
    assert.match(validateExecutiveSynthesis(impossibleCoverage).join("\n"), /exceeds eligibleSourceCount/);
  });
});
