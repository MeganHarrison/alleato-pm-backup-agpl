import {
  decideTriageAction,
  DEFAULT_TRIAGE_CONFIG,
  type TriageVerdict,
} from "../autonomous-triage-decision";

const verdict = (partial: Partial<TriageVerdict>): TriageVerdict => ({
  decision: "keep",
  confidence: 0.5,
  rationale: "",
  ...partial,
});

describe("decideTriageAction (autonomous triage safety gate)", () => {
  it("promotes only a confident promote verdict", () => {
    expect(decideTriageAction(verdict({ decision: "promote", confidence: 0.9 }))).toBe(
      "promote",
    );
  });

  it("archives only a confident archive verdict", () => {
    expect(decideTriageAction(verdict({ decision: "archive", confidence: 0.85 }))).toBe(
      "archive",
    );
  });

  it("keeps a low-confidence promote (below threshold) for human review", () => {
    expect(decideTriageAction(verdict({ decision: "promote", confidence: 0.79 }))).toBe(
      "keep",
    );
  });

  it("keeps a low-confidence archive (below threshold)", () => {
    expect(decideTriageAction(verdict({ decision: "archive", confidence: 0.5 }))).toBe(
      "keep",
    );
  });

  it("keeps an explicit keep verdict regardless of confidence", () => {
    expect(decideTriageAction(verdict({ decision: "keep", confidence: 0.99 }))).toBe(
      "keep",
    );
  });

  it("never archives on a promote verdict or vice versa", () => {
    expect(decideTriageAction(verdict({ decision: "promote", confidence: 1 }))).not.toBe(
      "archive",
    );
    expect(decideTriageAction(verdict({ decision: "archive", confidence: 1 }))).not.toBe(
      "promote",
    );
  });

  it("respects the threshold boundary exactly (>= promotes)", () => {
    const config = { ...DEFAULT_TRIAGE_CONFIG, promoteThreshold: 0.8 };
    expect(
      decideTriageAction(verdict({ decision: "promote", confidence: 0.8 }), config),
    ).toBe("promote");
    expect(
      decideTriageAction(verdict({ decision: "promote", confidence: 0.7999 }), config),
    ).toBe("keep");
  });
});
