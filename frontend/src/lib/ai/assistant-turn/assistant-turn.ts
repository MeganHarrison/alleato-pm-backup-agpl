import {
  AssistantTurnApprovalPersistenceError,
  AssistantTurnConflictError,
  AssistantTurnNotFoundError,
  type AssistantTurn,
  type AssistantTurnActor,
  type AssistantTurnCommand,
  type AssistantTurnDependencies,
  type AssistantTurnReceipt,
  type AssistantTurnRuntimeResult,
  type AssistantTurnSourceReceipt,
  type AssistantTurnTransition,
  type ExecuteAssistantTurnResult,
  type ObserveAssistantTurnQuery,
  type StartAssistantTurnCommand,
} from "./types";

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function drainBody(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  while (!(await reader.read()).done) {
    // Observe the exact stream returned to the client before finalizing.
  }
}

function classifyCompleted(
  sources: readonly AssistantTurnSourceReceipt[],
  warnings: readonly string[],
  completedAt: string,
): AssistantTurnTransition {
  const requiredFailure = sources.find(
    (source) =>
      source.required &&
      source.status !== "succeeded" &&
      source.status !== "warning",
  );
  if (requiredFailure) {
    return {
      terminal: "failed",
      stage: "required_receipt_failed",
      errorMessage:
        requiredFailure.message ??
        `Required ${requiredFailure.kind} "${requiredFailure.id}" ended with status "${requiredFailure.status}".`,
      completedAt,
    };
  }

  const hasWarning =
    warnings.length > 0 ||
    sources.some(
      (source) =>
        source.status === "warning" ||
        (!source.required &&
          (source.status === "failed" || source.status === "skipped")),
    );
  return {
    terminal: hasWarning ? "completed_with_warnings" : "completed",
    stage: hasWarning ? "completed_with_warnings" : "completed",
    errorMessage: null,
    completedAt,
  };
}

function transitionForResult(
  result: AssistantTurnRuntimeResult,
  completedAt: string,
): AssistantTurnTransition | null {
  if (result.status === "approval_required" || result.status === "delegated") {
    return null;
  }
  if (result.status === "failed") {
    return {
      terminal: "failed",
      stage: "failed",
      errorMessage: result.message,
      completedAt,
    };
  }
  if (result.status === "needs_user_input") {
    return {
      terminal: "needs_user_input",
      stage: "needs_user_input",
      errorMessage: result.message,
      completedAt,
    };
  }
  return classifyCompleted(
    result.sources ?? [],
    result.warnings ?? [],
    completedAt,
  );
}

function isWinningTerminalConflict(error: unknown): boolean {
  return (
    error instanceof AssistantTurnConflictError &&
    error.receipt?.lifecycle === "terminal"
  );
}

