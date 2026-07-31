"use client";

import { useParams } from "next/navigation";

import { SubcontractorInvoiceDetail } from "@/components/invoicing/SubcontractorInvoiceDetail";

export default function CommitmentInvoiceDetailPage() {
  const params = useParams()!;
  const projectId = params.projectId as string;
  const commitmentId = params.commitmentId as string;
  const invoiceId = Number(params.invoiceId as string);

  return (
    <SubcontractorInvoiceDetail
      projectId={projectId}
      invoiceId={invoiceId}
      backHref={`/${projectId}/commitments/${commitmentId}?tab=invoices`}
      backLabel="Back to Commitment"
    />
  );
}
