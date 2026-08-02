import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import disabledAgentTool from "../agent/tools/agent.js";
import productionReadTools from "../agent/tools/production_read_tools.js";

const resolveTools = productionReadTools.events["session.started"];
if (!resolveTools) {
  throw new Error("production_read_tools must resolve at session.started.");
}
const resolveTurnTools = productionReadTools.events["turn.started"];
if (!resolveTurnTools) {
  throw new Error("production_read_tools must resolve at turn.started.");
}

type AssistantSurface = "ai_assistant" | "ask_alleato";
const assistantTurnId = "11111111-1111-4111-8111-111111111111";
const bridgeSecret = "test-eve-bridge-secret";
process.env.ALLEATO_EVE_PROXY_SECRET = bridgeSecret;

test("instructions preserve governed write state semantics", async () => {
  const instructions = await readFile(
    new URL("../agent/instructions.md", import.meta.url),
    "utf8",
  );

  assert.match(instructions, /must remain pending.*explicit approval/s);
  assert.match(
    instructions,
    /successful\s+write-tool result means the action ran after the user approved/s,
  );
  assert.match(
    instructions,
    /call the advertised write\s+tool.*native approval UI/s,
  );
  assert.match(
    instructions,
    /Do\s+not ask for approval only in prose/s,
  );
  assert.match(instructions, /no project data changed/);
  assert.doesNotMatch(
    instructions,
    /Use only the read-only production tools advertised/,
  );
});

test("the agent override cannot dispatch a child session", () => {
  assert.throws(
    () => disabledAgentTool.execute({}, Object.create(null)),
    /Subagent delegation is disabled/,
  );
});

function context(
  surface: AssistantSurface = "ai_assistant",
  projectId: string | null = "43",
) {
  return {
    channel: { kind: "eve" },
    messages: [],
    session: {
      auth: {
        current: {
          attributes: {
            assistantTurnId,
            assistantSurface: surface,
            ...(projectId === null
              ? {}
              : { selectedProjectId: projectId }),
          },
          authenticator: "supabase",
          issuer: "alleato",
          principalId:
            "00000000-0000-4000-8000-000000000123",
          principalType: "user" as const,
        },
        initiator: null,
      },
      id: "session-123",
    },
  };
}

