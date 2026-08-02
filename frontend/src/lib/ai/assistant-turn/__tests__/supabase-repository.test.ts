import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  AssistantTurnApprovalPersistenceError,
  AssistantTurnConflictError,
  createSupabaseAssistantTurnRepository,
  type AssistantTurnActor,
} from "..";

type TableName =
  | "durable_ai_turns"
  | "durable_ai_turn_events"
  | "durable_ai_turn_approvals";
type Row = Record<string, unknown>;

const actor: AssistantTurnActor = {
  id: "00000000-0000-0000-0000-000000000001",
  organizationId: null,
  permissions: [],
};
const now = "2026-07-27T12:00:00.000Z";

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  private mode: "select" | "insert" | "update" = "select";
  private values: Row | Row[] | null = null;
  private ascending = true;
  private orderColumn: string | null = null;
  private resultLimit: number | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  gt(column: string, value: number) {
    this.filters.push((row) => Number(row[column]) > value);
    return this;
  }
  order(column: string, options: { ascending: boolean }) {
    this.orderColumn = column;
    this.ascending = options.ascending;
    return this;
  }
  limit(value: number) {
    this.resultLimit = value;
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.values = values;
    return this;
  }
  update(values: Row) {
    this.mode = "update";
    this.values = values;
    return this;
  }
  async single() {
    const result = this.execute();
    const data = Array.isArray(result.data)
      ? (result.data[0] ?? null)
      : result.data;
    return { ...result, data };
  }
  async maybeSingle() {
    return this.single();
  }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: Row[] | null;
          error: null | { code?: string; message: string };
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): {
    data: Row[] | null;
    error: null | { code?: string; message: string };
  } {
    const rows = this.db.tables[this.table];
    if (this.mode === "insert") {
      const inserts = Array.isArray(this.values) ? this.values : [this.values!];
      for (const value of inserts) {
        if (
          this.table === "durable_ai_turns" &&
          rows.some(
            (row) =>
              row.user_id === value.user_id &&
              row.session_id === value.session_id &&
              row.client_message_id === value.client_message_id,
          )
        ) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate command" },
          };
        }
        if (this.table === "durable_ai_turn_events") {
          value.id = this.db.nextEventId++;
        }
        if (this.table === "durable_ai_turn_approvals") {
          value.id ??= `approval-row-${rows.length + 1}`;
          value.decision_at ??= null;
          value.decision_by ??= null;
        }
        rows.push({ ...value });
      }
      return { data: inserts.map((value) => ({ ...value })), error: null };
    }
    const matched = rows.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
    if (this.mode === "update") {
      for (const row of matched) Object.assign(row, this.values);
    }
    let result = matched.map((row) => ({ ...row }));
    if (this.orderColumn) {
      const column = this.orderColumn;
      result.sort((left, right) => {
        const comparison =
          String(left[column]) < String(right[column]) ? -1 : 1;
        return this.ascending ? comparison : -comparison;
      });
    }
    if (this.resultLimit !== null) result = result.slice(0, this.resultLimit);
    return { data: result, error: null };
  }
}

