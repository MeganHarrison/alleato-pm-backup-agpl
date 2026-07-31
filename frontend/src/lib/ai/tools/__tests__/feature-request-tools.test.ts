import { z } from "zod";

jest.mock("ai", () => ({
  tool: jest.fn((definition) => definition),
}));

jest.mock("@/lib/feature-requests/server", () => ({
  attachLinearIssueToFeatureRequest: jest.fn(),
  attachLinearSubIssueToFeatureRequest: jest.fn(),
  captureFeatureRequestPacket: jest.fn(),
  draftLinearIssueFromFeatureRequest: jest.fn(),
  draftLinearSubIssuesFromImplementationPlan: jest.fn(),
  findRelatedFeatureRequests: jest.fn(),
  generateClaudeCodeHandoff: jest.fn(),
  generateImplementationPlan: jest.fn(),
  getFeatureRequestDetail: jest.fn(),
  recordLinearStatusUpdateForFeatureRequest: jest.fn(),
  updateFeatureRequestPacket: jest.fn(),
  buildFeatureRequestPacketWidget: jest.fn(),
}));

jest.mock("@/lib/feature-requests/readiness", () => ({
  scoreFeatureRequestReadiness: jest.fn(),
}));

jest.mock("@/lib/ideas/server", () => ({
  createIdea: jest.fn(),
}));

import {
  findRelatedFeatureRequests,
  getFeatureRequestDetail,
} from "@/lib/feature-requests/server";
import { scoreFeatureRequestReadiness } from "@/lib/feature-requests/readiness";
import { createFeatureRequestTools } from "../feature-request-tools";

const mockedFindRelatedFeatureRequests = jest.mocked(findRelatedFeatureRequests);
const mockedGetFeatureRequestDetail = jest.mocked(getFeatureRequestDetail);
const mockedScoreFeatureRequestReadiness = jest.mocked(scoreFeatureRequestReadiness);

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const TITLE = "Allow editing existing draft Prime Contract SOV rows from AI and contract workflow";

function getTool() {
  return createFeatureRequestTools("user-1").scoreFeatureRequestReadiness;
}

describe("scoreFeatureRequestReadiness feature resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves a title query and scores the matched packet", async () => {
    const request = { id: REQUEST_ID, title: TITLE };
    const latestPlan = { id: "plan-1" };
    const readiness = { readyForBuild: true, status: "ready_for_build" };
    mockedFindRelatedFeatureRequests.mockResolvedValue([request] as never);
    mockedGetFeatureRequestDetail.mockResolvedValue({ request, latestPlan } as never);
    mockedScoreFeatureRequestReadiness.mockReturnValue(readiness as never);

    const execute = getTool().execute;
    if (!execute) throw new Error("scoreFeatureRequestReadiness execute was not registered");
    const output = await execute({ query: TITLE });

    expect(mockedFindRelatedFeatureRequests).toHaveBeenCalledWith({
      query: TITLE,
      projectId: null,
      limit: 2,
    });
    expect(mockedGetFeatureRequestDetail).toHaveBeenCalledWith(REQUEST_ID);
    expect(mockedScoreFeatureRequestReadiness).toHaveBeenCalledWith({
      request,
      latestPlan,
    });
    expect(output).toEqual({
      success: true,
      requestId: REQUEST_ID,
      ...readiness,
    });
  });

  it("returns an explicit not-found result when a query has no matches", async () => {
    mockedFindRelatedFeatureRequests.mockResolvedValue([]);

    const execute = getTool().execute;
    if (!execute) throw new Error("scoreFeatureRequestReadiness execute was not registered");
    const output = await execute({ query: "missing feature" });

    expect(output).toEqual({
      success: false,
      error: 'No feature request matched "missing feature".',
    });
    expect(mockedGetFeatureRequestDetail).not.toHaveBeenCalled();
  });

  it("returns candidates when a query is ambiguous", async () => {
    mockedFindRelatedFeatureRequests.mockResolvedValue([
      { id: REQUEST_ID, title: "Edit Prime Contract SOV rows" },
      { id: SECOND_REQUEST_ID, title: "AI Prime Contract workflow" },
    ] as never);

    const execute = getTool().execute;
    if (!execute) throw new Error("scoreFeatureRequestReadiness execute was not registered");
    const output = await execute({ query: "Prime Contract" });

    expect(output).toEqual({
      success: false,
      error: 'More than one feature request matched "Prime Contract". Use a requestId or a more specific query.',
      matches: [
        { requestId: REQUEST_ID, title: "Edit Prime Contract SOV rows" },
        { requestId: SECOND_REQUEST_ID, title: "AI Prime Contract workflow" },
      ],
    });
    expect(mockedGetFeatureRequestDetail).not.toHaveBeenCalled();
  });

  it("requires a request ID or query", () => {
    const schema = getTool().inputSchema as z.ZodType;

    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("feature request project ID validation", () => {
  it("rejects values above the PostgreSQL integer range before execution", () => {
    const schema = createFeatureRequestTools("user-1").findRelatedFeatureRequests
      .inputSchema as z.ZodType;

    expect(schema.safeParse({ query: "Prime Contract", projectId: 2_147_483_647 }).success).toBe(true);
    const result = schema.safeParse({ query: "Prime Contract", projectId: 9_007_199_254_740_990 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(z.prettifyError(result.error)).toContain("Project ID must fit in a PostgreSQL integer.");
    }
  });
});
