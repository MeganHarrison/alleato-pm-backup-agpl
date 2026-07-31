export interface CommitmentSovLockState {
  locked: boolean;
  reason: "submitted_invoice" | null;
  message: string | null;
}

export function getCommitmentSovLockState(args: {
  hasSubmittedInvoice: boolean;
}): CommitmentSovLockState {
  if (!args.hasSubmittedInvoice) {
    return {
      locked: false,
      reason: null,
      message: null,
    };
  }

  return {
    locked: true,
    reason: "submitted_invoice",
    message:
      "A commitment invoice has already been submitted, so the schedule of values stays locked to protect invoice history.",
  };
}

export function hasSubmittedCommitmentInvoice(
  invoices: Array<{
    status?: string | null;
    submitted_at?: string | null;
    approved_at?: string | null;
  }>,
): boolean {
  return invoices.some((invoice) => {
    const status = invoice.status?.trim().toLowerCase() ?? "";
    return (
      Boolean(invoice.submitted_at) ||
      Boolean(invoice.approved_at) ||
      status === "under_review" ||
      status === "pending_owner_approval" ||
      status === "approved" ||
      status === "approved_as_noted" ||
      status === "paid"
    );
  });
}