class FakeSupabase {
  nextEventId = 1;
  conflictNextAtomicTransition = false;
  failNextAtomicTransitionAfterApproval = false;
  tables: Record<TableName, Row[]> = {
    durable_ai_turns: [],
    durable_ai_turn_events: [],
    durable_ai_turn_approvals: [],
  };
  from(table: TableName) {
    return new Query(this, table);
  }
  rpc(
    functionName: string,
    args: {
      p_turn_id: string;
      p_actor_id: string;
      p_expected_version: number;
      p_expected_status: string;
      p_changes: Row;
      p_events: Array<{
        event_type: string;
        occurred_at: string;
        data: Row;
      }>;
      p_approval_operation:
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
          }
        | null;
    },
  ) {
    expect(functionName).toBe("persist_durable_ai_turn_transition_v2");
    return {
      select: () => ({
        maybeSingle: async () => {
          const turn = this.tables.durable_ai_turns.find(
            (row) =>
              row.id === args.p_turn_id && row.user_id === args.p_actor_id,
          );
          if (
            !turn ||
            turn.version !== args.p_expected_version ||
            turn.status !== args.p_expected_status
          ) {
            return { data: null, error: null };
          }

          if (this.conflictNextAtomicTransition) {
            this.conflictNextAtomicTransition = false;
            return { data: null, error: null };
          }

          const stagedTurn = {
            ...turn,
            ...args.p_changes,
            version: Number(turn.version) + 1,
          };
          const stagedApprovals = this.tables.durable_ai_turn_approvals.map(
            (approval) => ({
              ...approval,
            }),
          );
          if (args.p_approval_operation?.action === "insert") {
            if (
              stagedApprovals.some(
                (approval) =>
                  approval.turn_id === args.p_turn_id &&
                  (approval.request_id ===
                    args.p_approval_operation!.request_id ||
                    approval.status === "pending"),
              )
            ) {
              return {
                data: null,
                error: { message: "duplicate approval request" },
              };
            }
            stagedApprovals.push({
              id: `approval-row-${stagedApprovals.length + 1}`,
              turn_id: args.p_turn_id,
              request_id: args.p_approval_operation.request_id,
              payload_identity: args.p_approval_operation.payload_identity,
              prompt: args.p_approval_operation.prompt,
              status: "pending",
              created_at: args.p_approval_operation.created_at,
              decision_at: null,
              decision_by: null,
            });
          }
          if (args.p_approval_operation?.action === "resolve") {
            const approval = stagedApprovals.find(
              (candidate) =>
                candidate.turn_id === args.p_turn_id &&
                candidate.request_id ===
                  args.p_approval_operation!.request_id &&
                candidate.payload_identity ===
                  args.p_approval_operation!.payload_identity &&
                candidate.status === "pending",
            );
            if (!approval) return { data: null, error: null };
            Object.assign(approval, {
              status: args.p_approval_operation.decision,
              decision_by: args.p_actor_id,
              decision_at: args.p_approval_operation.decision_at,
            });
          }

          if (this.failNextAtomicTransitionAfterApproval) {
            this.failNextAtomicTransitionAfterApproval = false;
            return {
              data: null,
              error: { message: "forced atomic transition failure" },
            };
          }

          const firstSequence =
            this.tables.durable_ai_turn_events
              .filter((event) => event.turn_id === args.p_turn_id)
              .reduce(
                (maximum, event) => Math.max(maximum, Number(event.sequence)),
                0,
              ) + 1;
          const stagedEvents = this.tables.durable_ai_turn_events.map(
            (event) => ({ ...event }),
          );
          let stagedNextEventId = this.nextEventId;
          args.p_events.forEach((event, index) => {
            stagedEvents.push({
              id: stagedNextEventId++,
              turn_id: args.p_turn_id,
              sequence: firstSequence + index,
              event_type: event.event_type,
              durability: "durable",
              occurred_at: event.occurred_at,
              data: event.data,
            });
          });
          Object.assign(turn, stagedTurn);
          this.tables.durable_ai_turn_approvals = stagedApprovals;
          this.tables.durable_ai_turn_events = stagedEvents;
          this.nextEventId = stagedNextEventId;
          return { data: { ...stagedTurn }, error: null };
        },
      }),
    };
  }
  client() {
    return {
      from: this.from.bind(this) as SupabaseClient<Database>["from"],
      rpc: this.rpc.bind(this) as SupabaseClient<Database>["rpc"],
    };
  }
}

function input() {
  return {
    turnId: "00000000-0000-0000-0000-000000000010",
    actor,
    now,
    command: {
      type: "start" as const,
      idempotencyKey: "client-message-1",
      sessionId: "session-1",
      payloadIdentity: "sha256:payload",
      payload: { message: "hello" },
    },
  };
}

