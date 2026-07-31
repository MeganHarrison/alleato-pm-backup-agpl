"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import type { MonthlyExecutiveReview } from "@/lib/executive/monthly-executive-review";

const label = (value: string) => value.replaceAll("_", " ");

export function MonthlyExecutiveReviewSection({ initialReview, canGovern }: { initialReview: MonthlyExecutiveReview; canGovern: boolean }) {
  const [review, setReview] = useState(initialReview);
  const [pending, setPending] = useState<"finance_closed" | "executive_approved" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const financeClosed = review.events.some((event) => event.action === "finance_closed");
  const executiveApproved = review.events.some((event) => event.action === "executive_approved");

  async function record(action: "finance_closed" | "executive_approved") {
    setPending(action); setError(null);
    try {
      setReview(await apiFetch<MonthlyExecutiveReview>("/api/executive/monthly-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewId: review.id, action }) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Monthly review governance action failed.");
    } finally { setPending(null); }
  }

  return <section className="space-y-5" aria-labelledby="monthly-review-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div id="monthly-review-heading"><SectionRuleHeading label="Monthly review governance" className="mb-1" /></div>
        <p className="mt-1 text-sm text-muted-foreground">Period {review.reviewPeriod} · governed version {review.artifactVersionId}</p>
      </div>
      <p className="text-sm font-medium text-foreground">{label(review.release.state)}</p>
    </div>
    {review.release.reasons.length ? <div className="space-y-1 text-sm" role="alert"><p className="font-medium text-foreground">Release is {review.release.state}.</p>{review.release.reasons.map((reason) => <p key={reason} className="text-muted-foreground">{reason}</p>)}<p className="text-muted-foreground">Recovery: {review.release.recovery}</p></div> : <p className="text-sm text-muted-foreground">Executive approval is recorded. Delivery evidence remains owned by the packet-correlated AI Ops ledger.</p>}
    <div className="grid gap-5 text-sm md:grid-cols-2">
      <div className="space-y-1"><p className="font-medium text-foreground">Financial trend</p><p className="text-muted-foreground">{formatCurrency(review.artifact.state?.financial.totalOutstandingAR ?? 0)} outstanding AR · {formatCurrency(review.artifact.state?.financial.totalPendingCORevenue ?? 0)} pending CO revenue</p></div>
      <div className="space-y-1"><p className="font-medium text-foreground">Operational trend</p><p className="text-muted-foreground">{review.portfolio.summary.openAttentionCount} actionable attention · {review.portfolio.summary.openConflictCount} actionable conflicts · {review.portfolio.summary.limitedProjectCount} projects with limited coverage</p></div>
      <div className="space-y-1"><p className="font-medium text-foreground">Financial readiness</p><p className="text-muted-foreground">{label(review.financialReadiness.state)} · {review.financialReadiness.freshness}</p>{review.financialReadiness.warnings.map((warning) => <p key={warning} className="text-muted-foreground">{warning}</p>)}</div>
      <div className="space-y-1"><p className="font-medium text-foreground">Source coverage</p><p className="text-muted-foreground">{review.sourceCoverage.eligibleProjectCount} eligible · {review.sourceCoverage.readyProjectCount} ready · {review.sourceCoverage.limitedProjectCount} limited</p><p className="text-muted-foreground">Packet {review.sourceCoverage.canonicalPacketId} · artifact {review.sourceCoverage.artifactIntegrity}</p></div>
      <div className="space-y-1"><p className="font-medium text-foreground">Delivery evidence</p><p className="text-muted-foreground">{review.delivery.deliveredCount} delivered · {review.delivery.pendingCount} pending · {review.delivery.deliveryAttemptIds.length} packet-correlated attempts</p></div>
      <div className="space-y-1"><p className="font-medium text-foreground">Supersession</p><p className="text-muted-foreground">{review.supersedesReviewId ? `Supersedes ${review.supersedesReviewId}` : "First recorded review for this period."}</p></div>
    </div>
    <div className="space-y-2"><p className="font-medium text-foreground">Strategic decisions</p>{review.artifact.packet.recommendedNextMoves.length ? <ul className="divide-y divide-border">{review.artifact.packet.recommendedNextMoves.slice(0, 5).map((decision) => <li key={decision} className="py-2 text-sm text-muted-foreground">{decision}</li>)}</ul> : <p className="text-sm text-muted-foreground">No strategic decision is recorded in this governed packet version.</p>}</div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Monthly review controls">
      {canGovern && !financeClosed ? <Button size="sm" disabled={pending !== null || review.financialReadiness.state !== "ready"} onClick={() => record("finance_closed")}>{pending === "finance_closed" ? "Recording finance close…" : "Record finance close"}</Button> : null}
      {canGovern && financeClosed && !executiveApproved ? <Button size="sm" disabled={pending !== null} onClick={() => record("executive_approved")}>{pending === "executive_approved" ? "Recording approval…" : "Record executive approval"}</Button> : null}
      {!canGovern && review.release.state !== "approved" ? <p className="text-sm text-muted-foreground">An app admin must record the remaining governance action for this version.</p> : null}
    </div>
    {error ? <ErrorState title="Monthly review governance could not be recorded" error={error} className="py-2" /> : null}
    <div className="divide-y divide-border" aria-label="Monthly review governance history">{review.events.map((event) => <div key={event.id} className="py-3 text-sm"><p className="font-medium text-foreground">{label(event.action)}</p><p className="text-muted-foreground">{event.actorLabel} · {new Date(event.createdAt).toLocaleString()}{event.rationale ? ` · ${event.rationale}` : ""}</p></div>)}</div>
  </section>;
}