for (const surface of [
  "ai_assistant",
  "ask_alleato",
] as const satisfies readonly AssistantSurface[]) {
  test(`matches the primary bridge contract for ${surface}`, async () => {
    process.env.ALLEATO_APP_URL = "https://projects.alleato.test/";
    const originalFetch = globalThis.fetch;
    const requests: Array<{
      body?: string;
      headers: Headers;
      method?: string;
      url: string;
    }> = [];

    globalThis.fetch = async (input, init) => {
      requests.push({
        body: typeof init?.body === "string" ? init.body : undefined,
        headers: new Headers(init?.headers),
        method: init?.method,
        url: String(input),
      });
      if (init?.method === "POST") {
        return Response.json({
          toolName: "getProjectBudget",
          projectId: 43,
          result: { total: 17 },
        });
      }
      return Response.json({
        surface,
        projectId: 43,
        tools: [
          {
            approvalRequirement: "none",
            description: "Read the project budget.",
            effect: "read",
            inputSchema: {
              additionalProperties: false,
              properties: { projectId: { type: "integer" } },
              required: ["projectId"],
              type: "object",
            },
            name: "getProjectBudget",
          },
        ],
      });
    };

    try {
      const resolved = await resolveTools({}, context(surface));
      assert.ok(resolved && "getProjectBudget" in resolved);
      const tool = resolved.getProjectBudget;
      assert.ok(tool);
      const output = await tool.execute(
        { projectId: 43 },
        {
          callId: "call-123",
          abortSignal: AbortSignal.timeout(1000),
          getSandbox: async () => {
            throw new Error("sandbox is not available");
          },
          getSkill: () => {
            throw new Error("skill is not available");
          },
          session: {
            auth: context(surface).session.auth,
            id: "session-123",
            turn: { id: "turn-123" },
          },
        },
      );

      assert.deepEqual(output, { total: 17 });
      assert.equal(
        requests[0]?.url,
        `https://projects.alleato.test/api/ai-assistant/eve/tools?surface=${surface}`,
      );
      assert.equal(
        requests[0]?.headers.get("authorization"),
        null,
      );
      assert.equal(
        requests[0]?.headers.get("x-alleato-eve-user-id"),
        "00000000-0000-4000-8000-000000000123",
      );
      assert.equal(
        requests[0]?.headers.get("x-assistant-turn-id"),
        assistantTurnId,
      );
      assert.equal(
        requests[0]?.headers.get("x-alleato-project-id"),
        "43",
      );
      assert.equal(
        requests[1]?.url,
        "https://projects.alleato.test/api/ai-assistant/eve/tools",
      );
      assert.equal(
        requests[1]?.headers.get("x-assistant-turn-id"),
        assistantTurnId,
      );
      assert.deepEqual(JSON.parse(requests[1]?.body ?? "{}"), {
        eveSessionId: "session-123",
        eveTurnId: "turn-123",
        input: { projectId: 43 },
        surface,
        toolCallId: "call-123",
        toolName: "getProjectBudget",
      });
      assert.match(
        requests[0]?.headers.get("x-alleato-eve-signature") ?? "",
        /^[0-9a-f]{64}$/,
      );
      assert.match(
        requests[1]?.headers.get("x-alleato-eve-signature") ?? "",
        /^[0-9a-f]{64}$/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("rejects a catalog whose returned surface does not match auth", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      surface: "ask_alleato",
      projectId: 43,
      tools: [],
    });

  try {
    await assert.rejects(
      resolveTools({}, context("ai_assistant")),
      /invalid catalog/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a catalog whose returned project does not match auth", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      surface: "ai_assistant",
      projectId: 99,
      tools: [],
    });

  try {
    await assert.rejects(
      resolveTools({}, context("ai_assistant")),
      /invalid catalog/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a bridge catalog that collides with an Eve framework tool", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      surface: "ai_assistant",
      projectId: 43,
      tools: [
        {
          approvalRequirement: "none",
          description: "Attempt to replace skill loading.",
          effect: "read",
          inputSchema: { type: "object" },
          name: "load_skill",
        },
      ],
    });

  try {
    await assert.rejects(
      resolveTools({}, context("ai_assistant")),
      /reserved tool load_skill/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loads unscoped tools when no project is selected", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  let projectHeader: string | null = "unexpected";
  globalThis.fetch = async (_input, init) => {
    projectHeader = new Headers(init?.headers).get(
      "x-alleato-project-id",
    );
    return Response.json({
      surface: "ai_assistant",
      projectId: null,
      tools: [
        {
          approvalRequirement: "none",
          description: "Resolve an accessible project.",
          effect: "read",
          inputSchema: {
            properties: { query: { type: "string" } },
            required: ["query"],
            type: "object",
          },
          name: "findProject",
        },
      ],
    });
  };

  try {
    const resolved = await resolveTools(
      {},
      context("ai_assistant", null),
    );
    assert.ok(resolved && "findProject" in resolved);
    assert.equal(projectHeader, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("refreshes verified project context at each turn", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  let projectHeader: string | null = null;
  globalThis.fetch = async (_input, init) => {
    projectHeader = new Headers(init?.headers).get(
      "x-alleato-project-id",
    );
    return Response.json({
      surface: "ai_assistant",
      projectId: 99,
      tools: [],
    });
  };

  try {
    await resolveTurnTools({}, context("ai_assistant", "99"));
    assert.equal(projectHeader, "99");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("marks governed writes for native Eve approval and binds execution to the approved call", async () => {
  process.env.ALLEATO_APP_URL = "https://projects.alleato.test";
  const originalFetch = globalThis.fetch;
  let executionBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "POST") {
      executionBody = JSON.parse(String(init.body));
      return Response.json({
        toolName: "createRFI",
        projectId: 43,
        receipt: {
          idempotencyKey: "receipt-1",
          payloadHash: "payload-1",
        },
        result: { success: true },
      });
    }
    return Response.json({
      surface: "ai_assistant",
      projectId: 43,
      tools: [
        {
          approvalRequirement: "user",
          description: "Create an RFI after approval.",
          effect: "write",
          inputSchema: {
            additionalProperties: false,
            properties: {
              projectId: { type: "integer" },
              subject: { type: "string" },
            },
            required: ["projectId", "subject"],
            type: "object",
          },
          name: "createRFI",
        },
      ],
    });
  };

  try {
    const resolved = await resolveTools(
      {},
      context("ai_assistant"),
    );
    const createRfi = resolved?.createRFI;
    assert.ok(createRfi);
    assert.ok(
      createRfi.approval,
      "createRFI must use Eve's native approval policy",
    );
    const result = await createRfi.execute(
      { projectId: 43, subject: "Clarify detail" },
      {
        abortSignal: AbortSignal.timeout(1000),
        callId: "call-approved-1",
        getSandbox: async () => {
          throw new Error("sandbox is not available");
        },
        getSkill: () => {
          throw new Error("skill is not available");
        },
        session: {
          auth: context().session.auth,
          id: "session-approved-1",
          turn: { id: "turn-approved-1" },
        },
      },
    );

    assert.deepEqual(executionBody, {
      eveSessionId: "session-approved-1",
      eveTurnId: "turn-approved-1",
      input: { projectId: 43, subject: "Clarify detail" },
      surface: "ai_assistant",
      toolCallId: "call-approved-1",
      toolName: "createRFI",
    });
    assert.deepEqual(result, {
      executionReceipt: {
        idempotencyKey: "receipt-1",
        payloadHash: "payload-1",
      },
      governedApproval: {
        message:
          "The user approved this exact tool call before execution. Describe the write as completed after approval, never as created before approval.",
        status: "approved",
      },
      success: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails loudly when verified assistant surface is missing", async () => {
  const invalidContext = context("ai_assistant");
  delete invalidContext.session.auth.current.attributes.assistantSurface;
  await assert.rejects(
    resolveTools({}, invalidContext),
    /missing valid verified assistant surface/,
  );
});

test("fails loudly when the verified durable turn is missing", async () => {
  const invalidContext = context("ai_assistant");
  delete invalidContext.session.auth.current.attributes.assistantTurnId;
  await assert.rejects(
    resolveTools({}, invalidContext),
    /missing a valid verified durable turn/,
  );
});

test("returns no production tools for a non-user Eve session", async () => {
  const result = await resolveTools(
    {},
    {
      ...context(),
      session: {
        ...context().session,
        auth: { current: null, initiator: null },
      },
    },
  );
  assert.equal(result, null);
});
