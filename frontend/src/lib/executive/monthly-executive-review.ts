import "server-only";

import type { Json } from "@/types/database.types";
import { createServiceClient } from "@/lib/supabase/service";

import { loadExecutivePortfolioState, type ExecutivePortfolioState } from "./executive-portfolio-state";
import { type GovernedExecutiveArtifact } from "./governed-executive-artifact";
import { monthlyFinancialReadiness, monthlyReviewPeriod, monthlyReviewRelease, type MonthlyFinancialReadiness, type MonthlyReviewEventAction, type MonthlyReviewReleaseState } from "./monthly-executive-review-contract";

export type { MonthlyReviewEventAction, MonthlyReviewReleaseState } from "./monthly-executive-review-contract";

export type MonthlyReviewEvent = {
  id: string;
  action: MonthlyReviewEventAction;
  actorUserId: string | null;
  actorLabel: string;
  rationale: string | null;
  createdAt: string;
};

export type MonthlyExecutiveReview = {
  id: string;
  reviewPeriod: string;
  artifactVersionId: string;
  artifact: GovernedExecutiveArtifact;
  portfolio: ExecutivePortfolioState;
  sourceCoverage: { eligibleProjectCount: number; readyProjectCount: number; limitedProjectCount: number; canonicalPacketId: string; artifactIntegrity: string };
  financialReadiness: MonthlyFinancialReadiness;
  delivery: GovernedExecutiveArtifact["delivery"];
  supersedesReviewId: string | null;
  events: MonthlyReviewEvent[];
  release: { state: MonthlyReviewReleaseState; reasons: string[]; recovery: string };
};

type ReviewRow = {
  id: string;
  artifact_version_id: string;
  review_period: string;
  source_coverage: Json;
  financial_readiness: Json;
  delivery_snapshot: Json;
  portfolio_snapshot: Json | null;
  supersedes_review_id: string | null;
};

type EventRow = {
  id: string;
  action: MonthlyReviewEventAction;
  actor_user_id: string | null;
  actor_label: string;
  rationale: string | null;
  created_at: string;
};

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function record(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function coverage(portfolio: ExecutivePortfolioState, artifact: GovernedExecutiveArtifact) {
  return {
    eligibleProjectCount: portfolio.summary.eligibleProjectCount,
    readyProjectCount: portfolio.summary.readyProjectCount,
    limitedProjectCount: portfolio.summary.limitedProjectCount,
    canonicalPacketId: artifact.packet.id,
    artifactIntegrity: artifact.integrity,
  };
}

async function eventsFor(reviewId: string): Promise<MonthlyReviewEvent[]> {
  const db = createServiceClient();
  const { data, error } = await db.from("executive_monthly_review_events")
    .select("id,action,actor_user_id,actor_label,rationale,created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Monthly review governance event read failed: ${error.message}`);
  return ((data ?? []) as EventRow[]).map((event) => ({ id: event.id, action: event.action, actorUserId: event.actor_user_id, actorLabel: event.actor_label, rationale: event.rationale, createdAt: event.created_at }));
}

function toReview(row: ReviewRow, artifact: GovernedExecutiveArtifact, events: MonthlyReviewEvent[]): MonthlyExecutiveReview {
  const financialReadiness = record(row.financial_readiness) as MonthlyExecutiveReview["financialReadiness"];
  const sourceCoverage = record(row.source_coverage) as MonthlyExecutiveReview["sourceCoverage"];
  const portfolioSnapshot = record(row.portfolio_snapshot ?? ({} as Json));
  const deliverySnapshot = record(row.delivery_snapshot);
  if (!Object.keys(portfolioSnapshot).length) throw new Error("Monthly review snapshot is incomplete because its immutable portfolio snapshot is absent. Reissue the governed monthly artifact; do not reconstruct history from live projects.");
  return {
    id: row.id,
    reviewPeriod: row.review_period,
    artifactVersionId: row.artifact_version_id,
    artifact,
    portfolio: portfolioSnapshot as ExecutivePortfolioState,
    sourceCoverage,
    financialReadiness,
    delivery: deliverySnapshot as GovernedExecutiveArtifact["delivery"],
    supersedesReviewId: row.supersedes_review_id,
    events,
    release: monthlyReviewRelease(artifact, financialReadiness, events),
  };
}

/** Monthly consumer only: content comes from the same immutable artifact/portfolio state used by weekly. */
export async function loadMonthlyExecutiveReview(artifact: GovernedExecutiveArtifact): Promise<MonthlyExecutiveReview> {
  if (artifact.kind !== "monthly") throw new Error("Monthly review requires a monthly governed artifact version.");
  const db = createServiceClient();
  const { data: existing, error: existingError } = await db.from("executive_monthly_reviews")
    .select("id,artifact_version_id,review_period,source_coverage,financial_readiness,delivery_snapshot,portfolio_snapshot,supersedes_review_id")
    .eq("artifact_version_id", artifact.id)
    .maybeSingle();
  if (existingError) throw new Error(`Monthly review read failed: ${existingError.message}`);
  let row = existing as ReviewRow | null;
  if (!row) {
    const portfolio = await loadExecutivePortfolioState({ state: artifact.state, executive: artifact.executive, governedArtifactVersionId: artifact.id });
    const period = monthlyReviewPeriod(artifact);
    const { error: issueError } = await db.rpc("issue_executive_monthly_review", { p_artifact_version_id: artifact.id, p_review_period: period, p_source_coverage: json(coverage(portfolio, artifact)), p_financial_readiness: json(monthlyFinancialReadiness(artifact)), p_delivery_snapshot: json(artifact.delivery), p_portfolio_snapshot: json(portfolio) });
    if (issueError) throw new Error(`Monthly review atomic issuance failed: ${issueError.message}`);
    const { data: issued, error: issuedError } = await db.from("executive_monthly_reviews")
      .select("id,artifact_version_id,review_period,source_coverage,financial_readiness,delivery_snapshot,portfolio_snapshot,supersedes_review_id")
      .eq("artifact_version_id", artifact.id)
      .single();
    if (issuedError || !issued) throw new Error(`Monthly review issuance readback failed: ${issuedError?.message ?? "review missing after atomic issuance"}`);
    row = issued as ReviewRow;
  }
  return toReview(row, artifact, await eventsFor(row.id));
}

export async function appendMonthlyReviewGovernanceEvent(input: { reviewId: string; action: "finance_closed" | "executive_approved"; actorUserId: string; actorLabel: string; rationale?: string | null }): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.rpc("record_executive_monthly_review_governance", { p_review_id: input.reviewId, p_action: input.action, p_actor_user_id: input.actorUserId, p_actor_label: input.actorLabel, p_rationale: input.rationale?.trim() || undefined });
  if (error) throw new Error(`Monthly review ${input.action.replaceAll("_", " ")} could not be recorded: ${error.message}`);
}
