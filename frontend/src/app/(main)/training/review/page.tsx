export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { PageShell, SectionRuleHeading } from "@/components/layout";
import { ResourceCard, toTrainingResourceViewModel } from "@/features/training";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";
import {
  getDiscoveryMetrics,
  getPendingFreshnessReviews,
  getResources,
  getRoles,
  getTopics,
} from "@/lib/training/server";

import { FreshnessDecisionForm } from "./freshness-decision-form";
import { LearningMetrics } from "./learning-metrics";
import { ReviewDecisionForm } from "./review-decision-form";
import { TrainingResourceFinderForm } from "./training-resource-finder-form";

type TrainingReviewPageProps = {
  searchParams: Promise<{
    reviewStatus?: string;
    reviewMessage?: string;
  }>;
};

function humanizeTrack(track: string) {
  return track.replaceAll("_", " ").replaceAll("-", " ");
}

function humanizeFreshnessOutcome(outcome: string) {
  return outcome.replaceAll("_", " ");
}

export default async function TrainingReviewPage({
  searchParams,
}: TrainingReviewPageProps) {
  await requireTrainingReviewerPageAccess();

  const [resources, freshnessReviews, roles, topics, metrics, query] =
    await Promise.all(
    [
      getResources({ status: "review" }),
      getPendingFreshnessReviews(),
      getRoles(),
      getTopics(),
      getDiscoveryMetrics(),
      searchParams,
    ],
  );
  const message =
    query.reviewStatus === "success" || query.reviewStatus === "error"
      ? query.reviewMessage
      : null;

  return (
    <PageShell
      variant="content"
      title="Training review"
      description="Review new sources and freshness findings before they change the training library."
      contentClassName="max-w-4xl"
      breadcrumbs={[
        { label: "Training", href: "/training" },
        { label: "Review" },
      ]}
    >
      <section className="space-y-4 pb-8" aria-label="Find training resources">
        <div className="space-y-1">
          <SectionRuleHeading
            label="Find training resources"
            as="h2"
            className="mb-1 pb-0"
          />
          <p className="text-sm text-muted-foreground">
            Search free sources for one role and topic. New matches enter this
            review queue.
          </p>
        </div>
        <TrainingResourceFinderForm roles={roles} topics={topics} />
      </section>

      {message ? (
        <p
          role={query.reviewStatus === "error" ? "alert" : "status"}
          className={
            query.reviewStatus === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}

      <section aria-label="Pending training resources" className="pb-8">
        <SectionRuleHeading label="New resources" as="h2" />
        {resources.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No new resources are waiting for review.
          </p>
        ) : (
          resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={toTrainingResourceViewModel(resource)}
              details={[
                resource.topicName,
                humanizeTrack(resource.track),
                resource.roles.map((role) => role.name).join(", "),
                resource.discovery
                  ? `Recommended ${Math.round(resource.discovery.score * 100)}% · ${resource.discovery.strategy.replaceAll("_", " ")}`
                  : null,
                ...(resource.discovery?.explanation ?? []),
              ].filter((detail): detail is string => Boolean(detail))}
              showStatus={false}
              showEmbed={false}
              actions={<ReviewDecisionForm resourceId={resource.id} />}
            />
          ))
        )}
      </section>

      <section aria-label="Pending training freshness findings">
        <SectionRuleHeading label="Freshness findings" as="h2" />
        {freshnessReviews.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No freshness findings are waiting for review.
          </p>
        ) : (
          freshnessReviews.map((review) => (
            <ResourceCard
              key={review.checkId}
              resource={toTrainingResourceViewModel(review.resource)}
              details={[
                review.resource.topicName,
                humanizeFreshnessOutcome(review.outcome),
                review.httpStatus ? `HTTP ${review.httpStatus}` : null,
                `Seen ${review.occurrenceCount} times`,
                review.observedTitle
                  ? `Observed title: ${review.observedTitle}`
                  : null,
              ].filter((detail): detail is string => Boolean(detail))}
              showStatus={false}
              showEmbed={false}
              actions={
                <FreshnessDecisionForm
                  checkId={review.checkId}
                  recommendedAction={review.recommendedAction}
                />
              }
            />
          ))
        )}
      </section>

      <LearningMetrics metrics={metrics} />
    </PageShell>
  );
}
