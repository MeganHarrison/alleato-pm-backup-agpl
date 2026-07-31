jest.mock("ai", () => ({
  tool: jest.fn((definition) => definition),
}));

jest.mock("../guardrails", () => ({
  createToolGuardrails: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
  createRagServiceClient: jest.fn(),
}));

// Mock createToolContext so action-tools tests don't need a real OpenAI key or
// RAG client. The ctx.db, ctx.rag, and ctx.guardrails slots are wired to the
// same jest.fn() stubs already mocked above so existing test expectations hold.
jest.mock("../tool-context", () => {
  const { createServiceClient, createRagServiceClient } = jest.requireMock("@/lib/supabase/service") as {
    createServiceClient: jest.MockedFunction<() => unknown>;
    createRagServiceClient: jest.MockedFunction<() => unknown>;
  };
  const { createToolGuardrails } = jest.requireMock("../guardrails") as {
    createToolGuardrails: jest.MockedFunction<(...args: unknown[]) => unknown>;
  };
  return {
    createToolContext: jest.fn((input: { userId: string; pinnedProjectId?: number }) => ({
      db: createServiceClient(),
      rag: createRagServiceClient(),
      openai: {},
      guardrails: createToolGuardrails(input.userId, { pinnedProjectId: input.pinnedProjectId }),
    })),
    createFakeToolContext: jest.fn(),
  };
});

jest.mock("@/lib/microsoft-graph/calendar-invites", () => ({
  buildCalendarInviteAdaptiveCard: jest.fn(),
  createOutlookCalendarInvite: jest.fn(),
  resolveOutlookOrganizerEmail: jest.fn(),
}));

jest.mock("@/lib/microsoft-graph/mail", () => ({
  buildOutlookMailDraftAdaptiveCard: jest.fn(),
  createOutlookMailDraft: jest.fn(),
  resolveOutlookMailboxUserId: jest.fn(),
}));

jest.mock("@/services/notificationService", () => ({
  notifyRfiReviewNeeded: jest.fn(),
}));

jest.mock("@/lib/ai/notification-decision-ledger", () => ({
  recordAiNotificationDecision: jest.fn(),
}));

import { createServiceClient } from "@/lib/supabase/service";
import { recordAiNotificationDecision } from "@/lib/ai/notification-decision-ledger";
import { notifyRfiReviewNeeded } from "@/services/notificationService";
import { createToolGuardrails } from "../guardrails";
import {
  buildCommitmentDraftWidget,
  buildCommitmentSovInserts,
  createActionTools,
  normalizeGeneratedTaskPriority,
  normalizeGeneratedTaskStatus,
  previewCreateRFI,
  validateCommitmentLineItems,
} from "../action-tools";

const mockedCreateToolGuardrails = jest.mocked(createToolGuardrails);
const mockedCreateServiceClient = jest.mocked(createServiceClient);
const mockedNotifyRfiReviewNeeded = jest.mocked(notifyRfiReviewNeeded);
const mockedRecordAiNotificationDecision = jest.mocked(
  recordAiNotificationDecision,
);

describe("previewCreateRFI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifyRfiReviewNeeded.mockResolvedValue({
      created: 1,
      skipped: 0,
    });
  });

  it("returns a traced preview without writing an RFI", async () => {
    const onTrace = jest.fn();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });

    const output = await previewCreateRFI(
      "user-1",
      { onTrace, pinnedProjectId: 43 },
      {
        projectId: 43,
        subject: "RFI - Delayed Electrical Rough-in",
        question: "Please clarify delayed electrical rough-in.",
        costImpact: "tbd",
        scheduleImpact: "tbd",
      },
    );

    expect(output).toMatchObject({
      action: "preview",
      preview: {
        table: "rfis",
        fields: {
          project_id: 43,
          subject: "RFI - Delayed Electrical Rough-in",
          question: "Please clarify delayed electrical rough-in.",
          cost_impact: "tbd",
          schedule_impact: "tbd",
          status: "open",
          is_private: false,
        },
      },
    });
    expect(mockedNotifyRfiReviewNeeded).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        projectId: 43,
        subject: "RFI - Delayed Electrical Rough-in",
        question: "Please clarify delayed electrical rough-in.",
        costImpact: "tbd",
        scheduleImpact: "tbd",
        eventKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "createRFI",
        input: expect.objectContaining({
          projectId: 43,
          confirmed: false,
        }),
        output: expect.objectContaining({
          action: "preview",
        }),
      }),
    );
  });

  it("fails loudly through trace when project access is denied", async () => {
    const onTrace = jest.fn();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({
        ok: false,
        error: "You do not have access to that project.",
      }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });

    const output = await previewCreateRFI(
      "user-1",
      { onTrace },
      {
        projectId: 999,
        subject: "RFI - Restricted Project",
        question: "Can I create this?",
      },
    );

    expect(output).toEqual({
      success: false,
      error: "You do not have access to that project.",
    });
    expect(mockedNotifyRfiReviewNeeded).not.toHaveBeenCalled();
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "createRFI",
        input: expect.objectContaining({
          projectId: 999,
          confirmed: false,
        }),
        output: output,
      }),
    );
  });
});

