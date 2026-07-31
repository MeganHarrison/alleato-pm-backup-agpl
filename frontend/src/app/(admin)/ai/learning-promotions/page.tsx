import { PageShell } from "@/components/layout";
import { requireAppAdminPageAccess } from "@/lib/auth/require-app-admin";
import { serviceDb } from "@/lib/supabase/service-db";

import { AiLearningPromotionsClient } from "./promotions-client";

export const dynamic = "force-dynamic";

export default async function AiLearningPromotionsPage() {
  await requireAppAdminPageAccess();

  const { data, error } = await serviceDb
    .from("ai_learning_promotions")
    .select("*")
    .eq("status", "candidate")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to load AI learning promotions: ${error.message}`);
  }

  return (
    <PageShell
      variant="table"
      title="AI Learning Promotions"
      description="Review candidate learnings before they can become durable assistant behavior, memory, attribution, or retrieval rules."
    >
      <AiLearningPromotionsClient initialPromotions={data ?? []} />
    </PageShell>
  );
}
