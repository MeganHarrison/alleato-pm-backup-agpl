import { redirect } from "next/navigation";

interface LegacyOwnerInvoiceNewPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ billing_period_id?: string; tab?: string }>;
}

// Redirect the legacy owner invoice create route to the canonical invoices create page.
export default async function LegacyOwnerInvoiceNewPage({
  params,
  searchParams,
}: LegacyOwnerInvoiceNewPageProps) {
  const { projectId } = await params;
  const { billing_period_id } = await searchParams;

  const query = billing_period_id
    ? `?tab=owner&billing_period_id=${encodeURIComponent(billing_period_id)}`
    : "?tab=owner";

  redirect(`/${projectId}/invoices/new${query}`);
}
