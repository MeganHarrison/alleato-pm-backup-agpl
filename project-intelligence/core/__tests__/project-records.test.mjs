import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertBriefProjectCoverage,
  assertProjectRecordCoverage,
  extractProjectRecords,
  normalizeProjectRecord,
} from "../project-records.mjs";

describe("Project Intelligence operating records", () => {
  const sources = [
    { projectId: 10, projectName: "Union Collective" },
    { projectId: 20, projectName: "Goodwill Brookville" },
  ];

  it("normalizes model output without inventing unsupported health values", () => {
    assert.deepEqual(normalizeProjectRecord({ healthStatus: "bad", needsAttention: [" a ", ""] }, 10, "Union"), {
      projectId: 10, projectName: "Union", healthStatus: "unknown", whatChanged: "",
      needsAttention: ["a"], openDecisions: [], activeRisks: [], financialRead: "",
      scheduleRead: "", fieldRead: "", confidence: null,
    });
  });

  it("drops model records for projects outside the requested batch", async () => {
    const records = await extractProjectRecords({
      sources,
      detailedReport: "report",
      businessDate: "2026-07-21",
      modelCall: async () => JSON.stringify({ records: [
        { projectName: "Union Collective", healthStatus: "watch" },
        { projectName: "Invented Project", healthStatus: "critical" },
      ] }),
    });
    assert.deepEqual(records.map((record) => record.projectId), [10]);
  });

  it("refuses publication when either brief or operating-record coverage is incomplete", () => {
    assert.throws(() => assertBriefProjectCoverage(sources, { projects: [{ name: "Union Collective" }] }), /Goodwill Brookville/);
    assert.throws(
      () => assertProjectRecordCoverage(sources, { projects: sources.map((source) => ({ name: source.projectName })) }, [{ projectId: 10 }]),
      /missing project records.*Goodwill Brookville/,
    );
  });
});
