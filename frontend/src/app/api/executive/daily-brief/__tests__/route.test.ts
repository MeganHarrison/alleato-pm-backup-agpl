const mockRequireCurrentUserAppCapability = jest.fn();
const mockLoadCurrentDailyExecutiveBriefPacket = jest.fn();

jest.mock("@/lib/app-capabilities", () => ({
  requireCurrentUserAppCapability: (...args: unknown[]) =>
    mockRequireCurrentUserAppCapability(...args),
}));

jest.mock("@/lib/daily-briefs/canonical-packets", () => ({
  loadCurrentDailyExecutiveBriefPacket: (...args: unknown[]) =>
    mockLoadCurrentDailyExecutiveBriefPacket(...args),
  toCanonicalDailyBriefApiResponse: (packet: unknown) => ({
    sourceOfTruth: "intelligence_packets",
    targetSlug: "daily-executive-brief",
    packet,
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "../route";

const canonicalPacket = {
  id: "packet-1",
  businessDate: "2026-07-06",
  sourceCount: 212,
};

describe("/api/executive/daily-brief", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireCurrentUserAppCapability.mockResolvedValue(undefined);
    mockLoadCurrentDailyExecutiveBriefPacket.mockResolvedValue(canonicalPacket);
  });

  it("returns the current canonical intelligence packet by default", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/executive/daily-brief"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sourceOfTruth: "intelligence_packets",
      targetSlug: "daily-executive-brief",
      packet: canonicalPacket,
    });
    expect(mockLoadCurrentDailyExecutiveBriefPacket).toHaveBeenCalledTimes(1);
  });

  it("fails loudly instead of regenerating the retired legacy packet", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/executive/daily-brief?fresh=true&days=5",
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "legacy_generation_retired",
      sourceOfTruth: "intelligence_packets",
    });
    expect(mockLoadCurrentDailyExecutiveBriefPacket).not.toHaveBeenCalled();
  });
});
