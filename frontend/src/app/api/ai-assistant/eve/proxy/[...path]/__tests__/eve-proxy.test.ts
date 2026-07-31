import {
  AssistantTurnConflictError,
  AssistantTurnNotFoundError,
  type AcceptAssistantTurnInput,
  type AssistantTurnActor,
  type AssistantTurnReceipt,
  type AssistantTurnReplayEvent,
  type AssistantTurnRepository,
  type PersistAssistantTurnRuntimeInput,
} from "@/lib/ai/assistant-turn";
import { GuardrailError } from "@/lib/guardrails/errors";

import {
  handleEveProxyRequest,
  resolveCanonicalProjectName,
  type EveProxyDependencies,
} from "../eve-proxy";

const TURN_ONE_SESSION = `aat.${Buffer.from("turn-1").toString("base64url")}`;
const TURN_TWO_SESSION = `aat.${Buffer.from("turn-2").toString("base64url")}`;

class MemoryRepository implements AssistantTurnRepository {
  receipts = new Map<string, AssistantTurnReceipt>();
  events = new Map<string, AssistantTurnReplayEvent[]>();
  persistRuntimeResultCalls = 0;

  async accept(input: AcceptAssistantTurnInput) {
    const duplicate = [...this.receipts.values()].find(
      (receipt) =>
        receipt.actorId === input.actor.id &&
        receipt.sessionId === input.command.sessionId &&
        receipt.idempotencyKey === input.command.idempotencyKey,
    );
    if (duplicate) {
      if (duplicate.payloadIdentity !== input.command.payloadIdentity) {
        throw new AssistantTurnConflictError("Payload conflict.", duplicate);
      }
      return { receipt: duplicate, isNew: false };
    }
    const receipt: AssistantTurnReceipt = {
      turnId: input.turnId,
      idempotencyKey: input.command.idempotencyKey,
      sessionId: input.command.sessionId,
      actorId: input.actor.id,
      status: "accepted",
      stage: "accepted",
      lifecycle: "accepted",
      terminal: null,
      payloadIdentity: input.command.payloadIdentity,
      commandPayload: input.command.payload,
      approval: { status: "not_required" },
      sources: [],
      warningMessages: [],
      cancellationRequestedAt: null,
      runtimeKind: null,
      runtimeLocator: null,
      version: 0,
      errorMessage: null,
      createdAt: input.now,
      startedAt: null,
      completedAt: null,
      updatedAt: input.now,
    };
    this.receipts.set(receipt.turnId, receipt);
    this.events.set(receipt.turnId, [
      {
        turnId: receipt.turnId,
        sequence: 1,
        type: "turn.accepted",
        occurredAt: input.now,
        durability: "durable",
      },
    ]);
    return { receipt, isNew: true };
  }

  async get(turnId: string, actor: AssistantTurnActor) {
    const receipt = this.receipts.get(turnId);
    return receipt?.actorId === actor.id ? receipt : null;
  }

  async claim(turnId: string, actor: AssistantTurnActor, now: string) {
    const receipt = await this.require(turnId, actor);
    const running: AssistantTurnReceipt = {
      ...receipt,
      status: "running",
      stage: "running",
      lifecycle: "running",
      startedAt: now,
      updatedAt: now,
      version: receipt.version + 1,
    };
    this.receipts.set(turnId, running);
    this.append(turnId, "turn.running", now);
    return running;
  }

  async complete(
    turnId: string,
    actor: AssistantTurnActor,
    value: Parameters<AssistantTurnRepository["complete"]>[2],
  ) {
    return this.terminal(turnId, actor, value);
  }

  async fail(
    turnId: string,
    actor: AssistantTurnActor,
    value: Parameters<AssistantTurnRepository["fail"]>[2],
  ) {
    return this.terminal(turnId, actor, value);
  }

  async persistRuntimeResult(input: PersistAssistantTurnRuntimeInput) {
    this.persistRuntimeResultCalls += 1;
    const receipt = await this.require(input.turnId, input.actor);
    if (receipt.lifecycle === "terminal") {
      throw new AssistantTurnConflictError("Already terminal.", receipt);
    }
    for (const event of input.result.events ?? []) {
      this.append(input.turnId, "runtime.event", input.now, {
        runtimeType: event.type,
        ...(event.data ?? {}),
      });
    }
    if (input.result.status === "delegated") {
      const delegated: AssistantTurnReceipt = {
        ...receipt,
        stage: "delegated_running",
        runtimeKind: "eve",
        runtimeLocator: input.result.runtimeLocator,
        version: receipt.version + 1,
        updatedAt: input.now,
      };
      this.receipts.set(input.turnId, delegated);
      return delegated;
    }
    if (!input.transition) throw new Error("Missing terminal transition.");
    return this.terminal(
      input.turnId,
      input.actor,
      input.transition,
    );
  }

