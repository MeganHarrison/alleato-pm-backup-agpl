/**
 * Unit tests for scoreResponseQuality.
 *
 * Covers: meta-commentary detection, empty responses, partial retrieval,
 * high-quality responses with actual data, failed tool calls, score
 * clamping, reasons array.
 *
 * @see CLAUDE.md Rules 14 & 15 — Bug Fix Completion Gate + Regression Test Gate
 * @see frontend/src/lib/ai/score-response-quality.ts — source
 */

import {
  scoreResponseQuality,
  META_COMMENTARY_PHRASES,
  computeTraceScores,
} from "../score-response-quality";

const emptyTrace: Array<Record<string, unknown>> = [];

const traceWith = (n: number, opts?: { failed?: number }) => {
  const t: Array<Record<string, unknown>> = [];
  for (let i = 0; i < n; i++) t.push({ tool: `tool${i}`, output: {}, timestamp: "" });
  for (let i = 0; i < (opts?.failed ?? 0); i++)
    t.push({ tool: `failed${i}`, error: "err", timestamp: "" });
  return t;
};

describe("scoreResponseQuality", () => {
  describe("hasMetaCommentary", () => {
    it("is false for a normal substantive response", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "The project budget is $1.2M with 3 open change orders.",
      });
      expect(result.hasMetaCommentary).toBe(false);
    });

    it("is true for 'Let me search for that' phrasing", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Let me search for that information for you.",
      });
      expect(result.hasMetaCommentary).toBe(true);
    });

    it("is true for any single meta-commentary phrase (Array.some semantics)", () => {
      for (const phrase of META_COMMENTARY_PHRASES) {
        const result = scoreResponseQuality({
          toolTrace: emptyTrace,
          content: `Sure! ${phrase} the data you need.`,
        });
        expect(result.hasMetaCommentary).toBe(true);
      }
    });

    it("is case-insensitive", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "LET ME SEARCH FOR that right now.",
      });
      expect(result.hasMetaCommentary).toBe(true);
    });

    it("penalises score by 30 when meta-commentary detected", () => {
      const baseline = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Direct answer with no stalling.",
      });
      const filler = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Let me search for that information.",
      });
      expect(baseline.score - filler.score).toBe(30);
    });
  });

  describe("empty response", () => {
    it("returns low confidence and low source quality", () => {
      const result = scoreResponseQuality({ toolTrace: emptyTrace, content: "" });
      expect(result.confidence).toBe("low");
      expect(result.sourceQuality).toBe("low");
      expect(result.score).toBeLessThan(60);
    });
  });

  describe("partial retrieval (1 tool call, 1 source citation)", () => {
    it("returns medium confidence", () => {
      const result = scoreResponseQuality({
        toolTrace: traceWith(1),
        content: "Here is what I found. [Source: doc1.pdf]",
      });
      expect(result.confidence).toBe("medium");
      expect(result.sourceQuality).toBe("medium");
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
    });
  });

  describe("high-quality response with real data", () => {
    it("returns high confidence when 3+ tool calls and 2+ citations", () => {
      const result = scoreResponseQuality({
        toolTrace: traceWith(3),
        content: "Budget: $1.2M [Source: budget.pdf] with 3 changes [Source: co-log.xlsx].",
      });
      expect(result.confidence).toBe("high");
      expect(result.sourceQuality).toBe("high");
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("treats a compiled intelligence packet as multi-evidence even with one tool trace", () => {
      const result = scoreResponseQuality({
        toolTrace: [
          {
            tool: "clientProjectIntelligencePacket",
            output: { cardCount: 6 },
            timestamp: "",
          },
        ],
        content:
          "Current read: closeout coordination. [Source: Teams thread] [Source: Invoice follow-up]",
      });
      expect(result.confidence).toBe("high");
      expect(result.reasons).toContain("compiled intelligence packet with multiple evidence cards");
    });

    it("treats source-specific meeting retrieval rows as high source quality without inline source tags", () => {
      const result = scoreResponseQuality({
        toolTrace: [
          {
            tool: "sourceSpecificRagRetrieval",
            output: {
              rowCount: 5,
              rows: [
                { id: "meeting-1", title: "Company quarterly meeting" },
                { id: "meeting-2", title: "Ace Hardware Champaign IL" },
              ],
            },
            timestamp: "",
          },
        ],
        content:
          "The last week of meetings shows growth pressure, unresolved client decisions, and compliance follow-up risk.",
      });

      expect(result.sourceQuality).toBe("high");
      expect(result.reasons).toContain(
        "retrieval trace included 5 source-bearing record(s) without inline citations",
      );
    });

    it("keeps generic non-retrieval tools from inflating source quality", () => {
      const result = scoreResponseQuality({
        toolTrace: traceWith(3),
        content: "This has tool activity, but no source-bearing retrieval.",
      });

      expect(result.confidence).toBe("medium");
      expect(result.sourceQuality).toBe("low");
    });
  });

  describe("failed tool calls", () => {
    it("penalises score by 5 per failure", () => {
      const r1 = scoreResponseQuality({ toolTrace: traceWith(0, { failed: 1 }), content: "" });
      expect(r1.score).toBe(45); // base 50 - 5
    });

    it("caps failure penalty at 20", () => {
      const r4 = scoreResponseQuality({ toolTrace: traceWith(0, { failed: 4 }), content: "" });
      const r5 = scoreResponseQuality({ toolTrace: traceWith(0, { failed: 5 }), content: "" });
      expect(r4.score).toBe(30); // base 50 - 20 (cap)
      expect(r5.score).toBe(30); // same cap
    });

    it("does not count MCP discovery activity as successful evidence work", () => {
      const result = scoreResponseQuality({
        toolTrace: [
          { tool: "mcpToolDiscovery", status: "success", output: { tools: ["a"] } },
          { tool: "mcpToolDiscovery", status: "success", output: { tools: ["b"] } },
          { tool: "mcpToolDiscovery", status: "success", output: { tools: ["c"] } },
        ],
        content: "An answer with no verified evidence.",
      });

      expect(result.reasons).toContain("no successful tool calls");
      expect(result.sourceQuality).toBe("low");
      expect(result.score).toBe(50);
    });

    it("caps an incomplete collection even when some records were retrieved", () => {
      const result = scoreResponseQuality({
        toolTrace: [
          {
            tool: "meetingCollectionAnalysis",
            status: "failed",
            output: {
              status: "incomplete",
              coverage: { matched: 8, retrieved: 7, failed: 1, exhaustive: false },
              records: Array.from({ length: 7 }, (_, index) => ({ id: index })),
            },
          },
        ],
        content: "I stopped rather than claim the partial analysis was complete.",
      });

      expect(result.score).toBeLessThanOrEqual(25);
      expect(result.sourceQuality).toBe("low");
      expect(result.reasons).toContain(
        "collection retrieval or synthesis was incomplete; quality score capped",
      );
    });
  });

  describe("score clamping", () => {
    it("never returns score below 0", () => {
      const result = scoreResponseQuality({
        toolTrace: traceWith(0, { failed: 10 }),
        content: "Let me search for that.",
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("never returns score above 100", () => {
      const result = scoreResponseQuality({
        toolTrace: traceWith(10),
        content: "Data [Source: a] [Source: b] [Source: c]",
      });
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("reasons array", () => {
    it("includes meta-commentary reason when detected", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Let me find that for you.",
      });
      expect(result.reasons.some((r) => r.includes("meta-commentary"))).toBe(true);
    });

    it("includes tool call summary", () => {
      const result = scoreResponseQuality({ toolTrace: traceWith(3), content: "" });
      expect(result.reasons.some((r) => r.includes("multiple successful tool calls"))).toBe(true);
    });

    it("includes 'no source citations' entry when no source refs present", () => {
      const result = scoreResponseQuality({ toolTrace: emptyTrace, content: "No citations here." });
      expect(result.reasons.some((r) => r.includes("no source citations"))).toBe(true);
    });

    it("includes 'no successful tool calls' entry when trace is empty", () => {
      const result = scoreResponseQuality({ toolTrace: emptyTrace, content: "" });
      expect(result.reasons.some((r) => r.includes("no successful tool calls"))).toBe(true);
    });
  });

  describe("tool call branch boundaries", () => {
    it("gives same +12 bonus for 2 tool calls as for 1", () => {
      const one = scoreResponseQuality({ toolTrace: traceWith(1), content: "" });
      const two = scoreResponseQuality({ toolTrace: traceWith(2), content: "" });
      expect(two.score).toBe(one.score); // both get +12, not +25
    });
  });

  describe("false positive guards", () => {
    it("does not flag 'one moment' used in a historical project context", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content:
          "At one moment in the project timeline, costs exceeded the approved budget by 12%.",
      });
      expect(result.hasMetaCommentary).toBe(false);
    });

    it("does not flag 'let me check' when followed by real data inline", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Let me check: approved budget $1.2M, committed $980K, variance $220K.",
      });
      expect(result.hasMetaCommentary).toBe(false);
    });

    it("does not flag 'searching for' when used in a summary context", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "I found what you were searching for in the contract log.",
      });
      expect(result.hasMetaCommentary).toBe(false);
    });

    it("still flags 'one moment while i' as stalling", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "One moment while I retrieve that for you.",
      });
      expect(result.hasMetaCommentary).toBe(true);
    });

    it("still flags 'let me check on' as stalling", () => {
      const result = scoreResponseQuality({
        toolTrace: emptyTrace,
        content: "Let me check on that for you.",
      });
      expect(result.hasMetaCommentary).toBe(true);
    });
  });

  describe("computeTraceScores (Langfuse trace scoring)", () => {
    it("scores answered=false for an empty response", () => {
      const s = computeTraceScores({ output: "", toolCallNames: [] });
      expect(s.answered).toBe(false);
      expect(s.responseQuality).toBe(0);
    });

    it("scores answered=false when the model stalls with meta-commentary", () => {
      const s = computeTraceScores({
        output: "Let me search for that and get back to you.",
        toolCallNames: ["semanticSearch"],
      });
      expect(s.answered).toBe(false);
    });

    it("scores answered=true for a substantive answer", () => {
      const s = computeTraceScores({
        output: "AR aging: $120k current, $30k 30-60 days, $5k over 90.",
        toolCallNames: ["getARAgingReport"],
      });
      expect(s.answered).toBe(true);
      expect(s.responseQuality).toBeGreaterThan(0.5);
    });

    it("normalizes the rich scorer to 0–1 and detects tool failure", () => {
      const s = computeTraceScores({
        output: "Here is the budget summary with [Source: budget].",
        toolTrace: [
          { tool: "getBudgetLineItems", output: { rowCount: 12 } },
          { tool: "semanticSearch", error: "timeout" },
        ],
      });
      expect(s.responseQuality).toBeGreaterThan(0);
      expect(s.responseQuality).toBeLessThanOrEqual(1);
      expect(s.toolFailure).toBe(true);
    });

    it("reports toolFailure=null when no rich tool trace is provided", () => {
      const s = computeTraceScores({
        output: "An answer.",
        toolCallNames: ["semanticSearch"],
      });
      expect(s.toolFailure).toBeNull();
    });
  });
});
