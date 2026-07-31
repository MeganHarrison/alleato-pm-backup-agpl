import { redirect } from "next/navigation";

interface LegacyInvoicingPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

// Redirect the legacy invoicing list route to the canonical invoices workspace.
export default async function LegacyInvoicingPage({
  params,
  searchParams,
}: LegacyInvoicingPageProps) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  if (tab === "subcontractor" || tab === "billing-periods") {
    redirect(`/${projectId}/invoices?tab=${tab}`);
  }

  redirect(`/${projectId}/invoices`);
}
