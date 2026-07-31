import {
  AssistantTurnConflictError,
  createAssistantTurn,
  type AcceptAssistantTurnInput,
  type AssistantTurnActor,
  type AssistantTurnReceipt,
  type AssistantTurnReplayEvent,
  type AssistantTurnRepository,
  type AssistantTurnRuntimeExecutor,
  type AssistantTurnTransition,
  type PersistAssistantTurnRuntimeInput,
  type ResolveAssistantTurnApprovalInput,
  type StartAssistantTurnCommand,
} from "..";

const actor: AssistantTurnActor = {
  id: "user-1",
  organizationId: "org-1",
  permissions: ["assistant:execute"],
};
const startCommand: StartAssistantTurnCommand = {
  type: "start",
  idempotencyKey: "request-1",
  sessionId: "session-1",
  payloadIdentity: "sha256:immutable-payload",
  payload: { message: "What needs my attention?" },
};
const at = "2026-07-27T12:00:00.000Z";

class DurableMemoryRepository implements AssistantTurnRepository {
  records = new Map<string, AssistantTurnReceipt>();
  events = new Map<string, AssistantTurnReplayEvent[]>();
  private idempotency = new Map<string, string>();

  private append(
    turnId: string,
    type: AssistantTurnReplayEvent["type"],
    data?: Readonly<Record<string, unknown>>,
  ) {
    const events = this.events.get(turnId) ?? [];
    events.push({
      turnId,
      sequence: events.length + 1,
      type,
      occurredAt: at,
      durability: "durable",
      ...(data ? { data } : {}),
    });
    this.events.set(turnId, events);
  }

