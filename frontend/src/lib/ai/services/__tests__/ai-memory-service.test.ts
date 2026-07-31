jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
}));

jest.mock("@/lib/ai/provider-config", () => ({
  getOpenAICompatibleClientConfig: jest.fn(() => ({ apiKey: "test-key" })),
  getOpenAIModelId: jest.fn((modelId: string) => modelId),
}));

jest.mock("@/lib/ai/insight-cards", () => ({
  resolveTargetIdsForProjects: jest.fn(),
}));

jest.mock("@/lib/ai/notification-decision-ledger", () => ({
  recordAiNotificationDecision: jest.fn(),
}));

jest.mock("openai", () =>
  jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    },
  })),
);

import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { recordAiNotificationDecision } from "@/lib/ai/notification-decision-ledger";
import {
  buildMemoryContextPayload,
  rankMemoriesForRecall,
  scoreMemoryForRecall,
  type AiMemory,
  writeMemory,
} from "../ai-memory-service";

const mockedCreateServiceClient = jest.mocked(createServiceClient);
const mockedCreateRagServiceClient = jest.mocked(createRagServiceClient);
const mockedRecordAiNotificationDecision = jest.mocked(
  recordAiNotificationDecision,
);

function memory(overrides: Partial<AiMemory>): AiMemory {
  return {
    id: overrides.id ?? "memory-1",
    type: overrides.type ?? "fact",
    content: overrides.content ?? "Default memory",
    confidence: overrides.confidence ?? 0.9,
    importance: overrides.importance ?? 0.5,
    project_id: overrides.project_id ?? null,
    meeting_id: overrides.meeting_id ?? null,
    source: overrides.source ?? "conversation",
    visibility: overrides.visibility ?? "private",
    created_at: overrides.created_at ?? "2026-05-18T12:00:00.000Z",
    similarity: overrides.similarity,
  };
}

function createMemoryWriteSupabaseMock({
  duplicateRows = [],
  insertedId = "memory-created",
}: {
  duplicateRows?: Array<{ id: string; importance: number }>;
  insertedId?: string;
} = {}) {
  const duplicateLimit = jest.fn().mockResolvedValue({
    data: duplicateRows,
    error: null,
  });
  const duplicateContentEq = jest.fn(() => ({ limit: duplicateLimit }));
  const duplicateTypeEq = jest.fn(() => ({ eq: duplicateContentEq }));
  const duplicateUserEq = jest.fn(() => ({ eq: duplicateTypeEq }));
  const duplicateSelect = jest.fn(() => ({ eq: duplicateUserEq }));

  const updateEq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ eq: updateEq }));

  const projectMaybeSingle = jest.fn().mockResolvedValue({
    data: { id: 25125 },
    error: null,
  });
  const projectEq = jest.fn(() => ({ maybeSingle: projectMaybeSingle }));
  const projectSelect = jest.fn(() => ({ eq: projectEq }));

  const insertSingle = jest.fn().mockResolvedValue({
    data: { id: insertedId },
    error: null,
  });
  const insertSelect = jest.fn(() => ({ single: insertSingle }));
  const insert = jest.fn(() => ({ select: insertSelect }));

  const aiMemoriesFrom = {
    select: jest.fn((columns?: string) => {
      if (columns === "id, importance") return { eq: duplicateUserEq };
      if (columns === "id") return { eq: projectEq };
      return duplicateSelect(columns);
    }),
    update,
    insert,
  };

  const from = jest.fn((table: string) => {
    if (table === "projects") {
      return { select: projectSelect };
    }
    return aiMemoriesFrom;
  });

  mockedCreateServiceClient.mockReturnValue({ from } as never);

  const upsert = jest.fn().mockResolvedValue({ error: null });
  const ragFrom = jest.fn(() => ({ upsert }));
  mockedCreateRagServiceClient.mockReturnValue({
    from: ragFrom,
  } as never);

  return {
    from,
    ragFrom,
    update,
    updateEq,
    insert,
    insertSingle,
    upsert,
  };
}

