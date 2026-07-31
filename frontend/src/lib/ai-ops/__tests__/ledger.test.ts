import { createAiOpsLedger } from "../ledger";
import type {
  AiArtifact,
  AiEvent,
  AiRun,
  AiRunStep,
  DeliveryAttempt,
  EvidenceRef,
} from "../contracts";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const DAILY_RECAP_ID = "33333333-3333-4333-8333-333333333333";

function createSupabaseMock() {
  const calls: Array<{ table: string; method: string; payload?: unknown }> = [];

  const response = { data: { id: RUN_ID }, error: null };
  const builder = {
    insert: jest.fn((payload: unknown) => {
      calls.push({ table: "", method: "insert", payload });
      return builder;
    }),
    update: jest.fn((payload: unknown) => {
      calls.push({ table: "", method: "update", payload });
      return builder;
    }),
    select: jest.fn(() => builder),
    single: jest.fn(async () => response),
    eq: jest.fn(async () => ({ error: null })),
  };

  const supabase = {
    from: jest.fn((table: string) => {
      const originalInsert = builder.insert;
      const originalUpdate = builder.update;
      builder.insert = jest.fn((payload: unknown) => {
        calls.push({ table, method: "insert", payload });
        return builder;
      });
      builder.update = jest.fn((payload: unknown) => {
        calls.push({ table, method: "update", payload });
        return builder;
      });
      void originalInsert;
      void originalUpdate;
      return builder;
    }),
  };

  return { supabase, calls, response };
}

function event(overrides: Partial<AiEvent> = {}): AiEvent {
  return {
    eventSource: "executive_daily_brief",
    eventType: "scheduled_run",
    status: "accepted",
    idempotencyKey: "executive_daily_brief:scheduled_run:2026-06-19",
    deliveryContext: { channel: "teams" },
    permissionContext: { actor: "system" },
    payload: { dryRun: false },
    metadata: { createdBy: "test" },
    ...overrides,
  };
}

function run(overrides: Partial<AiRun> = {}): AiRun {
  return {
    eventId: EVENT_ID,
    dailyRecapId: DAILY_RECAP_ID,
    workflowId: "executive_daily_brief",
    workflowVersion: "2026-06-19",
    triggerType: "scheduled_run",
    surface: "executive_daily_brief",
    title: "Executive Daily Brief",
    userGoal: "Generate the Executive Daily Brief.",
    normalizedGoal: "Generate evidence-linked executive packet.",
    status: "running",
    permissionMode: "service",
    sourceHealth: [
      {
        sourceFamily: "project_intelligence",
        resourceId: "packets",
        resourceName: "Project intelligence packets",
        status: "healthy",
        checkedAt: "2026-06-19T12:00:00.000Z",
        loadedCount: 3,
        missingCount: 0,
      },
    ],
    sourceCounts: { packets: 3 },
    artifacts: [],
    retryable: false,
    startedAt: "2026-06-19T12:00:00.000Z",
    metadata: { test: true },
    ...overrides,
  };
}

function evidenceRef(overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    sourceFamily: "intelligence_packet",
    sourceId: "packet-1",
    sourceTitle: "Packet 1",
    occurredAt: "2026-06-19T11:00:00.000Z",
    excerpt: "Packet was current when selected.",
    confidence: "high",
    projectId: 1009,
    projectLabel: "1009 - Example",
    metadata: { cardCount: 2 },
    ...overrides,
  };
}

function step(overrides: Partial<AiRunStep> = {}): AiRunStep {
  return {
    runId: RUN_ID,
    stepType: "artifact_persist",
    status: "succeeded",
    startedAt: "2026-06-19T12:00:30.000Z",
    completedAt: "2026-06-19T12:00:31.000Z",
    metadata: { artifactKind: "brief_packet" },
    ...overrides,
  };
}

function artifact(overrides: Partial<AiArtifact> = {}): AiArtifact {
  return {
    runId: RUN_ID,
    kind: "brief_packet",
    title: "Executive Daily Brief packet",
    storageTable: "daily_recaps",
    storageId: DAILY_RECAP_ID,
    contentType: "application/vnd.alleato.executive-brief+json",
    sourceRefs: [evidenceRef()],
    metadata: { recapDate: "2026-06-19" },
    ...overrides,
  };
}

function deliveryAttempt(
  overrides: Partial<DeliveryAttempt> = {},
): DeliveryAttempt {
  return {
    runId: RUN_ID,
    artifactId: "44444444-4444-4444-8444-444444444444",
    channel: "teams",
    recipientId: "user-1",
    recipientAddress: "brandon@example.com",
    status: "dry_run",
    providerMessageId: "teams-message-1",
    retryable: false,
    attemptedAt: "2026-06-19T12:01:00.000Z",
    metadata: {
      reason: "dry_run",
      providerResponse: { id: "teams-message-1" },
    },
    ...overrides,
  };
}

