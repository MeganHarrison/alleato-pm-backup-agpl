const mockRequireExecutiveDetail = jest.fn();
const mockLoadArtifact = jest.fn();
const mockLoadReview = jest.fn();
const mockAppendEvent = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({ withApiGuardrails: (_where: string, handler: unknown) => handler }));
jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/executive/governed-executive-artifact", () => ({ loadGovernedExecutiveArtifact: mockLoadArtifact }));
jest.mock("@/lib/executive/monthly-executive-review", () => ({ loadMonthlyExecutiveReview: mockLoadReview, appendMonthlyReviewGovernanceEvent: mockAppendEvent }));

import { GET, POST } from "../route";

const artifact = { id: "monthly-version-1", kind: "monthly" };
const review = { id: "8c177574-9ee1-4ffc-90fd-fcac24ef0c6f", financialReadiness: { state: "ready" }, events: [], release: { state: "draft" } };

describe("monthly review API access and governance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da", email: "executive@example.com" }, access: { isAdmin: true } });
    mockLoadArtifact.mockResolvedValue(artifact);
    mockLoadReview.mockResolvedValue(review);
  });

  it("requires executive detail before returning the governed monthly review", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockRequireExecutiveDetail).toHaveBeenCalledWith("api.executive.monthly-review.GET");
    expect(mockLoadArtifact).toHaveBeenCalledWith("monthly");
  });

  it("rejects a detail-capable non-admin before recording governance", async () => {
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da" }, access: { isAdmin: false } });
    await expect(POST({ request: new Request("https://example.test/api/executive/monthly-review", { method: "POST", body: JSON.stringify({ reviewId: review.id, action: "finance_closed" }) }) })).rejects.toThrow("Only an app admin");
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it("records finance close with the server-derived admin identity", async () => {
    mockLoadReview.mockResolvedValueOnce(review).mockResolvedValueOnce({ ...review, events: [{ action: "finance_closed" }] });
    const response = await POST({ request: new Request("https://example.test/api/executive/monthly-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewId: review.id, action: "finance_closed" }) }) });
    expect(response.status).toBe(201);
    expect(mockRequireExecutiveDetail).toHaveBeenCalledWith("api.executive.monthly-review.POST");
    expect(mockAppendEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da", actorLabel: "executive@example.com", action: "finance_closed" }));
  });
});
