"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditChangeOrderRedirectPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const changeOrderId = params.changeOrderId as string;

  useEffect(() => {
    if (!projectId || !changeOrderId) return;
    router.replace(`/${projectId}/change-orders/${changeOrderId}?edit=1`);
  }, [router, projectId, changeOrderId]);

  return null;
}