describe("ai-ops ledger", () => {
  it("validates and maps event inserts through the canonical ledger writer", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.createEvent(event());

    expect(supabase.from).toHaveBeenCalledWith("ai_operation_events");
    expect(calls[0]).toMatchObject({
      table: "ai_operation_events",
      method: "insert",
      payload: {
        event_source: "executive_daily_brief",
        event_type: "scheduled_run",
        status: "accepted",
        idempotency_key: "executive_daily_brief:scheduled_run:2026-06-19",
      },
    });
  });

  it("stores workflow version, source health, and artifacts in run metadata until first-class artifact tables exist", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.createRun(run());

    expect(supabase.from).toHaveBeenCalledWith("ai_work_runs");
    expect(calls[0]).toMatchObject({
      table: "ai_work_runs",
      method: "insert",
      payload: {
        workflow_id: "executive_daily_brief",
        daily_recap_id: DAILY_RECAP_ID,
        status: "running",
        metadata: expect.objectContaining({
          workflowVersion: "2026-06-19",
          retryable: false,
          sourceHealth: expect.any(Array),
          artifacts: [],
        }),
      },
    });
  });

  it("maps run updates to daily_recap_id for generated packet artifact linkage", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.updateRun(RUN_ID, {
      status: "succeeded",
      dailyRecapId: DAILY_RECAP_ID,
      resultSummary: "Generated Executive Daily Brief draft.",
      completedAt: "2026-06-19T12:01:00.000Z",
    });

    expect(supabase.from).toHaveBeenCalledWith("ai_work_runs");
    expect(calls[0]).toMatchObject({
      table: "ai_work_runs",
      method: "update",
      payload: {
        status: "succeeded",
        daily_recap_id: DAILY_RECAP_ID,
        result_summary: "Generated Executive Daily Brief draft.",
      },
    });
  });

  it("rejects invalid runs before writing to Supabase", async () => {
    const { supabase } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await expect(
      ledger.createRun(run({ workflowVersion: "" })),
    ).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("maps evidence refs to ai_work_run_sources with required source identity and excerpts", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.insertEvidenceRefs(RUN_ID, [evidenceRef()]);

    expect(supabase.from).toHaveBeenCalledWith("ai_work_run_sources");
    expect(calls[0]).toMatchObject({
      table: "ai_work_run_sources",
      method: "insert",
      payload: [
        {
          work_run_id: RUN_ID,
          source_family: "intelligence_packet",
          source_record_id: "packet-1",
          evidence_excerpt: "Packet was current when selected.",
          confidence: "high",
        },
      ],
    });
  });

  it("maps run steps to ai_work_run_steps", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.createRunStep(step());

    expect(supabase.from).toHaveBeenCalledWith("ai_work_run_steps");
    expect(calls[0]).toMatchObject({
      table: "ai_work_run_steps",
      method: "insert",
      payload: {
        work_run_id: RUN_ID,
        step_type: "artifact_persist",
        status: "succeeded",
        failure_code: undefined,
      },
    });
  });

  it("maps generated artifacts to ai_work_run_artifacts with source ref counts", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.createArtifact(artifact());

    expect(supabase.from).toHaveBeenCalledWith("ai_work_run_artifacts");
    expect(calls[0]).toMatchObject({
      table: "ai_work_run_artifacts",
      method: "insert",
      payload: {
        work_run_id: RUN_ID,
        kind: "brief_packet",
        storage_table: "daily_recaps",
        storage_id: DAILY_RECAP_ID,
        source_ref_count: 1,
      },
    });
  });

  it("maps delivery attempts to ai_work_run_delivery_attempts", async () => {
    const { supabase, calls } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await ledger.createDeliveryAttempt(deliveryAttempt());

    expect(supabase.from).toHaveBeenCalledWith(
      "ai_work_run_delivery_attempts",
    );
    expect(calls[0]).toMatchObject({
      table: "ai_work_run_delivery_attempts",
      method: "insert",
      payload: {
        work_run_id: RUN_ID,
        channel: "teams",
        recipient_id: "user-1",
        recipient_address: "brandon@example.com",
        status: "dry_run",
        provider_message_id: "teams-message-1",
        retryable: false,
        metadata: expect.objectContaining({
          providerResponse: { id: "teams-message-1" },
        }),
      },
    });
  });

  it("rejects invalid delivery attempts before writing to Supabase", async () => {
    const { supabase } = createSupabaseMock();
    const ledger = createAiOpsLedger(supabase as never);

    await expect(
      ledger.createDeliveryAttempt(deliveryAttempt({ recipientAddress: "" })),
    ).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
