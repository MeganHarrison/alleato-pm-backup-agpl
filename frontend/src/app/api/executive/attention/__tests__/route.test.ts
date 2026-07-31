const mockRequireExecutiveDetail = jest.fn();
const mockParseJsonBody = jest.fn();
const mockLoadState = jest.fn();
const mockLoadAttentionFeed = jest.fn();
const mockCreateAttention = jest.fn();
const mockServiceClient = { rpc: jest.fn() };
const mockCreateServiceClient = jest.fn(() => mockServiceClient);

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails: (_where: string, handler: unknown) => handler,
  parseJsonBody: mockParseJsonBody,
}));
jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/executive/executive-state", () => ({ loadCanonicalExecutiveState: mockLoadState }));
jest.mock("@/lib/executive/executive-attention", () => ({ loadExecutiveAttentionFeed: mockLoadAttentionFeed }));
jest.mock("@/lib/executive/executive-attention-conflicts", () => ({ createExecutiveAttentionItem: mockCreateAttention }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));

import { POST } from "../route";

const body = {
  type: "risk",
  title: "Permit dependency needs an owner",
  summary: "The project cannot release the permit-dependent work without a named executive decision.",
  priority: "high",
  impactOfDelay: "Mobilization will slip and the subcontractor schedule will compress.",
  accountableOwnerLabel: "Brandon",
  dueAt: "2026-07-17T16:00:00.000Z",
};

const freshState = {
  packet: { id: "packet-1" },
  generatedAt: "2026-07-16T12:00:00+00",
  inputs: [{ id: "canonical_packet", freshness: "fresh", evidenceCount: 3 }],
};

describe("POST /api/executive/attention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "user-1", email: "executive@example.com" } });
    mockParseJsonBody.mockResolvedValue(body);
    mockLoadState.mockResolvedValue(freshState);
    mockCreateAttention.mockResolvedValue("attention-1");
  });

  it("uses the capability gate, fresh canonical evidence, and a server-only writer", async () => {
    const response = await (POST as unknown as (context: { request: Request }) => Promise<Response>)({
      request: new Request("https://example.test/api/executive/attention", { method: "POST" }),
    });

    expect(response.status).toBe(201);
    expect(mockRequireExecutiveDetail).toHaveBeenCalledWith("api.executive.attention.POST");
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
    expect(mockCreateAttention).toHaveBeenCalledWith(mockServiceClient, expect.objectContaining({
      actor_kind: "human",
      metadata: expect.objectContaining({
        canonical_packet_id: "packet-1",
        canonical_packet_freshness: "fresh",
        created_by_label: "executive@example.com",
      }),
      evidence: [expect.objectContaining({ source_id: "packet-1", source_type: "intelligence_packet", source_occurred_at: "2026-07-16T12:00:00.000Z" })],
    }));
  });

  it("fails loudly before writing when canonical evidence is stale", async () => {
    mockLoadState.mockResolvedValue({
      ...freshState,
      inputs: [{ id: "canonical_packet", freshness: "stale", evidenceCount: 3 }],
    });

    await expect((POST as unknown as (context: { request: Request }) => Promise<Response>)({
      request: new Request("https://example.test/api/executive/attention", { method: "POST" }),
    })).rejects.toThrow("fresh canonical Daily Brief");
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockCreateAttention).not.toHaveBeenCalled();
  });
});
