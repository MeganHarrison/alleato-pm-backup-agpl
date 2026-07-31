"use client";

import Link from "next/link";

import { EmptyState, KpiRow, StatusBadge } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { evaluateCrmDealAttention } from "@/lib/crm/rules";

const SOURCE_LABELS = {
  outlook: "Outlook",
  teams: "Teams",
  fireflies: "Fireflies",
} as const;

export function CrmCommandCenterContent() {
  const {
    deals,
    activities,
    followUps,
    dealStageEvents,
    settings,
    archivedDealIds,
  } = useCrmWorkspace();
  const now = new Date();
  const openDeals = deals.filter(
    (deal) =>
      deal.status === "open" && !archivedDealIds.includes(deal.id),
  );
  const forecast = {
    commit: openDeals.filter(
      (deal) =>
        deal.forecastCategory === "commit" ||
        (!deal.forecastCategory && deal.probability >= 75),
    ),
    bestCase: openDeals.filter(
      (deal) =>
        deal.forecastCategory === "best_case" ||
        (!deal.forecastCategory &&
          deal.probability >= 40 &&
          deal.probability < 75),
    ),
    pipeline: openDeals.filter(
      (deal) =>
        deal.forecastCategory === "pipeline" ||
        (!deal.forecastCategory && deal.probability < 40),
    ),
  };
  const attention = openDeals
    .map((deal) => ({
      deal,
      reasons: evaluateCrmDealAttention({
        deal,
        followUps,
        staleDealDays: settings.staleDealDays,
        reportingTimezone: settings.reportingTimezone,
        now,
      }),
    }))
    .filter((item) => item.reasons.length > 0);
  const sourceHealth = (
    Object.keys(SOURCE_LABELS) as Array<keyof typeof SOURCE_LABELS>
  ).map((source) => {
    const sourceActivities = activities.filter(
      (activity) => activity.sourceSystem === source,
    );
    return {
      source,
      count: sourceActivities.length,
      latest: sourceActivities
        .map((activity) => activity.occurredAt)
        .sort((left, right) => right.localeCompare(left))[0],
    };
  });
  const activePursuits = openDeals
    .slice()
    .sort((left, right) => right.valueEstimate - left.valueEstimate)
    .slice(0, 6);

  return (
    <>
      <section>
        <SectionRuleHeading label="Forecast now" />
        <KpiRow
          size="small"
          metrics={[
            {
              label: "Commit",
              value: formatCurrency(
                forecast.commit.reduce(
                  (sum, deal) => sum + deal.valueEstimate,
                  0,
                ),
              ),
              context: `${forecast.commit.length} manager-classified deals`,
            },
            {
              label: "Best case",
              value: formatCurrency(
                forecast.bestCase.reduce(
                  (sum, deal) => sum + deal.valueEstimate,
                  0,
                ),
              ),
              context: `${forecast.bestCase.length} manager-classified deals`,
            },
            {
              label: "Pipeline",
              value: formatCurrency(
                forecast.pipeline.reduce(
                  (sum, deal) => sum + deal.valueEstimate,
                  0,
                ),
              ),
              context: `${forecast.pipeline.length} manager-classified deals`,
            },
          ]}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <SectionRuleHeading label="Management inspection" />
          {dealStageEvents.length ? (
            <ul className="divide-y divide-border">
              {dealStageEvents.slice(0, 8).map((event) => {
                const deal = deals.find(
                  (candidate) => candidate.id === event.dealId,
                );
                return (
                  <li
                    key={event.id}
                    className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]"
                  >
                    <span>
                      <Link
                        href={`/crm/deals/${event.dealId}`}
                        className="font-medium hover:underline"
                      >
                        {deal?.name ?? "Deal"}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {event.fromStageName ?? "New"} → {event.toStageName} ·{" "}
                        {event.changedBy}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(event.changedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No pipeline movement yet"
              description="Stage changes will appear here with the owner, date, and reason."
            />
          )}
        </div>

        <div>
          <SectionRuleHeading label="Communication source activity" />
          <div className="divide-y divide-border border-y border-border">
            {sourceHealth.map((item) => (
              <div
                key={item.source}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {SOURCE_LABELS[item.source]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.latest
                      ? `Last matched activity ${formatDate(item.latest)}`
                      : "No eligible CRM activity received"}
                  </span>
                </span>
                <StatusBadge
                  status={
                    item.latest ? "CRM activity received" : "No CRM activity"
                  }
                  variant={item.latest ? "success" : "neutral"}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Source activity is not proof of connection status.
          </p>
        </div>
      </section>

      <section>
        <SectionRuleHeading label="Construction pursuits" />
        {activePursuits.length ? (
          <div className="divide-y divide-border">
            {activePursuits.map((deal) => {
              const dealAttention = attention.find(
                (item) => item.deal.id === deal.id,
              );
              return (
                <article
                  key={deal.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-start"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span>
                      <Link
                        href={`/crm/deals/${deal.id}`}
                        className="font-semibold hover:underline"
                      >
                        {deal.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {deal.companyName}
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(deal.valueEstimate)}
                    </span>
                  </div>
                  <div className="md:text-right">
                    <p className="text-xs text-muted-foreground">
                      {dealAttention?.reasons[0]?.reason ?? "No hygiene warning"}
                    </p>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="mt-1 px-0"
                    >
                      <Link href={`/crm/deals/${deal.id}`}>
                        Review pursuit
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No active pursuits"
            description="Open CRM deals will appear here as the pursuit work queue."
          />
        )}
      </section>

      <section>
        <SectionRuleHeading label="Evidence briefing" />
        <div className="py-2">
          <p className="text-sm font-semibold">
            {attention.length
              ? `${attention.length} open ${attention.length === 1 ? "deal needs" : "deals need"} a documented next move.`
              : "Every open deal currently has a documented next move."}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            This briefing is calculated from CRM deals, Tasks follow-ups, stage
            history, and matched communication records. It does not invent
            activity, send a message, or change a record.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/crm/tasks">Work CRM actions</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/crm/settings/matching">
                Review communication matches
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
