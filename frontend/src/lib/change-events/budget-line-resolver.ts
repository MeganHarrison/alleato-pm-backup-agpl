import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type Supabase = SupabaseClient<Database>;

interface ResolveChangeEventBudgetLineIdInput {
  supabase: Supabase;
  projectId: number;
  inputId: string | null | undefined;
  where: string;
}

function invalidBudgetCode(where: string, message: string, details?: unknown): GuardrailError {
  return new GuardrailError({
    code: "INVALID_PAYLOAD",
    where,
    message,
    details,
    status: 400,
    severity: "low",
  });
}

export async function resolveChangeEventBudgetLineId({
  supabase,
  projectId,
  inputId,
  where,
}: ResolveChangeEventBudgetLineIdInput): Promise<string | null> {
  if (!inputId) return null;

  const { data: budgetLine, error: budgetLineError } = await supabase
    .from("budget_lines")
    .select("id, project_id")
    .eq("id", inputId)
    .maybeSingle();

  if (budgetLineError) {
    throw invalidBudgetCode(where, "Could not validate budget line.", {
      inputId,
      reason: budgetLineError.message,
    });
  }

  if (budgetLine) {
    if (budgetLine.project_id !== projectId) {
      throw invalidBudgetCode(where, "Budget line does not belong to this project.", {
        inputId,
        expectedProjectId: projectId,
        actualProjectId: budgetLine.project_id,
      });
    }

    return budgetLine.id;
  }

  const { data: projectBudgetCode, error: projectBudgetCodeError } = await supabase
    .from("project_budget_codes")
    .select("id, project_id, cost_code_id, cost_type_id, sub_job_id")
    .eq("id", inputId)
    .maybeSingle();

  if (projectBudgetCodeError) {
    throw invalidBudgetCode(where, "Could not validate project budget code.", {
      inputId,
      reason: projectBudgetCodeError.message,
    });
  }

  if (!projectBudgetCode) {
    throw invalidBudgetCode(
      where,
      `Invalid budget code: ID ${inputId} was not found in budget_lines or project_budget_codes.`,
      { inputId },
    );
  }

  if (projectBudgetCode.project_id !== projectId) {
    throw invalidBudgetCode(where, "Project budget code does not belong to this project.", {
      inputId,
      expectedProjectId: projectId,
      actualProjectId: projectBudgetCode.project_id,
    });
  }

  if (!projectBudgetCode.cost_type_id) {
    throw invalidBudgetCode(
      where,
      `Project budget code ${inputId} has no cost_type_id; cannot resolve budget line.`,
      { inputId },
    );
  }

  const { data: directBudgetLine, error: directBudgetLineError } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("project_id", projectId)
    .eq("project_budget_code_id", projectBudgetCode.id)
    .maybeSingle();

  if (directBudgetLineError) {
    throw invalidBudgetCode(where, "Could not resolve project budget code to a budget line.", {
      inputId,
      reason: directBudgetLineError.message,
    });
  }

  if (directBudgetLine) return directBudgetLine.id;

  const legacyQuery = supabase
    .from("budget_lines")
    .select("id")
    .eq("project_id", projectId)
    .eq("cost_code_id", projectBudgetCode.cost_code_id)
    .eq("cost_type_id", projectBudgetCode.cost_type_id);

  const { data: legacyBudgetLine, error: legacyBudgetLineError } =
    projectBudgetCode.sub_job_id === null
      ? await legacyQuery.is("sub_job_id", null).maybeSingle()
      : await legacyQuery.eq("sub_job_id", projectBudgetCode.sub_job_id).maybeSingle();

  if (legacyBudgetLineError) {
    throw invalidBudgetCode(where, "Could not resolve budget code by cost code and cost type.", {
      inputId,
      reason: legacyBudgetLineError.message,
    });
  }

  if (legacyBudgetLine) return legacyBudgetLine.id;

  const { data: newBudgetLine, error: createError } = await supabase
    .from("budget_lines")
    .insert({
      project_id: projectId,
      project_budget_code_id: projectBudgetCode.id,
      cost_code_id: projectBudgetCode.cost_code_id,
      cost_type_id: projectBudgetCode.cost_type_id,
      sub_job_id: projectBudgetCode.sub_job_id,
    })
    .select("id")
    .single();

  if (createError || !newBudgetLine) {
    throw invalidBudgetCode(where, "Failed to resolve budget code.", {
      inputId,
      reason: `Could not create budget line for project budget code. ${createError?.message ?? ""}`,
    });
  }

  return newBudgetLine.id;
}
