"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Heading } from "@/components/ds";
import {
  formatDate,
  sourceError,
  useAttentionFeed,
  useDailyBrief,
  useSystemHealth,
} from "./live-data";
import { ExecutiveDashboardVisualizations } from "./visualizations/executive-dashboard-visualizations";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
  WorkspaceSourceState,
} from "./workspace-primitives";

export function ExecutiveAiDashboard() {
  const attention = useAttentionFeed();
  const brief = useDailyBrief();
  const systemHealth = useSystemHealth();

  const attentionCount = attention.data?.items.length ?? 0;
  const title = attention.isLoading
    ? "Loading the current executive picture."
    : attentionCount > 0
      ? `${attentionCount} executive decision${attentionCount === 1 ? "" : "s"} need attention.`
      : "No executive decisions are waiting on action.";

  return (
    <>
      <WorkspacePageIntro
        eyebrow="Executive workspace"
        title={title}
      >
        This is the live portfolio entry point for Brandon and the leadership
        team. It connects current decisions, project coverage, financial
        movement, pipeline health, and the architecture controls behind them.
      </WorkspacePageIntro>

      <WorkspaceSection className="mt-10 pt-0" showHeader={false}>
        <ExecutiveDashboardVisualizations />
      </WorkspaceSection>

      <WorkspaceSection
        className="mt-12 pt-0"
        showHeader={false}
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="rounded-xl bg-card p-6 sm:p-8" aria-labelledby="daily-brief-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Daily executive brief
                </p>
                <Heading
                  level={4}
                  as="h2"
                  className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-foreground"
                >
                  <span id="daily-brief-heading">
                    {brief.data?.packet.title ?? "Current operating brief"}
                  </span>
                </Heading>
              </div>
              <Link
                href="/daily-brief"
                aria-label="Open daily executive brief"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            {brief.isLoading ? (
              <WorkspaceSourceState source="Daily Brief" state="loading" />
            ) : brief.isError ? (
              <WorkspaceSourceState
                source="Daily Brief"
                state="error"
                detail={sourceError(brief.error, "Daily Brief")}
              />
            ) : brief.data ? (
              <>
                <p className="mt-6 max-w-3xl text-base leading-relaxed text-foreground/85">
                  {brief.data.packet.currentStatus ??
                    brief.data.packet.strategicRead ??
                    "The current brief has no written status summary."}
                </p>
                {brief.data.packet.whyItMatters ? (
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    {brief.data.packet.whyItMatters}
                  </p>
                ) : null}
                <div className="mt-8 grid gap-5 pt-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight text-primary">
                      {brief.data.packet.sourceCount}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      source records · {formatDate(brief.data.packet.businessDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                      Recommended next moves
                    </p>
                    {brief.data.packet.recommendedNextMoves.length > 0 ? (
                      <ol className="mt-3 space-y-2 text-sm text-foreground/80">
                        {brief.data.packet.recommendedNextMoves.slice(0, 3).map((move, index) => (
                          <li key={`${index}-${move}`} className="flex gap-3">
                            <span className="font-mono text-xs text-primary">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{move}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No next moves were recorded in this brief.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <WorkspaceSourceState source="Daily Brief" state="empty" />
            )}
          </section>

          <section className="flex flex-col" aria-labelledby="operating-health-heading">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Operating health
                </p>
                <Heading
                  level={5}
                  as="h2"
                  className="mt-2 text-lg font-semibold tracking-tight text-foreground"
                >
                  <span id="operating-health-heading">Source-to-decision controls</span>
                </Heading>
              </div>
              <CanonicalLink href="/ai-dashboard/architecture">
                Architecture
              </CanonicalLink>
            </div>
            {systemHealth.isLoading ? (
              <WorkspaceSourceState source="Operating health" state="loading" />
            ) : systemHealth.isError ? (
              <WorkspaceSourceState
                source="Operating health"
                state="error"
                detail={sourceError(systemHealth.error, "Operating health")}
              />
            ) : systemHealth.data ? (
              <div className="mt-5 divide-y divide-border">
                {systemHealth.data.nodes.map((node) => (
                  <div key={node.id} className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">
                        {node.title}
                      </p>
                      <span
                        className={
                          node.health === "healthy"
                            ? "text-xs font-medium text-primary"
                            : "text-xs font-medium text-destructive"
                        }
                      >
                        {node.health === "healthy" ? "Healthy" : "Exception"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {node.affectedSurface}
                    </p>
                  </div>
                ))}
                <div className="py-4 text-sm text-muted-foreground">
                  {systemHealth.data.exceptions.length} active control exception
                  {systemHealth.data.exceptions.length === 1 ? "" : "s"}
                </div>
              </div>
            ) : (
              <WorkspaceSourceState source="Operating health" state="empty" />
            )}
          </section>
        </div>
      </WorkspaceSection>

    </>
  );
}
