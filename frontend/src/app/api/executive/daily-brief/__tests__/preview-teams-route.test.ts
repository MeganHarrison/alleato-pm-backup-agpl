const mockRequireCurrentUserAppCapability = jest.fn();
const mockPreviewCanonicalDailyBriefTeamsPayload = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (_name: string, handler: () => Promise<Response>) => (request: Request) =>
      handler(),
}));

jest.mock("@/lib/app-capabilities", () => ({
  requireCurrentUserAppCapability: (...args: unknown[]) =>
    mockRequireCurrentUserAppCapability(...args),
}));

jest.mock("@/lib/daily-briefs/canonical-teams-delivery", () => ({
  previewCanonicalDailyBriefTeamsPayload: (...args: unknown[]) =>
    mockPreviewCanonicalDailyBriefTeamsPayload(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "../preview-teams/route";

describe("/api/executive/daily-brief/preview-teams", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireCurrentUserAppCapability.mockResolvedValue(undefined);
    mockPreviewCanonicalDailyBriefTeamsPayload.mockResolvedValue({
      sourceOfTruth: "intelligence_packets",
      targetSlug: "daily-executive-brief",
      packetId: "packet-1",
      businessDate: "2026-07-06",
      sourceCount: 2,
      card: { card: { title: "Daily Executive Brief" }, fallbackText: "Brief" },
      fallbackText: "Brief",
    });
  });

  it("returns a Teams preview built from the canonical packet", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/executive/daily-brief/preview-teams",
        {
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      sourceOfTruth: "intelligence_packets",
      preview: {
        sourceOfTruth: "intelligence_packets",
        targetSlug: "daily-executive-brief",
        packetId: "packet-1",
      },
    });
    expect(mockPreviewCanonicalDailyBriefTeamsPayload).toHaveBeenCalledTimes(1);
  });
});