describe("createChangeEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRecordAiNotificationDecision.mockResolvedValue({
      status: "recorded",
      decision: {
        tier: "interrupt",
        channels: ["in_app", "assistant_widget"],
        requiredAction: "Approve, edit, or discard the AI-created change event draft.",
        reason: "AI-created draft needs human decision before it becomes record truth.",
        failureLoudBehavior: "Keep draft visible with source and owner.",
        preferenceOverrideReason:
          "Teams delivery suppressed by preference; in-app visibility retained.",
      },
    });
  });

  it("previews change request creation before writing", async () => {
    const onTrace = jest.fn();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({
        ok: true,
        projectId: 43,
      }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({ from: jest.fn() } as never);

    const tools = createActionTools(
      "00000000-0000-0000-0000-000000000001",
      { onTrace },
    );
    const execute = tools.createChangeEvent.execute;
    if (!execute) throw new Error("createChangeEvent execute was not registered");

    const output = await execute({
      projectId: 43,
      title: "Owner-requested lobby finish change",
      description: "Owner asked to upgrade the lobby finish package.",
      scope: "owner_change",
      type: "potential_change",
      status: "open",
      originId: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
      primeContractId: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      notificationDecision: {
        status: "recorded",
        decision: {
          channels: ["in_app", "assistant_widget"],
        },
      },
      preview: {
        table: "change_events",
        fields: {
          project_id: 43,
          title: "Owner-requested lobby finish change",
          description: "Owner asked to upgrade the lobby finish package.",
          type: "Owner Change",
          scope: "TBD",
          status: "Open",
          reason: null,
          origin: "Internal",
          origin_id: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
          expecting_revenue: true,
          line_item_revenue_source: null,
          prime_contract_id: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
        },
        reviewCard: {
          title: "Change event draft",
          recordType: "change_event",
          groups: expect.arrayContaining([
            expect.objectContaining({
              title: "General information",
              fields: expect.arrayContaining([
                expect.objectContaining({
                  key: "project_id",
                  label: "Project",
                  required: true,
                  value: "43",
                }),
              ]),
            }),
            expect.objectContaining({
              title: "Source and contract",
              fields: expect.arrayContaining([
                expect.objectContaining({
                  key: "origin_id",
                  value: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
                }),
                expect.objectContaining({
                  key: "prime_contract_id",
                  value: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
                }),
              ]),
            }),
            expect.objectContaining({
              title: "Line items",
              fields: expect.arrayContaining([
                expect.objectContaining({
                  key: "line_items",
                  value: "Not supported by chat create yet",
                }),
              ]),
            }),
          ]),
          notices: [],
        },
      },
    });
    expect(output.preview.reviewCard.groups).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Attachments",
        }),
      ]),
    );
    expect(mockedRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "00000000-0000-0000-0000-000000000001",
        eventType: "ai_change_event_awaiting_approval",
        severity: "normal",
        projectId: 43,
        entityType: "change_events",
        eventKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        title: "AI change event draft ready",
        body:
          "Review, edit, or confirm the AI-created change event draft: Owner-requested lobby finish change",
        preferenceHints: {
          suppressTeams: true,
        },
        isUserOnRelatedPage: true,
        preview: expect.objectContaining({
          toolName: "createChangeEvent",
          table: "change_events",
          fields: expect.objectContaining({
            project_id: 43,
            title: "Owner-requested lobby finish change",
          }),
          reviewCard: expect.objectContaining({
            title: "Change event draft",
          }),
        }),
      }),
    );
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "createChangeEvent",
        input: expect.objectContaining({
          projectId: 43,
          confirmed: false,
        }),
        output: expect.objectContaining({
          action: "preview",
        }),
      }),
    );
  });

  it("keeps the change request preview visible when notification decision recording fails", async () => {
    const onTrace = jest.fn();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({
        ok: true,
        projectId: 43,
      }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({ from: jest.fn() } as never);
    mockedRecordAiNotificationDecision.mockResolvedValueOnce({
      status: "failed",
      decision: {
        tier: "interrupt",
        channels: ["in_app", "assistant_widget"],
        requiredAction: "Approve, edit, or discard the AI-created change event draft.",
        reason: "AI-created draft needs human decision before it becomes record truth.",
        failureLoudBehavior: "Keep draft visible with source and owner.",
        preferenceOverrideReason: null,
      },
      error: {
        code: "insert_failed",
        message:
          "Failed to record AI notification decision (ai_change_event_awaiting_approval): insert denied",
      },
    });

    const tools = createActionTools(
      "00000000-0000-0000-0000-000000000001",
      { onTrace },
    );
    const execute = tools.createChangeEvent.execute;
    if (!execute) throw new Error("createChangeEvent execute was not registered");

    const output = await execute({
      projectId: 43,
      title: "Owner-requested lobby finish change",
      description: "Owner asked to upgrade the lobby finish package.",
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      preview: {
        table: "change_events",
      },
      notificationDecision: {
        status: "failed",
        error: {
          code: "insert_failed",
          message: expect.stringContaining(
            "Failed to record AI notification decision",
          ),
        },
      },
    });
    expect(onTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "createChangeEvent",
        output: expect.objectContaining({
          action: "preview",
          notificationDecision: expect.objectContaining({
            status: "failed",
          }),
        }),
      }),
    );
  });

  it("rejects invalid native values before preview or write", async () => {
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn(),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({ from: jest.fn() } as never);

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createChangeEvent.execute;
    if (!execute) throw new Error("createChangeEvent execute was not registered");

    const output = await execute({
      projectId: 43,
      title: "Invalid status",
      status: "void",
      confirmed: false,
    });

    expect(output).toMatchObject({
      success: false,
      error: expect.stringContaining('Invalid change request status "void"'),
    });
    expect(mockedRecordAiNotificationDecision).not.toHaveBeenCalled();
  });

  it("writes a confirmed change request with the canonical DB payload", async () => {
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const changeEventInsert = jest.fn((payload) => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: "ce-1",
            project_id: payload.project_id,
            title: payload.title,
            number: payload.number,
            status: payload.status,
          },
          error: null,
        }),
      })),
    }));
    const from = jest.fn((tableName: string) => {
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest
                          .fn()
                          .mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      if (tableName === "change_events") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              // Statuses drive the closing-insight open count: only CE-009 is open,
              // so other-open = 1 and the newly created (Open) CE makes 2.
              data: [
                { number: "001", status: "Approved", deleted_at: null },
                { number: "CE-009", status: "Open", deleted_at: null },
                { number: "not-a-number", status: "Closed", deleted_at: null },
              ],
              error: null,
            }),
          })),
          insert: changeEventInsert,
        };
      }
      throw new Error(`Unexpected table in change request test: ${tableName}`);
    });

    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({
        ok: true,
        projectId: 43,
      }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({ from } as never);

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createChangeEvent.execute;
    if (!execute) throw new Error("createChangeEvent execute was not registered");

    const output = await execute({
      projectId: 43,
      title: "Owner-requested lobby finish change",
      description: "Owner asked to upgrade the lobby finish package.",
      scope: "owner_change",
      type: "potential_change",
      status: "open",
      reason: "Back Charge",
      origin: "Internal",
      originId: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
      expectingRevenue: true,
      primeContractId: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
      confirmed: true,
      idempotencyKey: "change-request-key-1",
    });

    expect(changeEventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 43,
        title: "Owner-requested lobby finish change",
        description: "Owner asked to upgrade the lobby finish package.",
        type: "Owner Change",
        scope: "TBD",
        status: "Open",
        reason: "Back Charge",
        origin: "Internal",
        origin_id: "5b769b58-6f0a-4c1f-bf51-63010c88ad5a",
        number: "010",
        expecting_revenue: true,
        line_item_revenue_source: null,
        prime_contract_id: "614ccdf0-25c6-4f85-a4cc-0ce94d6f36cf",
      }),
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
    expect(mockedRecordAiNotificationDecision).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      success: true,
      message:
        'Change request **010 — "Owner-requested lobby finish change"** logged. That\'s **2 open change events** on this project now — worth a scan if you\'re tracking exposure. Want to add attachments or open the full form to set line items?',
      record: {
        id: "ce-1",
        project_id: 43,
        number: "010",
        status: "Open",
      },
    });
  });
});

