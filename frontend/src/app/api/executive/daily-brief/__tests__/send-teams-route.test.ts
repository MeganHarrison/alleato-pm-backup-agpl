const mockRequireCurrentUserAppCapability = jest.fn();
const mockGetApiRouteUser = jest.fn();
const mockDeliverCanonicalDailyBriefToTeams = jest.fn();
const mockStartDailyBriefRun = jest.fn();
const mockCompleteDailyBriefRun = jest.fn();
const mockFailDailyBriefRun = jest.fn();
const mockRecordDeliveryAttempt = jest.fn();
const mockRecordTeamsPayloadArtifact = jest.fn();
const mockLoadGovernedExecutiveArtifact = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (
      _name: string,
      handler: (input: { request: Request }) => Promise<Response>,
    ) =>
    (request: Request) =>
      handler({ request }),
}));

jest.mock("@/lib/app-capabilities", () => ({
  requireCurrentUserAppCapability: (...args: unknown[]) =>
    mockRequireCurrentUserAppCapability(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: (...args: unknown[]) => mockGetApiRouteUser(...args),
}));

jest.mock("@/lib/daily-briefs/canonical-teams-delivery", () => ({
  deliverCanonicalDailyBriefToTeams: (...args: unknown[]) =>
    mockDeliverCanonicalDailyBriefToTeams(...args),
}));

jest.mock("@/lib/ai-ops/executive-daily-brief-ledger", () => ({
  completeDailyBriefRun: (...args: unknown[]) =>
    mockCompleteDailyBriefRun(...args),
  failDailyBriefRun: (...args: unknown[]) => mockFailDailyBriefRun(...args),
  recordDeliveryAttempt: (...args: unknown[]) =>
    mockRecordDeliveryAttempt(...args),
  recordTeamsPayloadArtifact: (...args: unknown[]) =>
    mockRecordTeamsPayloadArtifact(...args),
  startDailyBriefRun: (...args: unknown[]) => mockStartDailyBriefRun(...args),
}));

jest.mock("@/lib/executive/governed-executive-artifact", () => ({
  loadGovernedExecutiveArtifact: (...args: unknown[]) => mockLoadGovernedExecutiveArtifact(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "../send-teams/route";

const ORIGINAL_ENV = process.env;

const runContext = {
  eventId: "event-1",
  runId: "run-1",
  startedAt: "2026-07-07T10:00:00.000Z",
  toolPolicy: {
    workflowId: "executive_daily_brief",
    allowedToolNames: ["build-teams-daily-brief-payload"],
    actorMode: "service",
    allowedProjectIds: null,
    allowedSourceFamilies: ["intelligence_packet"],
    allowDelivery: false,
    allowWrites: true,
    metadata: {},
  },
};

const canonicalPacket = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "current",
  generatedAt: "2026-07-07T05:32:00.000Z",
  coveredStartAt: "2026-07-06T00:00:00.000Z",
  coveredEndAt: "2026-07-06T23:59:59.000Z",
  freshnessStatus: "fresh",
  businessDate: "2026-07-06",
  title: "Daily Executive Brief - 2026-07-06",
  executiveSummary: "Summary",
  currentStatus: null,
  strategicRead: null,
  whyItMatters: null,
  recommendedNextMoves: ["Call Jason"],
  confidenceSummary: {},
  sourceCoverage: {},
  sourceCounts: { email: 2 },
  sourceIds: ["source-1", "source-2"],
  sources: [],
  sourceCount: 2,
  briefMarkdown: "## Executive read\nSummary",
  sections: [{ title: "Executive read", body: "Summary" }],
  brief: null,
  compilerVersion: "manual-v1",
};

describe("/api/executive/daily-brief/send-teams", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    mockRequireCurrentUserAppCapability.mockResolvedValue(undefined);
    mockGetApiRouteUser.mockResolvedValue({ id: "user-1" });
    mockStartDailyBriefRun.mockResolvedValue(runContext);
    mockCompleteDailyBriefRun.mockResolvedValue(undefined);
    mockFailDailyBriefRun.mockResolvedValue(undefined);
    mockRecordDeliveryAttempt.mockResolvedValue({ id: "attempt-1" });
    mockRecordTeamsPayloadArtifact.mockResolvedValue({ id: "artifact-1" });
    mockLoadGovernedExecutiveArtifact.mockResolvedValue({ id: "governed-version-1", integrity: "ready", packet: canonicalPacket });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("records disabled delivery without reading or sending a packet", async () => {
    process.env.EXECUTIVE_DAILY_BRIEF_ENABLED = "false";

    const response = await POST(
      new NextRequest("http://localhost/api/executive/daily-brief/send-teams", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      status: "disabled",
      sourceOfTruth: "intelligence_packets",
      runId: "run-1",
    });
    expect(mockDeliverCanonicalDailyBriefToTeams).not.toHaveBeenCalled();
    expect(mockRecordDeliveryAttempt).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        channel: "teams",
        status: "disabled",
        failureCode: "EXECUTIVE_DAILY_BRIEF_DISABLED",
      }),
    );
    expect(mockCompleteDailyBriefRun).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        status: "skipped",
        deliveryStatus: "disabled",
      }),
    );
  });

  it("dry-runs Teams delivery from the canonical packet and records attempts", async () => {
    process.env.EXECUTIVE_DAILY_BRIEF_ENABLED = "false";
    mockDeliverCanonicalDailyBriefToTeams.mockResolvedValue({
      ok: true,
      status: "dry_run",
      sentAt: "2026-07-07T10:05:00.000Z",
      packet: canonicalPacket,
      card: { card: { title: "Daily Executive Brief" }, fallbackText: "Brief" },
      recipients: [
        {
          userId: "user-1",
          email: "bclymer@alleatogroup.com",
          displayName: "Brandon Clymer",
          sent: false,
          reason: "dry_run",
        },
      ],
    });

    const response = await POST(
      new NextRequest("http://localhost/api/executive/daily-brief/send-teams", {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: "dry_run",
      runId: "run-1",
      sourceOfTruth: "intelligence_packets",
    });
    expect(mockDeliverCanonicalDailyBriefToTeams).toHaveBeenCalledWith({
      dryRun: true,
      packet: canonicalPacket,
    });
    expect(mockRecordTeamsPayloadArtifact).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        storageTable: "intelligence_packets",
        storageId: "packet-1",
        metadata: expect.objectContaining({
          packetId: "packet-1",
          governedArtifactVersionId: "governed-version-1",
          sourceOfTruth: "intelligence_packets",
          targetSlug: "daily-executive-brief",
        }),
      }),
    );
    expect(mockRecordDeliveryAttempt).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        artifactId: "artifact-1",
        channel: "teams",
        status: "dry_run",
        metadata: expect.objectContaining({ packetId: "packet-1" }),
      }),
    );
    expect(mockCompleteDailyBriefRun).toHaveBeenCalledWith(
      runContext,
      expect.objectContaining({
        status: "succeeded",
        deliveryStatus: "dry_run",
        sourceCounts: expect.objectContaining({ sourceCount: 2 }),
      }),
    );
  });
});
