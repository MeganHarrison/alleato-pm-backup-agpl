"use client";

import { useState } from "react";
import {
  DollarSign,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ds";
import type { PCO } from "@/hooks/use-pcos";

interface PCOSidebarProps {
  pco: PCO;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
  VOID: "Void",
};

type AnnotationType = "positive" | "negative" | "lesson" | null;

export function PCOSidebar({ pco }: PCOSidebarProps) {
  const [annotationType, setAnnotationType] = useState<AnnotationType>(
    (pco.annotation as AnnotationType) ?? null
  );
  const [annotationNote, setAnnotationNote] = useState(
    pco.annotation_note ?? ""
  );

  const lineItems = pco.line_items ?? [];
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (item.line_amount ?? 0),
    0
  );
  const markupAmount = subtotal * ((pco.markup_percentage ?? 0) / 100);
  const total = subtotal + markupAmount;
  const showAnnotation = pco.status === "APPROVED" || !!pco.prime_change_order_id;

  return (
    <div className="space-y-6">
      {/* Financial Impact */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          Financial Impact
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {formatCurrency(pco.approved_value ?? total)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pco.approved_value ? "Approved Value" : "Estimated Value"}
          </p>
        </div>

        {lineItems.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-3">
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {item.description || item.category || "Line item"}
                </span>
                <span className="tabular-nums text-foreground">
                  {formatCurrency(item.line_amount)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              {(pco.markup_percentage ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Markup ({pco.markup_percentage}%)
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(markupAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="tabular-nums text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Schedule Impact */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Schedule Impact
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {pco.schedule_impact_days ?? 0}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">days</span>
          </p>
        </div>
        {pco.schedule_impact_description && (
          <p className="text-sm text-muted-foreground">
            {pco.schedule_impact_description}
          </p>
        )}
      </section>

      {/* Details */}
      <section className="space-y-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">PCO Number</dt>
            <dd className="font-medium tabular-nums text-foreground">{pco.number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={STATUS_LABELS[pco.status] ?? pco.status} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="text-foreground">{pco.type}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-foreground">
              {new Date(pco.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="tabular-nums text-foreground">v{pco.current_version}</dd>
          </div>
          {pco.change_events && pco.change_events.length > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Linked CEs</dt>
              <dd className="flex flex-wrap gap-1 justify-end">
                {pco.change_events.map((ce) => (
                  <Badge key={ce.id} variant="outline" className="text-xs">
                    #{ce.number}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
          {pco.root_cause && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Root Cause</dt>
              <dd className="text-foreground text-right max-w-[60%]">
                {pco.root_cause}
              </dd>
            </div>
          )}
          {pco.change_reason && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Change Reason</dt>
              <dd className="text-foreground text-right max-w-[60%]">
                {pco.change_reason}
              </dd>
            </div>
          )}
          {pco.location && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-foreground text-right max-w-[60%]">
                {pco.location}
              </dd>
            </div>
          )}
          {pco.reference && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="text-foreground text-right max-w-[60%]">
                {pco.reference}
              </dd>
            </div>
          )}
          {pco.request_received_from && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Request From</dt>
              <dd className="text-foreground text-right max-w-[60%]">
                {pco.request_received_from}
              </dd>
            </div>
          )}
          {pco.due_date && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Due Date</dt>
              <dd className="text-foreground">
                {new Date(pco.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
          {pco.is_private && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Private</dt>
              <dd className="text-foreground">Yes</dd>
            </div>
          )}
          {pco.field_change && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Field Change</dt>
              <dd className="text-foreground">Yes</dd>
            </div>
          )}
          {pco.paid_in_full && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid in Full</dt>
              <dd className="text-foreground">Yes</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Annotation */}
      {showAnnotation && (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Annotation
          </div>
          <div className="flex gap-2">
            <Button
              variant={annotationType === "positive" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setAnnotationType(annotationType === "positive" ? null : "positive")
              }
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
              Positive
            </Button>
            <Button
              variant={annotationType === "negative" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setAnnotationType(annotationType === "negative" ? null : "negative")
              }
            >
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
              Negative
            </Button>
            <Button
              variant={annotationType === "lesson" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setAnnotationType(annotationType === "lesson" ? null : "lesson")
              }
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Lesson
            </Button>
          </div>
          {annotationType && (
            <Textarea
              placeholder="Add a note about this change..."
              value={annotationNote}
              onChange={(e) => setAnnotationNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          )}
        </section>
      )}
    </div>
  );
}
