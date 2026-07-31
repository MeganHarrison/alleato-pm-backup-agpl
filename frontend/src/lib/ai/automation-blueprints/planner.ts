import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";

import {
  matchAutomationBlueprint,
  type AutomationBlueprintDefinition,
} from "./catalog";
import {
  parseNaturalLanguageSchedule,
  type ParsedSchedule,
} from "./schedule-parser";

type AiWorkRunRow = Database["public"]["Tables"]["ai_work_runs"]["Row"];
type AiWorkRunInsert = Database["public"]["Tables"]["ai_work_runs"]["Insert"];

export type AutomationBlueprintPlanResult =
  | {
      status: "disabled";
      reason: "feature_disabled";
      draftCreated: false;
    }
  | {
      status: "blocked";
      reason:
        | "unsupported_blueprint"
        | "ambiguous_schedule"
        | "invalid_timezone";
      draftCreated: false;
      message: string;
    }
  | {
      status: "draft_created";
      reason: null;
      draftCreated: true;
      draft: AiWorkRunRow;
      blueprint: AutomationBlueprintDefinition;
      schedule: Extract<ParsedSchedule, { status: "ok" }>;
    }
  | {
      status: "failed";
      reason: "persistence_failed";
      draftCreated: false;
      message: string;
    };

export interface PlanScheduledAutomationParams {
  userInput: string;
  userId?: string | null;
  projectId?: number | null;
  timezone?: string | null;
  sourceSurface?: string;
  sourceMessageId?: string | null;
}

interface PlannerDependencies {
  isEnabled?: () => boolean;
  createDraft?: (payload: AiWorkRunInsert) => Promise<AiWorkRunRow>;
}

function featureEnabled(): boolean {
  return process.env.AI_ASSISTANT_AUTOMATION_BLUEPRINTS_ENABLED === "true";
}

async function createAutomationDraft(payload: AiWorkRunInsert): Promise<AiWorkRunRow> {
    const { data, error } = await serviceDb.from("ai_work_runs")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "ai_work_runs insert returned no row");
  }

  return data;
}

function normalizeGoal(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toJson(value: unknown): Json {
  return value as Json;
}

function draftPayload(params: {
  input: PlanScheduledAutomationParams;
  blueprint: AutomationBlueprintDefinition;
  schedule: Extract<ParsedSchedule, { status: "ok" }>;
}): AiWorkRunInsert {
  const normalizedGoal = normalizeGoal(params.input.userInput);
  return {
    workflow_id: "automation_blueprint_draft",
    trigger_type: "user_requested",
    surface: params.input.sourceSurface ?? "ai_assistant_automation_blueprint",
    title: `Draft automation: ${params.blueprint.title}`,
    user_goal: normalizedGoal,
    normalized_goal: normalizedGoal.toLowerCase(),
    status: "needs_admin_review",
    priority: "normal",
    permission_mode: "admin_approved",
    model_policy: toJson({
      execution: "no_model_execution_required",
    }),
    runtime_budget: toJson({
      draftOnly: true,
      renderMutationAllowed: false,
    }),
    tool_scope: toJson({
      runtimeOwner: params.blueprint.runtimeOwner,
      existingRenderCronName: params.blueprint.existingRenderCronName,
      renderMutationAllowed: false,
    }),
    source_policy: toJson({
      sourceCloneUsage: {
        hermesBlueprintCatalog: "ADAPT slot-schema and validation ideas",
        hermesSuggestions: "REFERENCE consent-first suggestion flow",
        hermesJobs: "REFERENCE only; no scheduler/runtime copy",
      },
    }),
    source_counts: toJson({}),
    delivery_status: "skipped",
    delivery_target: toJson({}),
    metadata: toJson({
      blueprint: params.blueprint,
      proposedSchedule: params.schedule,
      currentRenderSchedule: params.blueprint.currentSchedule,
      approvalNotes: params.blueprint.approvalNotes,
      sourceMessageId: params.input.sourceMessageId ?? null,
      requestedByUserId: params.input.userId ?? null,
      projectId: params.input.projectId ?? null,
      reviewRequired: true,
      directCronMutationBlocked: true,
      rollback: "Reject or cancel this draft; no Render cron definition changes were made.",
    }),
  };
}

export async function planScheduledAutomation(
  params: PlanScheduledAutomationParams,
  deps: PlannerDependencies = {},
): Promise<AutomationBlueprintPlanResult> {
  const isEnabled = deps.isEnabled ?? featureEnabled;
  const createDraft = deps.createDraft ?? createAutomationDraft;

  if (!isEnabled()) {
    return {
      status: "disabled",
      reason: "feature_disabled",
      draftCreated: false,
    };
  }

  const timezone = params.timezone?.trim() || "America/Indiana/Indianapolis";
  let schedule: ParsedSchedule;
  try {
    schedule = parseNaturalLanguageSchedule({
      input: params.userInput,
      timezone,
    });
  } catch (error) {
    return {
      status: "blocked",
      reason: "invalid_timezone",
      draftCreated: false,
      message: error instanceof Error ? error.message : "Invalid timezone",
    };
  }

  if (schedule.status !== "ok") {
    return {
      status: "blocked",
      reason: "ambiguous_schedule",
      draftCreated: false,
      message: schedule.message,
    };
  }

  const blueprint = matchAutomationBlueprint(params.userInput);
  if (!blueprint) {
    return {
      status: "blocked",
      reason: "unsupported_blueprint",
      draftCreated: false,
      message:
        "This automation is not in the approved blueprint catalog yet. Ask for daily recap, source health, executive assistant check, or Microsoft Graph sync.",
    };
  }

  try {
    const draft = await createDraft(
      draftPayload({
        input: params,
        blueprint,
        schedule,
      }),
    );
    return {
      status: "draft_created",
      reason: null,
      draftCreated: true,
      draft,
      blueprint,
      schedule,
    };
  } catch (error) {
    return {
      status: "failed",
      reason: "persistence_failed",
      draftCreated: false,
      message:
        error instanceof Error
          ? `Automation blueprint draft persistence failed: ${error.message}`
          : "Automation blueprint draft persistence failed.",
    };
  }
}