describe("generated task DB contract normalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps AI-friendly priority aliases to public.tasks priority values", () => {
    expect(normalizeGeneratedTaskPriority("normal")).toBe("medium");
    expect(normalizeGeneratedTaskPriority("medium")).toBe("medium");
    expect(normalizeGeneratedTaskPriority("critical")).toBe("urgent");
    expect(normalizeGeneratedTaskPriority("urgent")).toBe("urgent");
    expect(normalizeGeneratedTaskPriority("high")).toBe("high");
    expect(normalizeGeneratedTaskPriority("low")).toBe("low");
    expect(normalizeGeneratedTaskPriority()).toBe("medium");
  });

  it("maps AI-friendly status aliases to public.tasks status values", () => {
    expect(normalizeGeneratedTaskStatus("completed")).toBe("done");
    expect(normalizeGeneratedTaskStatus("done")).toBe("done");
    expect(normalizeGeneratedTaskStatus("in_progress")).toBe("in_progress");
    expect(normalizeGeneratedTaskStatus("blocked")).toBe("blocked");
    expect(normalizeGeneratedTaskStatus("cancelled")).toBe("cancelled");
    expect(normalizeGeneratedTaskStatus("open")).toBe("open");
    expect(normalizeGeneratedTaskStatus()).toBe("open");
  });

  it("creates confirmed generated tasks through the atomic RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: "task-1",
        title: "Call Brandon",
        description: "Call Brandon about framing RFI",
        status: "done",
        priority: "urgent",
        due_date: "2026-05-12",
        project_id: 43,
        assignee_name: "Brandon",
        assignee_email: null,
        created_at: "2026-05-11T21:30:00Z",
      },
      error: null,
    });
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn((tableName: string) => {
      if (tableName === "people") {
        return {
          select: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      throw new Error(`Unexpected table write in generated task test: ${tableName}`);
    });

    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({ from, rpc } as never);

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createGeneratedTask.execute;
    if (!execute) throw new Error("createGeneratedTask execute was not registered");

    const output = await execute({
      projectId: 43,
      title: "Call Brandon",
      description: "Call Brandon about framing RFI",
      assignee: "Brandon",
      dueDate: "2026-05-12",
      scheduleTaskId: "11111111-1111-1111-1111-111111111111",
      priority: "critical",
      status: "completed",
      confirmed: true,
      idempotencyKey: "task-key-1",
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_ai_generated_task",
      expect.objectContaining({
        p_title: "Call Brandon",
        p_description: "Call Brandon about framing RFI",
        p_status: "done",
        p_priority: "urgent",
        p_project_id: 43,
        p_schedule_task_id: "11111111-1111-1111-1111-111111111111",
        p_assignee_name: "Brandon",
        p_idempotency_key: "task-key-1",
      }),
    );
    expect(from).not.toHaveBeenCalledWith("document_metadata");
    expect(from).not.toHaveBeenCalledWith("tasks");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
    expect(output).toMatchObject({
      success: true,
      record: {
        id: "task-1",
        status: "done",
        priority: "urgent",
      },
    });
  });

  it("direct-writes generated tasks for Teams task-create mode without a preview round trip", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: "task-2",
        title: "Confirm utility transfer impact",
        description:
          "Confirm the Solar Array temp-power transfer back to utility power will not impact electricity.",
        status: "open",
        priority: "high",
        due_date: "2026-06-26",
        project_id: null,
        assignee_name: "Candon Rusin",
        assignee_email: "candon@example.com",
        created_at: "2026-06-26T13:45:00Z",
      },
      error: null,
    });
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn((tableName: string) => {
      if (tableName === "people") {
        return {
          select: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: "person-1",
                  first_name: "Candon",
                  last_name: "Rusin",
                  email: "candon@example.com",
                },
              ],
              error: null,
            }),
          })),
        };
      }
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      throw new Error(`Unexpected table write in generated task test: ${tableName}`);
    });

    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn().mockResolvedValue(null),
    });
    mockedCreateServiceClient.mockReturnValue({ from, rpc } as never);

    const tools = createActionTools(
      "00000000-0000-0000-0000-000000000001",
      { generatedTaskWriteMode: "direct" },
    );
    const execute = tools.createGeneratedTask.execute;
    if (!execute) throw new Error("createGeneratedTask execute was not registered");

    const output = await execute({
      title: "Confirm utility transfer impact",
      description:
        "Confirm the Solar Array temp-power transfer back to utility power will not impact electricity.",
      assignee: "Candon Rusin",
      dueDate: "2026-06-26",
      priority: "high",
      status: "open",
      confirmed: false,
      idempotencyKey: "teams-task-key-1",
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_ai_generated_task",
      expect.objectContaining({
        p_title: "Confirm utility transfer impact",
        p_status: "open",
        p_priority: "high",
        p_assignee_name: "Candon Rusin",
        p_assignee_email: "candon@example.com",
        p_assignee_person_id: "person-1",
        p_idempotency_key: "teams-task-key-1",
      }),
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        request_payload: expect.objectContaining({
          confirmed: true,
          autoConfirmedBy: "teams_task_write_direct",
        }),
      }),
    );
    expect(output).toMatchObject({
      success: true,
      message:
        'Task **"Confirm utility transfer impact"** was added to the Tasks page.',
      links: {
        tasksPage: "/tasks?task=task-2",
      },
    });
  });
});

