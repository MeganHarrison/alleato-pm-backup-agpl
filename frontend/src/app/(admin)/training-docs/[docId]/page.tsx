import { PageShell } from "@/components/layout";
import { requireAdmin } from "@/app/api/admin/_shared";

import { TrainingDocDetailClient } from "./training-doc-detail-client";

export default async function TrainingDocDetailPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  await requireAdmin("training-doc-detail-page");
  const { docId } = await params;

  return (
    <PageShell
      variant="content"
      title="Training Doc"
      description="Edit the SOP content, screenshots, review notes, and publish state."
    >
      <TrainingDocDetailClient docId={docId} />
    </PageShell>
  );
}