  async resolveApproval() {
    throw new Error("Not used.");
  }

  async cancel(turnId: string, actor: AssistantTurnActor, reason: string, now: string) {
    return this.terminal(turnId, actor, {
      terminal: "canceled",
      stage: "canceled",
      errorMessage: reason,
      completedAt: now,
    });
  }

  async isCancellationRequested() {
    return false;
  }

  async listEvents(
    turnId: string,
    actor: AssistantTurnActor,
    afterSequence: number,
  ) {
    await this.require(turnId, actor);
    return (this.events.get(turnId) ?? []).filter(
      (event) => event.sequence > afterSequence,
    );
  }

  private async require(turnId: string, actor: AssistantTurnActor) {
    const receipt = await this.get(turnId, actor);
    if (!receipt) throw new AssistantTurnNotFoundError(turnId);
    return receipt;
  }

  private append(
    turnId: string,
    type: AssistantTurnReplayEvent["type"],
    occurredAt: string,
    data?: Readonly<Record<string, unknown>>,
  ) {
    const events = this.events.get(turnId) ?? [];
    events.push({
      turnId,
      sequence: events.length + 1,
      type,
      occurredAt,
      durability: "durable",
      ...(data ? { data } : {}),
    });
    this.events.set(turnId, events);
  }

  private async terminal(
    turnId: string,
    actor: AssistantTurnActor,
    value: Parameters<AssistantTurnRepository["fail"]>[2],
  ) {
    const receipt = await this.require(turnId, actor);
    if (receipt.lifecycle === "terminal") {
      throw new AssistantTurnConflictError("Already terminal.", receipt);
    }
    const status =
      value.terminal === "completed" ||
      value.terminal === "completed_with_warnings"
        ? "completed"
        : value.terminal === "canceled"
          ? "canceled"
          : "failed";
    const terminal: AssistantTurnReceipt = {
      ...receipt,
      status,
      stage: value.stage,
      lifecycle: "terminal",
      terminal: value.terminal,
      errorMessage: value.errorMessage,
      completedAt: value.completedAt,
      updatedAt: value.completedAt,
      version: receipt.version + 1,
    };
    this.receipts.set(turnId, terminal);
    this.append(turnId, "turn.terminal", value.completedAt, {
      outcome: value.terminal,
    });
    return terminal;
  }
}

function postBody(message = "Hello") {
  return JSON.stringify({
    message,
    clientContext: {
      assistantSurface: "alleato_ai",
      conversationId: "conversation-1",
    },
  });
}

function proxyRequest(
  method: "GET" | "POST",
  path: string,
  body?: string,
  signal?: AbortSignal,
) {
  return new Request(`http://localhost/api/ai-assistant/eve/proxy/${path}`, {
    method,
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
      cookie: "must-not-forward=true",
    },
    ...(body ? { body } : {}),
    ...(signal ? { signal } : {}),
  });
}

function harness() {
  const repository = new MemoryRepository();
  const deferred: Promise<void>[] = [];
  let turnSequence = 0;
  const fetchUpstream = jest.fn<
    ReturnType<EveProxyDependencies["fetchUpstream"]>,
    Parameters<EveProxyDependencies["fetchUpstream"]>
  >();
  const dependencies: EveProxyDependencies = {
    authenticate: async () => ({ id: "user-1" }),
    authorizeConversation: async () => true,
    resolveProjectByCanonicalName: async () => ({ status: "not_found" }),
    createRepository: () => repository,
    eveBaseUrl: "https://eve.alleato.test/",
    eveProxySecret: "test-proxy-secret-at-least-32-characters",
    supabaseUrl: "https://production.supabase.test",
    supabaseAnonKey: "production-anon-key",
    fetchUpstream,
    createTurnId: () => `turn-${++turnSequence}`,
    defer: (task) => deferred.push(task),
    now: () => "2026-07-27T20:00:00.000Z",
  };
  return { deferred, dependencies, fetchUpstream, repository };
}

