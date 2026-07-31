/**
 * Tests for the code-owned LLM judge. The most important property is the SAFETY
 * GATE: it must be OFF by default so enabling it (and its LLM cost) is explicit.
 */
import { shouldRunJudge } from "../llm-judge";

describe("shouldRunJudge (safety gate)", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("is OFF when the enable flag is not set", () => {
    delete process.env.LANGFUSE_LLM_JUDGE_ENABLED;
    process.env.LANGFUSE_LLM_JUDGE_SAMPLE_RATE = "1";
    expect(shouldRunJudge()).toBe(false);
  });

  it("is OFF when enabled but sample rate is 0 / unset", () => {
    process.env.LANGFUSE_LLM_JUDGE_ENABLED = "true";
    delete process.env.LANGFUSE_LLM_JUDGE_SAMPLE_RATE;
    expect(shouldRunJudge()).toBe(false);
    process.env.LANGFUSE_LLM_JUDGE_SAMPLE_RATE = "0";
    expect(shouldRunJudge()).toBe(false);
  });

  it("always runs when enabled with rate >= 1", () => {
    process.env.LANGFUSE_LLM_JUDGE_ENABLED = "true";
    expect(shouldRunJudge({ rate: 1 })).toBe(true);
  });

  it("samples deterministically against the injected rng", () => {
    process.env.LANGFUSE_LLM_JUDGE_ENABLED = "true";
    // rate 0.2: rng 0.1 < 0.2 → run; rng 0.5 ≥ 0.2 → skip
    expect(shouldRunJudge({ rate: 0.2, rng: () => 0.1 })).toBe(true);
    expect(shouldRunJudge({ rate: 0.2, rng: () => 0.5 })).toBe(false);
  });

  it("never runs even at rate 1 if the enable flag is off", () => {
    process.env.LANGFUSE_LLM_JUDGE_ENABLED = "false";
    expect(shouldRunJudge({ rate: 1, rng: () => 0 })).toBe(false);
  });
});
