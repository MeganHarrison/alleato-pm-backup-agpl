"use client";

import { useParams } from "next/navigation";

import { SubcontractorInvoiceDetail } from "@/components/invoicing/SubcontractorInvoiceDetail";

export default function SubcontractorInvoiceDetailPage() {
  const params = useParams()!;
  const projectId = params.projectId as string;
  const invoiceId = Number(params.invoiceId as string);

  return (
    <SubcontractorInvoiceDetail
      projectId={projectId}
      invoiceId={invoiceId}
      backHref={`/${projectId}/invoices?tab=subcontractor`}
      backLabel="Back to Invoices"
    />
  );
}
