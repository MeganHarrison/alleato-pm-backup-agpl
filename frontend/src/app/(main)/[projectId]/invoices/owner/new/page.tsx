import { redirect } from "next/navigation";

interface OwnerInvoiceNewAliasPageProps {
  params: Promise<{ projectId: string }>;
}

// Redirects legacy owner invoice create URLs to the canonical invoices create page.
export default async function OwnerInvoiceNewAliasPage({
  params,
}: OwnerInvoiceNewAliasPageProps) {
  const { projectId } = await params;
  redirect(`/${projectId}/invoices/new?tab=owner`);
}

