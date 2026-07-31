/* eslint-disable design-system/require-page-shell -- Feature-owned PageShell owns the page shell. */

import { CrmLeadDetailReview } from "@/features/crm/lead-detail-review";
import { CrmLeadsWorkspace } from "@/features/crm/leads-workspace";

export default async function CrmLeadDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;

  if (!leadId) {
    return <CrmLeadsWorkspace />;
  }

  return <CrmLeadDetailReview leadId={leadId} />;
}
