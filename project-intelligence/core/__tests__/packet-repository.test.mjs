import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPacketDatabaseConfig,
  buildPacketJson,
  persistIntelligencePacket,
} from "../packet-repository.mjs";

const input = {
  sources: [{ id: "source-1", alias: "S1", title: "Meeting", lane: "meetings", projectId: 1, projectName: "Union", sourceAt: "2026-07-21T14:00:00Z", url: "https://source/1" }],
  structured: { projects: [], callsToday: [] },
  briefMarkdown: "# Detailed report",
  dashboardMarkdown: "# Dashboard",
  laneNotes: { meetings: "notes" },
  projectRecords: [],
  corpusReceipt: { status: "complete" },
  sourceReadReceipt: { status: "complete" },
  businessDate: "2026-07-21",
  windowBounds: { startIso: "2026-07-21T04:00:00.000Z", endIso: "2026-07-22T04:00:00.000Z" },
  packetType: "current",
  compilerVersion: "test",
};

describe("Project Intelligence packet repository", () => {
  it("uses the canonical app database resolver and Supabase TLS policy", async () => {
    let resolverOptions = null;
    const config = await buildPacketDatabaseConfig("postgres://raw", {
      buildConnectionString: async (_rawUrl, options) => {
        resolverOptions = options;
        return "postgres://resolved";
      },
    });

    assert.deepEqual(resolverOptions, { includeSslMode: false });
    assert.deepEqual(config, {
      connectionString: "postgres://resolved",
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  });

  it("persists the full report separately from the dashboard brief", () => {
    const packet = buildPacketJson(input);
    assert.equal(packet.briefMarkdown, "# Detailed report");
    assert.equal(packet.dashboardMarkdown, "# Dashboard");
    assert.equal(packet.runContract.status, "staged");
  });

  it("commits atomically and rolls back on a packet write failure", async () => {
    const successfulQueries = [];
    const successfulClient = { query: async (sql) => {
      successfulQueries.push(String(sql).trim().split(/\s+/).slice(0, 3).join(" "));
      if (String(sql).includes("intelligence_targets")) return { rows: [{ id: "target" }] };
      if (String(sql).includes("intelligence_packets")) return { rows: [{ id: "packet", generated_at: "now" }] };
      return { rows: [] };
    } };
    const result = await persistIntelligencePacket(successfulClient, input);
    assert.equal(result.packetId, "packet");
    assert.equal(successfulQueries.at(-1), "commit");

    const failedQueries = [];
    const failedClient = { query: async (sql) => {
      failedQueries.push(String(sql).trim());
      if (String(sql).includes("intelligence_targets")) return { rows: [{ id: "target" }] };
      if (String(sql).includes("intelligence_packets")) throw new Error("write failed");
      return { rows: [] };
    } };
    await assert.rejects(() => persistIntelligencePacket(failedClient, input), /write failed/);
    assert.equal(failedQueries.at(-1), "rollback");
  });
});
