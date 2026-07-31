import assert from "node:assert/strict";
import test from "node:test";

import {
  assertScopePostcondition,
  assertSourceSnapshotCount,
  buildPayload,
  buildScopePayload,
  scanKeysetSnapshot,
  SOURCE_SNAPSHOT_TRANSACTION_OPTIONS,
  withSourceSnapshot,
} from "../copy-document-metadata-to-rag.mjs";

test("copies the authoritative Business Area scope into RAG metadata", () => {
  const payload = buildPayload({
    id: "finance-document",
    project_id: 60,
    business_area_id: 3,
    source_metadata: { retained: true, business_area_id: 5 },
  });

  assert.equal(payload.project_id, 60);
  assert.deepEqual(payload.source_metadata, {
    retained: true,
    business_area_id: 3,
    migrated_from_app_document_metadata: true,
    app_deleted_at: null,
    fireflies_link: null,
    meeting_link: null,
    source_drive_id: null,
    source_site_id: null,
    source_path: null,
    source_etag: null,
    source_size: null,
    organizer_email: null,
    host_email: null,
    participants_array: null,
    tags: null,
    phase: null,
    workflow_target: null,
    division: null,
    trade: null,
  });
});

test("represents an explicitly de-scoped PM APP document without stale scope", () => {
  assert.deepEqual(
    buildScopePayload({
      id: "project-document",
      project_id: 25113,
      business_area_id: null,
    }),
    {
      id: "project-document",
      project_id: 25113,
      business_area_id: null,
    },
  );

  const payload = buildPayload({
    id: "project-document",
    project_id: 25113,
    business_area_id: null,
    source_metadata: { business_area_id: 3 },
  });
  assert.equal(
    Object.hasOwn(payload.source_metadata, "business_area_id"),
    false,
  );
});

test("fails loudly when a copied batch retains stale document or chunk scope", () => {
  assert.throws(
    () =>
      assertScopePostcondition(
        {
          desired_documents: 2,
          existing_documents: 2,
          missing_documents: 0,
          document_mismatches: 1,
          chunk_mismatches: 3,
        },
        { requireAllDocuments: true },
      ),
    /RAG_SCOPE_POSTCONDITION_FAILED.*document_mismatches.*chunk_mismatches/,
  );
});

test("fails loudly if the repeatable-read source snapshot is not fully scanned", () => {
  assert.throws(
    () => assertSourceSnapshotCount(100, 99),
    /SOURCE_SNAPSHOT_COUNT_MISMATCH expected=100 scanned=99/,
  );
});

test("opens the source scan as a read-only repeatable-read transaction", async () => {
  let receivedOptions;
  const sourceClient = {
    begin(options, work) {
      receivedOptions = options;
      return work("transaction-client");
    },
  };

  const result = await withSourceSnapshot(
    sourceClient,
    async (transactionClient) => transactionClient,
  );

  assert.equal(
    SOURCE_SNAPSHOT_TRANSACTION_OPTIONS,
    "isolation level repeatable read read only",
  );
  assert.equal(receivedOptions, SOURCE_SNAPSHOT_TRANSACTION_OPTIONS);
  assert.equal(result, "transaction-client");
});

test("keyset-paginates the complete stable source snapshot", async () => {
  const cursors = [];
  const processed = [];
  const pages = new Map([
    [null, [{ id: "a" }, { id: "b" }]],
    ["b", [{ id: "c" }, { id: "d" }]],
    ["d", []],
  ]);

  const result = await scanKeysetSnapshot({
    expectedCount: 4,
    fetchPage: async (afterId) => {
      cursors.push(afterId);
      return pages.get(afterId);
    },
    processPage: async (rows) => {
      processed.push(rows.map((row) => row.id));
    },
  });

  assert.deepEqual(cursors, [null, "b", "d"]);
  assert.deepEqual(processed, [["a", "b"], ["c", "d"]]);
  assert.deepEqual(result, { scanned: 4, lastId: "d" });
});

test("rejects a non-increasing keyset page", async () => {
  await assert.rejects(
    () =>
      scanKeysetSnapshot({
        expectedCount: 2,
        fetchPage: async () => [{ id: "b" }, { id: "a" }],
        processPage: async () => {},
      }),
    /SOURCE_KEYSET_ORDER_VIOLATION after=b next=a/,
  );
});