describe("createSubmittal DB contract", () => {
  const userId = "00000000-0000-0000-0000-000000000001";
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupSubmittalMocks() {
    const submittalInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: "sub-1",
            title: "Structural Steel Shop Drawings",
            submittal_number: "001",
            status: "pending",
          },
          error: null,
        }),
      })),
    }));
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn((tableName: string) => {
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest
                          .fn()
                          .mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      if (tableName === "submittals") {
        return {
          // read path: fetch the latest submittal_number for numbering
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest
                  .fn()
                  .mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
          // write path
          insert: submittalInsert,
        };
      }
      throw new Error(`Unexpected table in submittal test: ${tableName}`);
    });

    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn().mockResolvedValue(1009),
    } as never);
    mockedCreateServiceClient.mockReturnValue({ from } as never);

    return { from, submittalInsert };
  }

  it("writes the authenticated user uuid to submitted_by and the free-text party to submitter_company", async () => {
    // Regression: submitted_by is a NOT NULL uuid FK. Previously the tool wrote
    // the free-text "submittedBy" string ("TBD"/subcontractor name) straight
    // into it, so every confirmed createSubmittal failed at the DB insert and
    // the model hallucinated an unrelated "due date is required" error.
    const { submittalInsert } = setupSubmittalMocks();

    const tools = createActionTools(userId);
    const execute = tools.createSubmittal.execute;
    if (!execute) throw new Error("createSubmittal execute was not registered");

    await execute(
      {
        projectId: 1009,
        title: "Structural Steel Shop Drawings",
        specSection: "05 12 00",
        submittedBy: "ACME Steel Co",
        status: "Draft",
        confirmed: true,
        idempotencyKey: "submittal-key-1",
      },
      { toolCallId: "call-1", messages: [] } as never,
    );

    expect(submittalInsert).toHaveBeenCalledTimes(1);
    const payload = submittalInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.submitted_by).toBe(userId);
    expect(payload.submitted_by).toMatch(UUID_RE);
    expect(payload.submitted_by).not.toBe("ACME Steel Co");
    expect(payload.created_by).toBe(userId);
    expect(payload.submitter_company).toBe("ACME Steel Co");
  });

  it("only accepts status values permitted by the submittals_status_check DB constraint", () => {
    // Regression: the tool defaulted status to "pending" and offered
    // "revise_resubmit", neither of which is in the DB check constraint, so
    // every insert failed. The schema enum must be a subset of the allowed set
    // and must default to a valid status.
    const DB_ALLOWED_STATUSES = new Set([
      "Draft",
      "Open",
      "Distributed",
      "Closed",
      "draft",
      "submitted",
      "under_review",
      "requires_revision",
      "approved",
      "rejected",
      "superseded",
    ]);

    const tools = createActionTools(userId);
    const schema = (
      tools.createSubmittal as unknown as { inputSchema: import("zod").ZodTypeAny }
    ).inputSchema;
    const statusSchema = (
      schema as unknown as { shape: { status: import("zod").ZodTypeAny } }
    ).shape.status;

    // Default must be a valid status (status omitted -> default applied).
    const parsedDefault = (
      schema as unknown as {
        parse: (v: unknown) => { status: string };
      }
    ).parse({ projectId: 1009, title: "x" });
    expect(DB_ALLOWED_STATUSES.has(parsedDefault.status)).toBe(true);

    // Every status the tool offers must be permitted by the DB constraint.
    const toolStatuses = [
      "Draft",
      "Open",
      "Distributed",
      "Closed",
      "submitted",
      "under_review",
      "requires_revision",
      "approved",
      "rejected",
      "superseded",
    ];
    for (const value of toolStatuses) {
      expect(statusSchema.safeParse(value).success).toBe(true);
      expect(DB_ALLOWED_STATUSES.has(value)).toBe(true);
    }

    // The previously-broken values must be rejected by the tool schema.
    expect(statusSchema.safeParse("pending").success).toBe(false);
    expect(statusSchema.safeParse("revise_resubmit").success).toBe(false);
  });

  it("stores submitter_company as null when the party is blank or 'TBD'", async () => {
    const { submittalInsert } = setupSubmittalMocks();

    const tools = createActionTools(userId);
    const execute = tools.createSubmittal.execute;
    if (!execute) throw new Error("createSubmittal execute was not registered");

    await execute(
      {
        projectId: 1009,
        title: "Door Hardware",
        submittedBy: "TBD",
        status: "Draft",
        confirmed: true,
        idempotencyKey: "submittal-key-2",
      },
      { toolCallId: "call-2", messages: [] } as never,
    );

    const payload = submittalInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.submitted_by).toBe(userId);
    expect(payload.submitter_company).toBeNull();
  });
});

