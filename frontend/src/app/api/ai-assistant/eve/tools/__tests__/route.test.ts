import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";
import { z } from "zod";

const rpc = jest.fn();
const maybeSingle = jest.fn();
const durableTurnQuery: Record<string, jest.Mock> = {};
durableTurnQuery.select = jest.fn(() => durableTurnQuery);
durableTurnQuery.eq = jest.fn(() => durableTurnQuery);
durableTurnQuery.maybeSingle = maybeSingle;
const from = jest.fn(() => durableTurnQuery);
const serviceClient = { from, rpc };
const createServiceClient = jest.fn(() => serviceClient);
const loadUserPermissionsWithClient = jest.fn(async () => ({
  isAdmin: false,
}));
const hasPermission = jest.fn(() => false);
const executeReadTool = jest.fn(async (input) => ({ ok: true, input }));
const executeWriteTool = jest.fn(async () => ({ mutated: true }));
const createProductionEveRequestCatalog = jest.fn(
  ({
    allowWrites,
    surface,
  }: {
    allowWrites?: boolean;
    surface: string;
  }) => {
    const readEntry = {
      name: "getProjectDetails",
      description: "Read the selected project.",
      inputSchema: z.object({ includeBudget: z.boolean().optional() }),
      effect: "read",
      approvalRequirement: "none",
      tool: {
        description: "Read the selected project.",
        inputSchema: z.object({ includeBudget: z.boolean().optional() }),
        execute: executeReadTool,
      },
    };
    const writeEntry = {
      name: "createRFI",
      description: "Create an RFI.",
      inputSchema: z.object({ projectId: z.number() }),
      effect: "write",
      approvalRequirement: "user",
      tool: {
        description: "Create an RFI.",
        inputSchema: z.object({ projectId: z.number() }),
        execute: executeWriteTool,
      },
    };
    const entries =
      surface === "ai_assistant"
        ? [readEntry, ...(allowWrites ? [writeEntry] : [])]
        : [];
    return {
      report: { complete: true },
      registry: {},
      catalog: {
        entries,
        advertisedNames: entries.map((entry) => entry.name),
        executableNames: entries.map((entry) => entry.name),
      },
    };
  },
);

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: (...args: unknown[]) =>
    createServiceClient(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  getApiRouteUser: jest.fn(async () => null),
}));

jest.mock("@/lib/permissions", () => ({
  loadUserPermissionsWithClient: (...args: unknown[]) =>
    loadUserPermissionsWithClient(...args),
  hasPermission: (...args: unknown[]) => hasPermission(...args),
}));

jest.mock("@/lib/ai/eve-runtime", () => ({
  createProductionEveRequestCatalog: (...args: unknown[]) =>
    createProductionEveRequestCatalog(...args),
}));

jest.mock("@/lib/guardrails/observability", () => ({
  getOrCreateRequestId: () => "request-1",
  logEvent: jest.fn(),
  notifyOnError: jest.fn(),
}));

jest.mock("@/lib/app-error-telemetry", () => ({
  recordAppErrorEvent: jest.fn(),
}));

import { GET, POST } from "../route";

function request(
  method: "GET" | "POST",
  options: {
    bearer?: string;
    assistantTurnId?: string;
    projectId?: string;
    signature?: string;
    surface?: string;
    userId?: string;
    body?: unknown;
  } = {},
) {
  const surface = options.surface ?? "ai_assistant";
  const projectId =
    options.projectId === undefined ? "67" : options.projectId;
  const assistantTurnId =
    options.assistantTurnId === undefined
      ? "11111111-1111-4111-8111-111111111111"
      : options.assistantTurnId;
  const userId =
    options.userId === undefined
      ? "00000000-0000-4000-8000-000000000001"
      : options.userId;
  const body =
    method === "POST"
      ? JSON.stringify(
          {
            eveSessionId: "session-1",
            eveTurnId: "turn-1",
            toolCallId: "call-1",
            ...(options.body ?? {
              surface,
              toolName: "getProjectDetails",
              input: { includeBudget: true },
            }),
          },
        )
      : "";
  const timestamp = Date.now().toString();
  const signature = createHmac(
    "sha256",
    "test-eve-bridge-secret",
  )
    .update(
      [
        timestamp,
        assistantTurnId ?? "",
        userId ?? "",
        projectId ?? "",
        body,
      ].join("\n"),
    )
    .digest("hex");
  return new NextRequest(
    `http://localhost/api/ai-assistant/eve/tools?surface=${surface}`,
    {
      method,
      headers: {
        ...(options.bearer === undefined
          ? { authorization: "Bearer valid-token" }
          : options.bearer
            ? { authorization: options.bearer }
            : {}),
        ...(projectId
            ? { "x-alleato-project-id": projectId }
            : {}),
        ...(assistantTurnId
            ? { "x-assistant-turn-id": assistantTurnId }
            : {}),
        ...(userId
          ? { "x-alleato-eve-user-id": userId }
          : {}),
        "x-alleato-eve-signature":
          options.signature === undefined
            ? signature
            : options.signature,
        "x-alleato-eve-timestamp": timestamp,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST"
        ? {
            body,
          }
        : {}),
    },
  );
}

