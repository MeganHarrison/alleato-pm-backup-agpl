import test from "node:test";
import assert from "node:assert/strict";

import {
  SOURCE_FAMILY_CONFIG,
  coverageStatus,
  normalizeRunSource,
} from "../source_control_plane_health_lib.mjs";

test("normalizeRunSource preserves known source-sync family keys", () => {
  assert.equal(normalizeRunSource("teams_dm"), "teams_dm");
  assert.equal(normalizeRunSource("sharepoint_file"), "sharepoint_file");
  assert.equal(normalizeRunSource("fireflies"), "fireflies");
});

test("coverageStatus distinguishes healthy warning and critical", () => {
  assert.equal(coverageStatus(9, 10, 0.9), "healthy");
  assert.equal(coverageStatus(5, 10, 0.9), "warning");
  assert.equal(coverageStatus(0, 10, 0.9), "critical");
  assert.equal(coverageStatus(0, 0, 0.9), "unknown");
});

test("family matchers classify canonical document shapes", () => {
  const meetings = SOURCE_FAMILY_CONFIG.find((family) => family.key === "meetings");
  const teams = SOURCE_FAMILY_CONFIG.find((family) => family.key === "teams");
  const emails = SOURCE_FAMILY_CONFIG.find((family) => family.key === "emails");
  const sharepoint = SOURCE_FAMILY_CONFIG.find((family) => family.key === "sharepoint");

  assert.ok(meetings?.matchesDocument({ source: "fireflies" }));
  assert.ok(teams?.matchesDocument({ source: "microsoft_graph", category: "teams_message", type: "teams_dm_conversation" }));
  assert.ok(emails?.matchesDocument({ source: "microsoft_graph", category: "email", type: "email" }));
  assert.ok(sharepoint?.matchesDocument({ source: "microsoft_graph", source_item_id: "sites/test/sharepoint-file" }));
});
