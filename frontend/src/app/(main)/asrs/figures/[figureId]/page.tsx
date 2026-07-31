import { notFound } from "next/navigation";

import { Button, StatusBadge } from "@/components/ds";
import { FmdsVisualReviewForm } from "@/components/fmds/fmds-visual-review-form";
import {
  ContentSectionStack,
  DetailLayout,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";
import { getFmdsFigureDetailData } from "@/lib/fmds/fmds-figures.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function interpretationPoints(value: Record<string, unknown>): string[] {
  const reviewTrace = asRecord(value.review_trace);
  const adjudication = asRecord(reviewTrace?.adjudication);
  const preferredValues = [
    value.summary,
    value.description,
    value.interpretation,
    value.requirements,
    value.observations,
    adjudication?.approval_basis,
  ];
  const points = preferredValues.flatMap((candidate) => {
    if (typeof candidate === "string") return [candidate];
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );
    }
    return [];
  });

  return [
    ...new Set(points.map((point) => point.trim()).filter(Boolean)),
  ].slice(0, 16);
}

export default async function AsrsFigureDetailPage({
  params,
}: {
  params: Promise<{ figureId: string }>;
}) {
  const { figureId } = await params;
  const data = await getFmdsFigureDetailData(figureId);
  if (!data) notFound();

  const { figure, revision, latestCandidate, latestReview } = data;
  const sourcePdfHref = figure.source_pdf_url
    ? `${figure.source_pdf_url}#page=${figure.page_number}`
    : null;
  const initialReviewDecision =
    latestReview?.decision === "approved" ||
    latestReview?.decision === "changes_requested" ||
    latestReview?.decision === "rejected"
      ? latestReview.decision
      : null;
  const candidate = latestCandidate?.output ?? figure.extracted_description;
  const candidatePoints = interpretationPoints(candidate);
  const candidateReady = candidatePoints.length > 0;

  return (
    <PageShell
      variant="detailWide"
      title={`${figure.figure_identifier}${figure.title ? `: ${figure.title}` : ""}`}
      description={`${revision.document_code} · ${revision.revision_label} · p. ${figure.page_number}`}
      statusBadge={
        <StatusBadge status={figure.review_status.replaceAll("_", " ")} />
      }
      breadcrumbs={[
        { label: "ASRS Intelligence", href: "/asrs" },
        { label: "Figures", href: "/asrs/figures" },
        { label: figure.figure_identifier },
      ]}
    >
      <ContentSectionStack>
        <section>
          <SectionRuleHeading label="Is the interpretation an exact match?" />
          <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
            Compare every label, dimension, symbol, relationship, and governing
            note against the original source. The source image is authoritative.
          </p>
          <DetailLayout
            variant="equal"
            sidebarAt="lg"
            columnGap="wide"
            sidebar={
              <section aria-label="Candidate interpretation">
                <SectionRuleHeading label="Candidate interpretation (review this)" />
                {candidateReady ? (
                  <ul className="space-y-3 text-sm leading-6 text-foreground">
                    {candidatePoints.map((point) => (
                      <li key={point} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="bg-destructive/10 p-4 text-sm text-destructive">
                    No figure interpretation is available to approve.
                  </p>
                )}
              </section>
            }
          >
            <section aria-label="Original source">
              <SectionRuleHeading
                label="Original source excerpt (authoritative)"
                actions={
                  sourcePdfHref ? (
                    <Button
                      variant="link"
                      size="sm"
                      asChild
                      className="h-auto px-0 py-0 text-xs font-semibold"
                    >
                      <a href={sourcePdfHref} target="_blank" rel="noreferrer">
                        View PDF
                      </a>
                    </Button>
                  ) : undefined
                }
              />
              {figure.signed_evidence_url ? (
                <a
                  href={figure.signed_evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-auto rounded-md border border-border bg-muted/20 p-2"
                >
                  <img
                    src={figure.signed_evidence_url}
                    alt={`Original FMDS source excerpt for ${figure.figure_identifier}`}
                    className="mx-auto max-h-screen w-auto max-w-full object-contain"
                  />
                </a>
              ) : (
                <p className="bg-destructive/10 p-4 text-sm text-destructive">
                  Review is blocked because source evidence is unavailable.
                </p>
              )}
            </section>
          </DetailLayout>
        </section>

        <section className="max-w-3xl">
          <SectionRuleHeading label="Record the review" />
          <FmdsVisualReviewForm
            sourceType="figure"
            sourceId={figure.id}
            evidencePath={figure.evidence_image_path}
            candidateIds={latestCandidate ? [latestCandidate.id] : []}
            canApprove={candidateReady}
            initialDecision={initialReviewDecision}
            initialNotes={latestReview?.notes ?? ""}
            approvalBlockedReason={
              candidateReady
                ? undefined
                : "Approved is unavailable because no figure interpretation exists."
            }
          />
        </section>

        {latestReview ? (
          <section className="max-w-3xl text-sm">
            <SectionRuleHeading label="Latest review" />
            <p className="font-medium">
              {latestReview.decision.replaceAll("_", " ")} by{" "}
              {latestReview.reviewer_id}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {latestReview.notes}
            </p>
          </section>
        ) : null}
      </ContentSectionStack>
    </PageShell>
  );
}