  async accept(input: AcceptAssistantTurnInput) {
    const key = `${input.actor.id}:${input.command.sessionId}:${input.command.idempotencyKey}`;
    const existingId = this.idempotency.get(key);
    if (existingId) {
      const existing = this.records.get(existingId)!;
      if (existing.payloadIdentity !== input.command.payloadIdentity) {
        throw new AssistantTurnConflictError("payload mismatch", existing);
      }
      return { receipt: existing, isNew: false };
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
    this.records.set(receipt.turnId, receipt);
    this.idempotency.set(key, receipt.turnId);
    this.append(receipt.turnId, "turn.accepted");
    return { receipt, isNew: true };
  }

  async get(turnId: string, requestedActor: AssistantTurnActor) {
    const receipt = this.records.get(turnId);
    return receipt?.actorId === requestedActor.id ? receipt : null;
  }

  async claim(turnId: string, requestedActor: AssistantTurnActor, now: string) {
    const receipt = await this.required(turnId, requestedActor);
    if (receipt.status !== "accepted") {
      throw new AssistantTurnConflictError("cannot claim", receipt);
    }
    const running = this.store({
      ...receipt,
      status: "running",
      stage: "running",
      lifecycle: "running",
      startedAt: now,
      updatedAt: now,
      version: receipt.version + 1,
    });
    this.append(turnId, "turn.running");
    return running;
  }

  async complete(
    turnId: string,
    requestedActor: AssistantTurnActor,
    transition: AssistantTurnTransition,
  ) {
    return this.terminal(turnId, requestedActor, transition);
  }

  async fail(
    turnId: string,
    requestedActor: AssistantTurnActor,
    transition: AssistantTurnTransition,
  ) {
    return this.terminal(turnId, requestedActor, transition);
  }

  async persistRuntimeResult(input: PersistAssistantTurnRuntimeInput) {
    const receipt = await this.required(input.turnId, input.actor);
    if (receipt.lifecycle !== "running") {
      throw new AssistantTurnConflictError("terminal wins", receipt);
    }
    const sources = input.result.sources ?? [];
    if (input.result.status === "approval_required") {
      const pending = this.store({
        ...receipt,
        stage: "approval_required",
        approval: {
          status: "pending" as const,
          requestId: input.result.requestId,
          payloadIdentity: receipt.payloadIdentity,
          prompt: input.result.prompt,
        },
        sources,
        version: receipt.version + 1,
      });
      this.append(input.turnId, "turn.approval_requested");
      return pending;
    }
    if (input.result.status === "delegated") {
      const delegated = this.store({
        ...receipt,
        stage: "delegated_running",
        sources,
        runtimeKind: input.result.runtimeKind,
        runtimeLocator: input.result.runtimeLocator,
        version: receipt.version + 1,
      });
      this.append(input.turnId, "runtime.event", {
        runtimeType: "runtime.delegated",
      });
      return delegated;
    }
    for (const event of input.result.events ?? []) {
      this.append(input.turnId, "runtime.event", {
        runtimeType: event.type,
        ...(event.data ?? {}),
      });
    }
    return this.terminal(
      input.turnId,
      input.actor,
      input.transition!,
      sources,
      input.result.status === "completed"
        ? (input.result.warnings ?? [])
        : [],
    );
  }

  async resolveApproval(input: ResolveAssistantTurnApprovalInput) {
    const receipt = await this.required(input.turnId, input.actor);
    const approval = receipt.approval;
    if (
      approval.status !== "pending" ||
      approval.requestId !== input.requestId ||
      approval.payloadIdentity !== input.payloadIdentity
    ) {
      return { receipt, payload: receipt.commandPayload, won: false };
    }
    const rejected = input.decision === "rejected";
    const updated = this.store({
      ...receipt,
      status: rejected ? "failed" : "running",
      stage: rejected ? "approval_rejected" : "running",
      lifecycle: rejected ? "terminal" : "running",
      terminal: rejected ? "failed" : null,
      completedAt: rejected ? input.now : null,
      approval: {
        status: "resolved",
        requestId: approval.requestId,
        payloadIdentity: approval.payloadIdentity,
        decision: input.decision,
        resolvedBy: input.actor.id,
        resolvedAt: input.now,
      },
      version: receipt.version + 1,
    });
    this.append(input.turnId, "turn.approval_resolved");
    if (rejected) this.append(input.turnId, "turn.terminal");
    return { receipt: updated, payload: receipt.commandPayload, won: true };
  }

  async cancel(
    turnId: string,
    requestedActor: AssistantTurnActor,
    reason: string,
    now: string,
  ) {
    const receipt = await this.required(turnId, requestedActor);
    if (receipt.lifecycle === "terminal") return receipt;
    const canceled = this.store({
      ...receipt,
      status: "canceled",
      stage: "canceled",
      lifecycle: "terminal",
      terminal: "canceled",
      cancellationRequestedAt: now,
      errorMessage: reason,
      completedAt: now,
      version: receipt.version + 1,
    });
    this.append(turnId, "turn.cancellation_requested");
    this.append(turnId, "turn.canceled");
    this.append(turnId, "turn.terminal");
    return canceled;
  }

  async isCancellationRequested(
    turnId: string,
    requestedActor: AssistantTurnActor,
  ) {
    return (
      (await this.required(turnId, requestedActor)).cancellationRequestedAt !==
      null
    );
  }

  async listEvents(
    turnId: string,
    requestedActor: AssistantTurnActor,
    afterSequence: number,
  ) {
    await this.required(turnId, requestedActor);
    return (this.events.get(turnId) ?? []).filter(
      (event) => event.sequence > afterSequence,
    );
  }

  private async terminal(
    turnId: string,
    requestedActor: AssistantTurnActor,
    transition: AssistantTurnTransition,
    sources: readonly AssistantTurnReceipt["sources"][number][] = [],
    warnings: readonly string[] = [],
  ) {
    const receipt = await this.required(turnId, requestedActor);
    if (receipt.lifecycle === "terminal") {
      throw new AssistantTurnConflictError("terminal wins", receipt);
    }
    const completed = this.store({
      ...receipt,
      status:
        transition.terminal === "completed" ||
        transition.terminal === "completed_with_warnings"
          ? "completed"
          : "failed",
      stage: transition.stage,
      lifecycle: "terminal",
      terminal: transition.terminal,
      sources,
      warningMessages: warnings,
      errorMessage: transition.errorMessage,
      completedAt: transition.completedAt,
      version: receipt.version + 1,
    });
    this.append(turnId, "turn.terminal");
    return completed;
  }

  private async required(turnId: string, requestedActor: AssistantTurnActor) {
    const receipt = await this.get(turnId, requestedActor);
    if (!receipt) throw new Error("not found");
    return receipt;
  }

  private store(receipt: AssistantTurnReceipt) {
    this.records.set(receipt.turnId, receipt);
    return receipt;
  }
}

function harness(
  runtime: AssistantTurnRuntimeExecutor,
  repository = new DurableMemoryRepository(),
) {
  const deferred: Promise<void>[] = [];
  let turnNumber = 0;
  const assistantTurn = createAssistantTurn({
    repository,
    runtime,
    createTurnId: () => `turn-${++turnNumber}`,
    defer: (task) => deferred.push(task),
    now: () => at,
  });
  return {
    assistantTurn,
    repository,
    settle: () => Promise.all(deferred.splice(0)),
  };
}

function controlledResponse() {
  let close!: () => void;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first token"));
        close = () => controller.close();
      },
    }),
  );
  return { response, close };
}