async function settle(deferred: Promise<void>[]) {
  await Promise.all(deferred);
}

it("rejects non-canonical paths before proxying", async () => {
  const { dependencies, fetchUpstream } = harness();
  await expect(
    handleEveProxyRequest({
      dependencies,
      path: ["https:", "evil.example", "secret"],
      request: proxyRequest("GET", "https:/evil.example/secret"),
    }),
  ).rejects.toMatchObject<Partial<GuardrailError>>({
    status: 404,
  });
  expect(fetchUpstream).not.toHaveBeenCalled();
});

it("does not invent a server cancel route that Eve does not expose", async () => {
  const { dependencies, fetchUpstream } = harness();
  await expect(
    handleEveProxyRequest({
      dependencies,
      path: ["eve", "v1", "session", "eve-session-1"],
      request: new Request(
        "http://localhost/api/ai-assistant/eve/proxy/eve/v1/session/eve-session-1",
        {
          method: "DELETE",
          headers: { authorization: "Bearer user-token" },
        },
      ),
    }),
  ).rejects.toMatchObject<Partial<GuardrailError>>({ status: 404 });
  expect(fetchUpstream).not.toHaveBeenCalled();
});

it("requires a valid bearer before proxying", async () => {
  const { dependencies, fetchUpstream } = harness();
  const request = new Request(
    "http://localhost/api/ai-assistant/eve/proxy/eve/v1/session",
    { method: "POST", body: postBody() },
  );
  await expect(
    handleEveProxyRequest({
      dependencies,
      path: ["eve", "v1", "session"],
      request,
    }),
  ).rejects.toMatchObject<Partial<GuardrailError>>({ status: 401 });
  expect(fetchUpstream).not.toHaveBeenCalled();
});

it("accepts a delegated start exactly once and strips ambient secrets", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream.mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        sessionId: "eve-session-1",
        continuationToken: "eve:next",
      }),
      {
        headers: {
          "content-type": "application/json",
          "set-cookie": "secret=leak",
          "x-eve-session-id": "eve-session-1",
        },
      },
    ),
  );
  const first = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  expect(await first.json()).toMatchObject({ sessionId: TURN_ONE_SESSION });
  await settle(deferred);

  const duplicate = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  expect(duplicate.status).toBe(202);
  expect(fetchUpstream).toHaveBeenCalledTimes(1);
  expect(String(fetchUpstream.mock.calls[0][0])).toBe(
    "https://eve.alleato.test/eve/v1/session",
  );
  expect(first.headers.get("set-cookie")).toBeNull();
  const forwarded = fetchUpstream.mock.calls[0][1];
  const forwardedHeaders = new Headers(forwarded.headers);
  expect(forwardedHeaders.get("cookie")).toBeNull();
  expect(forwardedHeaders.get("authorization")).toBeNull();
  expect(forwardedHeaders.get("x-alleato-user-access-token")).toBe(
    "user-token",
  );
  expect(forwardedHeaders.get("x-alleato-assistant-surface")).toBe(
    "ai_assistant",
  );
  expect(forwardedHeaders.get("x-alleato-eve-proxy-secret")).toBe(
    "test-proxy-secret-at-least-32-characters",
  );
  expect(forwardedHeaders.get("x-alleato-supabase-url")).toBe(
    "https://production.supabase.test",
  );
  expect(forwardedHeaders.get("x-alleato-supabase-anon-key")).toBe(
    "production-anon-key",
  );
  expect(forwarded.signal).toBeInstanceOf(AbortSignal);
  expect([...repository.receipts.values()][0]).toMatchObject({
    stage: "delegated_running",
    runtimeLocator: "eve-session-1",
    status: "running",
  });
  expect((await duplicate.clone().json()).sessionId).toBe(TURN_ONE_SESSION);
});

it("never lets a caller override the proxy-bound user token", async () => {
  const { deferred, dependencies, fetchUpstream } = harness();
  fetchUpstream.mockResolvedValue(
    new Response(JSON.stringify({ sessionId: "eve-session-1" }), {
      headers: { "x-eve-session-id": "eve-session-1" },
    }),
  );
  const request = new Request(
    "http://localhost/api/ai-assistant/eve/proxy/eve/v1/session",
    {
      method: "POST",
      body: postBody(),
      headers: {
        authorization: "Bearer authenticated-user-token",
        "content-type": "application/json",
        "x-alleato-user-access-token": "caller-controlled-token",
      },
    },
  );

  const response = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request,
  });
  await response.text();
  await settle(deferred);

  const headers = new Headers(fetchUpstream.mock.calls[0][1].headers);
  expect(headers.get("authorization")).toBeNull();
  expect(headers.get("x-alleato-user-access-token")).toBe(
    "authenticated-user-token",
  );
});

