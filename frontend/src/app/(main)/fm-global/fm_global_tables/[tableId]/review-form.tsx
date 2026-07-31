"use client";

import { FmdsVisualReviewForm } from "@/components/fmds/fmds-visual-review-form";
import type { ReviewDecision } from "@/components/fmds/fmds-visual-review-form";

export function FmdsTableReviewForm({
  tableId,
  ...props
}: {
  tableId: string;
  evidencePath: string | null;
  candidateIds: string[];
  canApprove: boolean;
  approvalBlockedReason?: string;
  initialDecision?: ReviewDecision | null;
  initialNotes?: string;
}) {
  return (
    <FmdsVisualReviewForm sourceType="table" sourceId={tableId} {...props} />
  );
}
