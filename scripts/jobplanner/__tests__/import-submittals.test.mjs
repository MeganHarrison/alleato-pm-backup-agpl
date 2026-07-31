import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPartyDisplay,
  mapSubmittalStatus,
  mapSubmittalTypeName,
  normalizeDate,
} from "../import-submittals-lib.mjs";

test("normalizeDate returns yyyy-mm-dd for valid inputs", () => {
  assert.equal(normalizeDate("2026-07-03T19:05:45.420Z"), "2026-07-03");
  assert.equal(normalizeDate(null), null);
  assert.equal(normalizeDate("not-a-date"), null);
});

test("mapSubmittalStatus keeps open and closed behavior explicit", () => {
  assert.equal(mapSubmittalStatus({ isClosed: true }), "Closed");
  assert.equal(mapSubmittalStatus({ isClosed: false }), "Open");
});

test("mapSubmittalTypeName normalizes Job Planner item types into local names", () => {
  assert.equal(mapSubmittalTypeName([{ name: "Drawings" }]), "Drawings");
  assert.equal(mapSubmittalTypeName([{ name: "Material Samples" }]), "Material Samples");
  assert.equal(mapSubmittalTypeName([{ name: "Contract Documents" }]), "Contract");
  assert.equal(mapSubmittalTypeName([{ name: "Specification Sheets" }]), "Product Data Sheets");
  assert.equal(mapSubmittalTypeName([]), "Other");
});

test("formatPartyDisplay produces a readable ball-in-court label", () => {
  assert.equal(
    formatPartyDisplay({ contactName: "Antawn Ennis", companyName: "Jack Laurie Floors, LLC" }),
    "Antawn Ennis (Jack Laurie Floors, LLC)",
  );
  assert.equal(formatPartyDisplay({ companyName: "DEEM" }), "DEEM");
  assert.equal(formatPartyDisplay(null), null);
});
