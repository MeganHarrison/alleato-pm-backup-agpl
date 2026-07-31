export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { requireAdmin } from "@/app/api/admin/_shared";
import { createServiceClient } from "@/lib/supabase/service";
import { getTrainingDoc } from "@/lib/training-docs/server";

import { TrainingDocPreviewClient } from "./training-doc-preview-client";

export default async function TrainingDocPreviewPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  await requireAdmin("training-doc-preview-page");
  const { docId } = await params;
  const doc = await getTrainingDoc(createServiceClient(), docId);

  return (
    <PageShell
      variant="content"
      title={doc?.title ?? "Training Page"}
      description={
        doc?.summary ??
        "Preview the generated SOP exactly from the app's saved training content."
      }
    >
      <TrainingDocPreviewClient docId={docId} />
    </PageShell>
  );
}
