"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button, DetailField, DetailFieldGrid, ErrorState } from "@/components/ds";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
  formatAiApprovalQueueEventLabel,
  getAiApprovalQueueMetadata,
  getAiApprovalQueuePreview,
  getAiApprovalQueueReviewChecks,
  getAiApprovalQueueRelatedHref,
  isAiApprovalQueueNotification,
} from "@/lib/collaboration/ai-approval-queue";
import {
  useCollaborationNotifications,
  type CollaborationNotification,
  type NotificationReviewPayload,
} from "@/hooks/use-collaboration-notifications";
import { getAiNotificationDeliveryPlan } from "@/lib/collaboration/ai-notification-routing";

export const dynamic = "force-dynamic";

function formatAge(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return formatDistanceToNow(date, { addSuffix: true });
}

function formatDeliveryChannelLabel(channel: string): string {
  return channel.replaceAll("_", " ");
}

function AiApprovalQueueRow({
  notification,
  onMarkReviewed,
  onConfirmChangeEvent,
  onDiscard,
}: {
  notification: CollaborationNotification;
  onMarkReviewed: (id: string, review?: NotificationReviewPayload) => void;
  onConfirmChangeEvent: (id: string, review?: NotificationReviewPayload) => void;
  onDiscard: (id: string) => void;
}) {
  const metadata = getAiApprovalQueueMetadata(notification.metadata);
  const deliveryPlan = getAiNotificationDeliveryPlan(notification);
  const preview = getAiApprovalQueuePreview(notification.metadata);
  const reviewChecks = getAiApprovalQueueReviewChecks(preview);
  const [checkedReviewIds, setCheckedReviewIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const relatedHref = getAiApprovalQueueRelatedHref({
    projectId: notification.projectId,
    entityType: notification.entityType,
    entityId: notification.entityId,
  });
  const stateLabel = notification.readAt ? "Reviewed" : "Needs review";
  const canMarkReviewed =
    Boolean(notification.readAt) ||
    reviewChecks.length === 0 ||
    reviewChecks.every((check) => checkedReviewIds.has(check.id));
  const isChangeEventConfirmation =
    !notification.readAt &&
    metadata.eventType === "ai_change_event_awaiting_approval" &&
    preview?.table === "change_events";
  const canConfirmChangeEvent = isChangeEventConfirmation && canMarkReviewed;

  function toggleReviewCheck(id: string, checked: boolean) {
    setCheckedReviewIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function buildReviewPayload(): NotificationReviewPayload {
    const checkedReviewChecks = reviewChecks.filter((check) =>
      checkedReviewIds.has(check.id),
    );
    return {
      checkedIds: checkedReviewChecks.map((check) => check.id),
      checkedLabels: checkedReviewChecks.map((check) => check.label),
    };
  }

  return (
    <li className="grid gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_8rem_7rem_minmax(0,1.4fr)_auto] lg:items-start">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium text-foreground">
          {notification.title}
        </div>
        <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {metadata.requiredAction ?? notification.body ?? "Review the AI decision."}
        </div>
        {preview ? (
          <DetailFieldGrid columns={2} className="mt-2 gap-x-4 gap-y-1">
            {preview.fields.slice(0, 6).map((field) => (
              <DetailField key={field.key} label={field.label}>
                {field.value}
              </DetailField>
            ))}
          </DetailFieldGrid>
        ) : null}
        {!notification.readAt && reviewChecks.length > 0 ? (
          <div className="mt-3 space-y-2">
            {reviewChecks.map((check) => {
              const inputId = `ai-approval-${notification.id}-${check.id}`;
              return (
                <label
                  key={check.id}
                  htmlFor={inputId}
                  className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                >
                  <Checkbox
                    id={inputId}
                    checked={checkedReviewIds.has(check.id)}
                    onCheckedChange={(checked) =>
                      toggleReviewCheck(check.id, checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span>{check.label}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 text-sm text-foreground/80">
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground lg:hidden">
          Workflow
        </span>
        <div>{formatAiApprovalQueueEventLabel(metadata.eventType)}</div>
      </div>
      <div className="text-sm text-foreground/80">
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground lg:hidden">
          Status
        </span>
        <div>{stateLabel}</div>
      </div>
      <div className="text-sm text-foreground/80">
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground lg:hidden">
          Age
        </span>
        <div>{formatAge(notification.createdAt)}</div>
      </div>
      <div className="text-xs leading-5 text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground lg:hidden">
          Why it needs review
        </span>
        <div>
          {metadata.reason ?? metadata.failureLoudBehavior ?? "Source details unavailable."}
        </div>
        {deliveryPlan ? (
          <div className="mt-1">
            Route: {deliveryPlan.tier.replace("_", " ")} ·{" "}
            {deliveryPlan.channels.map(formatDeliveryChannelLabel).join(", ")}
          </div>
        ) : null}
      </div>
      <div className="flex justify-start gap-2 lg:justify-end">
        {relatedHref ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={relatedHref}>Open</Link>
          </Button>
        ) : null}
        {!notification.readAt ? (
          isChangeEventConfirmation ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!canConfirmChangeEvent}
              onClick={() => {
                if (!canConfirmChangeEvent) return;
                onConfirmChangeEvent(notification.id, buildReviewPayload());
              }}
            >
              Confirm
            </Button>
          ) : null
        ) : null}
        {!notification.readAt ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canMarkReviewed}
            onClick={() => {
              if (!canMarkReviewed) return;

              onMarkReviewed(notification.id, buildReviewPayload());
            }}
          >
            Mark reviewed
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDiscard(notification.id)}
        >
          Discard
        </Button>
      </div>
    </li>
  );
}

function AiApprovalQueueHeader() {
  return (
    <div className="hidden grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_8rem_7rem_minmax(0,1.4fr)_auto] gap-4 border-b border-border/60 pb-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-foreground lg:grid">
      <div>Decision</div>
      <div>Workflow</div>
      <div>Status</div>
      <div>Age</div>
      <div>Why it needs review</div>
      <div className="text-right">Actions</div>
    </div>
  );
}

function AiApprovalQueueTable({
  notifications,
  onMarkReviewed,
  onConfirmChangeEvent,
  onDiscard,
}: {
  notifications: CollaborationNotification[];
  onMarkReviewed: (id: string, review?: NotificationReviewPayload) => void;
  onConfirmChangeEvent: (id: string, review?: NotificationReviewPayload) => void;
  onDiscard: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="py-10">
        <SectionRuleHeading
          label="No AI decisions need review"
          className="mb-1 pb-0"
        />
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Approval-oriented AI decisions will appear here when drafts, report
          sends, or other review-first actions are waiting on a human decision.
        </p>
      </div>
    );
  }

  return (
    <div>
      <AiApprovalQueueHeader />
      <ul className="divide-y divide-border/60">
        {notifications.map((notification) => (
          <AiApprovalQueueRow
            key={notification.id}
            notification={notification}
            onMarkReviewed={onMarkReviewed}
            onConfirmChangeEvent={onConfirmChangeEvent}
            onDiscard={onDiscard}
          />
        ))}
      </ul>
    </div>
  );
}

export default function AiApprovalsPage() {
  const {
    notifications,
    isLoading,
    isFetchingMore,
    error,
    hasMore,
    fetchMore,
    markReviewed,
    confirmAiChangeEvent,
    deleteNotification,
  } = useCollaborationNotifications({
    kind: AI_APPROVAL_QUEUE_NOTIFICATION_KIND,
    limit: 100,
  });

  const queueItems = notifications.filter(isAiApprovalQueueNotification);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageShell variant="table" title="AI approvals">
        <section className="space-y-4">
          <SectionRuleHeading label="Needs review" className="mb-0 pb-0" />

          {error ? (
            <ErrorState title="AI approvals could not load" error={error} />
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : (
            <AiApprovalQueueTable
              notifications={queueItems}
              onMarkReviewed={(id, review) => void markReviewed(id, review)}
              onConfirmChangeEvent={(id, review) =>
                void confirmAiChangeEvent(id, review)
              }
              onDiscard={(id) => void deleteNotification(id)}
            />
          )}

          {hasMore ? (
            <div className="flex justify-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isFetchingMore}
                onClick={() => void fetchMore()}
              >
                {isFetchingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </section>
      </PageShell>
    </div>
  );
}