describe("buildCommitmentDraftWidget", () => {
  it("marks unresolved vendors as a failing validation item", () => {
    const widget = buildCommitmentDraftWidget({
      projectId: 25125,
      type: "subcontract",
      title: "Electrical rough-in",
      contractNumber: "SC-001",
      status: "Draft",
      vendorName: "Acme Electric",
      contractCompanyId: null,
      description: "Electrical rough-in scope",
    });

    expect(widget.type).toBe("commitment_draft");
    expect(widget.vendorResolved).toBe(false);
    expect(widget.validation).toContainEqual(
      expect.objectContaining({
        label: "Vendor",
        status: "fail",
      }),
    );
  });

  it("builds a passable purchase order draft when the vendor is resolved", () => {
    const widget = buildCommitmentDraftWidget({
      projectId: 25125,
      type: "purchase_order",
      title: "Switchgear procurement",
      contractNumber: "PO-001",
      status: "Draft",
      vendorName: "Acme Supply",
      contractCompanyId: "company-1",
      estimatedCompletionDate: "2026-07-01",
      defaultRetainagePercent: 5,
    });

    expect(widget.commitmentType).toBe("purchase_order");
    expect(widget.vendorResolved).toBe(true);
    expect(widget.validation.every((item) => item.status !== "fail")).toBe(true);
    expect(widget.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Delivery date", value: "2026-07-01" }),
        expect.objectContaining({ label: "Retainage %", value: "5" }),
      ]),
    );
  });

  it("includes SOV line items and total in the commitment draft", () => {
    const widget = buildCommitmentDraftWidget({
      projectId: 25125,
      type: "subcontract",
      title: "Electrical rough-in",
      contractNumber: "SC-001",
      status: "Draft",
      vendorName: "Acme Electric",
      contractCompanyId: "company-1",
      lineItems: [
        {
          budgetCode: "26-0000",
          description: "Electrical rough-in",
          amount: 12500,
          quantity: 1,
          unitCost: 12500,
          uom: "LS",
          retainagePercent: 10,
        },
      ],
    });

    expect(widget.totalAmount).toBe(12500);
    expect(widget.lineItems).toEqual([
      expect.objectContaining({
        costCode: "26-0000",
        description: "Electrical rough-in",
        amount: 12500,
        quantity: 1,
        unitCost: 12500,
        uom: "LS",
      }),
    ]);
    expect(widget.validation).toContainEqual(
      expect.objectContaining({
        label: "SOV lines",
        status: "pass",
      }),
    );
  });

  it("maps commitment line items to the correct SOV table insert shapes", () => {
    expect(
      buildCommitmentSovInserts({
        commitmentId: "commitment-1",
        type: "subcontract",
        lineItems: [
          {
            budgetCode: "26-0000",
            description: "Electrical rough-in",
            amount: 12500,
            uom: "LS",
            retainagePercent: 10,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        subcontract_id: "commitment-1",
        line_number: 1,
        budget_code: "26-0000",
        project_budget_code_id: null,
        description: "Electrical rough-in",
        amount: 12500,
        billed_to_date: 0,
        unit_of_measure: "LS",
        retainage_percent: 10,
      }),
    ]);

    expect(
      buildCommitmentSovInserts({
        commitmentId: "commitment-2",
        type: "purchase_order",
        lineItems: [
          {
            budgetCode: "22-0000",
            description: "Plumbing fixtures",
            amount: 8000,
            uom: "EA",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        purchase_order_id: "commitment-2",
        line_number: 1,
        budget_code: "22-0000",
        project_budget_code_id: null,
        description: "Plumbing fixtures",
        amount: 8000,
        billed_to_date: 0,
        uom: "EA",
      }),
    ]);
  });

  it("uses resolved project budget code IDs when building commitment SOV inserts", () => {
    expect(
      buildCommitmentSovInserts({
        commitmentId: "commitment-1",
        type: "subcontract",
        budgetCodeResolutions: [
          {
            projectBudgetCodeId: "project-budget-code-1",
            displayBudgetCode: "26-0000.S",
          },
        ],
        lineItems: [
          {
            budgetCode: "26-0000.S",
            description: "Electrical rough-in",
            amount: 12500,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        budget_code: "26-0000.S",
        project_budget_code_id: "project-budget-code-1",
      }),
    ]);
  });

  it("fails validation for invalid SOV line items", () => {
    expect(
      validateCommitmentLineItems([
        {
          description: " ",
          amount: -1,
        },
      ]),
    ).toEqual([
      "Line 1: description is required.",
      "Line 1: amount must be zero or greater.",
    ]);
  });
});

describe("project directory action tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedCreateServiceClient.mockReturnValue({
      from: jest.fn(),
      rpc: jest.fn(),
    } as never);
  });

  it("previews project company creation before writing", async () => {
    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createProjectCompany.execute;
    if (!execute) throw new Error("createProjectCompany execute was not registered");

    const output = await execute({
      projectId: 43,
      name: "ABC Electric",
      companyType: "SUBCONTRACTOR",
      emailAddress: "estimating@abcelectric.test",
      businessPhone: "555-0100",
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      preview: {
        tables: ["companies", "project_companies"],
        fields: {
          project_id: 43,
          name: "ABC Electric",
          company_type: "SUBCONTRACTOR",
          email_address: "estimating@abcelectric.test",
          contact_phone: "555-0100",
          status: "ACTIVE",
        },
      },
    });
  });

  it("previews project contact creation before writing", async () => {
    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createProjectContact.execute;
    if (!execute) throw new Error("createProjectContact execute was not registered");

    const output = await execute({
      projectId: 43,
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex.rivera@abcelectric.test",
      jobTitle: "Project Manager",
      companyName: "ABC Electric",
      role: "Electrical PM",
      makePrimaryCompanyContact: true,
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      preview: {
        tables: ["people", "project_directory_memberships", "project_companies"],
        fields: {
          project_id: 43,
          first_name: "Alex",
          last_name: "Rivera",
          email: "alex.rivera@abcelectric.test",
          job_title: "Project Manager",
          company_name: "ABC Electric",
          role: "Electrical PM",
          person_type: "contact",
          status: "active",
          make_primary_company_contact: true,
        },
      },
    });
  });
});

