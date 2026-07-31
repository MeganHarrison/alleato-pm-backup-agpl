"use client";

/* eslint-disable design-system/require-page-shell -- This route adapter delegates its required PageShell to the canonical DrawingInteractionWorkspace. */
import { useParams } from "next/navigation";
import { DrawingInteractionWorkspace } from "@/components/drawings/DrawingInteractionWorkspace";

/** Route adapter: the Drawing interaction workspace owns all canvas behavior. */
export default function DrawingViewerPage() {
  const params = useParams<{ projectId: string; drawingId: string }>();
  return <DrawingInteractionWorkspace projectId={params.projectId} drawingId={params.drawingId} />;
}
