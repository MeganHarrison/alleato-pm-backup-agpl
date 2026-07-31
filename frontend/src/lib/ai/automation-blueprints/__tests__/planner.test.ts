import { planScheduledAutomation } from "../planner";
import { parseNaturalLanguageSchedule } from "../schedule-parser";
import type { Database } from "@/types/database.types";

type AiWorkRunRow = Database["public"]["Tables"]["ai_work_runs"]["Row"];

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

function workRun(overrides: Partial<AiWorkRunRow> = {}): AiWorkRunRow {
  return {
    id: "run-1",
    event_id: null,
    source_sync_run_id: null,
    daily_recap_id: null,
    workflow_id: "automation_blueprint_draft",
    trigger_type: "user_requested",
    surface: "ai_assistant_automation_blueprint",
    title: "Draft automation: Microsoft Graph sync",
    user_goal: "Schedule graph sync weekdays at 7am",
    normalized_goal: "schedule graph sync weekdays at 7am",
    status: "needs_admin_review",
    priority: "normal",
    permission_mode: "admin_approved",
    model_policy: {},
    runtime_budget: {},
    tool_scope: {},
    source_policy: {},
    source_counts: {},
    result_summary: null,
    confidence: null,
    delivery_status: "skipped",
    delivery_target: {},
    failure_code: null,
    failure_message: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-06-19T18:00:00.000Z",
    updated_at: "2026-06-19T18:00:00.000Z",
    ...overrides,
  };
}

describe("parseNaturalLanguageSchedule", () => {
  it("parses daily, weekday, weekly, and hourly schedules", () => {
    expect(
      parseNaturalLanguageSchedule({
        input: "run daily recap daily at 8:30am",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ok",
      cadence: "daily",
      cronExpression: "30 8 * * *",
      localTime: "08:30",
    });

    expect(
      parseNaturalLanguageSchedule({
        input: "run graph sync weekdays at 7am",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ok",
      cadence: "weekdays",
      cronExpression: "0 7 * * 1-5",
    });

    expect(
      parseNaturalLanguageSchedule({
        input: "source health every monday at 9pm",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ok",
      cadence: "weekly",
      cronExpression: "0 21 * * 1",
      weekday: "monday",
    });

    expect(
      parseNaturalLanguageSchedule({
        input: "source rag health every 4 hours on weekdays",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ok",
      cadence: "hourly",
      cronExpression: "0 */4 * * 1-5",
      intervalHours: 4,
    });
  });

  it("returns ambiguity instead of guessing cadence or time", () => {
    expect(
      parseNaturalLanguageSchedule({
        input: "run graph sync at 7am",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ambiguous",
      reason: "missing_cadence",
    });

    expect(
      parseNaturalLanguageSchedule({
        input: "run graph sync weekdays",
        timezone: "America/New_York",
      }),
    ).toMatchObject({
      status: "ambiguous",
      reason: "missing_time",
    });
  });
});

describe("planScheduledAutomation", () => {
  it("is default-off and does not create a draft", async () => {
    const createDraft = jest.fn();

    const result = await planScheduledAutomation(
      {
        userInput: "Schedule graph sync weekdays at 7am",
        timezone: "America/New_York",
      },
      {
        isEnabled: () => false,
        createDraft,
      },
    );

    expect(result).toEqual({
      status: "disabled",
      reason: "feature_disabled",
      draftCreated: false,
    });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("creates a reviewable draft in ai_work_runs without mutating Render cron", async () => {
    const createDraft = jest.fn().mockResolvedValue(workRun());

    const result = await planScheduledAutomation(
      {
        userInput: "Schedule graph sync weekdays at 7am",
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        timezone: "America/New_York",
      },
      {
        isEnabled: () => true,
        createDraft,
      },
    );

    expect(result).toMatchObject({
      status: "draft_created",
      reason: null,
      draftCreated: true,
      blueprint: {
        key: "graph_sync",
        existingRenderCronName: "alleato-graph-sync",
      },
      schedule: {
        cronExpression: "0 7 * * 1-5",
      },
    });
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: "automation_blueprint_draft",
        status: "needs_admin_review",
        permission_mode: "admin_approved",
        delivery_status: "skipped",
        metadata: expect.objectContaining({
          reviewRequired: true,
          directCronMutationBlocked: true,
          rollback: expect.stringContaining("no Render cron definition changes"),
        }),
      }),
    );
  });

  it("blocks unsupported blueprints without persistence", async () => {
    const createDraft = jest.fn();
    const result = await planScheduledAutomation(
      {
        userInput: "Schedule a coffee reminder daily at 8am",
        timezone: "America/New_York",
      },
      {
        isEnabled: () => true,
        createDraft,
      },
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "unsupported_blueprint",
      draftCreated: false,
    });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("fails loudly when persistence fails", async () => {
    const result = await planScheduledAutomation(
      {
        userInput: "Schedule graph sync daily at 9am",
        timezone: "America/New_York",
      },
      {
        isEnabled: () => true,
        createDraft: jest.fn().mockRejectedValue(new Error("insert denied")),
      },
    );

    expect(result).toMatchObject({
      status: "failed",
      reason: "persistence_failed",
      draftCreated: false,
      message: "Automation blueprint draft persistence failed: insert denied",
    });
  });
});