function responseWithTurnHeaders(
  response: Response,
  body: ReadableStream<Uint8Array> | null,
  receipt: AssistantTurnReceipt,
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-assistant-turn-id", receipt.turnId);
  headers.set("x-assistant-turn-status", receipt.status);
  headers.set(
    "x-assistant-turn-observe",
    `/api/ai-assistant/turns?turnId=${encodeURIComponent(receipt.turnId)}`,
  );
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createAssistantTurn(
  dependencies: AssistantTurnDependencies,
): AssistantTurn {
  const now = dependencies.now ?? (() => new Date().toISOString());

  async function requireReceipt(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<AssistantTurnReceipt> {
    const receipt = await dependencies.repository.get(turnId, actor);
    if (!receipt) throw new AssistantTurnNotFoundError(turnId);
    return receipt;
  }

  async function failGeneration(
    receipt: AssistantTurnReceipt,
    actor: AssistantTurnActor,
    error: unknown,
  ): Promise<void> {
    try {
      await dependencies.repository.fail(receipt.turnId, actor, {
        terminal: "failed",
        stage: "stream_failed",
        errorMessage: readableError(error),
        completedAt: now(),
      });
    } catch (transitionError) {
      if (!isWinningTerminalConflict(transitionError)) throw transitionError;
    }
  }

  function monitor(
    running: AssistantTurnReceipt,
    actor: AssistantTurnActor,
    response: Response,
    monitorBody: ReadableStream<Uint8Array> | null,
    runtimeResult: Promise<AssistantTurnRuntimeResult> | undefined,
  ): void {
    const observedResult = runtimeResult?.then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    const task = (async () => {
      try {
        if (monitorBody) await drainBody(monitorBody);
        if (!response.ok) {
          throw new Error(
            `Generation response failed with HTTP ${response.status}.`,
          );
        }
        const observed = observedResult ? await observedResult : null;
        if (observed && !observed.ok) throw observed.error;
        const result =
          observed?.result ?? ({ status: "completed" } as const);
        try {
          await dependencies.repository.persistRuntimeResult({
            turnId: running.turnId,
            actor,
            result,
            transition: transitionForResult(result, now()),
            now: now(),
          });
        } catch (error) {
          if (!isWinningTerminalConflict(error)) throw error;
        }
      } catch (error) {
        await failGeneration(running, actor, error);
      }
    })().catch((error) => {
      if (dependencies.onBackgroundError) {
        dependencies.onBackgroundError(error);
      } else {
        console.error("AssistantTurn monitor failed", error);
      }
    });
    dependencies.defer(task);
  }

  async function generate(
    running: AssistantTurnReceipt,
    actor: AssistantTurnActor,
    resume: null | {
      approvalRequestId: string;
      decision: "approved";
    },
    disposition: "started" | "resumed",
  ): Promise<ExecuteAssistantTurnResult> {
    let generation;
    try {
      generation = await dependencies.runtime.generate({
        turnId: running.turnId,
        actor,
        payloadIdentity: running.payloadIdentity,
        payload: running.commandPayload,
        resume,
      });
    } catch (error) {
      await failGeneration(running, actor, error);
      throw error;
    }

    if (!generation.response.body) {
      monitor(running, actor, generation.response, null, generation.result);
      return {
        receipt: running,
        response: responseWithTurnHeaders(generation.response, null, running),
        disposition,
      };
    }

    const [clientBody, monitorBody] = generation.response.body.tee();
    monitor(
      running,
      actor,
      generation.response,
      monitorBody,
      generation.result,
    );
    return {
      receipt: running,
      response: responseWithTurnHeaders(generation.response, clientBody, running),
      disposition,
    };
  }

  async function start(
    command: StartAssistantTurnCommand,
    actor: AssistantTurnActor,
  ): Promise<ExecuteAssistantTurnResult> {
    const accepted = await dependencies.repository.accept({
      turnId: dependencies.createTurnId(),
      command,
      actor,
      now: now(),
    });
    if (!accepted.isNew) {
      return {
        receipt: accepted.receipt,
        response: null,
        disposition: "duplicate",
      };
    }
    const running = await dependencies.repository.claim(
      accepted.receipt.turnId,
      actor,
      now(),
    );
    return generate(running, actor, null, "started");
  }

  async function cancel(
    turnId: string,
    reason: string | undefined,
    actor: AssistantTurnActor,
  ): Promise<ExecuteAssistantTurnResult> {
    await requireReceipt(turnId, actor);
    const receipt = await dependencies.repository.cancel(
      turnId,
      actor,
      reason ?? "Canceled by the authenticated user.",
      now(),
    );
    if (dependencies.runtime.cancel) {
      try {
        await dependencies.runtime.cancel(turnId, actor);
      } catch (error) {
        if (dependencies.onBackgroundError) {
          dependencies.onBackgroundError(error);
        } else {
          console.error("AssistantTurn runtime cancellation failed", error);
        }
      }
    }
    return {
      receipt,
      response: null,
      disposition: "canceled",
    };
  }

  async function resume(
    command: Extract<AssistantTurnCommand, { type: "resume" }>,
    actor: AssistantTurnActor,
  ): Promise<ExecuteAssistantTurnResult> {
    await requireReceipt(command.turnId, actor);
    let resolved;
    try {
      resolved = await dependencies.repository.resolveApproval({
        turnId: command.turnId,
        actor,
        requestId: command.approvalRequestId,
        payloadIdentity: command.payloadIdentity,
        decision: command.decision,
        now: now(),
      });
    } catch (error) {
      if (error instanceof AssistantTurnConflictError) throw error;
      throw new AssistantTurnApprovalPersistenceError(command.turnId);
    }
    if (!resolved.won) {
      throw new AssistantTurnConflictError(
        "This approval request was already resolved.",
        resolved.receipt,
      );
    }
    if (command.decision === "rejected") {
      return {
        receipt: resolved.receipt,
        response: null,
        disposition: "resumed",
      };
    }
    return generate(
      { ...resolved.receipt, commandPayload: resolved.payload },
      actor,
      {
        approvalRequestId: command.approvalRequestId,
        decision: "approved",
      },
      "resumed",
    );
  }

  return {
    async execute(command, actor) {
      switch (command.type) {
        case "start":
          return start(command, actor);
        case "cancel":
          return cancel(command.turnId, command.reason, actor);
        case "resume":
          return resume(command, actor);
      }
    },
    async observe(query: ObserveAssistantTurnQuery, actor: AssistantTurnActor) {
      const receipt = await requireReceipt(query.turnId, actor);
      const events = await dependencies.repository.listEvents(
        query.turnId,
        actor,
        query.afterSequence ?? 0,
      );
      return { receipt, events };
    },
  };
}
