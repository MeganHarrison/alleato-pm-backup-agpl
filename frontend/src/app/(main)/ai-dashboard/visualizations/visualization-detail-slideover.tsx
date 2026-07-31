"use client";

import Link from "next/link";
import { ArrowUpRight, Database, Loader2 } from "lucide-react";

import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { SheetDescription } from "@/components/ui/sheet";
import type {
  ActivityRange,
  VisualizationDetailKind,
} from "@/lib/ai-dashboard/dashboard-visualization-contract";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDateTime,
  sourceError,
  useVisualizationDetail,
} from "../live-data";

export type VisualizationSelection = {
  kind: VisualizationDetailKind;
  key: string;
} | null;

type Props = {
  selection: VisualizationSelection;
  onOpenChange: (open: boolean) => void;
  range: ActivityRange;
  projectId: number | null;
};

const severityClass = {
  neutral: "text-muted-foreground",
  watch: "text-primary",
  at_risk: "text-destructive",
  critical: "text-destructive",
} as const;

const dataStateLabel = {
  confirmed: "Confirmed",
  estimated: "Estimated",
  ai_inference: "AI inference",
  incomplete: "Incomplete",
} as const;

export function VisualizationDetailSlideover({
  selection,
  onOpenChange,
  range,
  projectId,
}: Props) {
  const detail = useVisualizationDetail(
    selection?.kind ?? "lifecycle",
    selection?.key ?? null,
    range,
    projectId,
  );

  return (
    <SidePanel open={Boolean(selection)} onOpenChange={onOpenChange}>
      <SidePanelContent
        size="xl"
        side="right"
      >
        <SidePanelHeader className="pr-12 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {selection?.kind === "opportunity"
              ? "AI opportunity evidence"
              : selection?.kind === "activity"
                ? "Source activity"
                : "Lifecycle records"}
          </p>
          <SidePanelTitle className="text-xl sm:text-2xl">
            {detail.data?.label ?? "Loading detail"}
          </SidePanelTitle>
          <SheetDescription>
            {detail.data?.source.detail ??
              "Opening source-linked records for this selection."}
          </SheetDescription>
        </SidePanelHeader>

        <SidePanelBody>
          {detail.isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading source records
            </div>
          ) : detail.isError ? (
            <div className="py-10">
              <p className="text-sm font-medium text-destructive">
                Detail could not be loaded.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {sourceError(detail.error, "Visualization detail")}
              </p>
            </div>
          ) : detail.data?.items.length ? (
            <div className="divide-y divide-border">
              {detail.data.items.map((item) => (
                <article key={item.id} className="py-5 first:pt-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[item.projectName, item.owner, formatDateTime(item.timestamp)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        severityClass[item.severity],
                      )}
                    >
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.summary}
                  </p>

                  {item.nextAction ? (
                    <p className="mt-3 text-sm text-foreground">
                      <span className="text-muted-foreground">Next action:</span>{" "}
                      {item.nextAction}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span>{dataStateLabel[item.dataState]}</span>
                    {item.value !== null ? (
                      <span>{formatCurrency(item.value)}</span>
                    ) : selection?.kind === "opportunity" ? (
                      <span>Impact value unavailable</span>
                    ) : null}
                    {item.confidence !== null ? (
                      <span>{Math.round(item.confidence * 100)}% confidence</span>
                    ) : null}
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Open record <ArrowUpRight className="size-3" />
                    </Link>
                    {item.sourceHref ? (
                      <Link
                        href={item.sourceHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Source <ArrowUpRight className="size-3" />
                      </Link>
                    ) : null}
                  </div>

                  {item.supportingSources.length ? (
                    <div className="mt-4 space-y-2">
                      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Database className="size-3" />
                        Supporting evidence
                      </p>
                      {item.supportingSources.map((source) =>
                        source.href ? (
                          <Link
                            key={source.id}
                            href={source.href}
                            className="block text-xs text-primary hover:underline"
                          >
                            {source.label} · {source.confidence} confidence
                          </Link>
                        ) : (
                          <p key={source.id} className="text-xs text-muted-foreground">
                            {source.label} · {source.confidence} confidence
                          </p>
                        ),
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="py-12 text-sm text-muted-foreground">
              <p>
                No records match this selection. Open the source system to repair
                missing stage, activity, or evidence data.
              </p>
              {detail.data ? (
                <Link
                  href={detail.data.source.recoveryHref}
                  className="mt-4 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Review source <ArrowUpRight className="size-3" />
                </Link>
              ) : null}
            </div>
          )}
        </SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  );
}
