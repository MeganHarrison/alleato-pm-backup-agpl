"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout";

export default function DrawingViewerV2Redirect() {
  const params = useParams()! ?? {};
  const router = useRouter();
  const projectId = params.projectId as string;
  const drawingId = params.drawingId as string;

  useEffect(() => {
    router.replace(`/${projectId}/drawings/viewer/${drawingId}`);
  }, [drawingId, projectId, router]);

  return (
    <PageShell
      variant="table"
      title="Redirecting to Drawing Viewer"
      showHeader={false}
      className="h-screen"
      contentClassName="flex h-full items-center justify-center"
    >
      <p className="text-sm text-muted-foreground">Redirecting to the current drawing viewer…</p>
    </PageShell>
  );
}