it("resolves Vermillian Rise before forwarding the first Eve turn", async () => {
  const { deferred, dependencies, fetchUpstream } = harness();
  dependencies.resolveProjectByCanonicalName = async (_request, message) =>
    resolveCanonicalProjectName(message, [
      { id: 25125, name: "Vermillian Rise" },
      { id: 67, name: "Allisonville" },
    ]);
  fetchUpstream.mockResolvedValue(
    new Response(
      JSON.stringify({
        sessionId: "real-eve-session",
        continuationToken: "eve:next",
      }),
      { headers: { "x-eve-session-id": "real-eve-session" } },
    ),
  );

  const response = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest(
      "POST",
      "eve/v1/session",
      postBody("Give me an executive brief for Vermillian Rise"),
    ),
  });
  await response.text();
  await settle(deferred);

  const headers = new Headers(fetchUpstream.mock.calls[0][1].headers);
  expect(headers.get("x-alleato-project-id")).toBe("25125");
  expect(headers.get("x-alleato-assistant-surface")).toBe("ai_assistant");
});

it("never chooses when multiple accessible canonical project names appear", async () => {
  const { dependencies, fetchUpstream } = harness();
  dependencies.resolveProjectByCanonicalName = async (_request, message) =>
    resolveCanonicalProjectName(message, [
      { id: 25125, name: "Vermillian Rise" },
      { id: 67, name: "Allisonville" },
    ]);

  await expect(
    handleEveProxyRequest({
      dependencies,
      path: ["eve", "v1", "session"],
      request: proxyRequest(
        "POST",
        "eve/v1/session",
        postBody("Compare Vermillian Rise with Allisonville"),
      ),
    }),
  ).rejects.toMatchObject<Partial<GuardrailError>>({
    status: 409,
    details: expect.objectContaining({ needsUserInput: true }),
  });
  expect(fetchUpstream).not.toHaveBeenCalled();
});

it("forwards NDJSON bytes and durably terminalizes ordered Eve receipts", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        [
          JSON.stringify({ type: "turn.started", data: { turnId: "t1" } }),
          JSON.stringify({
            type: "message.appended",
            data: { messageDelta: "Hi" },
          }),
          JSON.stringify({ type: "turn.completed", data: { turnId: "t1" } }),
          "",
        ].join("\n"),
        { headers: { "content-type": "application/x-ndjson" } },
      ),
    );
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  const bytes = await stream.text();
  expect(bytes).toContain('"type":"message.appended"');
  const streamHeaders = new Headers(fetchUpstream.mock.calls[1][1].headers);
  expect(streamHeaders.get("x-assistant-turn-id")).toBe("turn-1");
  expect(streamHeaders.get("x-alleato-assistant-surface")).toBe(
    "ai_assistant",
  );
  expect(streamHeaders.get("x-alleato-eve-proxy-secret")).toBe(
    "test-proxy-secret-at-least-32-characters",
  );
  expect(streamHeaders.get("authorization")).toBeNull();
  expect(streamHeaders.get("x-alleato-user-access-token")).toBe("user-token");
  await settle(deferred);

  const receipt = [...repository.receipts.values()][0];
  expect(receipt).toMatchObject({
    lifecycle: "terminal",
    terminal: "completed",
    stage: "eve_turn_completed",
  });
  const indexes = (repository.events.get(receipt.turnId) ?? [])
    .map((event) => event.data?.eveStreamIndex)
    .filter((value) => typeof value === "number");
  expect(indexes).toEqual([0, 1, 2]);
});

it("closes and terminalizes a turn without waiting for the Eve session stream to end", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  let upstreamCanceled = false;
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                [
                  JSON.stringify({ type: "turn.started" }),
                  JSON.stringify({ type: "turn.completed" }),
                  JSON.stringify({ type: "session.waiting" }),
                  "",
                ].join("\n"),
              ),
            );
          },
          cancel() {
            upstreamCanceled = true;
          },
        }),
        { headers: { "content-type": "application/x-ndjson" } },
      ),
    );

  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await expect(stream.text()).resolves.toContain('"type":"turn.completed"');
  await settle(deferred);

  expect(upstreamCanceled).toBe(true);
  expect([...repository.receipts.values()][0]).toMatchObject({
    lifecycle: "terminal",
    terminal: "completed",
    stage: "eve_turn_completed",
  });
  expect(
    [...repository.events.values()][0]
      .map((event) => event.data?.eveStreamIndex)
      .filter((value) => typeof value === "number"),
  ).toEqual([0, 1, 2]);
});

