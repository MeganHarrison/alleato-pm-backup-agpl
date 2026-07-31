export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { getLearningLibrary } from "@/lib/learning/server";
import { createClient } from "@/lib/supabase/server";

import { TrainingPageClient } from "../training-page-client";

export default async function TrainingLibraryPage() {
  const [items, rolesResult] = await Promise.all([
    getLearningLibrary(),
    (await createClient())
      .from("training_role")
      .select("id,slug,name")
      .eq("active", true)
      .order("sort_order"),
  ]);
  if (rolesResult.error) {
    throw new Error(`Training role filters failed: ${rolesResult.error.message}`);
  }
  return (
    <PageShell
      variant="detailWide"
      title="Training Library"
      description="Find the right guide, SOP, course, or resource when the work calls for it."
    >
      <TrainingPageClient items={items} roles={rolesResult.data ?? []} />
    </PageShell>
  );
}
