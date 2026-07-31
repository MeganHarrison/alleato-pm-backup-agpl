export type BudgetChangeStatus = "draft" | "pending" | "approved" | "void";

export type BudgetChangeAction = "submit" | "approve" | "reject" | "void";

export interface BudgetChangePermissionShape {
  isAdmin: boolean;
  canManageBudgetChanges: boolean;
  canApproveBudgetChanges: boolean;
}

export const BUDGET_CHANGE_STATUSES: BudgetChangeStatus[] = [
  "draft",
  "pending",
  "approved",
  "void",
];

export function getBudgetChangeSelectableStatuses(
  currentStatus: BudgetChangeStatus,
  permissions: BudgetChangePermissionShape,
): BudgetChangeStatus[] {
  if (permissions.isAdmin) {
    return BUDGET_CHANGE_STATUSES;
  }

  const statuses = new Set<BudgetChangeStatus>([currentStatus]);

  if (permissions.canManageBudgetChanges) {
    if (currentStatus === "draft") statuses.add("pending");
    if (currentStatus === "pending") statuses.add("draft");
  }

  if (permissions.canApproveBudgetChanges) {
    if (currentStatus === "pending") statuses.add("approved");
    if (currentStatus === "approved") statuses.add("void");
  }

  return BUDGET_CHANGE_STATUSES.filter((status) => statuses.has(status));
}

export function getBudgetChangeAllowedActions(
  currentStatus: BudgetChangeStatus,
  permissions: BudgetChangePermissionShape,
): BudgetChangeAction[] {
  const allowedStatuses = getBudgetChangeSelectableStatuses(
    currentStatus,
    permissions,
  );

  return getBudgetChangeActionsForStatuses(currentStatus, allowedStatuses);
}

export function getBudgetChangeActionsForStatuses(
  currentStatus: BudgetChangeStatus,
  selectableStatuses: BudgetChangeStatus[],
): BudgetChangeAction[] {
  const actions: BudgetChangeAction[] = [];

  if (selectableStatuses.includes("pending") && currentStatus !== "pending") {
    actions.push("submit");
  }
  if (selectableStatuses.includes("approved") && currentStatus !== "approved") {
    actions.push("approve");
  }
  if (selectableStatuses.includes("draft") && currentStatus !== "draft") {
    actions.push("reject");
  }
  if (selectableStatuses.includes("void") && currentStatus !== "void") {
    actions.push("void");
  }

  return actions;
}

export function mapBudgetChangeActionToStatus(
  action: BudgetChangeAction,
): BudgetChangeStatus {
  switch (action) {
    case "submit":
      return "pending";
    case "approve":
      return "approved";
    case "reject":
      return "draft";
    case "void":
      return "void";
    default:
      return action satisfies never;
  }
}

export function getBudgetChangeActionFromStatusChange(
  currentStatus: BudgetChangeStatus,
  targetStatus: BudgetChangeStatus,
): BudgetChangeAction | null {
  if (currentStatus === targetStatus) return null;

  switch (targetStatus) {
    case "pending":
      return "submit";
    case "approved":
      return "approve";
    case "draft":
      return "reject";
    case "void":
      return "void";
    default:
      return targetStatus satisfies never;
  }
}

export function canDeleteBudgetChange(
  currentStatus: BudgetChangeStatus,
  permissions: BudgetChangePermissionShape,
): boolean {
  if (permissions.isAdmin) return true;
  return permissions.canManageBudgetChanges && currentStatus === "draft";
}
