export type CommitmentSovCleanupReason =
  | "ambiguous_typed_matches"
  | "blank_code_nonzero_amount"
  | "blank_code_zero_amount"
  | "inactive_only_match"
  | "no_project_budget_code_match"
  | "null_type_only_match"
  | "safe_typed_match_remaining";

export type CommitmentSovCleanupCandidate = {
  id: string;
  label: string;
  isActive: boolean;
  hasCostType: boolean;
};

export type CommitmentSovCleanupCandidateInput = {
  id: string;
  costCodeId: string;
  costTypeCode: string | null;
  isActive: boolean;
  hasCostType: boolean;
};

export type CommitmentSovCleanupClassification = {
  reason: CommitmentSovCleanupReason;
  typedCandidates: CommitmentSovCleanupCandidate[];
  otherCandidates: CommitmentSovCleanupCandidate[];
  recommendedAction: string;
};

export function normalizeCommitmentSovBudgetCode(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatCommitmentSovCandidateLabel(
  candidate: Pick<CommitmentSovCleanupCandidateInput, "costCodeId" | "costTypeCode">,
): string {
  return candidate.costTypeCode
    ? `${candidate.costCodeId}.${candidate.costTypeCode}`
    : candidate.costCodeId;
}

export function getCommitmentSovCleanupAction(
  reason: CommitmentSovCleanupReason,
): string {
  switch (reason) {
    case "ambiguous_typed_matches":
      return "Choose the specific cost type candidate.";
    case "blank_code_nonzero_amount":
      return "Assign a project budget code before this amount can be trusted.";
    case "blank_code_zero_amount":
      return "Confirm the zero-value row can remain unmapped or assign a budget code.";
    case "inactive_only_match":
      return "Reactivate the budget code or choose a current replacement.";
    case "no_project_budget_code_match":
      return "Create or activate the missing project budget code, or mark intentionally unmapped.";
    case "null_type_only_match":
      return "Create a typed project budget code for this cost code.";
    case "safe_typed_match_remaining":
      return "Safe automated backfill candidate; investigate why it was not migrated.";
  }
}

function toCleanupCandidate(
  candidate: CommitmentSovCleanupCandidateInput,
): CommitmentSovCleanupCandidate {
  return {
    id: candidate.id,
    label: formatCommitmentSovCandidateLabel(candidate),
    isActive: candidate.isActive,
    hasCostType: candidate.hasCostType,
  };
}

export function classifyCommitmentSovCleanupRow(args: {
  budgetCode: string | null;
  amount: number | null;
  candidates: CommitmentSovCleanupCandidateInput[];
}): CommitmentSovCleanupClassification {
  const budgetCode = args.budgetCode?.trim() ?? "";
  const normalizedBudgetCode = normalizeCommitmentSovBudgetCode(budgetCode);

  if (!budgetCode) {
    const reason =
      Number(args.amount ?? 0) === 0
        ? "blank_code_zero_amount"
        : "blank_code_nonzero_amount";
    return {
      reason,
      typedCandidates: [],
      otherCandidates: [],
      recommendedAction: getCommitmentSovCleanupAction(reason),
    };
  }

  const matches = args.candidates.filter((candidate) => {
    const formatted = formatCommitmentSovCandidateLabel(candidate);
    return (
      candidate.id.toLowerCase() === budgetCode.toLowerCase() ||
      normalizeCommitmentSovBudgetCode(candidate.costCodeId) ===
        normalizedBudgetCode ||
      normalizeCommitmentSovBudgetCode(formatted) === normalizedBudgetCode ||
      (candidate.costTypeCode
        ? normalizeCommitmentSovBudgetCode(
            `${candidate.costCodeId}${candidate.costTypeCode}`,
          ) === normalizedBudgetCode
        : false)
    );
  });

  const typedActive = matches.filter(
    (candidate) => candidate.isActive && candidate.hasCostType,
  );
  const nullTypeActive = matches.filter(
    (candidate) => candidate.isActive && !candidate.hasCostType,
  );
  const inactive = matches.filter((candidate) => !candidate.isActive);

  const reason: CommitmentSovCleanupReason =
    typedActive.length === 1
      ? "safe_typed_match_remaining"
      : typedActive.length > 1
        ? "ambiguous_typed_matches"
        : nullTypeActive.length > 0
          ? "null_type_only_match"
          : inactive.length > 0
            ? "inactive_only_match"
            : "no_project_budget_code_match";

  return {
    reason,
    typedCandidates: typedActive.map(toCleanupCandidate),
    otherCandidates: [...nullTypeActive, ...inactive].map(toCleanupCandidate),
    recommendedAction: getCommitmentSovCleanupAction(reason),
  };
}
