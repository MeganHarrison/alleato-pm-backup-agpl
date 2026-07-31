import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import {
  AssistantTurnApprovalPersistenceError,
  AssistantTurnConflictError,
  AssistantTurnNotFoundError,
  type AcceptAssistantTurnInput,
  type AssistantTurnActor,
  type AssistantTurnApprovalState,
  type AssistantTurnDurableStatus,
  type AssistantTurnReceipt,
  type AssistantTurnReplayEvent,
  type AssistantTurnRepository,
  type AssistantTurnRuntimeEvent,
  type AssistantTurnSourceReceipt,
  type AssistantTurnTerminalOutcome,
  type AssistantTurnTransition,
} from "./types";

type TurnRow = Database["public"]["Tables"]["durable_ai_turns"]["Row"];
type TurnInsert = Database["public"]["Tables"]["durable_ai_turns"]["Insert"];
type TurnUpdate = Database["public"]["Tables"]["durable_ai_turns"]["Update"];
type EventRow = Database["public"]["Tables"]["durable_ai_turn_events"]["Row"];
type EventInsert =
  Database["public"]["Tables"]["durable_ai_turn_events"]["Insert"];
type ApprovalRow =
  Database["public"]["Tables"]["durable_ai_turn_approvals"]["Row"];

type AtomicApprovalOperation =
  | {
      action: "insert";
      request_id: string;
      payload_identity: string;
      prompt: string;
      created_at: string;
    }
  | {
      action: "resolve";
      request_id: string;
      payload_identity: string;
      decision: "approved" | "rejected";
      decision_at: string;
    };
type AtomicTransitionRpc = (
  functionName: "persist_durable_ai_turn_transition_v2",
  args: {
    p_turn_id: string;
    p_actor_id: string;
    p_expected_version: number;
    p_expected_status: string;
    p_changes: Json;
    p_events: Json;
    p_approval_operation: Json;
  },
) => {
  select: (columns: "*") => {
    maybeSingle: () => Promise<{
      data: TurnRow | null;
      error: { message: string } | null;
    }>;
  };
};

function databaseError(operation: string, message: string): Error {
  return new Error(`AssistantTurn ${operation} failed: ${message}`);
}

function asJson(value: unknown): Json {
  return value as Json;
}

function sourceReceipts(value: Json): readonly AssistantTurnSourceReceipt[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)),
  ) as unknown as AssistantTurnSourceReceipt[];
}

function warningMessages(value: Json): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function terminalForRow(row: TurnRow): AssistantTurnTerminalOutcome | null {
  if (row.terminal_outcome) {
    return row.terminal_outcome as AssistantTurnTerminalOutcome;
  }
  if (row.status === "canceled") return "canceled";
  if (row.status === "failed") {
    return row.stage === "needs_user_input" ? "needs_user_input" : "failed";
  }
  if (row.status === "completed") {
    return row.stage === "completed_with_warnings"
      ? "completed_with_warnings"
      : "completed";
  }
  return null;
}

function approvalState(row: ApprovalRow | null): AssistantTurnApprovalState {
  if (!row) return { status: "not_required" };
  if (row.status === "pending") {
    return {
      status: "pending",
      requestId: row.request_id,
      payloadIdentity: row.payload_identity,
      prompt: row.prompt,
    };
  }
  return {
    status: "resolved",
    requestId: row.request_id,
    payloadIdentity: row.payload_identity,
    decision: row.status as "approved" | "rejected",
    resolvedBy: row.decision_by ?? "",
    resolvedAt: row.decision_at ?? row.created_at,
  };
}