describe("createCommitment previews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true, projectId: 43 }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
    mockedRecordAiNotificationDecision.mockResolvedValue({
      status: "recorded",
      decision: {
        tier: "interrupt",
        channels: ["in_app", "teams"],
        requiredAction: "Confirm vendor, dates, line items, and total before commit.",
        reason: "Commitment or SOV draft is a high-risk financial write.",
        failureLoudBehavior: "Keep Commit disabled until required confirmations complete.",
        preferenceOverrideReason:
          "Teams delivery suppressed by preference; in-app visibility retained.",
      },
    });
  });

  function setupCommitmentPreviewClient() {
    const from = jest.fn((tableName: string) => {
      if (tableName === "subcontracts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
        };
      }
      if (tableName === "companies") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: [{ id: "company-1", name: "Acme Electric" }],
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table in commitment preview test: ${tableName}`);
    });

    mockedCreateServiceClient.mockReturnValue({ from, rpc: jest.fn() } as never);
  }

  it("records a notification decision when previewing a commitment", async () => {
    setupCommitmentPreviewClient();

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createCommitment.execute;
    if (!execute) throw new Error("createCommitment execute was not registered");

    const output = await execute({
      projectId: 43,
      type: "subcontract",
      title: "Electrical rough-in",
      vendorName: "Acme Electric",
      status: "Draft",
      lineItems: [
        {
          budgetCode: "26-0000",
          description: "Electrical rough-in",
          amount: 12500,
        },
      ],
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      notificationDecision: {
        status: "recorded",
        decision: {
          channels: ["in_app", "teams"],
        },
      },
      preview: {
        table: "subcontracts",
        fields: {
          project_id: 43,
          contract_number: "SC-001",
          title: "Electrical rough-in",
          contract_company_id: "company-1",
        },
      },
    });
    expect(mockedRecordAiNotificationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "00000000-0000-0000-0000-000000000001",
        eventType: "ai_commitment_awaiting_approval",
        severity: "normal",
        projectId: 43,
        entityType: "subcontracts",
        eventKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        title: "AI commitment draft ready",
        body:
          "Confirm vendor, dates, and line items before creating the AI-drafted commitment: Electrical rough-in",
        preferenceHints: {
          suppressTeams: true,
        },
        isUserOnRelatedPage: true,
        preview: expect.objectContaining({
          toolName: "createCommitment",
          table: "subcontracts",
          fields: expect.objectContaining({
            project_id: 43,
            contract_number: "SC-001",
            title: "Electrical rough-in",
          }),
          widget: expect.objectContaining({
            type: "commitment_draft",
          }),
        }),
      }),
    );
  });

  it("keeps the commitment preview visible when notification decision recording fails", async () => {
    setupCommitmentPreviewClient();
    mockedRecordAiNotificationDecision.mockResolvedValueOnce({
      status: "failed",
      decision: {
        tier: "interrupt",
        channels: ["in_app", "teams"],
        requiredAction: "Confirm vendor, dates, line items, and total before commit.",
        reason: "Commitment or SOV draft is a high-risk financial write.",
        failureLoudBehavior: "Keep Commit disabled until required confirmations complete.",
        preferenceOverrideReason: null,
      },
      error: {
        code: "insert_failed",
        message:
          "Failed to record AI notification decision (ai_commitment_awaiting_approval): insert denied",
      },
    });

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createCommitment.execute;
    if (!execute) throw new Error("createCommitment execute was not registered");

    const output = await execute({
      projectId: 43,
      type: "subcontract",
      title: "Electrical rough-in",
      vendorName: "Acme Electric",
      status: "Draft",
      confirmed: false,
    });

    expect(output).toMatchObject({
      action: "preview",
      preview: {
        table: "subcontracts",
      },
      notificationDecision: {
        status: "failed",
        error: {
          code: "insert_failed",
          message: expect.stringContaining(
            "Failed to record AI notification decision",
          ),
        },
      },
    });
  });
});

describe("createCommitment line-item writes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateToolGuardrails.mockReturnValue({
      enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true, projectId: 43 }),
      getScope: jest.fn(),
      getScopedProjectIds: jest.fn(),
      applyPinnedProject: jest.fn(),
    });
  });

  it("creates SOV line items after a confirmed subcontract is created", async () => {
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const subcontractInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: "subcontract-1",
            contract_number: "SC-001",
            title: "Electrical rough-in",
            status: "Draft",
          },
          error: null,
        }),
      })),
    }));
    const sovInsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn((tableName: string) => {
      if (tableName === "subcontracts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
          insert: subcontractInsert,
          delete: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (tableName === "companies") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: [{ id: "company-1", name: "Acme Electric" }],
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      if (tableName === "project_budget_codes") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: "project-budget-code-1",
                    cost_code_id: "26-0000",
                    cost_type_id: "cost-type-1",
                    cost_code_types: { code: "S", description: "Subcontract" },
                  },
                ],
                error: null,
              }),
            })),
          })),
        };
      }
      if (tableName === "subcontract_sov_items") {
        return {
          insert: sovInsert,
        };
      }
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      throw new Error(`Unexpected table in commitment line-item test: ${tableName}`);
    });

    mockedCreateServiceClient.mockReturnValue({ from, rpc: jest.fn() } as never);

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createCommitment.execute;
    if (!execute) throw new Error("createCommitment execute was not registered");

    const output = await execute({
      projectId: 43,
      type: "subcontract",
      title: "Electrical rough-in",
      vendorName: "Acme Electric",
      status: "Draft",
      lineItems: [
        {
          budgetCode: "26-0000",
          description: "Electrical rough-in",
          amount: 12500,
          quantity: 1,
          unitCost: 12500,
          uom: "LS",
          retainagePercent: 10,
        },
      ],
      confirmed: true,
    });

    expect(output).toMatchObject({
      success: true,
      lineItemsCreated: 1,
    });
    expect(sovInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        subcontract_id: "subcontract-1",
        line_number: 1,
        budget_code: "26-0000.S",
        project_budget_code_id: "project-budget-code-1",
        description: "Electrical rough-in",
        amount: 12500,
        quantity: 1,
        unit_cost: 12500,
        unit_of_measure: "LS",
        retainage_percent: 10,
      }),
    ]);
  });

  it("does not create the commitment when an AI-provided SOV budget code is inactive", async () => {
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const subcontractInsert = jest.fn();
    const from = jest.fn((tableName: string) => {
      if (tableName === "subcontracts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          })),
          insert: subcontractInsert,
        };
      }
      if (tableName === "companies") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              ilike: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                  data: [{ id: "company-1", name: "Acme Electric" }],
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      if (tableName === "project_budget_codes") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      if (tableName === "ai_tool_write_audits") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
          insert: auditInsert,
        };
      }
      throw new Error(`Unexpected table in inactive budget code test: ${tableName}`);
    });

    mockedCreateServiceClient.mockReturnValue({ from, rpc: jest.fn() } as never);

    const tools = createActionTools("00000000-0000-0000-0000-000000000001");
    const execute = tools.createCommitment.execute;
    if (!execute) throw new Error("createCommitment execute was not registered");

    const output = await execute({
      projectId: 43,
      type: "subcontract",
      title: "Electrical rough-in",
      vendorName: "Acme Electric",
      status: "Draft",
      lineItems: [
        {
          budgetCode: "99-9999",
          description: "Electrical rough-in",
          amount: 12500,
        },
      ],
      confirmed: true,
    });

    expect(output).toMatchObject({
      success: false,
      error: 'Line 1: budget code "99-9999" is not active for this project.',
    });
    expect(subcontractInsert).not.toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_name: "createCommitment",
        status: "error",
      }),
    );
  });
});
