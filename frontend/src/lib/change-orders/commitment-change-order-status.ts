function normalizeStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? "";
}

export function isApprovedCommitmentChangeOrderStatus(
  status: string | null | undefined,
) {
  return normalizeStatus(status) === "approved";
}

export function getCommitmentChangeOrderLineItemLock(
  status: string | null | undefined,
) {
  const locked = isApprovedCommitmentChangeOrderStatus(status);
  return {
    locked,
    reason: locked ? "approved" : null,
    message: locked
      ? "Approved commitment change orders are read-only. Change the status before editing line items."
      : null,
  };
}
