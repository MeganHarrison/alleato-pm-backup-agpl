/* eslint-disable design-system/require-page-shell -- This legacy page performs a server redirect and renders no UI. */
import { redirect } from "next/navigation";

interface LegacyBillingPeriodsPageProps {
  params: Promise<{ projectId: string }>;
}

// Billing period management is owned by the Invoices workspace. Keep old
// bookmarks working without maintaining a second list/create implementation.
export default async function LegacyBillingPeriodsPage({
  params,
}: LegacyBillingPeriodsPageProps) {
  const { projectId } = await params;
  redirect(`/${projectId}/invoices?tab=billing-periods`);
}
