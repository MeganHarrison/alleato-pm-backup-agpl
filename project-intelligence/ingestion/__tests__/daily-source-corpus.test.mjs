import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLaneReadReceipts,
  canonicalSourceProvenance,
  chunkSourcesForModel,
  fetchCompleteSourceRows,
  packSourceChunks,
} from "../daily-source-corpus.mjs";

test("canonical provenance prefers provider identity and canonical web URL", () => {
  assert.deepEqual(
    canonicalSourceProvenance({
      id: 44,
      source_item_id: "outlook-item-9",
      fireflies_id: "ff-1",
      url: "https://legacy",
      source_web_url: "https://canonical",
    }),
    { canonicalSourceId: "outlook-item-9", canonicalSourceUrl: "https://canonical" },
  );
  assert.deepEqual(canonicalSourceProvenance({ id: 44, source_web_url: "not-a-url" }), {
    canonicalSourceId: "44",
    canonicalSourceUrl: null,
  });
});

test("lane receipts distinguish valid empty lanes from failed lanes", () => {
  const classifyLane = (row) => row.lane;
  const receipts = buildLaneReadReceipts(
    [
      { id: "m1", lane: "meetings" },
      { id: "e1", lane: "emails" },
      { id: "t1", lane: "teams" },
    ],
    [{ id: "m1", lane: "meetings", text: "transcript" }],
    [
      { id: "e1", lane: "emails", reason: "source has no usable full content" },
      { id: "t1", lane: "teams", reason: "not in 2026-07-18 by row timestamp" },
    ],
    { classifyLane },
  );
  assert.equal(receipts.meetings.status, "complete");
  assert.equal(receipts.emails.status, "failed");
  assert.equal(receipts.teams.status, "valid-empty");
  assert.equal(receipts.documents.status, "valid-empty");
});
import {
  assertProjectStateWriteComplete,
  promoteCompletedPacket,
} from "../../projections/daily-deep-read-consumers.mjs";
import {
  assertSourceMaterializationComplete,
  isProviderAvailabilityError,
} from "../../core/compile-daily-executive-brief.mjs";

test("complete source enumeration paginates past the former 1,500 row cap", async () => {
  const allRows = Array.from({ length: 1_505 }, (_, index) => ({ id: `source-${index}` }));
  const commands = [];
  const client = {
    async query(sql, params = []) {
      commands.push(sql);
      if (/count\(\*\)/i.test(sql)) return { rows: [{ eligible_count: allRows.length }] };
      if (/limit \$3::int offset \$4::int/i.test(sql)) {
        const [, , limit, offset] = params;
        return { rows: allRows.slice(offset, offset + limit) };
      }
      return { rows: [] };
    },
  };

  const result = await fetchCompleteSourceRows(client, {
    startIso: "2026-07-18T04:00:00.000Z",
    endIso: "2026-07-19T04:00:00.000Z",
    pageSize: 500,
  });

  assert.equal(result.rows.length, 1_505);
  assert.deepEqual(result.receipt, {
    status: "complete",
    eligibleRows: 1_505,
    fetchedRows: 1_505,
    uniqueRows: 1_505,
    pageSize: 500,
    pageCount: 4,
  });
  assert.match(commands[0], /repeatable read read only/i);
  assert.match(commands.at(-1), /commit/i);
});

test("source enumeration rolls back and fails on a partial page", async () => {
  let page = 0;
  const client = {
    async query(sql) {
      if (/count\(\*\)/i.test(sql)) return { rows: [{ eligible_count: 3 }] };
      if (/limit \$3::int offset \$4::int/i.test(sql)) {
        page += 1;
        return { rows: page === 1 ? [{ id: "one" }, { id: "two" }] : [] };
      }
      return { rows: [] };
    },
  };
  await assert.rejects(
    fetchCompleteSourceRows(client, {
      startIso: "2026-07-18T04:00:00.000Z",
      endIso: "2026-07-19T04:00:00.000Z",
      pageSize: 2,
    }),
    /stopped at 2\/3 rows/,
  );
});

test("full-content model chunks account for every source character without truncation", () => {
  const sources = [
    { alias: "S1", lane: "meetings", title: "Long meeting", projectName: "Alpha", text: "a".repeat(25_001) },
    { alias: "S2", lane: "emails", title: "Email", projectName: "Beta", text: "hello" },
  ];
  const result = chunkSourcesForModel(sources, 10_000);
  assert.equal(result.chunks.length, 4);
  assert.equal(result.receipt.sourceCharacters, 25_006);
  assert.equal(result.receipt.modelInputCharacters, 25_006);
  assert.equal(result.receipt.truncatedSources, 0);
  assert.equal(packSourceChunks(result.chunks, { maxBatchCharacters: 15_000 }).length, 3);
});

test("any rejected project projection fails the run", () => {
  assert.throws(
    () =>
      assertProjectStateWriteComplete(
        {
          updated: 1,
          skipped: 0,
          rejected: 1,
          rejectionDetails: [{ projectId: 67, reason: "unsupported_projection_field" }],
        },
        2,
      ),
    /rejected 1\/2 projects.*unsupported_projection_field/,
  );
});

test("an eligible source without usable full content fails materialization", () => {
  assert.throws(
    () =>
      assertSourceMaterializationComplete(
        [{ id: "source-1" }],
        [{ id: "source-2", lane: "meetings", reason: "meeting source lacks ## Transcript marker" }],
      ),
    /could not be read in full/,
  );
  assert.deepEqual(
    assertSourceMaterializationComplete(
      [{ id: "source-1" }],
      [
        { id: "source-2", reason: "not in 2026-07-18 by row fallback" },
        { id: "source-3", reason: "duplicate content of S1" },
      ],
    ),
    {
      status: "complete",
      materializedSources: 1,
      excludedOutsideWindow: 1,
      deduplicatedSources: 1,
      criticalFailures: 0,
    },
  );
});

test("a staged packet is promoted only through a completed run receipt", async () => {
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push(sql.replace(/\s+/g, " ").trim());
      if (/select id, target_id, packet_type/i.test(sql)) {
        return {
          rows: [
            {
              id: "packet-1",
              target_id: "target-1",
              packet_type: "snapshot",
              freshness_status: "working_sample",
              packet_json: { runContract: { status: "staged" } },
            },
          ],
        };
      }
      if (/returning id, target_id, packet_type/i.test(sql)) {
        const runContract = JSON.parse(params[2]);
        return {
          rows: [
            {
              id: "packet-1",
              target_id: "target-1",
              packet_type: "current",
              freshness_status: "fresh",
              run_contract: runContract,
            },
          ],
        };
      }
      if (/current_count/i.test(sql)) return { rows: [{ current_count: 1 }] };
      return { rows: [], rowCount: 1 };
    },
  };
  const result = await promoteCompletedPacket(
    {
      id: "packet-1",
      packet_json: { runContract: { status: "staged", requestedPacketType: "current" } },
    },
    { projectStateMatched: 2 },
    client,
  );
  assert.equal(result.status, "completed");
  assert.ok(statements.findIndex((sql) => /set packet_type = 'snapshot'/.test(sql)) < statements.findIndex((sql) => /freshness_status = 'fresh'/.test(sql)));
});

test("gateway credit and quota failures are eligible for the configured direct-provider fallback", () => {
  assert.equal(isProviderAvailabilityError(402, "A positive credit balance is required"), true);
  assert.equal(isProviderAvailabilityError(429, "rate limit"), true);
  assert.equal(isProviderAvailabilityError(400, "invalid request schema"), false);
});