describe("Supabase AssistantTurn repository", () => {
  it("durably accepts immutable identity/payload and appends an accepted event", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    const accepted = await repository.accept(input());

    expect(accepted.receipt).toEqual(
      expect.objectContaining({
        payloadIdentity: "sha256:payload",
        commandPayload: { message: "hello" },
        version: 0,
      }),
    );
    expect(db.tables.durable_ai_turn_events).toEqual([
      expect.objectContaining({ sequence: 1, event_type: "turn.accepted" }),
    ]);
  });

  it("rejects duplicate idempotency keys with a different immutable payload", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await expect(
      repository.accept({
        ...input(),
        turnId: "00000000-0000-0000-0000-000000000011",
        command: {
          ...input().command,
          payloadIdentity: "sha256:different",
        },
      }),
    ).rejects.toBeInstanceOf(AssistantTurnConflictError);
  });

  it("uses optimistic versions so only one concurrent claim wins", async () => {
    const db = new FakeSupabase();
    const first = createSupabaseAssistantTurnRepository(db.client());
    const second = createSupabaseAssistantTurnRepository(db.client());
    await first.accept(input());

    const results = await Promise.allSettled([
      first.claim(input().turnId, actor, now),
      second.claim(input().turnId, actor, now),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(db.tables.durable_ai_turns[0].version).toBe(1);
  });

  it("persists runtime receipts and replays ordered events from a fresh repository", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.persistRuntimeResult({
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "completed",
        sources: [
          {
            id: "project:7",
            kind: "source",
            required: true,
            status: "succeeded",
          },
        ],
        warnings: ["partial history"],
        events: [{ type: "tool.completed", data: { tool: "query" } }],
      },
      transition: {
        terminal: "completed_with_warnings",
        stage: "completed_with_warnings",
        errorMessage: null,
        completedAt: now,
      },
    });

    const fresh = createSupabaseAssistantTurnRepository(db.client());
    const observed = await fresh.get(input().turnId, actor);
    const events = await fresh.listEvents(input().turnId, actor, 1);
    expect(observed?.sources).toHaveLength(1);
    expect(observed?.warningMessages).toEqual(["partial history"]);
    expect(events.map((event) => event.type)).toEqual([
      "turn.running",
      "runtime.event",
      "turn.terminal",
    ]);
  });

  it("atomically persists one concurrent runtime result without duplicate or missing event sequences", async () => {
    const db = new FakeSupabase();
    const first = createSupabaseAssistantTurnRepository(db.client());
    const second = createSupabaseAssistantTurnRepository(db.client());
    await first.accept(input());
    await first.claim(input().turnId, actor, now);

    const persist = {
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "completed" as const,
        events: [{ type: "tool.completed", data: { tool: "query" } }],
      },
      transition: {
        terminal: "completed" as const,
        stage: "completed",
        errorMessage: null,
        completedAt: now,
      },
    };
    const results = await Promise.allSettled([
      first.persistRuntimeResult(persist),
      second.persistRuntimeResult(persist),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(db.tables.durable_ai_turns[0].version).toBe(2);
    expect(
      db.tables.durable_ai_turn_events.map((event) => event.sequence),
    ).toEqual([1, 2, 3, 4]);
    expect(
      db.tables.durable_ai_turn_events.map((event) => event.event_type),
    ).toEqual([
      "turn.accepted",
      "turn.running",
      "runtime.event",
      "turn.terminal",
    ]);
  });

  it("atomically resolves one exact approval and recovers the original payload", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.persistRuntimeResult({
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "approval_required",
        requestId: "request-approval",
        prompt: "Approve sending?",
      },
      transition: null,
    });
    const resolution = {
      turnId: input().turnId,
      actor,
      requestId: "request-approval",
      payloadIdentity: "sha256:payload",
      decision: "approved" as const,
      now,
    };
    const winner = await repository.resolveApproval(resolution);
    const loser = await repository.resolveApproval(resolution);

    expect(winner).toEqual(
      expect.objectContaining({
        won: true,
        payload: { message: "hello" },
      }),
    );
    expect(loser.won).toBe(false);
    expect(
      db.tables.durable_ai_turn_approvals.filter(
        (row) => row.status === "approved",
      ),
    ).toHaveLength(1);
  });

  it("rejects a mismatched approval request before mutating the durable turn", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.persistRuntimeResult({
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "approval_required",
        requestId: "request-current",
        prompt: "Approve sending?",
      },
      transition: null,
    });

    await expect(
      repository.resolveApproval({
        turnId: input().turnId,
        actor,
        requestId: "request-stale",
        payloadIdentity: "sha256:payload",
        decision: "approved",
        now,
      }),
    ).rejects.toBeInstanceOf(AssistantTurnApprovalPersistenceError);

    expect(db.tables.durable_ai_turn_approvals).toEqual([
      expect.objectContaining({
        request_id: "request-current",
        status: "pending",
      }),
    ]);
    expect(db.tables.durable_ai_turns[0]).toEqual(
      expect.objectContaining({
        version: 2,
        status: "running",
        stage: "approval_required",
      }),
    );
  });

  it("rolls back an approval request when the atomic RPC fails", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    db.failNextAtomicTransitionAfterApproval = true;

    await expect(
      repository.persistRuntimeResult({
        turnId: input().turnId,
        actor,
        now,
        result: {
          status: "approval_required",
          requestId: "request-rollback",
          prompt: "Approve sending?",
        },
        transition: null,
      }),
    ).rejects.toThrow("forced atomic transition failure");

    expect(db.tables.durable_ai_turn_approvals).toEqual([]);
    expect(db.tables.durable_ai_turns[0]).toEqual(
      expect.objectContaining({
        version: 1,
        status: "running",
        stage: "running",
      }),
    );
    expect(
      db.tables.durable_ai_turn_events.map((event) => event.event_type),
    ).toEqual(["turn.accepted", "turn.running"]);
  });

  it("leaves a pending approval unchanged when its atomic resolution conflicts", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.persistRuntimeResult({
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "approval_required",
        requestId: "request-conflict",
        prompt: "Approve sending?",
      },
      transition: null,
    });
    db.conflictNextAtomicTransition = true;

    await expect(
      repository.resolveApproval({
        turnId: input().turnId,
        actor,
        requestId: "request-conflict",
        payloadIdentity: "sha256:payload",
        decision: "approved",
        now,
      }),
    ).rejects.toBeInstanceOf(AssistantTurnConflictError);

    expect(db.tables.durable_ai_turn_approvals).toEqual([
      expect.objectContaining({
        request_id: "request-conflict",
        status: "pending",
        decision_by: null,
        decision_at: null,
      }),
    ]);
    expect(db.tables.durable_ai_turns[0]).toEqual(
      expect.objectContaining({
        version: 2,
        status: "running",
        stage: "approval_required",
      }),
    );
    expect(
      db.tables.durable_ai_turn_events.map((event) => event.event_type),
    ).toEqual(["turn.accepted", "turn.running", "turn.approval_requested"]);
  });

  it("rolls back approval resolution when the atomic RPC fails after staging it", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.persistRuntimeResult({
      turnId: input().turnId,
      actor,
      now,
      result: {
        status: "approval_required",
        requestId: "request-resolution-rollback",
        prompt: "Approve sending?",
      },
      transition: null,
    });
    db.failNextAtomicTransitionAfterApproval = true;

    await expect(
      repository.resolveApproval({
        turnId: input().turnId,
        actor,
        requestId: "request-resolution-rollback",
        payloadIdentity: "sha256:payload",
        decision: "approved",
        now,
      }),
    ).rejects.toThrow("forced atomic transition failure");

    expect(db.tables.durable_ai_turn_approvals).toEqual([
      expect.objectContaining({
        request_id: "request-resolution-rollback",
        status: "pending",
        decision_by: null,
        decision_at: null,
      }),
    ]);
    expect(db.tables.durable_ai_turns[0]).toEqual(
      expect.objectContaining({
        version: 2,
        status: "running",
        stage: "approval_required",
      }),
    );
    expect(
      db.tables.durable_ai_turn_events.map((event) => event.event_type),
    ).toEqual(["turn.accepted", "turn.running", "turn.approval_requested"]);
  });

  it("persists cancellation_requested_at and exposes the cancellation check", async () => {
    const db = new FakeSupabase();
    const repository = createSupabaseAssistantTurnRepository(db.client());
    await repository.accept(input());
    await repository.claim(input().turnId, actor, now);
    await repository.cancel(input().turnId, actor, "stop", now);

    expect(
      await repository.isCancellationRequested(input().turnId, actor),
    ).toBe(true);
    expect(
      db.tables.durable_ai_turn_events.slice(-3).map((row) => row.event_type),
    ).toEqual([
      "turn.cancellation_requested",
      "turn.canceled",
      "turn.terminal",
    ]);
  });
});