const routeArgs = { params: Promise.resolve({}) };

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
  hasPermission.mockReturnValue(false);
  loadUserPermissionsWithClient.mockResolvedValue({
    isAdmin: false,
  });
  maybeSingle.mockResolvedValue({
    data: { command_payload: { surface: "alleato_ai" } },
    error: null,
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.ALLEATO_EVE_PROXY_SECRET =
    "test-eve-bridge-secret";
});

it("returns a serializable request-scoped read-only catalog", async () => {
  const response = await GET(request("GET"), routeArgs);
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(payload.projectId).toBe(67);
  expect(payload.tools).toEqual([
    expect.objectContaining({
      name: "getProjectDetails",
      description: "Read the selected project.",
      inputSchema: expect.objectContaining({ type: "object" }),
    }),
  ]);
  expect(createProductionEveRequestCatalog).toHaveBeenCalledWith(
    expect.objectContaining({
      actorPermissions: ["ai_assistant.tools.read"],
      allowDelivery: false,
      allowWrites: false,
      userId: "00000000-0000-4000-8000-000000000001",
      project: { status: "resolved", projectId: 67 },
      provider: "eve",
      surface: "ai_assistant",
    }),
  );
});

it("executes the existing implementation from that same filtered catalog", async () => {
  const response = await POST(request("POST"), routeArgs);
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload).toEqual({
    toolName: "getProjectDetails",
    projectId: 67,
    result: { ok: true, input: { includeBudget: true } },
  });
  expect(executeReadTool).toHaveBeenCalledTimes(1);
  expect(executeReadTool.mock.calls[0][0]).toEqual({ includeBudget: true });
});

