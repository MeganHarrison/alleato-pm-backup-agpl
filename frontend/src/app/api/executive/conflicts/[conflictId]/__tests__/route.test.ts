const mockRequireExecutiveDetail = jest.fn();
const mockParseJsonBody = jest.fn();
const mockResolveConflict = jest.fn();
const mockLoadFeed = jest.fn();
const mockCreateServiceClient = jest.fn(() => ({ rpc: jest.fn() }));

jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/guardrails/api", () => ({ withApiGuardrails: (_where: string, handler: unknown) => handler, parseJsonBody: mockParseJsonBody }));
jest.mock("@/lib/executive/executive-attention-conflicts", () => ({ resolveExecutiveClaimConflict: mockResolveConflict }));
jest.mock("@/lib/executive/executive-conflicts", () => ({ loadExecutiveConflictFeed: mockLoadFeed }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));

import { PATCH } from "../route";

describe("PATCH /api/executive/conflicts/[conflictId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da", email: "executive@example.com" } });
    mockParseJsonBody.mockResolvedValue({ briefId: "b2ca37e9-69e9-4d32-b611-d42dd870fa4e", resolutionSummary: "Finance confirmed the ERP committed-cost forecast for current operations.", currentOperationalMeaning: "Use the $1.2m committed-cost forecast." });
    mockLoadFeed.mockResolvedValue({ canonicalPacket: { id: "b2ca37e9-69e9-4d32-b611-d42dd870fa4e" }, attention: [{ id: "00d32e07-e9c0-4061-9f28-3c13a16d4b9f", lifecycle: "open" }], conflicts: [{ id: "c9c3f801-e389-4e0e-867c-48d604597241", attentionId: "00d32e07-e9c0-4061-9f28-3c13a16d4b9f", status: "open" }] });
  });

  it("derives the named human identity at the capability-gated server route", async () => {
    const response = await (PATCH as unknown as (context: { request: Request; params: Promise<{ conflictId: string }> }) => Promise<Response>)({ request: new Request("https://example.test/api/executive/conflicts/conflict-1", { method: "PATCH" }), params: Promise.resolve({ conflictId: "c9c3f801-e389-4e0e-867c-48d604597241" }) });
    expect(response.status).toBe(200);
    expect(mockResolveConflict).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actor_label: "executive@example.com", actor_user_id: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da", actor_kind: "human" }), { current_operational_meaning: "Use the $1.2m committed-cost forecast." });
  });

  it("fails closed before the resolver when the conflict is no longer linked to the canonical attention feed", async () => {
    mockLoadFeed.mockResolvedValueOnce({
      canonicalPacket: { id: "b2ca37e9-69e9-4d32-b611-d42dd870fa4e" },
      attention: [{ id: "00d32e07-e9c0-4061-9f28-3c13a16d4b9f", lifecycle: "open" }],
      conflicts: [],
    });

    await expect((PATCH as unknown as (context: { request: Request; params: Promise<{ conflictId: string }> }) => Promise<Response>)({
      request: new Request("https://example.test/api/executive/conflicts/conflict-1", { method: "PATCH" }),
      params: Promise.resolve({ conflictId: "c9c3f801-e389-4e0e-867c-48d604597241" }),
    })).rejects.toThrow("not an open conflict attached to Executive Attention on the current canonical Daily Brief");

    expect(mockResolveConflict).not.toHaveBeenCalled();
  });
});
