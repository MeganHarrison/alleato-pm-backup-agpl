type SyncMarker = string | number | null | undefined;

export interface SubcontractorInvoiceEditabilityInput {
  status?: string | null;
  acumatica_ref_nbr?: SyncMarker;
  acumatica_doc_type?: SyncMarker;
  acumatica_sync_at?: SyncMarker;
  acumatica_ap_bill_id?: SyncMarker;
}

const EDITABLE_STATUSES = new Set([
  "draft",
  "invited",
  "revise_and_resubmit",
]);

export function isSubcontractorInvoiceAccountingSynced(
  invoice: SubcontractorInvoiceEditabilityInput,
): boolean {
  return Boolean(
    invoice.acumatica_ref_nbr ||
      invoice.acumatica_doc_type ||
      invoice.acumatica_sync_at ||
      invoice.acumatica_ap_bill_id,
  );
}

export function getSubcontractorInvoiceEditability(
  invoice: SubcontractorInvoiceEditabilityInput,
) {
  const isAccountingSynced =
    isSubcontractorInvoiceAccountingSynced(invoice);

  return {
    isAccountingSynced,
    canEdit:
      EDITABLE_STATUSES.has(invoice.status ?? "") &&
      !isAccountingSynced,
    canReturnToDraft:
      invoice.status === "under_review" && !isAccountingSynced,
  };
}
