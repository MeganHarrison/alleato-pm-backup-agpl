export const PRIME_CONTRACT_CHANGE_ORDER_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "not_pricing", label: "Not Pricing" },
  { value: "pending_pricing", label: "Pending Pricing" },
  { value: "pending_in_review", label: "Pending In Review" },
  { value: "pending_revised", label: "Pending Revised" },
  { value: "pending_proceeding", label: "Pending Proceeding" },
  { value: "pending_not_proceeding", label: "Pending Not Proceeding" },
  { value: "no_charge", label: "No Charge" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "void", label: "Void" },
] as const;

export type PrimeContractChangeOrderStatus =
  (typeof PRIME_CONTRACT_CHANGE_ORDER_STATUSES)[number]["value"];

export const PRIME_CONTRACT_CHANGE_ORDER_DELETABLE_STATUSES = [
  "draft",
  "proposed",
  "pending",
  "rejected",
] as const;

function normalizeStatusValue(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? "";
}

export function canDeletePrimeContractChangeOrderStatus(
  status: string | null | undefined,
) {
  type DeletableStatus =
    (typeof PRIME_CONTRACT_CHANGE_ORDER_DELETABLE_STATUSES)[number];

  return PRIME_CONTRACT_CHANGE_ORDER_DELETABLE_STATUSES.includes(
    normalizeStatusValue(status) as DeletableStatus,
  );
}

export function primeContractChangeOrderDeleteBlockedMessage(
  status: string | null | undefined,
) {
  const normalizedStatus = normalizeStatusValue(status) || "unknown";
  return `Cannot delete a change order with status "${normalizedStatus}". Only draft, proposed, pending, or rejected change orders can be deleted.`;
}

export function primeContractChangeOrderStatusLabel(status: string | null | undefined) {
  return (
    PRIME_CONTRACT_CHANGE_ORDER_STATUSES.find((option) => option.value === status)
      ?.label ?? "Draft"
  );
}

export function normalizePrimeContractChangeOrderStatus(
  status: string | null | undefined,
): PrimeContractChangeOrderStatus {
  const normalizedStatus = normalizeStatusValue(status);
  if (
    PRIME_CONTRACT_CHANGE_ORDER_STATUSES.some((option) => option.value === normalizedStatus)
  ) {
    return normalizedStatus as PrimeContractChangeOrderStatus;
  }

  if (normalizedStatus === "proposed") return "pending";
  if (normalizedStatus === "out_for_signature") return "pending_in_review";
  if (normalizedStatus === "executed") return "approved";
  return "draft";
}
