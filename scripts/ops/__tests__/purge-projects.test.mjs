import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalManifest,
  expectedConfirmation,
  manifestDigest,
  parseArgs,
  validateApplyReportReceipt,
  validateTargetResolution,
} from "../purge-projects.mjs";

const manifest = {
  taskId: "LOCAL-TEST",
  targets: [
    {
      name: "Project Alpha",
      projectId: 10,
      jobNumber: "A-1",
      acumaticaProjectId: "1001",
    },
    {
      name: "Project Beta",
      projectId: 11,
      jobNumber: null,
      acumaticaProjectId: null,
    },
  ],
};

test("confirmation is deterministic and manifest-bound", () => {
  const first = expectedConfirmation(manifest);
  const second = expectedConfirmation(structuredClone(manifest));
  assert.equal(first, second);
  assert.match(first, /^PURGE_PROJECTS_[A-F0-9]{16}$/);

  const changed = structuredClone(manifest);
  changed.targets[0].jobNumber = "A-2";
  assert.notEqual(expectedConfirmation(changed), first);
});

test("target resolution requires one exact row and matching identifiers", () => {
  const resolved = validateTargetResolution(manifest, [
    {
      id: 10,
      name: "Project Alpha",
      job_number: "A-1",
      project_number: null,
      acumatica_project_id: "1001",
      erp_system: "acumatica",
      archived: false,
      created_at: "2026-07-23T00:00:00Z",
    },
    {
      id: 11,
      name: "Project Beta",
      job_number: null,
      project_number: null,
      acumatica_project_id: null,
      erp_system: null,
      archived: true,
      created_at: "2026-07-22T00:00:00Z",
    },
  ]);

  assert.deepEqual(
    resolved.map((row) => row.id),
    [10, 11],
  );
});

test("target resolution fails closed for missing, duplicate, or mismatched rows", () => {
  assert.throws(
    () => validateTargetResolution(manifest, []),
    /expected exactly one production row/,
  );

  assert.throws(
    () =>
      validateTargetResolution(manifest, [
        {
          id: 10,
          name: "Project Alpha",
          job_number: "WRONG",
          acumatica_project_id: "1001",
        },
        {
          id: 11,
          name: "Project Beta",
        },
      ]),
    /expected job number A-1/,
  );

  assert.throws(
    () =>
      validateTargetResolution(
        { taskId: "DUP", targets: [{ name: "Project Beta" }] },
        [
          { id: 11, name: "Project Beta" },
          { id: 12, name: "Project Beta" },
        ],
      ),
    /expected exactly one production row, found 2/,
  );
});

test("target resolution fails closed on a mismatched internal project ID", () => {
  assert.throws(
    () =>
      validateTargetResolution(manifest, [
        {
          id: 12,
          name: "Project Alpha",
          job_number: "A-1",
          acumatica_project_id: "1001",
        },
        {
          id: 11,
          name: "Project Beta",
        },
      ]),
    /expected project ID 10, found 12/,
  );
});

test("target resolution accepts harmless database name whitespace", () => {
  const resolved = validateTargetResolution(
    {
      taskId: "TRIMMED-NAME",
      targets: [
        {
          name: "Superior Beverae Exotec",
          projectId: 178,
          jobNumber: "26-117",
          acumaticaProjectId: "26117",
        },
      ],
    },
    [
      {
        id: 178,
        name: "Superior Beverae Exotec ",
        job_number: "26-117",
        project_number: "26-117",
        acumatica_project_id: "26117",
      },
    ],
  );

  assert.equal(resolved[0].id, 178);
  assert.equal(resolved[0].name, "Superior Beverae Exotec ");
});

test("manifest validation rejects duplicate target names", () => {
  assert.throws(
    () =>
      canonicalManifest({
        targets: [{ name: "Same" }, { name: "Same" }],
      }),
    /must be unique/,
  );
});

test("verify mode requires an apply receipt", () => {
  assert.throws(
    () => parseArgs(["--mode=verify"]),
    /requires --apply-report/,
  );
});

test("receipt validation rejects a mismatched apply result", () => {
  assert.throws(
    () =>
      validateApplyReportReceipt(manifest, {
        status: "APPLY_PASS",
        taskId: "WRONG-TASK",
        manifestDigest: manifestDigest(manifest),
        ragDatabase: {
          targetDocumentCount: 1,
          targetDocumentIds: ["document-1"],
        },
      }),
    /not a matching APPLY_PASS receipt/,
  );
});

test("receipt validation requires every exact RAG document ID", () => {
  const receipt = {
    status: "APPLY_PASS",
    taskId: manifest.taskId,
    manifestDigest: manifestDigest(manifest),
    ragDatabase: {
      targetDocumentCount: 2,
      targetDocumentIds: ["document-1"],
    },
  };

  assert.throws(
    () => validateApplyReportReceipt(manifest, receipt),
    /requires every deleted RAG document ID/,
  );

  receipt.ragDatabase.targetDocumentIds.push("document-2");
  assert.deepEqual(validateApplyReportReceipt(manifest, receipt), [
    "document-1",
    "document-2",
  ]);
});
