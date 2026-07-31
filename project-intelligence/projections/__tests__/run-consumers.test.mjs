import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseConsumerReceipt, runConsumersForPacket } from "../run-consumers.mjs";
import { projectOperatingRecords, projectSourceSignals } from "../projection-fanout.mjs";

describe("Project Intelligence consumer invocation", () => {
  it("parses the final JSON receipt after diagnostic output", () => {
    assert.deepEqual(parseConsumerReceipt('diagnostic\n{"ok":true}'), { ok: true });
  });

  it("accepts only a completed receipt for the requested packet", () => {
    const receipt = { ok: true, packetId: "packet-1", runContract: { status: "completed" } };
    assert.deepEqual(runConsumersForPacket("packet-1", { spawn: () => ({ status: 0, stdout: JSON.stringify(receipt), stderr: "" }) }), receipt);
    assert.throws(
      () => runConsumersForPacket("packet-1", { spawn: () => ({ status: 0, stdout: JSON.stringify({ ...receipt, packetId: "other" }), stderr: "" }) }),
      /without a completed run receipt/,
    );
  });

  it("fails loudly with the rerun command when the child process fails", () => {
    assert.throws(
      () => runConsumersForPacket("packet-1", { spawn: () => ({ status: 1, stdout: "", stderr: "database unavailable" }) }),
      /Rerun: node .*--packetId packet-1/,
    );
  });
});

describe("Project Intelligence governed projection fan-out", () => {
  const packet = { id: "packet-1", packet_json: { runContract: { requestedPacketType: "current" } } };

  it("refuses promotion when source-signal readback does not reconcile", async () => {
    await assert.rejects(
      () => projectSourceSignals({
        packet,
        candidates: [{ id: 1 }, { id: 2 }],
        shouldWrite: true,
        writeCandidates: async () => ({ inserted: 2 }),
        readBackCandidates: async () => [{ count: 1 }],
      }),
      /candidate readback failed/,
    );
  });

  it("promotes the packet only after every app projection reconciles", async () => {
    const calls = [];
    const result = await projectOperatingRecords({
      packet,
      projectStateRecords: [{ project_id: 10 }],
      taskRecords: [{ id: 1 }],
      progressReports: [{ id: 1 }],
      shouldWrite: true,
      withTransaction: async (_client, callback) => callback({}),
      writeProjectCurrentState: async () => ({ updated: 1 }),
      readBackProjectCurrentState: async () => ({ expected: 1, matched: 1, missingProjectIds: [] }),
      writeTasks: async () => ({ inserted: 1 }),
      writeProgressReports: async () => ({ created: 1, refreshed: 0, skipped: 0 }),
      promoteCompletedPacket: async (_packet, receipt) => {
        calls.push(receipt);
        return { status: "completed" };
      },
      candidateCount: 2,
      candidateReadBackCount: 2,
    });
    assert.equal(result.runContract.status, "completed");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].progressReportsAccounted, 1);
  });

  it("does not promote when task or progress-report counts are incomplete", async () => {
    let promoted = false;
    await assert.rejects(
      () => projectOperatingRecords({
        packet,
        projectStateRecords: [{ project_id: 10 }],
        taskRecords: [{ id: 1 }],
        progressReports: [],
        shouldWrite: true,
        withTransaction: async (_client, callback) => callback({}),
        writeProjectCurrentState: async () => ({ updated: 1 }),
        readBackProjectCurrentState: async () => ({ matched: 1 }),
        writeTasks: async () => ({ inserted: 0 }),
        writeProgressReports: async () => ({ created: 0, refreshed: 0, skipped: 0 }),
        promoteCompletedPacket: async () => { promoted = true; },
        candidateCount: 1,
        candidateReadBackCount: 1,
      }),
      /task write failed/,
    );
    assert.equal(promoted, false);
  });
});