it("batches verbose Eve streams and makes continuation ready before the client stream closes", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  const verboseEvents = [
    JSON.stringify({ type: "turn.started" }),
    ...Array.from({ length: 300 }, (_, index) =>
      JSON.stringify({
        type: "message.appended",
        data: { messageDelta: `fragment-${index}` },
      }),
    ),
    JSON.stringify({ type: "turn.completed" }),
    JSON.stringify({ type: "session.waiting" }),
    "",
  ].join("\n");
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "real-eve-session",
          continuationToken: "eve:first",
        }),
        { headers: { "x-eve-session-id": "real-eve-session" } },
      ),
    )
    .mockResolvedValueOnce(new Response(verboseEvents))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "real-eve-session",
          continuationToken: "eve:second",
        }),
        { headers: { "x-eve-session-id": "real-eve-session" } },
      ),
    );

  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody("First")),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;
  const writesBeforeStream = repository.persistRuntimeResultCalls;

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await stream.text();

  expect(repository.persistRuntimeResultCalls - writesBeforeStream).toBe(2);
  expect(repository.receipts.get("turn-1")).toMatchObject({
    lifecycle: "terminal",
    terminal: "completed",
  });

  const continuation = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION],
    request: proxyRequest(
      "POST",
      `eve/v1/session/${TURN_ONE_SESSION}`,
      JSON.stringify({
        continuationToken: "eve:first",
        message: "what projects are at most risk",
        clientContext: {
          assistantSurface: "alleato_ai",
          conversationId: "conversation-1",
        },
      }),
    ),
  });
  expect(continuation.status).toBe(200);
});

