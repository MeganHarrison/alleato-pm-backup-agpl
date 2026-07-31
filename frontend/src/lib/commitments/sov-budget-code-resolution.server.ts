import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

type ProjectBudgetCodeLookupRow = {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  cost_code_types:
    | { code: string | null; description: string | null }
    | { code: string | null; description: string | null }[]
    | null;
};

export type ResolvedCommitmentSovBudgetCode = {
  projectBudgetCodeId: string | null;
  displayBudgetCode: string | null;
};

type ResolveCommitmentSovBudgetCodeArgs = {
  supabase: DbClient;
  projectId: number;
  lineNumber: number;
  where: string;
  submittedBudgetCode?: string | null;
  submittedProjectBudgetCodeId?: string | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeBudgetCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function commitmentSovBudgetCodeDisplay(
  row: ProjectBudgetCodeLookupRow,
): string {
  const costType = relationOne(row.cost_code_types);
  return costType?.code ? `${row.cost_code_id}.${costType.code}` : row.cost_code_id;
}

export async function fetchCommitmentSovProjectBudgetCodes(
  supabase: DbClient,
  projectId: number,
  where: string,
): Promise<ProjectBudgetCodeLookupRow[]> {
  const { data, error } = await supabase
    .from("project_budget_codes")
    .select("id, cost_code_id, cost_type_id, cost_code_types ( code, description )")
    .eq("project_id", projectId)
    .eq("is_active", true);

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: `${where}#fetch-project-budget-codes`,
      message: `Failed to fetch project budget codes: ${error.message}`,
      cause: error,
    });
  }

  return ((data ?? []) as ProjectBudgetCodeLookupRow[]).filter(
    (row) => Boolean(row.cost_type_id),
  );
}

export async function resolveCommitmentSovBudgetCode(
  args: ResolveCommitmentSovBudgetCodeArgs,
): Promise<ResolvedCommitmentSovBudgetCode> {
  const budgetCodes = await fetchCommitmentSovProjectBudgetCodes(
    args.supabase,
    args.projectId,
    args.where,
  );

  return resolveCommitmentSovBudgetCodeFromLookup({
    ...args,
    budgetCodes,
  });
}

export function resolveCommitmentSovBudgetCodeFromLookup(
  args: Omit<ResolveCommitmentSovBudgetCodeArgs, "supabase" | "projectId"> & {
    budgetCodes: ProjectBudgetCodeLookupRow[];
  },
): ResolvedCommitmentSovBudgetCode {
  const submittedProjectBudgetCodeId = args.submittedProjectBudgetCodeId || null;
  const submittedBudgetCode = args.submittedBudgetCode?.trim() || null;

  if (submittedProjectBudgetCodeId) {
    const match = args.budgetCodes.find(
      (code) => code.id === submittedProjectBudgetCodeId,
    );
    if (!match) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: `${args.where}#resolve-budget-code`,
        message: `Line ${args.lineNumber}: selected budget code is not active for this project.`,
        status: 400,
      });
    }

    return {
      projectBudgetCodeId: match.id,
      displayBudgetCode:
        submittedBudgetCode || commitmentSovBudgetCodeDisplay(match),
    };
  }

  if (!submittedBudgetCode) {
    return { projectBudgetCodeId: null, displayBudgetCode: null };
  }

  const normalizedSubmitted = normalizeBudgetCode(submittedBudgetCode);
  const matchGroups = [
    args.budgetCodes.filter((code) => code.id === submittedBudgetCode),
    args.budgetCodes.filter((code) => {
      const costType = relationOne(code.cost_code_types);
      return (
        costType?.code &&
        normalizeBudgetCode(`${code.cost_code_id}${costType.code}`) ===
          normalizedSubmitted
      );
    }),
    args.budgetCodes.filter(
      (code) => normalizeBudgetCode(code.cost_code_id) === normalizedSubmitted,
    ),
  ];

  const matches = matchGroups.find((group) => group.length > 0) ?? [];
  if (matches.length === 1) {
    return {
      projectBudgetCodeId: matches[0].id,
      displayBudgetCode: commitmentSovBudgetCodeDisplay(matches[0]),
    };
  }

  if (matches.length > 1) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: `${args.where}#resolve-budget-code`,
      message: `Line ${args.lineNumber}: budget code "${submittedBudgetCode}" is ambiguous for this project. Select the specific budget code before saving.`,
      status: 400,
    });
  }

  throw new GuardrailError({
    code: "INVALID_PAYLOAD",
    where: `${args.where}#resolve-budget-code`,
    message: `Line ${args.lineNumber}: budget code "${submittedBudgetCode}" is not active for this project.`,
    status: 400,
  });
}
