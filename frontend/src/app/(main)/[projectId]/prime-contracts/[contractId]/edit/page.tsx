"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditPrimeContractRedirectPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const contractId = params.contractId as string;

  useEffect(() => {
    if (!projectId || !contractId) return;
    router.replace(`/${projectId}/prime-contracts/${contractId}?edit=1`);
  }, [router, projectId, contractId]);

  return null;
}
