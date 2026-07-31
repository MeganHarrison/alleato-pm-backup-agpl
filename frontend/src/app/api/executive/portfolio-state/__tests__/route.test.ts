const mockRequireExecutiveDetail = jest.fn();
const mockLoadPortfolio = jest.fn();
const mockLoadArtifact = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({ withApiGuardrails: (_where: string, handler: unknown) => handler }));
jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/executive/executive-portfolio-state", () => ({ loadExecutivePortfolioState: mockLoadPortfolio }));
jest.mock("@/lib/executive/governed-executive-artifact", () => ({ loadGovernedExecutiveArtifact: mockLoadArtifact }));

import { GET } from "../route";

const getPortfolioState = GET as () => Promise<Response>;

describe("GET /api/executive/portfolio-state", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireExecutiveDetail.mockResolvedValue(undefined); mockLoadArtifact.mockResolvedValue({ id: "weekly-version-1", state: { packet: { id: "packet-1" } }, executive: { canonicalPacket: { id: "packet-1" } } }); mockLoadPortfolio.mockResolvedValue({ projects: [], summary: { eligibleProjectCount: 0 } }); });
  it("requires executive access before returning the server-owned portfolio contract", async () => {
    const response = await getPortfolioState();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [], summary: { eligibleProjectCount: 0 } });
    expect(mockRequireExecutiveDetail).toHaveBeenCalledWith("api.executive.portfolio-state.GET");
    expect(mockLoadPortfolio).toHaveBeenCalledWith(expect.objectContaining({ governedArtifactVersionId: "weekly-version-1" }));
  });
  it("fails before reading portfolio state when access is absent", async () => {
    mockRequireExecutiveDetail.mockRejectedValue(new Error("Executive detail access is required."));
    await expect(getPortfolioState()).rejects.toThrow("Executive detail access is required.");
    expect(mockLoadPortfolio).not.toHaveBeenCalled();
  });
});