describe("AssistantTurn durable shell", () => {
  it("returns the stream immediately and durably terminalizes afterward", async () => {
    const controlled = controlledResponse();
    const runtime = {
      generate: jest.fn(async () => ({
        response: controlled.response,
        result: Promise.resolve({ status: "completed" as const }),
      })),
    };
    const { assistantTurn, repository, settle } = harness(runtime);
    const execution = await assistantTurn.execute(startCommand, actor);
    expect(execution.receipt.status).toBe("running");
    controlled.close();
    await execution.response!.text();
    await settle();
    expect((await repository.get(execution.receipt.turnId, actor))?.status).toBe(
      "completed",
    );
  });

  it("suppresses duplicate generation and rejects idempotency payload drift", async () => {
    const runtime = {
      generate: jest.fn(async () => ({ response: new Response("done") })),
    };
    const { assistantTurn, settle } = harness(runtime);
    await assistantTurn.execute(startCommand, actor);
    const duplicate = await assistantTurn.execute(startCommand, actor);
    expect(duplicate.disposition).toBe("duplicate");
    await expect(
      assistantTurn.execute(
        { ...startCommand, payloadIdentity: "sha256:different" },
        actor,
      ),
    ).rejects.toBeInstanceOf(AssistantTurnConflictError);
    await settle();
    expect(runtime.generate).toHaveBeenCalledTimes(1);
  });

  it("replays ordered durable receipts from a fresh service instance", async () => {
    const repository = new DurableMemoryRepository();
    const runtime = {
      generate: jest.fn(async () => ({
        response: new Response("done"),
        result: Promise.resolve({
          status: "completed" as const,
          events: [{ type: "tool.completed", data: { tool: "query" } }],
        }),
      })),
    };
    const first = harness(runtime, repository);
    const execution = await first.assistantTurn.execute(startCommand, actor);
    await first.settle();
    const fresh = harness(runtime, repository);
    const observation = await fresh.assistantTurn.observe(
      { turnId: execution.receipt.turnId, afterSequence: 1 },
      actor,
    );
    expect(observation.events.map((event) => event.type)).toEqual([
      "turn.running",
      "runtime.event",
      "turn.terminal",
    ]);
    expect(observation.events.every((event) => event.durability === "durable")).toBe(
      true,
    );
  });

  it("resumes an approved exact request once with the original payload", async () => {
    const runtime: AssistantTurnRuntimeExecutor = {
      generate: jest
        .fn()
        .mockResolvedValueOnce({
          response: new Response("approval"),
          result: Promise.resolve({
            status: "approval_required",
            requestId: "approval-1",
            prompt: "Approve?",
          }),
        })
        .mockResolvedValueOnce({
          response: new Response("done"),
          result: Promise.resolve({ status: "completed" }),
        }),
    };
    const { assistantTurn, settle } = harness(runtime);
    const execution = await assistantTurn.execute(startCommand, actor);
    await settle();
    const command = {
      type: "resume" as const,
      turnId: execution.receipt.turnId,
      approvalRequestId: "approval-1",
      payloadIdentity: startCommand.payloadIdentity,
      decision: "approved" as const,
    };
    const resumed = await assistantTurn.execute(command, actor);
    await expect(assistantTurn.execute(command, actor)).rejects.toBeInstanceOf(
      AssistantTurnConflictError,
    );
    await settle();
    expect(resumed.disposition).toBe("resumed");
    expect(runtime.generate).toHaveBeenCalledTimes(2);
    expect(runtime.generate).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: startCommand.payload }),
    );
  });

  it("terminalizes a rejected approval without generation", async () => {
    const runtime: AssistantTurnRuntimeExecutor = {
      generate: jest.fn(async () => ({
        response: new Response("approval"),
        result: Promise.resolve({
          status: "approval_required" as const,
          requestId: "approval-1",
          prompt: "Approve?",
        }),
      })),
    };
    const { assistantTurn, settle } = harness(runtime);
    const execution = await assistantTurn.execute(startCommand, actor);
    await settle();
    const rejected = await assistantTurn.execute(
      {
        type: "resume",
        turnId: execution.receipt.turnId,
        approvalRequestId: "approval-1",
        payloadIdentity: startCommand.payloadIdentity,
        decision: "rejected",
      },
      actor,
    );
    expect(rejected.receipt.stage).toBe("approval_rejected");
    expect(runtime.generate).toHaveBeenCalledTimes(1);
  });

  it("persists cancellation intent, invokes runtime cancellation, and wins late completion", async () => {
    const controlled = controlledResponse();
    const runtime = {
      generate: jest.fn(async () => ({ response: controlled.response })),
      cancel: jest.fn(async () => undefined),
    };
    const { assistantTurn, repository, settle } = harness(runtime);
    const execution = await assistantTurn.execute(startCommand, actor);
    await assistantTurn.execute(
      { type: "cancel", turnId: execution.receipt.turnId },
      actor,
    );
    controlled.close();
    await execution.response!.text();
    await settle();
    expect(
      await repository.isCancellationRequested(execution.receipt.turnId, actor),
    ).toBe(true);
    expect(runtime.cancel).toHaveBeenCalledTimes(1);
    expect((await repository.get(execution.receipt.turnId, actor))?.terminal).toBe(
      "canceled",
    );
  });

  it("persists delegated Eve locator and leaves the turn running", async () => {
    const runtime = {
      generate: jest.fn(async () => ({
        response: new Response('{"sessionId":"eve-session-1"}'),
        result: Promise.resolve({
          status: "delegated" as const,
          runtimeKind: "eve" as const,
          runtimeLocator: "eve-session-1",
        }),
      })),
    };
    const { assistantTurn, repository, settle } = harness(runtime);
    const execution = await assistantTurn.execute(startCommand, actor);
    await settle();
    const receipt = await repository.get(execution.receipt.turnId, actor);
    expect(receipt).toEqual(
      expect.objectContaining({
        status: "running",
        stage: "delegated_running",
        runtimeKind: "eve",
        runtimeLocator: "eve-session-1",
      }),
    );
  });
});