function toReceipt(
  row: TurnRow,
  approval: ApprovalRow | null,
): AssistantTurnReceipt {
  const status = row.status as AssistantTurnDurableStatus;
  return {
    turnId: row.id,
    idempotencyKey: row.client_message_id,
    sessionId: row.session_id,
    actorId: row.user_id,
    status,
    stage: row.stage,
    lifecycle:
      status === "accepted"
        ? "accepted"
        : status === "running"
          ? "running"
          : "terminal",
    terminal: terminalForRow(row),
    payloadIdentity: row.payload_identity,
    commandPayload: row.command_payload,
    approval: approvalState(approval),
    sources: sourceReceipts(row.source_receipts),
    warningMessages: warningMessages(row.warning_messages),
    cancellationRequestedAt: row.cancellation_requested_at,
    runtimeKind: row.runtime_kind,
    runtimeLocator: row.runtime_locator,
    version: row.version,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function toReplayEvent(row: EventRow): AssistantTurnReplayEvent {
  const data =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Readonly<Record<string, unknown>>)
      : undefined;
  return {
    turnId: row.turn_id,
    sequence: row.sequence,
    type: row.event_type as AssistantTurnReplayEvent["type"],
    occurredAt: row.occurred_at,
    durability: "durable",
    ...(data ? { data } : {}),
  };
}

function terminalStatus(
  outcome: AssistantTurnTerminalOutcome,
): AssistantTurnDurableStatus {
  if (outcome === "completed" || outcome === "completed_with_warnings") {
    return "completed";
  }
  if (outcome === "canceled") return "canceled";
  return "failed";
}

export function createSupabaseAssistantTurnRepository(
  supabase: SupabaseClient<Database>,
): AssistantTurnRepository {
  async function loadApproval(turnId: string): Promise<ApprovalRow | null> {
    const { data, error } = await supabase
      .from("durable_ai_turn_approvals")
      .select("*")
      .eq("turn_id", turnId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw databaseError("approval read", error.message);
    return data;
  }

  async function getRow(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<TurnRow | null> {
    const { data, error } = await supabase
      .from("durable_ai_turns")
      .select("*")
      .eq("id", turnId)
      .eq("user_id", actor.id)
      .maybeSingle();
    if (error) throw databaseError("observe", error.message);
    return data;
  }

  async function get(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<AssistantTurnReceipt | null> {
    const row = await getRow(turnId, actor);
    if (!row) return null;
    return toReceipt(row, await loadApproval(turnId));
  }

  async function requireRow(
    turnId: string,
    actor: AssistantTurnActor,
  ): Promise<TurnRow> {
    const row = await getRow(turnId, actor);
    if (!row) throw new AssistantTurnNotFoundError(turnId);
    return row;
  }

  async function nextEventSequence(turnId: string): Promise<number> {
    const { data, error } = await supabase
      .from("durable_ai_turn_events")
      .select("*")
      .eq("turn_id", turnId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw databaseError("event sequence read", error.message);
    return (data?.sequence ?? 0) + 1;
  }

  async function appendEvents(
    turnId: string,
    events: readonly {
      type: AssistantTurnReplayEvent["type"];
      occurredAt: string;
      data?: Readonly<Record<string, unknown>>;
    }[],
  ): Promise<void> {
    if (events.length === 0) return;
    const firstSequence = await nextEventSequence(turnId);
    const rows: EventInsert[] = events.map((event, index) => ({
      turn_id: turnId,
      sequence: firstSequence + index,
      event_type: event.type,
      durability: "durable",
      occurred_at: event.occurredAt,
      data: asJson(event.data ?? {}),
    }));
    const { error } = await supabase
      .from("durable_ai_turn_events")
      .insert(rows);
    if (error) throw databaseError("event append", error.message);
  }

  async function atomicUpdateWithEvents(
    current: TurnRow,
    actor: AssistantTurnActor,
    changes: TurnUpdate,
    operation: string,
    events: readonly {
      type: AssistantTurnReplayEvent["type"];
      occurredAt: string;
      data?: Readonly<Record<string, unknown>>;
    }[],
    approvalOperation: AtomicApprovalOperation | null = null,
  ): Promise<TurnRow> {
    const rpc = supabase.rpc.bind(supabase) as unknown as AtomicTransitionRpc;
    const { data, error } = await rpc("persist_durable_ai_turn_transition_v2", {
      p_turn_id: current.id,
      p_actor_id: actor.id,
      p_expected_version: current.version,
      p_expected_status: current.status,
      p_changes: asJson(changes),
      p_events: asJson(
        events.map((event) => ({
          event_type: event.type,
          occurred_at: event.occurredAt,
          data: event.data ?? {},
        })),
      ),
      p_approval_operation: asJson(approvalOperation),
    })
      .select("*")
      .maybeSingle();
    if (error) throw databaseError(operation, error.message);
    if (data) return data;
    const latest = await get(current.id, actor);
    if (!latest) throw new AssistantTurnNotFoundError(current.id);
    throw new AssistantTurnConflictError(
      `${operation} lost an optimistic concurrency race.`,
      latest,
    );
  }

  async function transition(
    turnId: string,
    actor: AssistantTurnActor,
    allowed: readonly AssistantTurnDurableStatus[],
    transitionValue: AssistantTurnTransition,
  ): Promise<AssistantTurnReceipt> {
    const current = await requireRow(turnId, actor);
    if (!allowed.includes(current.status as AssistantTurnDurableStatus)) {
      throw new AssistantTurnConflictError(
        `Assistant turn cannot transition from ${current.status}.`,
        toReceipt(current, await loadApproval(turnId)),
      );
    }
    const transitionEvents = [
      {
        type:
          transitionValue.terminal === "canceled"
            ? ("turn.canceled" as const)
            : ("turn.terminal" as const),
        occurredAt: transitionValue.completedAt,
        data: {
          outcome: transitionValue.terminal,
          stage: transitionValue.stage,
          ...(transitionValue.errorMessage
            ? { errorMessage: transitionValue.errorMessage }
            : {}),
        },
      },
      ...(transitionValue.terminal === "canceled"
        ? [
            {
              type: "turn.terminal" as const,
              occurredAt: transitionValue.completedAt,
              data: {
                outcome: transitionValue.terminal,
                stage: transitionValue.stage,
              },
            },
          ]
        : []),
    ];
    const updated = await atomicUpdateWithEvents(
      current,
      actor,
      {
        status: terminalStatus(transitionValue.terminal),
        stage: transitionValue.stage,
        terminal_outcome: transitionValue.terminal,
        completed_at: transitionValue.completedAt,
        error_message: transitionValue.errorMessage,
        updated_at: transitionValue.completedAt,
      },
      `${transitionValue.stage} transition`,
      transitionEvents,
    );
    return toReceipt(updated, await loadApproval(turnId));
  }

  async function getByCommand(
    input: AcceptAssistantTurnInput,
  ): Promise<AssistantTurnReceipt | null> {
    const { data, error } = await supabase
      .from("durable_ai_turns")
      .select("*")
      .eq("user_id", input.actor.id)
      .eq("session_id", input.command.sessionId)
      .eq("client_message_id", input.command.idempotencyKey)
      .maybeSingle();
    if (error) throw databaseError("duplicate lookup", error.message);
    return data ? toReceipt(data, await loadApproval(data.id)) : null;
  }

  return {
    async accept(input) {
      const row: TurnInsert = {
        id: input.turnId,
        user_id: input.actor.id,
        session_id: input.command.sessionId,
        client_message_id: input.command.idempotencyKey,
        payload_identity: input.command.payloadIdentity,
        command_payload: asJson(input.command.payload),
        status: "accepted",
        stage: "accepted",
        terminal_outcome: null,
        source_receipts: [],
        warning_messages: [],
        version: 0,
        updated_at: input.now,
      };
      const { data, error } = await supabase
        .from("durable_ai_turns")
        .insert(row)
        .select("*")
        .single();
      if (!error && data) {
        await appendEvents(data.id, [
          { type: "turn.accepted", occurredAt: input.now },
        ]);
        return { receipt: toReceipt(data, null), isNew: true };
      }
      if (error?.code !== "23505") {
        throw databaseError(
          "accept",
          error?.message ?? "insert returned no row",
        );
      }
      const receipt = await getByCommand(input);
      if (!receipt) {
        throw databaseError(
          "duplicate lookup",
          "the unique command exists but its receipt could not be read",
        );
      }
      if (receipt.payloadIdentity !== input.command.payloadIdentity) {
        throw new AssistantTurnConflictError(
          "The idempotency key already belongs to a different immutable payload.",
          receipt,
        );
      }
      return { receipt, isNew: false };
    },

    get,

    async claim(turnId, actor, now) {
      const current = await requireRow(turnId, actor);
      if (current.status !== "accepted") {
        throw new AssistantTurnConflictError(
          `Assistant turn cannot be claimed from ${current.status}.`,
          toReceipt(current, await loadApproval(turnId)),
        );
      }
      const updated = await atomicUpdateWithEvents(
        current,
        actor,
        {
          status: "running",
          stage: "running",
          started_at: now,
          updated_at: now,
          error_message: null,
        },
        "claim",
        [{ type: "turn.running", occurredAt: now }],
      );
      return toReceipt(updated, null);
    },

    complete: (turnId, actor, outcome) =>
      transition(turnId, actor, ["running"], outcome),

    fail: (turnId, actor, outcome) =>
      transition(turnId, actor, ["accepted", "running"], outcome),

    async persistRuntimeResult(input) {
      const current = await requireRow(input.turnId, input.actor);
      if (current.status !== "running") {
        throw new AssistantTurnConflictError(
          `Runtime result cannot persist from ${current.status}.`,
          toReceipt(current, await loadApproval(input.turnId)),
        );
      }
      const sources = input.result.sources ?? [];
      const warnings =
        input.result.status === "completed"
          ? (input.result.warnings ?? [])
          : [];
      const approvalResult =
        input.result.status === "approval_required" ? input.result : null;
      const delegatedResult =
        input.result.status === "delegated" ? input.result : null;
      const isApproval = approvalResult !== null;
      const isDelegated = delegatedResult !== null;
      const update: TurnUpdate = {
        source_receipts: asJson(sources),
        warning_messages: asJson(warnings),
        updated_at: input.now,
        ...(isApproval
          ? {
              stage: "approval_required",
              terminal_outcome: null,
              completed_at: null,
              error_message: null,
            }
          : isDelegated
            ? {
                stage: "delegated_running",
                runtime_kind: delegatedResult!.runtimeKind,
                runtime_locator: delegatedResult!.runtimeLocator,
                terminal_outcome: null,
                completed_at: null,
                error_message: null,
              }
            : {
                status: terminalStatus(input.transition!.terminal),
                stage: input.transition!.stage,
                terminal_outcome: input.transition!.terminal,
                completed_at: input.transition!.completedAt,
                error_message: input.transition!.errorMessage,
              }),
      };
      const runtimeEvents = (input.result.events ?? []).map(
        (event: AssistantTurnRuntimeEvent) => ({
          type: "runtime.event" as const,
          occurredAt: input.now,
          data: { runtimeType: event.type, ...(event.data ?? {}) },
        }),
      );
      const durableEvents = [
        ...runtimeEvents,
        ...(isApproval
          ? [
              {
                type: "turn.approval_requested" as const,
                occurredAt: input.now,
                data: {
                  requestId: approvalResult!.requestId,
                  prompt: approvalResult!.prompt,
                },
              },
            ]
          : isDelegated
            ? [
                {
                  type: "runtime.event" as const,
                  occurredAt: input.now,
                  data: {
                    runtimeType: "runtime.delegated",
                    runtimeKind: delegatedResult!.runtimeKind,
                    runtimeLocator: delegatedResult!.runtimeLocator,
                  },
                },
              ]
            : [
                {
                  type: "turn.terminal" as const,
                  occurredAt: input.now,
                  data: {
                    outcome: input.transition!.terminal,
                    stage: input.transition!.stage,
                    ...(input.transition!.errorMessage
                      ? { errorMessage: input.transition!.errorMessage }
                      : {}),
                  },
                },
              ]),
      ];
      const updated = await atomicUpdateWithEvents(
        current,
        input.actor,
        update,
        "runtime result",
        durableEvents,
        isApproval
          ? {
              action: "insert",
              request_id: approvalResult!.requestId,
              payload_identity: current.payload_identity,
              prompt: approvalResult!.prompt,
              created_at: input.now,
            }
          : null,
      );
      const approval = isApproval ? await loadApproval(input.turnId) : null;
      if (
        isApproval &&
        (!approval ||
          approval.request_id !== approvalResult!.requestId ||
          approval.payload_identity !== current.payload_identity ||
          approval.status !== "pending")
      ) {
        throw new AssistantTurnApprovalPersistenceError(input.turnId);
      }
      return toReceipt(updated, approval);
    },

    async resolveApproval(input) {
      const current = await requireRow(input.turnId, input.actor);
      const existingApproval = await loadApproval(input.turnId);
      if (
        existingApproval &&
        existingApproval.request_id === input.requestId &&
        existingApproval.payload_identity === input.payloadIdentity &&
        existingApproval.status !== "pending"
      ) {
        return {
          receipt: toReceipt(current, existingApproval),
          payload: current.command_payload,
          won: false,
        };
      }
      if (
        current.status !== "running" ||
        current.stage !== "approval_required" ||
        current.payload_identity !== input.payloadIdentity
      ) {
        throw new AssistantTurnApprovalPersistenceError(input.turnId);
      }
      const rejected = input.decision === "rejected";
      const approvalEvents = [
        {
          type: "turn.approval_resolved" as const,
          occurredAt: input.now,
          data: {
            requestId: input.requestId,
            decision: input.decision,
            resolvedBy: input.actor.id,
          },
        },
        ...(rejected
          ? [
              {
                type: "turn.terminal" as const,
                occurredAt: input.now,
                data: { outcome: "failed", stage: "approval_rejected" },
              },
            ]
          : []),
      ];
      let updated: TurnRow;
      try {
        updated = await atomicUpdateWithEvents(
          current,
          input.actor,
          rejected
            ? {
                status: "failed",
                stage: "approval_rejected",
                terminal_outcome: "failed",
                completed_at: input.now,
                error_message: "The authenticated user rejected the approval.",
                updated_at: input.now,
              }
            : {
                status: "running",
                stage: "running",
                terminal_outcome: null,
                completed_at: null,
                error_message: null,
                updated_at: input.now,
              },
          "approval continuation",
          approvalEvents,
          {
            action: "resolve",
            request_id: input.requestId,
            payload_identity: input.payloadIdentity,
            decision: input.decision,
            decision_at: input.now,
          },
        );
      } catch (error) {
        if (error instanceof AssistantTurnConflictError) {
          const [latest, latestApproval] = await Promise.all([
            requireRow(input.turnId, input.actor),
            loadApproval(input.turnId),
          ]);
          if (
            !latestApproval ||
            latestApproval.request_id !== input.requestId ||
            latestApproval.payload_identity !== input.payloadIdentity
          ) {
            throw new AssistantTurnApprovalPersistenceError(input.turnId);
          }
          if (latestApproval.status !== "pending") {
            return {
              receipt: toReceipt(latest, latestApproval),
              payload: latest.command_payload,
              won: false,
            };
          }
        }
        throw error;
      }
      const resolvedApproval = await loadApproval(input.turnId);
      if (
        !resolvedApproval ||
        resolvedApproval.request_id !== input.requestId ||
        resolvedApproval.payload_identity !== input.payloadIdentity ||
        resolvedApproval.status !== input.decision
      ) {
        throw new AssistantTurnApprovalPersistenceError(input.turnId);
      }
      return {
        receipt: toReceipt(updated, resolvedApproval),
        payload: current.command_payload,
        won: true,
      };
    },

    async cancel(turnId, actor, reason, now) {
      const current = await requireRow(turnId, actor);
      if (
        current.status === "completed" ||
        current.status === "failed" ||
        current.status === "canceled"
      ) {
        return toReceipt(current, await loadApproval(turnId));
      }
      const cancellationEvents = [
        {
          type: "turn.cancellation_requested" as const,
          occurredAt: now,
          data: { reason },
        },
        {
          type: "turn.canceled" as const,
          occurredAt: now,
          data: { reason },
        },
        {
          type: "turn.terminal" as const,
          occurredAt: now,
          data: { outcome: "canceled", stage: "canceled" },
        },
      ];
      const updated = await atomicUpdateWithEvents(
        current,
        actor,
        {
          status: "canceled",
          stage: "canceled",
          terminal_outcome: "canceled",
          cancellation_requested_at: now,
          completed_at: now,
          error_message: reason,
          updated_at: now,
        },
        "cancellation",
        cancellationEvents,
      );
      return toReceipt(updated, await loadApproval(turnId));
    },

    async isCancellationRequested(turnId, actor) {
      const row = await requireRow(turnId, actor);
      return row.cancellation_requested_at !== null;
    },

    async listEvents(turnId, actor, afterSequence) {
      await requireRow(turnId, actor);
      const { data, error } = await supabase
        .from("durable_ai_turn_events")
        .select("*")
        .eq("turn_id", turnId)
        .gt("sequence", afterSequence)
        .order("sequence", { ascending: true });
      if (error) throw databaseError("event replay", error.message);
      return (data ?? []).map(toReplayEvent);
    },
  };
}
