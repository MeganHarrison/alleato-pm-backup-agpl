const mockRequireExecutiveDetail = jest.fn();
const mockParseJsonBody = jest.fn();
const mockResolveAttention = jest.fn();
const mockTransitionAttention = jest.fn();
const mockCreateServiceClient = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails: (_where: string, handler: unknown) => handler,
  parseJsonBody: mockParseJsonBody,
}));
jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/executive/executive-attention-conflicts", () => ({
  resolveExecutiveAttentionItem: mockResolveAttention,
  transitionExecutiveAttentionItem: mockTransitionAttention,
}));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));

import { PATCH } from "../route";

describe("PATCH /api/executive/attention/[attentionId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "user-1", email: "executive@example.com" } });
    mockCreateServiceClient.mockReturnValue({});
  });

  it("passes the shared resolutionSummary contract to the human-only resolver", async () => {
    mockParseJsonBody.mockResolvedValue({
      action: "resolve",
      resolutionSummary: "The evidence-backed executive decision was reviewed and completed.",
      actor_label: "spoofed@example.com",
      actor_user_id: "f9eb0e2c-3a8c-4f7e-a4bf-00db7a28a84b",
    });

    const response = await (PATCH as unknown as (context: {
      request: Request;
      params: Promise<{ attentionId: string }>;
    }) => Promise<Response>)({
      request: new Request("https://example.test/api/executive/attention/attention-1", { method: "PATCH" }),
      params: Promise.resolve({ attentionId: "attention-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockResolveAttention).toHaveBeenCalledWith({}, {
      id: "attention-1",
      actor_label: "executive@example.com",
      actor_user_id: "user-1",
      actor_kind: "human",
      resolution_summary: "The evidence-backed executive decision was reviewed and completed.",
      dismiss: false,
    });
    expect(mockTransitionAttention).not.toHaveBeenCalled();
  });

  it("fails before the service client when the executive capability is absent", async () => {
    mockRequireExecutiveDetail.mockRejectedValue(new Error("Executive detail access is required."));

    await expect((PATCH as unknown as (context: {
      request: Request;
      params: Promise<{ attentionId: string }>;
    }) => Promise<Response>)({
      request: new Request("https://example.test/api/executive/attention/attention-1", { method: "PATCH" }),
      params: Promise.resolve({ attentionId: "attention-1" }),
    })).rejects.toThrow("Executive detail access is required.");

    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockResolveAttention).not.toHaveBeenCalled();
  });
});
