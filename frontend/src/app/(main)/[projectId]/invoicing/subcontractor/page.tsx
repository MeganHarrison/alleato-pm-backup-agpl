"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function SubcontractorInvoicingRedirect() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;

  useEffect(() => {
    router.replace(`/${projectId}/invoices?tab=subcontractor`);
  }, [router, projectId]);

  return null;
}
