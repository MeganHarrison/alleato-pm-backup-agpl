"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout";

// The active-case subroute redirects back to the run view; the run view
// already supports per-case navigation via its cursor. This exists so
// external deep links (e.g. from feedback) don't 404.
export default function RunnerCasePage() {
  const params = useParams<{ runId: string; caseNumber: string }>()!;
  const router = useRouter();
  useEffect(() => {
    router.replace(`/testing/runs/${params.runId}`);
  }, [router, params.runId]);
  return (
    <PageShell variant="content" title="Redirecting…">
      {null}
    </PageShell>
  );
}
