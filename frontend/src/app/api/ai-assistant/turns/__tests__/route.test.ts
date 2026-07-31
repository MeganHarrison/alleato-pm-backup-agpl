const authMock = jest.fn();
const observeMock = jest.fn();
const assistantTurnFactoryMock = jest.fn();
const repositoryGetMock = jest.fn();
const repositoryCancelMock = jest.fn();

jest.mock("@/lib/guardrails/api", () => ({
  withApiGuardrails:
    (_where: string, handler: (context: unknown) => Promise<Response>) =>
    (context: unknown) =>
      handler(context),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUserFromRequest: (...args: unknown[]) => authMock(...args),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(() => ({ service: true })),
}));
jest.mock("@/lib/ai/assistant-turn", () => {
  const actual = jest.requireActual("@/lib/ai/assistant-turn");
  return {
    ...actual,
    createSupabaseAssistantTurnRepository: jest.fn(() => ({
      get: (...args: unknown[]) => repositoryGetMock(...args),
      cancel: (...args: unknown[]) => repositoryCancelMock(...args),
    })),
    createAssistantTurn: (...args: unknown[]) => {
      assistantTurnFactoryMock(...args);
      return {
        observe: (...inner: unknown[]) => observeMock(...inner),
      };
    },
  };
});

import {
  AssistantTurnNotFoundError,
  type AssistantTurnReceipt,
} from "@/lib/ai/assistant-turn";
import { DELETE, GET } from "../route";

const receipt: AssistantTurnReceipt = {
  turnId: "turn-1",
  idempotencyKey: "message-1",
  sessionId: "session-1",
  actorId: "user-1",
  status: "running",
  stage: "running",
  lifecycle: "running",
  terminal: null,
  payloadIdentity: "sha256:test",
  commandPayload: { surface: "alleato_ai" },
  approval: { status: "not_required" },
  sources: [],
  warningMessages: [],
  cancellationRequestedAt: null,
  runtimeKind: null,
  runtimeLocator: null,
  version: 1,
  errorMessage: null,
  createdAt: "2026-07-27T00:00:00.000Z",
  startedAt: "2026-07-27T00:00:01.000Z",
  completedAt: null,
  updatedAt: "2026-07-27T00:00:01.000Z",
};

function context(query = "turnId=turn-1") {
  return {
    request: new Request(
      `http://localhost/api/ai-assistant/turns?${query}`,
      {
        headers: {
          authorization: "Bearer user-token",
          "x-alleato-project-id": "42",
        },
      },
    ),
  } as never;
}

describe("AssistantTurn observe/cancel route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue({ id: "user-1" });
    observeMock.mockResolvedValue({ receipt, events: [] });
    repositoryGetMock.mockResolvedValue(receipt);
    repositoryCancelMock.mockResolvedValue({
      ...receipt,
      status: "canceled",
      stage: "canceled",
      lifecycle: "terminal",
      terminal: "canceled",
      cancellationRequestedAt: "2026-07-27T00:00:02.000Z",
      completedAt: "2026-07-27T00:00:02.000Z",
    });
  });

  it("observes through the authenticated actor and replay cursor", async () => {
    observeMock.mockResolvedValue({ receipt, events: [] });
    const response = await GET(
      context("turnId=turn-1&afterSequence=2"),
      undefined as never,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(observeMock).toHaveBeenCalledWith(
      { turnId: "turn-1", afterSequence: 2 },
      expect.objectContaining({ id: "user-1" }),
    );
  });

  it("fails before observation when authentication is absent", async () => {
    authMock.mockResolvedValue(null);
    await expect(GET(context(), undefined as never)).rejects.toMatchObject({
      status: 401,
    });
    expect(observeMock).not.toHaveBeenCalled();
  });

  it("requires valid turn and cursor query parameters", async () => {
    await expect(GET(context(""), undefined as never)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      GET(context("turnId=turn-1&afterSequence=-1"), undefined as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns not found for a missing or foreign turn", async () => {
    observeMock.mockRejectedValue(new AssistantTurnNotFoundError("turn-1"));
    await expect(GET(context(), undefined as never)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("returns not found without contacting Eve for a missing or foreign cancel target", async () => {
    repositoryGetMock.mockResolvedValue(null);

    await expect(
      DELETE(context(), undefined as never),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    expect(repositoryCancelMock).not.toHaveBeenCalled();
  });

  it("makes repeated cancellation idempotent without contacting Eve twice", async () => {
    repositoryGetMock.mockResolvedValue({
      ...receipt,
      status: "canceled",
      stage: "canceled",
      lifecycle: "terminal",
      terminal: "canceled",
    });

    const response = await DELETE(context(), undefined as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      disposition: "already_canceled",
      receipt: { status: "canceled" },
    });
    expect(repositoryCancelMock).not.toHaveBeenCalled();
  });

  it("documents Eve 0.22.6's lack of durable cancellation and leaves the receipt active", async () => {
    repositoryGetMock.mockResolvedValue({
      ...receipt,
      runtimeKind: "eve",
      runtimeLocator: "eve-session-1",
    });

    await expect(
      DELETE(context(), undefined as never),
    ).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      status: 501,
      details: { reason: "EVE_DURABLE_CANCEL_UNAVAILABLE" },
    });
    expect(repositoryCancelMock).not.toHaveBeenCalled();
  });
});
