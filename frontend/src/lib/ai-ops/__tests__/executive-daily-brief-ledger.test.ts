const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

import { linkDailyRecapToCanonicalRun } from "../daily-brief-canonical-link";
import { evidenceRefSchema } from "../contracts";
import { evidenceRefsFromDeliveryResult } from "../executive-daily-brief-ledger";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const DAILY_RECAP_ID = "33333333-3333-4333-8333-333333333333";

function canonicalLinkInput() {
  return {
    dailyRecapId: DAILY_RECAP_ID,
    runId: RUN_ID,
  };
}

describe("Executive Daily Brief ledger helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("links a generated daily_recaps packet to its canonical AI work run", async () => {
    await linkDailyRecapToCanonicalRun(canonicalLinkInput());

    expect(mockFrom).toHaveBeenCalledWith("daily_recaps");
    expect(mockUpdate).toHaveBeenCalledWith({ ai_work_run_id: RUN_ID });
    expect(mockEq).toHaveBeenCalledWith("id", DAILY_RECAP_ID);
  });

  it("fails loudly when the daily_recaps canonical run link cannot be written", async () => {
    mockEq.mockResolvedValueOnce({
      error: { message: "permission denied for daily_recaps" },
    });

    await expect(
      linkDailyRecapToCanonicalRun(canonicalLinkInput()),
    ).rejects.toThrow(/Failed to link Daily Brief packet/);
  });

  it("normalizes owner briefing source timestamps before writing evidence refs", () => {
    const refs = evidenceRefsFromDeliveryResult({
      ok: true,
      status: "dry_run",
      sentAt: "2026-06-24T18:20:00.000Z",
      recipients: [],
      decisionsNeeded: 1,
      actionsRequired: 0,
      projectsShown: 1,
      sourceSummary: {
        generatedAt: "2026-06-24T18:20:00.000Z",
        activeProjectCount: 1,
        stalePacketCount: 0,
        topProjects: [
          {
            targetId: "target-1",
            projectId: 123,
            projectName: "Test Project",
            packetId: "packet-1",
            packetGeneratedAt: "2026-06-24 18:15:00+00",
            packetIsStale: false,
            decisionsNeeded: [
              {
                cardId: "card-1",
                cardType: "decision",
                title: "Approve release path",
                summary: "Decision summary",
                whyItMatters: null,
                nextAction: null,
                confidence: "high",
                sourceCount: 1,
                firstSeenAt: "2026-06-24 17:00:00+00",
                lastSeenAt: "2026-06-24 18:00:00+00",
              },
            ],
            actionsRequired: [],
          },
        ],
      },
    });

    expect(refs.map((ref) => ref.occurredAt)).toEqual([
      "2026-06-24T18:15:00.000Z",
      "2026-06-24T18:00:00.000Z",
    ]);
    expect(() =>
      refs.forEach((ref) => evidenceRefSchema.parse(ref)),
    ).not.toThrow();
  });
});
