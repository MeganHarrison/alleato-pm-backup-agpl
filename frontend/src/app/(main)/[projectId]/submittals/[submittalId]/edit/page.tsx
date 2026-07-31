import { serviceDb } from "@/lib/supabase/service-db";
import { notFound } from "next/navigation";
import { SubmittalFormPage } from "@/features/submittals/submittal-form-page";
import type { SubmittalSummary } from "@/hooks/use-submittals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ projectId: string; submittalId: string }>;
}

export default async function EditSubmittalPage({ params }: Props) {
  const { projectId, submittalId } = await params;

  const { data: submittal, error } = await serviceDb.from("submittals")
    .select(
      `*,
       submittal_type:submittal_types(id, name),
       submittal_package:submittal_packages(id, name)`,
    )
    .eq("project_id", parseInt(projectId, 10))
    .eq("id", submittalId)
    .single();

  if (error || !submittal) {
    notFound();
  }

  return (
    <SubmittalFormPage
      projectId={parseInt(projectId, 10)}
      submittal={submittal as unknown as SubmittalSummary}
    />
  );
}