it("advertises and executes createRFI only through the governed write contract", async () => {
  hasPermission.mockReturnValue(true);
  const discovery = await GET(request("GET"), routeArgs);
  const discoveryPayload = await discovery.json();
  const createRfi = discoveryPayload.tools.find(
    (tool: { name: string }) => tool.name === "createRFI",
  );

  expect(discovery.status).toBe(200);
  expect(createRfi).toMatchObject({
    approvalRequirement: "user",
    effect: "write",
    name: "createRFI",
  });
  expect(createRfi.inputSchema.properties).not.toHaveProperty(
    "confirmed",
  );
  expect(createRfi.inputSchema.properties).not.toHaveProperty(
    "idempotencyKey",
  );
  expect(createProductionEveRequestCatalog).toHaveBeenCalledWith(
    expect.objectContaining({
      actorPermissions: [
        "ai_assistant.tools.read",
        "ai_assistant.tools.write",
      ],
      allowWrites: true,
    }),
  );

  const businessInput = {
    projectId: 67,
    subject: "Clarify ceiling support",
    question: "Which support detail governs above Corridor 2?",
    costImpact: "tbd",
    scheduleImpact: "no",
  };
  const execution = await POST(
    request("POST", {
      body: {
        surface: "ai_assistant",
        toolName: "createRFI",
        input: businessInput,
      },
    }),
    routeArgs,
  );
  const payload = await execution.json();

  expect(execution.status).toBe(200);
  expect(payload.receipt).toMatchObject({
    assistantTurnId:
      "11111111-1111-4111-8111-111111111111",
    eveSessionId: "session-1",
    eveTurnId: "turn-1",
    toolCallId: "call-1",
  });
  expect(payload.receipt.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
  expect(payload.receipt.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  expect(executeWriteTool).toHaveBeenCalledWith(
    {
      ...businessInput,
      confirmed: true,
      idempotencyKey: payload.receipt.idempotencyKey,
    },
    expect.objectContaining({ toolCallId: "call-1" }),
  );
});

it("rejects a governed payload whose projectId diverges from the signed scoped project", async () => {
  hasPermission.mockReturnValue(true);
  const response = await POST(
    request("POST", {
      body: {
        surface: "ai_assistant",
        toolName: "createRFI",
        input: {
          projectId: 68,
          subject: "Wrong project",
          question: "This should fail.",
          costImpact: "no",
          scheduleImpact: "no",
        },
      },
    }),
    routeArgs,
  );

  expect(response.status).toBe(403);
  expect(executeWriteTool).not.toHaveBeenCalled();
});

it("rejects a direct or tampered bridge request before authentication", async () => {
  const response = await POST(
    request("POST", { signature: "0".repeat(64) }),
    routeArgs,
  );
  expect(response.status).toBe(403);
  expect(createServiceClient).not.toHaveBeenCalled();
  expect(executeReadTool).not.toHaveBeenCalled();
});

it("requires a signed Eve user identity", async () => {
  const response = await GET(
    request("GET", { userId: "" }),
    routeArgs,
  );
  expect(response.status).toBe(403);
  expect(createServiceClient).not.toHaveBeenCalled();
});

it("returns only the unscoped catalog when project context is absent", async () => {
  const response = await GET(request("GET", { projectId: "" }), routeArgs);
  expect(response.status).toBe(200);
  expect((await response.json()).projectId).toBeNull();
  expect(createProductionEveRequestCatalog).toHaveBeenCalledWith(
    expect.objectContaining({ project: { status: "not_found" } }),
  );
  expect(rpc).not.toHaveBeenCalled();
});

it("rejects ambiguous and invalid project scope before catalog creation", async () => {
  for (const projectId of ["67,68", "-1"]) {
    const response = await GET(request("GET", { projectId }), routeArgs);
    expect([400, 409]).toContain(response.status);
  }
  expect(createProductionEveRequestCatalog).not.toHaveBeenCalled();
});

it("rejects inaccessible projects", async () => {
  loadUserPermissionsWithClient.mockResolvedValueOnce(null);
  expect(
    (await GET(request("GET"), routeArgs)).status,
  ).toBe(403);
});

it("does not advertise or execute tools outside the exact surface catalog", async () => {
  maybeSingle.mockResolvedValue({
    data: { command_payload: { surface: "ask_alleato" } },
    error: null,
  });
  const discovery = await GET(
    request("GET", { surface: "ask_alleato" }),
    routeArgs,
  );
  expect((await discovery.json()).tools).toEqual([]);

  const execution = await POST(
    request("POST", {
      surface: "ask_alleato",
      body: {
        surface: "ask_alleato",
        toolName: "getProjectDetails",
        input: {},
      },
    }),
    routeArgs,
  );
  expect(execution.status).toBe(403);
  expect(executeReadTool).not.toHaveBeenCalled();
  expect(executeWriteTool).not.toHaveBeenCalled();
});

it("does not let Ask Alleato request AI Assistant tools", async () => {
  maybeSingle.mockResolvedValue({
    data: { command_payload: { surface: "ask_alleato" } },
    error: null,
  });
  const response = await POST(
    request("POST", {
      surface: "ask_alleato",
      body: {
        surface: "ai_assistant",
        toolName: "getProjectDetails",
        input: {},
      },
    }),
    routeArgs,
  );

  expect(response.status).toBe(403);
  expect(executeReadTool).not.toHaveBeenCalled();
});

it("requires a server-verifiable durable Eve turn", async () => {
  const response = await GET(
    request("GET", { assistantTurnId: "" }),
    routeArgs,
  );

  expect(response.status).toBe(403);
  expect(from).not.toHaveBeenCalled();
  expect(createProductionEveRequestCatalog).not.toHaveBeenCalled();
});

it("fails loudly when the durable Eve turn surface is unavailable", async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect((await GET(request("GET"), routeArgs)).status).toBe(403);

  maybeSingle.mockResolvedValueOnce({
    data: { command_payload: {} },
    error: null,
  });
  expect((await GET(request("GET"), routeArgs)).status).toBe(500);

  expect(createProductionEveRequestCatalog).not.toHaveBeenCalled();
});

it("rejects invalid tool input without calling the implementation", async () => {
  const response = await POST(
    request("POST", {
      body: {
        surface: "ai_assistant",
        toolName: "getProjectDetails",
        input: { includeBudget: "yes" },
      },
    }),
    routeArgs,
  );

  expect(response.status).toBe(400);
  expect(executeReadTool).not.toHaveBeenCalled();
});

it("rejects client-supplied permission widening fields", async () => {
  const response = await POST(
    request("POST", {
      body: {
        surface: "ai_assistant",
        toolName: "getProjectDetails",
        input: {},
        allowWrites: true,
        actorPermissions: ["ai_assistant.tools.write"],
      },
    }),
    routeArgs,
  );

  expect(response.status).toBe(400);
  expect(createProductionEveRequestCatalog).not.toHaveBeenCalled();
  expect(executeReadTool).not.toHaveBeenCalled();
});

it("fails loudly if a non-read tool crosses the bridge boundary", async () => {
  createProductionEveRequestCatalog.mockReturnValueOnce({
    report: { complete: true },
    registry: {},
    catalog: {
      entries: [
        {
          name: "writeSomething",
          description: "Unsafe.",
          inputSchema: z.object({}),
          effect: "read",
          approvalRequirement: "user",
          tool: {
            inputSchema: z.object({}),
            execute: executeWriteTool,
          },
        },
      ],
    },
  });

  const response = await GET(request("GET"), routeArgs);
  expect(response.status).toBe(500);
  expect(executeWriteTool).not.toHaveBeenCalled();
});
