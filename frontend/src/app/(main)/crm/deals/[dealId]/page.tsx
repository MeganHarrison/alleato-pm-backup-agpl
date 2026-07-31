/* eslint-disable design-system/require-page-shell -- Feature-owned PageShell owns the page shell. */

import { CrmDealDetailReview } from "@/features/crm/deal-detail-review";

export default async function CrmDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return <CrmDealDetailReview dealId={dealId} />;
}
