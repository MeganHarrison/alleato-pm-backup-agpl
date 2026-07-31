import { currentPacketFreshnessStatus } from "../intelligence-freshness";

describe("currentPacketFreshnessStatus", () => {
  it("reports a formerly fresh packet as stale once its age crosses the current threshold", () => {
    expect(
      currentPacketFreshnessStatus({
        freshnessStatus: "fresh",
        isStale: true,
      }),
    ).toBe("stale");
  });

  it("preserves the stored status while the packet is still current", () => {
    expect(
      currentPacketFreshnessStatus({
        freshnessStatus: "partial",
        isStale: false,
      }),
    ).toBe("partial");
  });
});