it("forwards reconnect cursors and does not duplicate durable indexes", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(`${JSON.stringify({ type: "turn.started" })}\n`),
    )
    .mockResolvedValueOnce(
      new Response(`${JSON.stringify({ type: "turn.completed" })}\n`),
    );
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const first = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await first.text();
  await settle(deferred);
  deferred.length = 0;

  const reconnect = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=1`,
    ),
  });
  await reconnect.text();
  await settle(deferred);

  expect(String(fetchUpstream.mock.calls[2][0])).toContain("startIndex=1");
  const receipt = [...repository.receipts.values()][0];
  const indexes = (repository.events.get(receipt.turnId) ?? [])
    .map((event) => event.data?.eveStreamIndex)
    .filter((value) => typeof value === "number");
  expect(indexes).toEqual([0, 1]);
});

it("binds local stream cursors to distinct app turns", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "real-eve-session",
          continuationToken: "eve:first",
        }),
        { headers: { "x-eve-session-id": "real-eve-session" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        [
          JSON.stringify({ type: "turn.started" }),
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "session.waiting" }),
          "",
        ].join("\n"),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "real-eve-session",
          continuationToken: "eve:second",
        }),
        { headers: { "x-eve-session-id": "real-eve-session" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        [
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "session.waiting" }),
          "",
        ].join("\n"),
      ),
    );

  const firstStart = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody("First")),
  });
  expect((await firstStart.json()).sessionId).toBe(TURN_ONE_SESSION);
  await settle(deferred);
  deferred.length = 0;

  const firstStream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await firstStream.text();
  await settle(deferred);
  deferred.length = 0;

  const secondStart = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION],
    request: proxyRequest(
      "POST",
      `eve/v1/session/${TURN_ONE_SESSION}`,
      JSON.stringify({
        continuationToken: "eve:first",
        message: "Second",
        clientContext: {
          assistantSurface: "alleato_ai",
          conversationId: "conversation-1",
        },
      }),
    ),
  });
  expect((await secondStart.json()).sessionId).toBe(TURN_TWO_SESSION);
  await settle(deferred);
  deferred.length = 0;

  const secondStream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_TWO_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_TWO_SESSION}/stream?startIndex=0`,
    ),
  });
  await secondStream.text();
  await settle(deferred);
  deferred.length = 0;
  expect(String(fetchUpstream.mock.calls[3][0])).toContain("startIndex=3");

  await expect(
    handleEveProxyRequest({
      dependencies,
      path: ["eve", "v1", "session", TURN_TWO_SESSION, "stream"],
      request: proxyRequest(
        "GET",
        `eve/v1/session/${TURN_TWO_SESSION}/stream?startIndex=500`,
      ),
    }),
  ).rejects.toMatchObject<Partial<GuardrailError>>({ status: 409 });

  const oldTabController = new AbortController();
  const delayedOldTab = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=3`,
      undefined,
      oldTabController.signal,
    ),
  });
  expect(delayedOldTab.headers.get("x-assistant-turn-id")).toBe("turn-1");
  await expect(delayedOldTab.text()).resolves.toBe("");
  oldTabController.abort();
  await settle(deferred);

  expect(repository.receipts.get("turn-1")).toMatchObject({
    lifecycle: "terminal",
    terminal: "completed",
  });
  expect(repository.receipts.get("turn-2")).toMatchObject({
    lifecycle: "terminal",
    terminal: "completed",
  });
  expect(fetchUpstream).toHaveBeenCalledTimes(4);
  expect(String(fetchUpstream.mock.calls[2][0])).toContain(
    "/eve/v1/session/real-eve-session",
  );
});

it("durably cancels an aborted read-only stream before late Eve terminal events", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockImplementationOnce(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          setTimeout(() => {
            controller.enqueue(
              new TextEncoder().encode(
                `${JSON.stringify({ type: "turn.completed" })}\n`,
              ),
            );
            controller.close();
          }, 10);
        },
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Response(body, {
        headers: { "content-type": "application/x-ndjson" },
      });
    });
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const controller = new AbortController();
  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
      undefined,
      controller.signal,
    ),
  });
  controller.abort();
  await stream.text();
  await settle(deferred);

  const receipt = [...repository.receipts.values()][0];
  expect(receipt).toMatchObject({
    lifecycle: "terminal",
    status: "canceled",
    terminal: "canceled",
  });
  expect(
    (repository.events.get(receipt.turnId) ?? []).some(
      (event) => event.data?.runtimeType === "turn.completed",
    ),
  ).toBe(false);
});

it("fails loudly when a terminal Eve batch contains an event without a type", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        [
          JSON.stringify({}),
          JSON.stringify({ type: "turn.completed" }),
          JSON.stringify({ type: "session.waiting" }),
          "",
        ].join("\n"),
      ),
    );
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await expect(stream.text()).rejects.toThrow(
    "Eve stream event 0 does not contain a type.",
  );
  await settle(deferred);
  expect(repository.receipts.get("turn-1")).toMatchObject({
    lifecycle: "terminal",
    terminal: "failed",
  });
});

it("fails loudly when Eve returns invalid NDJSON before a terminal boundary", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response("not-json\n", {
        headers: { "content-type": "application/x-ndjson" },
      }),
    );
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);
  deferred.length = 0;

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  await expect(stream.text()).rejects.toThrow(
    "Eve returned invalid NDJSON before the terminal boundary.",
  );
  await settle(deferred);
  expect(repository.receipts.get("turn-1")).toMatchObject({
    lifecycle: "terminal",
    terminal: "failed",
  });
});

it("propagates Eve stream errors and terminalizes the delegated turn", async () => {
  const { deferred, dependencies, fetchUpstream, repository } = harness();
  fetchUpstream
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: "eve-session-1",
          continuationToken: "eve:next",
        }),
        { headers: { "x-eve-session-id": "eve-session-1" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response("upstream unavailable", { status: 503 }),
    );
  const start = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session"],
    request: proxyRequest("POST", "eve/v1/session", postBody()),
  });
  await start.text();
  await settle(deferred);

  const stream = await handleEveProxyRequest({
    dependencies,
    path: ["eve", "v1", "session", TURN_ONE_SESSION, "stream"],
    request: proxyRequest(
      "GET",
      `eve/v1/session/${TURN_ONE_SESSION}/stream?startIndex=0`,
    ),
  });
  expect(stream.status).toBe(503);
  expect(await stream.text()).toBe("upstream unavailable");
  expect([...repository.receipts.values()][0]).toMatchObject({
    lifecycle: "terminal",
    terminal: "failed",
    errorMessage: "Eve stream failed with HTTP 503.",
  });
});
