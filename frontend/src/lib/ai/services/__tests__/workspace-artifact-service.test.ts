jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

jest.mock("@/lib/ai/services/ai-memory-service", () => ({
  embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { buildChangeEventWorkflowMetadata } from "@/lib/ai/change-event-workflow";
import {
  updateChangeEventDraftArtifactEdits,
  upsertChangeEventDraftArtifact,
} from "@/lib/ai/services/workspace-artifact-service";

const createServiceClientMock =
  createServiceClient as jest.MockedFunction<typeof createServiceClient>;

function createSelectMaybeSingleChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function createInsertChain(result: unknown) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function createUpdateChain(result: unknown) {
  const chain = {
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
  };
  chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce(result);
  return chain;
}

function createUpdateFetchChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function createListChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    then: jest.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
  };
  return chain;
}

describe("workspace artifact change-event drafts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a session-scoped change event draft artifact when none exists", async () => {
    const lookupChain = createSelectMaybeSingleChain({
      data: null,
      error: null,
    });
    const insertChain = createInsertChain({
      data: { id: "artifact-1" },
      error: null,
    });
    createServiceClientMock
      .mockReturnValueOnce({ from: jest.fn(() => lookupChain) } as never)
      .mockReturnValueOnce({ from: jest.fn(() => insertChain) } as never);

    const workflow = buildChangeEventWorkflowMetadata({
      prompt:
        "The owner requested another restroom after framing. Cost is about $18,000.",
      selectedProjectId: 760,
      selectedProjectName: "Exol Wilmer",
    });

    const result = await upsertChangeEventDraftArtifact({
      userId: "user-1",
      sessionId: "session-1",
      workflow,
    });

    expect(result).toEqual({
      id: "artifact-1",
      version: 1,
      action: "created",
    });
    expect(lookupChain.eq).toHaveBeenCalledWith(
      "artifact_type",
      "change_event_draft",
    );
    expect(lookupChain.eq).toHaveBeenCalledWith("session_id", "session-1");
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_type: "change_event_draft",
        project_id: 760,
        session_id: "session-1",
        tags: ["change-event", "ai-workflow"],
      }),
    );
  });

  it("updates the existing session artifact instead of creating another draft", async () => {
    const lookupChain = createSelectMaybeSingleChain({
      data: { id: "artifact-1" },
      error: null,
    });
    const fetchChain = createUpdateFetchChain({
      data: {
        version: 3,
        artifact_type: "change_event_draft",
        title: "Old title",
        content: {},
        project_id: null,
      },
      error: null,
    });
    const updateChain = createUpdateChain({ error: null });
    const firstClientFrom = jest.fn().mockReturnValueOnce(lookupChain);
    createServiceClientMock
      .mockReturnValueOnce({ from: firstClientFrom } as never)
      .mockReturnValueOnce({
        from: jest
          .fn()
          .mockReturnValueOnce(fetchChain)
          .mockReturnValueOnce(updateChain),
      } as never);

    const workflow = buildChangeEventWorkflowMetadata({
      prompt:
        "The owner requested another restroom after framing. Cost is about $18,000.",
      selectedProjectId: 760,
      selectedProjectName: "Exol Wilmer",
    });

    const result = await upsertChangeEventDraftArtifact({
      userId: "user-1",
      sessionId: "session-1",
      workflow,
    });

    expect(result).toEqual({
      id: "artifact-1",
      version: 4,
      action: "updated",
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 4,
        project_id: 760,
        session_id: "session-1",
        tags: ["change-event", "ai-workflow"],
      }),
    );
  });

  it("persists user edits to the latest session draft artifact", async () => {
    const workflow = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      prompt: "Help me create a change event",
      selectedProjectId: 760,
      selectedProjectName: "Exol Wilmer",
    });
    const listChain = createListChain({
      data: [
        {
          id: "artifact-1",
          user_id: "user-1",
          project_id: 760,
          artifact_type: "change_event_draft",
          title: "Change Event Draft",
          status: "draft",
          version: 1,
          content: { workflow },
          context_snapshot: {},
          session_id: "session-1",
          promoted_to: null,
          promoted_at: null,
          tags: ["change-event", "ai-workflow"],
          created_at: "2026-07-06T05:00:00.000Z",
          updated_at: "2026-07-06T05:00:00.000Z",
        },
      ],
      error: null,
    });
    const fetchChain = createUpdateFetchChain({
      data: {
        version: 1,
        artifact_type: "change_event_draft",
        title: "Change Event Draft",
        content: { workflow },
        project_id: 760,
      },
      error: null,
    });
    const updateChain = createUpdateChain({ error: null });

    createServiceClientMock
      .mockReturnValueOnce({ from: jest.fn(() => listChain) } as never)
      .mockReturnValueOnce({
        from: jest
          .fn()
          .mockReturnValueOnce(fetchChain)
          .mockReturnValueOnce(updateChain),
      } as never);

    const result = await updateChangeEventDraftArtifactEdits({
      userId: "user-1",
      sessionId: "session-1",
      edits: {
        title: "Owner requested restroom relocation",
        narrative: "Owner requested relocating restroom plumbing after framing.",
        cause: "Owner Requested",
        scope: "Out of Scope",
        costImpact: "$18,000",
        scheduleImpact: "No schedule impact expected",
      },
    });

    expect(result).toMatchObject({
      id: "artifact-1",
      version: 2,
      workflow: {
        draft: {
          title: "Owner requested restroom relocation",
          cause: "Owner Requested",
          readyForPreview: true,
        },
        readiness: {
          readyForPreview: true,
        },
      },
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        project_id: 760,
        title: "Owner requested restroom relocation",
        session_id: "session-1",
      }),
    );
  });

  it("persists project selection edits to the draft artifact", async () => {
    const workflow = buildChangeEventWorkflowMetadata({
      updatedAt: "2026-07-06T05:00:00.000Z",
      prompt:
        "Create a change event because the owner requested restroom relocation after framing. Cost is about $18,000 with no schedule impact.",
    });
    const listChain = createListChain({
      data: [
        {
          id: "artifact-1",
          user_id: "user-1",
          project_id: null,
          artifact_type: "change_event_draft",
          title: "Change Event Draft",
          status: "draft",
          version: 1,
          content: { workflow },
          context_snapshot: {},
          session_id: "session-1",
          promoted_to: null,
          promoted_at: null,
          tags: ["change-event", "ai-workflow"],
          created_at: "2026-07-06T05:00:00.000Z",
          updated_at: "2026-07-06T05:00:00.000Z",
        },
      ],
      error: null,
    });
    const fetchChain = createUpdateFetchChain({
      data: {
        version: 1,
        artifact_type: "change_event_draft",
        title: "Change Event Draft",
        content: { workflow },
        project_id: null,
      },
      error: null,
    });
    const updateChain = createUpdateChain({ error: null });

    createServiceClientMock
      .mockReturnValueOnce({ from: jest.fn(() => listChain) } as never)
      .mockReturnValueOnce({
        from: jest
          .fn()
          .mockReturnValueOnce(fetchChain)
          .mockReturnValueOnce(updateChain),
      } as never);

    const result = await updateChangeEventDraftArtifactEdits({
      userId: "user-1",
      sessionId: "session-1",
      edits: {
        projectId: 760,
        projectName: "Exol Wilmer",
      },
    });

    expect(result).toMatchObject({
      id: "artifact-1",
      version: 2,
      workflow: {
        draft: {
          projectId: 760,
          projectName: "Exol Wilmer",
          readyForPreview: true,
        },
        readiness: {
          readyForPreview: true,
        },
      },
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        project_id: 760,
        session_id: "session-1",
      }),
    );
  });
});
