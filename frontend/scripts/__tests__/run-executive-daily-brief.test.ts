import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWorkRunSourceRefs,
  summarizeDeliveryResult,
} from "../run-executive-daily-brief";

test("summarizeDeliveryResult projects a sent owner briefing", () => {
  const projection = summarizeDeliveryResult({
    ok: true,
    status: "sent",
    decisionsNeeded: 3,
    actionsRequired: 2,
    projectsShown: 1,
    recipients: [
      { userId: "user-1", displayName: "Brandon", sent: true },
      { userId: "user-2", displayName: "Megan", sent: true },
    ],
    sourceSummary: {
      activeProjectCount: 7,
      stalePacketCount: 1,
      topProjects: [],
    },
  });

  assert.equal(projection.runStatus, "succeeded");
  assert.equal(projection.deliveryStatus, "sent");
  assert.deepEqual(projection.sourceCounts, {
    decisionsNeeded: 3,
    actionsRequired: 2,
    projectsShown: 1,
    activeProjectCount: 7,
    stalePacketCount: 1,
    recipientCount: 2,
    sentCount: 2,
    failedRecipientCount: 0,
  });
});

test("summarizeDeliveryResult marks partial success when a recipient fails", () => {
  const projection = summarizeDeliveryResult({
    ok: true,
    status: "sent",
    decisionsNeeded: 1,
    actionsRequired: 0,
    projectsShown: 1,
    recipients: [
      { userId: "user-1", displayName: "Brandon", sent: true },
      { userId: "user-2", displayName: "Megan", sent: false, reason: "missing conversation" },
    ],
  });

  assert.equal(projection.runStatus, "partial_success");
  assert.equal(projection.deliveryStatus, "sent");
  assert.equal(projection.sourceCounts.failedRecipientCount, 1);
});

test("buildWorkRunSourceRefs extracts packet, card, and recipient sources", () => {
  const refs = buildWorkRunSourceRefs({
    result: {
      ok: true,
      status: "sent",
      recipients: [{ userId: "user-1", displayName: "Brandon", sent: true }],
      sourceSummary: {
        topProjects: [
          {
            targetId: "target-1",
            projectId: 760,
            projectName: "Westfield Collective",
            packetId: "packet-1",
            packetGeneratedAt: "2026-06-19T12:00:00.000Z",
            packetIsStale: false,
            decisionsNeeded: [
              {
                cardId: "card-1",
                cardType: "schedule_risk",
                title: "Permit delay",
                summary: "Permit response is late.",
                confidence: "high",
                sourceCount: 2,
                firstSeenAt: "2026-06-18T12:00:00.000Z",
                lastSeenAt: "2026-06-19T12:00:00.000Z",
              },
            ],
            actionsRequired: [],
          },
        ],
      },
    },
  });

  assert.equal(refs.length, 3);
  assert.equal(refs[0].sourceFamily, "intelligence_packet");
  assert.equal(refs[1].sourceFamily, "insight_card");
  assert.equal(refs[1].confidence, "high");
  assert.equal(refs[2].sourceFamily, "teams_recipient");
});
