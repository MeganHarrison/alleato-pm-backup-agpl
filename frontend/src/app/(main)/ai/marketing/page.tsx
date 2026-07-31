import type { ReactNode } from "react";

import { PageShell } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import { MarketingCalendarReview } from "@/components/marketing/MarketingCalendarReview";
import {
  getMarketingCalendar,
  MarketingServiceError,
} from "@/lib/ai/services/marketing-service";

export const metadata = {
  title: "Marketing Calendar | Alleato",
  description: "Review CMO-generated content calendar items and draft assets.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function nextWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  const start = new Date(today);
  start.setDate(today.getDate() + daysUntilMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatMarketingLoadError(error: MarketingServiceError): string {
  const cause = error.causeMessage.trim().startsWith("<!DOCTYPE html>")
    ? "Supabase returned an upstream HTML error while loading review data."
    : error.causeMessage;
  return `${error.action} failed: ${cause} Prevention: ${error.prevention}`;
}

export default async function MarketingCalendarPage() {
  const range = nextWeekRange();
  let content: ReactNode;

  try {
    const items = await getMarketingCalendar({ dateRange: range });
    content = <MarketingCalendarReview items={items} />;
  } catch (error) {
    if (!(error instanceof MarketingServiceError)) {
      throw error;
    }

    content = (
      <ErrorState
        title="Marketing calendar could not load"
        error={formatMarketingLoadError(error)}
        className="items-start py-2 text-left"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageShell
        variant="table"
        title="Marketing Calendar"
        description="Review source-backed CMO content plans, draft assets, citations, and approval states."
      >
        {content}
      </PageShell>
    </div>
  );
}
