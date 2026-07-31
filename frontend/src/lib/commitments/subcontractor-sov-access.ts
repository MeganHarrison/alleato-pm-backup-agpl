export interface SubcontractorSovCommitmentAccess {
  is_private: boolean | null;
  invoice_contact_ids: string[] | null;
  non_admin_user_ids: string[] | null;
  allow_non_admin_view_sov_items: boolean | null;
}

export function canEditSubcontractorSov(params: {
  actorPersonId: string;
  isUpstream: boolean;
  commitment: SubcontractorSovCommitmentAccess;
}): boolean {
  const { actorPersonId, isUpstream, commitment } = params;
  if (isUpstream) return true;

  const invoiceContacts = commitment.invoice_contact_ids || [];
  const nonAdminUsers = commitment.non_admin_user_ids || [];
  const isInvoiceContact = invoiceContacts.includes(actorPersonId);
  const hasExplicitSovAccess =
    nonAdminUsers.includes(actorPersonId) &&
    commitment.allow_non_admin_view_sov_items === true;

  if (commitment.is_private) {
    return isInvoiceContact && hasExplicitSovAccess;
  }

  return isInvoiceContact || hasExplicitSovAccess;
}

export function mergeSubcontractorSovAccessIds(
  existingPersonIds: string[] | null | undefined,
  recipientPersonIds: string[],
): string[] {
  return [...new Set([...(existingPersonIds || []), ...recipientPersonIds])];
}
