import { redirect } from "next/navigation";

interface PrimeContractInvoiceNewRedirectPageProps {
  params: Promise<{ projectId: string; contractId: string }>;
}

// Redirects prime contract invoice creation to the canonical invoice create page with contract context pre-selected.
export default async function PrimeContractInvoiceNewRedirectPage({
  params,
}: PrimeContractInvoiceNewRedirectPageProps) {
  const { projectId, contractId } = await params;

  redirect(
    `/${projectId}/invoices/new?contractType=prime&contractId=${encodeURIComponent(contractId)}`,
  );
}
