"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import { PageScaffold, SectionRuleHeading } from "@/components/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCrmWorkspace } from "@/hooks/use-crm";
import type { CrmDeal } from "@/lib/crm/types";
import { crmDateOnly, evaluateCrmDealAttention } from "@/lib/crm/rules";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";
import { CRM_WORKSPACE_PAGE_VARIANT } from "@/features/crm/crm-workspace-layout";

export function CrmPipelineReview() {
  const pathname = usePathname();
  const {
    deals,
    stages,
    followUps,
    settings,
    archivedDealIds,
    moveDeal: persistDealMove,
  } = useCrmWorkspace();
  const [now, setNow] = React.useState(() => new Date());
  const [hygieneFilter, setHygieneFilter] = React.useState<
    "all" | "expected_close_overdue" | "no_next_action" | "stale_deal"
  >("all");
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const today = crmDateOnly(now, settings.reportingTimezone);
  const activeDeals = deals.filter(
    (deal) =>
      deal.status === "open" && !archivedDealIds.includes(deal.id),
  );
  const attentionByDeal = React.useMemo(
    () =>
      new Map(
        activeDeals.map((deal) => [
          deal.id,
          evaluateCrmDealAttention({
            deal,
            followUps,
            staleDealDays: settings.staleDealDays,
            reportingTimezone: settings.reportingTimezone,
            now,
          }),
        ]),
      ),
    [
      activeDeals,
      followUps,
      now,
      settings.reportingTimezone,
      settings.staleDealDays,
    ],
  );
  const visibleDeals =
    hygieneFilter === "all"
      ? activeDeals
      : activeDeals.filter((deal) =>
          attentionByDeal
            .get(deal.id)
            ?.some((item) => item.code === hygieneFilter),
        );
  const hygieneOptions = [
    { value: "all" as const, label: "All open", count: activeDeals.length },
    {
      value: "no_next_action" as const,
      label: "No next action",
      count: activeDeals.filter((deal) =>
        attentionByDeal
          .get(deal.id)
          ?.some((item) => item.code === "no_next_action"),
      ).length,
    },
    {
      value: "expected_close_overdue" as const,
      label: "Close date overdue",
      count: activeDeals.filter((deal) =>
        attentionByDeal
          .get(deal.id)
          ?.some((item) => item.code === "expected_close_overdue"),
      ).length,
    },
    {
      value: "stale_deal" as const,
      label: "Stale",
      count: activeDeals.filter((deal) =>
        attentionByDeal
          .get(deal.id)
          ?.some((item) => item.code === "stale_deal"),
      ).length,
    },
  ];
  const moveDeal = async (deal: CrmDeal, stageId: string) => {
    const targetStage = stages.find((stage) => stage.id === stageId);
    if (!targetStage) return;
    try {
      await persistDealMove(deal.id, stageId);
      toast.success(`Moved to ${targetStage.name}`);
    } catch (error) {
      toast.error("Deal was not moved", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <PageScaffold
      layout="single"
      variant={CRM_WORKSPACE_PAGE_VARIANT}
      title="Sales pipeline"
      description="Shared sales opportunities and stage ownership"
      tabs={buildCrmWorkspaceTabs(pathname)}
    >
      <section>
        <SectionRuleHeading label="Alleato Business Development" />
        <div className="mb-4 w-full max-w-xs">
          <Select
            value={hygieneFilter}
            onValueChange={(value) =>
              setHygieneFilter(value as typeof hygieneFilter)
            }
          >
            <SelectTrigger aria-label="Pipeline hygiene filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hygieneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto pb-3">
          <div
            className="grid w-max grid-flow-col auto-cols-[15rem] gap-4"
            data-testid="crm-pipeline-board"
          >
            {stages.map((stage) => {
              const stageDeals = visibleDeals.filter(
                (deal) => deal.stageId === stage.id,
              );
              return (
                <section key={stage.id} className="min-w-0 space-y-3">
                  <div className="flex items-baseline justify-between border-b border-border pb-2">
                    <p className="min-w-0 pr-3 text-sm font-semibold">
                      {stage.name}
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(
                        stageDeals.reduce(
                          (sum, deal) => sum + deal.valueEstimate,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  {stageDeals.map((deal) => {
                    const attention = attentionByDeal.get(deal.id) ?? [];
                    const nextAction = followUps
                      .filter(
                        (followUp) =>
                          followUp.dealId === deal.id &&
                          ["open", "in_progress", "blocked"].includes(
                            followUp.status,
                          ) &&
                          followUp.dueDate >= today,
                      )
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

                    return (
                      <article
                        key={deal.id}
                        className="space-y-3 rounded-md border border-border bg-background p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">{deal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.companyName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="tabular-nums">
                            {formatCurrency(deal.valueEstimate)}
                          </span>
                          <StatusBadge status={deal.status} />
                        </div>
                        {deal.expectedCloseDate ? (
                          <p className="text-xs text-muted-foreground">
                            Close {formatDate(deal.expectedCloseDate)}
                          </p>
                        ) : null}
                        {nextAction ? (
                          <div className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
                            <p className="font-medium">Next action</p>
                            <p className="mt-0.5 text-muted-foreground">
                              {nextAction.title} ·{" "}
                              {formatDate(nextAction.dueDate)}
                            </p>
                          </div>
                        ) : null}
                        {attention.length > 0 ? (
                          <div
                            className="space-y-2 border-t border-border pt-3"
                            data-testid={`deal-attention-${deal.id}`}
                          >
                            {attention.map((item) => (
                              <div key={item.code} className="space-y-1">
                                <StatusBadge
                                  status={item.label}
                                  variant={
                                    item.severity === "attention"
                                      ? "error"
                                      : "warning"
                                  }
                                />
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {item.reason}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <Select
                          value={deal.stageId}
                          onValueChange={(value) => moveDeal(deal, value)}
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Move ${deal.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </article>
                    );
                  })}
                  {stageDeals.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      No deals
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </PageScaffold>
  );
}
