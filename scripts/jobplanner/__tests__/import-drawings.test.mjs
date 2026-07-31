import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDrawingNaturalKey,
  buildDrawingSetKey,
  inferFileType,
  normalizeDate,
  normalizeRevisionCode,
  normalizeName,
  normalizeRevisionName,
  pickCurrentRevision,
} from "../import-drawings-lib.mjs";

test("normalizeDate returns YYYY-MM-DD for valid timestamps", () => {
  assert.equal(normalizeDate("2026-06-22T00:00:00.000Z"), "2026-06-22");
  assert.equal(normalizeDate(null), null);
});

test("inferFileType prefers content type and falls back to file extension", () => {
  assert.equal(inferFileType("sheet.pdf"), "application/pdf");
  assert.equal(inferFileType("sheet.unknown", "image/jpeg"), "image/jpeg");
  assert.equal(inferFileType("sheet.bin"), "application/octet-stream");
});

test("normalizeRevisionName and buildDrawingSetKey produce stable keys", () => {
  const version = {
    versionId: 8572,
    name: "Permit Set",
    issuedOn: "2026-06-12T00:00:00.000Z",
  };

  assert.equal(normalizeRevisionName(version), "Permit Set");
  assert.equal(normalizeRevisionCode(version), "JP8572");
  assert.equal(buildDrawingSetKey(version), "Permit Set::2026-06-12");
  assert.equal(normalizeRevisionName({ versionId: 99, name: "" }), "Version 99");
});

test("pickCurrentRevision chooses the latest real issued drawing revision", () => {
  const versions = [
    {
      versionId: 7273,
      name: "First",
      issuedOn: "2026-03-26T00:00:00.000Z",
      drawings: [
        {
          name: "F101",
          guid: "old-guid",
          issuedOn: "2026-06-08T00:00:00.000Z",
          createdOn: "2026-06-10T20:05:12.530Z",
        },
      ],
    },
    {
      versionId: 8686,
      name: "Revised Foundation Details",
      issuedOn: "2026-06-22T00:00:00.000Z",
      drawings: [
        {
          name: "F101",
          guid: "new-guid",
          issuedOn: "2026-06-22T00:00:00.000Z",
          createdOn: "2026-06-22T14:00:00.000Z",
        },
      ],
    },
  ];

  const winner = pickCurrentRevision(versions, "F101");
  assert.equal(winner.version.versionId, 8686);
  assert.equal(winner.drawing.guid, "new-guid");
});

test("drawing natural keys and names normalize whitespace consistently", () => {
  assert.equal(buildDrawingNaturalKey("  A101 "), "a101");
  assert.equal(normalizeName("  Cover Sheet  "), "Cover Sheet");
  assert.equal(normalizeName("", "Fallback"), "Fallback");
});
