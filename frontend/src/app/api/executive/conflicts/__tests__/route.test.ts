const mockRequireExecutiveDetail = jest.fn();
const mockParseJsonBody = jest.fn();
const mockLoadFeed = jest.fn();
const mockCreateConflict = jest.fn();
const mockCreateServiceClient = jest.fn(() => ({ rpc: jest.fn() }));

jest.mock("@/lib/executive/executive-visibility", () => ({ requireCurrentUserExecutiveDetail: mockRequireExecutiveDetail }));
jest.mock("@/lib/guardrails/api", () => ({ withApiGuardrails: (_where: string, handler: unknown) => handler, parseJsonBody: mockParseJsonBody }));
jest.mock("@/lib/executive/executive-conflicts", () => ({ loadExecutiveConflictFeed: mockLoadFeed }));
jest.mock("@/lib/executive/executive-attention-conflicts", () => ({ createExecutiveClaimConflict: mockCreateConflict }));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: mockCreateServiceClient }));

import { POST } from "../route";

const feed = {
  canonicalPacket: { id: "b2ca37e9-69e9-4d32-b611-d42dd870fa4e", generatedAt: "2026-07-16T12:00:00.000Z", freshness: "fresh", evidenceCount: 3, authority: "authoritative" },
  attention: [{ id: "00d32e07-e9c0-4061-9f28-3c13a16d4b9f", lifecycle: "open", title: "Permit decision" }],
  conflicts: [],
};
const body = {
  briefId: feed.canonicalPacket.id, attentionId: feed.attention[0].id, domain: "finance", subject: "Incompatible committed-cost forecasts", priority: "high", impactOfDelay: "Commitment approval will be delayed.", accountableResolverLabel: "Finance owner", dueAt: "2026-07-17T16:00:00.000Z",
  claims: [
    { label: "ERP forecast", statement: "Committed cost is $1.2m.", authority: "authoritative", freshness: "fresh", sourceType: "transactional_record", sourceId: "erp-1", sourceHash: "12345678" },
    { label: "Field forecast", statement: "Committed cost is $1.4m.", authority: "observed", freshness: "partial", sourceType: "meeting", sourceId: "meeting-1", sourceHash: "87654321" },
  ],
};

describe("POST /api/executive/conflicts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireExecutiveDetail.mockResolvedValue({ user: { id: "1d3cad29-c9ec-4297-a2a3-4cba413ea9da", email: "executive@example.com" } });
    mockParseJsonBody.mockResolvedValue(body);
    mockLoadFeed.mockResolvedValue(feed);
    mockCreateConflict.mockResolvedValue("74ae960a-6097-40aa-bc2a-03895b3fe7aa");
  });

  it("creates a resolver-owned conflict from an open published attention item without trusting client actor identity", async () => {
    const response = await (POST as unknown as (context: { request: Request }) => Promise<Response>)({ request: new Request("https://example.test/api/executive/conflicts", { method: "POST" }) });
    expect(response.status).toBe(201);
    expect(mockCreateConflict).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actor_kind: "human", actor_label: "executive@example.com", metadata: expect.objectContaining({ ownership_route: "Finance owner", canonical_packet_authority: "authoritative" }), claims: expect.arrayContaining([expect.objectContaining({ claim_value: { statement: "Committed cost is $1.2m.", authority: "authoritative", freshness: "fresh" } })]) }));
  });

  it("fails loudly when the requested detail route is not the current canonical brief", async () => {
    mockParseJsonBody.mockResolvedValue({ ...body, briefId: "50d2523e-326e-4865-b01a-2f37a1d07c1c" });
    await expect((POST as unknown as (context: { request: Request }) => Promise<Response>)({ request: new Request("https://example.test/api/executive/conflicts", { method: "POST" }) })).rejects.toThrow("current canonical Daily Brief");
    expect(mockCreateConflict).not.toHaveBeenCalled();
  });
});
