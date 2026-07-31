import { createClient } from "@/lib/supabase/server";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";
import {
  insightCardBaseQuery,
  deriveSeverity,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";
import { InsightsClient } from "@/features/insights/insights-client";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "Potential Change Orders";
const PAGE_DESCRIPTION =
  "Open change-management signals the AI surfaced from meetings, emails, and documents — review and convert the real ones into change events.";

/**
 * Focused review surface for potential change orders. Reuses the existing
 * AI-detected `change_management` insight cards (produced by the backend
 * intelligence compiler) rather than running a duplicate detector — this page
 * just filters them to the open ones and gives them an actionable home with a
 * one-click "Create change event" path and the AiFeedback loop.
 */
export default async function PotentialChangeOrdersPage() {
  const supabase = await createClient();

  // includeAnyStatus omitted → only ACTIVE_CARD_STATUSES (open/blocked/needs_review/stale).
  const { data: rawCards, error } = await insightCardBaseQuery(supabase)
    .eq("card_type", "change_management")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <TablePageWrapper title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <div className="p-6 text-center text-destructive">
          Error loading potential change orders. Please try again later.
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

  return (
    <InsightsClient
      data={rows}
      entityKey="potential-change-orders"
      header={{ title: PAGE_TITLE, description: PAGE_DESCRIPTION }}
    />
  );
}
