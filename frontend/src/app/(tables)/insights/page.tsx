import { createClient } from "@/lib/supabase/server";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";
import {
  insightCardBaseQuery,
  deriveSeverity,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";
import { InsightsClient } from "@/features/insights/insights-client";

const PAGE_TITLE = "AI Insights";
const PAGE_DESCRIPTION = "AI-generated insights from meetings and documents";

export default async function AIInsightsPage() {
  const supabase = await createClient();

  const { data: rawCards, error } = await insightCardBaseQuery(supabase, {
    includeAnyStatus: true,
  }).order("created_at", { ascending: false });

  if (error) {
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="text-center text-destructive p-6">
          Error loading AI insights. Please try again later.
        </div>
      </TablePageWrapper>
    );
  }

  const cards = (rawCards ?? []) as unknown as InsightCardWithTarget[];

  const rows = cards.map((card) => ({
    id: card.id,
    title: card.title,
    description: card.summary,
    type: card.card_type,
    status: card.current_status,
    severity: deriveSeverity(card),
    confidence: card.confidence,
    owner: card.suggested_owner_label ?? "",
    project_name: card.intelligence_targets?.name ?? "",
    projectId: card.intelligence_targets?.project_id ?? null,
    next_action: card.next_action ?? "",
    why_it_matters: card.why_it_matters ?? "",
    resolved: card.current_status === "resolved",
    created_at: card.created_at,
  }));

  return <InsightsClient data={rows} />;
}
