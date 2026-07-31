import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import {
  getTrainingPageShellProps,
  TrainingResourcePageContent,
} from "@/features/training";
import { getResources } from "@/lib/training/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TrainingResourceDetailPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;
  const resources = await getResources();
  const resource = resources.find((item) => item.id === resourceId);

  if (!resource) notFound();

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("knowledge_content_item")
    .select("id")
    .eq("source_type", "training_resource")
    .eq("source_id", resource.id)
    .maybeSingle();

  return (
    <PageShell
      {...getTrainingPageShellProps({
        title: resource.title,
        description: resource.description?.trim() || null,
        layout: "media",
      })}
    >
      <TrainingResourcePageContent resource={resource} contentItemId={content?.id} />
    </PageShell>
  );
}