describe("AI memory recall ranking", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-19T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("weights recency ahead of semantic similarity for default recall", () => {
    const freshMemory = memory({
      id: "fresh",
      content: "Fresh source-quality rule",
      created_at: "2026-05-18T12:00:00.000Z",
      similarity: 0.55,
      importance: 0.4,
    });
    const staleMemory = memory({
      id: "stale",
      content: "Older but semantically similar rule",
      created_at: "2026-01-01T12:00:00.000Z",
      similarity: 0.95,
      importance: 1,
    });

    expect(rankMemoriesForRecall([staleMemory, freshMemory])[0].id).toBe(
      "fresh",
    );
  });

  it("boosts selected-project memories and explains the ranking inputs", () => {
    const selectedProjectMemory = memory({
      id: "selected-project",
      project_id: 983,
      created_at: "2026-05-10T12:00:00.000Z",
      similarity: 0.6,
    });
    const otherProjectMemory = memory({
      id: "other-project",
      project_id: 42,
      created_at: "2026-05-10T12:00:00.000Z",
      similarity: 0.6,
    });

    const ranked = rankMemoriesForRecall(
      [otherProjectMemory, selectedProjectMemory],
      { projectId: 983 },
    );

    expect(ranked[0].id).toBe("selected-project");
    expect(ranked[0].ranking_reason).toContain("project=selected");
    expect(
      scoreMemoryForRecall(selectedProjectMemory, { projectId: 983 }).reason,
    ).toContain("freshness=");
  });

  it("exposes selected memory ranking metadata for the debugger payload", () => {
    const payload = buildMemoryContextPayload(
      [],
      [
        memory({
          id: "project-fact",
          project_id: 983,
          content:
            "Ulta Fresno owner updates should prioritize meeting transcripts.",
          created_at: "2026-05-18T12:00:00.000Z",
          similarity: 0.72,
        }),
      ],
      [],
      { projectId: 983 },
    );

    expect(payload.block).toContain("Ulta Fresno owner updates");
    expect(payload.selected[0]).toMatchObject({
      id: "project-fact",
      ranking_reason: expect.stringContaining("project=selected"),
    });
    expect(payload.selected[0].ranking_score).toBeGreaterThan(0);
  });
});

describe("AI memory write notification decisions", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-19T12:00:00.000Z"));
    jest.clearAllMocks();
    mockedRecordAiNotificationDecision.mockResolvedValue({
      status: "recorded",
      decision: {
        tier: "quiet",
        channels: ["quiet_inbox"],
        requiredAction: "Review in AI Profile or Memory Center if needed.",
        reason: "Memory update is transparency context, not an interruption.",
        failureLoudBehavior: "Keep memory source and edit/delete path visible.",
        preferenceOverrideReason: null,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records a quiet notification decision when a memory is created", async () => {
    const { ragFrom, upsert } = createMemoryWriteSupabaseMock({
      insertedId: "memory-created",
    });

    await expect(
      writeMemory({
        userId: "user-1",
        type: "preference",
        content: "Prefers short summaries.",
        projectId: 25125,
        source: "manual",
      }),
    ).resolves.toMatchObject({
      id: "memory-created",
      action: "created",
      notificationDecision: { status: "recorded" },
    });

    expect(mockedRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "user-1",
        eventType: "ai_memory_updated",
        severity: "low",
        projectId: 25125,
        entityType: "ai_memories",
        entityId: "memory-created",
        eventKey: "ai_memory:memory-created:created",
        title: "AI memory saved",
        body: "Prefers short summaries.",
      }),
    );
    expect(ragFrom).toHaveBeenCalledWith("rag_document_metadata");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "memory-created",
        app_document_id: "memory-created",
        project_id: 25125,
        source: "ai_memory",
        source_system: "ai_memory",
        source_item_id: "memory-created",
        title: "AI memory: preference",
        source_web_url: "/settings/memory?memoryId=memory-created",
        url: "/settings/memory?memoryId=memory-created",
        embedding_status: "embedded",
      }),
      { onConflict: "id" },
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        chunk_id: "ai_memory_memory-created",
        document_id: "memory-created",
        source_type: "ai_memory",
      }),
      { onConflict: "chunk_id" },
    );
  });

  it("records a quiet notification decision when a duplicate memory is updated", async () => {
    createMemoryWriteSupabaseMock({
      duplicateRows: [{ id: "memory-existing", importance: 0.4 }],
    });

    await expect(
      writeMemory({
        userId: "user-1",
        type: "preference",
        content: "Prefers short summaries.",
        projectId: 25125,
        source: "manual",
      }),
    ).resolves.toMatchObject({
      id: "memory-existing",
      action: "updated",
      notificationDecision: { status: "recorded" },
    });

    expect(mockedRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "memory-existing",
        eventKey: "ai_memory:memory-existing:updated",
        title: "AI memory updated",
      }),
    );
  });

  it("keeps memory writes successful when the notification ledger returns a typed failure", async () => {
    createMemoryWriteSupabaseMock({ insertedId: "memory-created" });
    mockedRecordAiNotificationDecision.mockResolvedValue({
      status: "failed",
      decision: {
        tier: "quiet",
        channels: ["quiet_inbox"],
        requiredAction: "Review in AI Profile or Memory Center if needed.",
        reason: "Memory update is transparency context, not an interruption.",
        failureLoudBehavior: "Keep memory source and edit/delete path visible.",
        preferenceOverrideReason: null,
      },
      error: {
        code: "insert_failed",
        message: "Failed to record AI notification decision: insert denied",
      },
    });

    await expect(
      writeMemory({
        userId: "user-1",
        type: "preference",
        content: "Prefers short summaries.",
      }),
    ).resolves.toMatchObject({
      id: "memory-created",
      action: "created",
      notificationDecision: {
        status: "failed",
        error: {
          code: "insert_failed",
        },
      },
    });
  });
});
