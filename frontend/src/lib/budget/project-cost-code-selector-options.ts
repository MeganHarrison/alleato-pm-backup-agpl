export interface ProjectCostCodeForSelector {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  cost_codes: {
    title: string | null;
  } | null;
  cost_code_types: {
    code: string;
    description: string;
  } | null;
}

export interface BudgetCodeSelectorOption {
  id: string;
  code: string;
  costType: string | null;
  description: string;
  fullLabel: string;
}

export function projectCostCodesToBudgetCodeOptions(
  projectCostCodes: ProjectCostCodeForSelector[],
): BudgetCodeSelectorOption[] {
  return projectCostCodes.map((projectCostCode) => {
    const costType = projectCostCode.cost_code_types?.code ?? null;
    const description = projectCostCode.cost_codes?.title ?? "";
    return {
      id: projectCostCode.id,
      code: projectCostCode.cost_code_id,
      costType,
      description,
      fullLabel: `${projectCostCode.cost_code_id}${
        costType ? `.${costType}` : ""
      }${description ? ` - ${description}` : ""}`,
    };
  });
}
