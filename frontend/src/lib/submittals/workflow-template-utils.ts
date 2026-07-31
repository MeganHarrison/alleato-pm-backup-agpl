import {
  normalizeSubmittalWorkflowRole,
  type SubmittalWorkflowRole,
} from "@/lib/submittals/workflow-roles";

export type WorkflowTemplateStepDefinition = {
  step_type: SubmittalWorkflowRole;
  required: boolean;
  user_id: string | null;
};

export type WorkflowTemplateRecord = {
  id: string;
  project_id: number;
  name: string;
  description: string | null;
  steps: WorkflowTemplateStepDefinition[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeWorkflowTemplateStep(
  value: unknown,
): WorkflowTemplateStepDefinition {
  if (!isRecord(value)) {
    return {
      step_type: "Approver",
      required: true,
      user_id: null,
    };
  }

  return {
    step_type: normalizeSubmittalWorkflowRole(
      typeof value.step_type === "string" ? value.step_type : null,
    ),
    required: value.required !== false,
    user_id: typeof value.user_id === "string" ? value.user_id : null,
  };
}

export function normalizeWorkflowTemplateRecord(
  value: unknown,
): WorkflowTemplateRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.project_id !== "number") return null;
  if (typeof value.name !== "string") return null;
  if (typeof value.created_at !== "string") return null;
  if (typeof value.updated_at !== "string") return null;

  return {
    id: value.id,
    project_id: value.project_id,
    name: value.name,
    description:
      typeof value.description === "string" ? value.description : null,
    steps: Array.isArray(value.steps)
      ? value.steps.map(normalizeWorkflowTemplateStep)
      : [],
    created_at: value.created_at,
    updated_at: value.updated_at,
    created_by: typeof value.created_by === "string" ? value.created_by : null,
  };
}
