"use client";

import { Pencil, Send, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Inline } from "@/components/layout/inline";
import { StatusBadge } from "@/components/ds";
import type { PCO } from "@/hooks/use-pcos";

interface PCORecordHeaderProps {
  pco: PCO;
  onEdit: () => void;
  onSubmit: () => void;
  onConvert: () => void;
  converting?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
  VOID: "Void",
  CONVERTED: "Converted",
};

const typeLabels: Record<string, string> = {
  CLIENT_REQUESTED: "Client Requested",
  INTERNAL: "Internal",
  MIXED: "Mixed",
};

export function PCORecordHeader({
  pco,
  onEdit,
  onSubmit,
  onConvert,
  converting,
}: PCORecordHeaderProps) {
  const status = pco.status;
  const createdDate = pco.created_at
    ? new Date(pco.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const updatedDate = pco.updated_at
    ? new Date(pco.updated_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={STATUS_LABELS[status] ?? status} />
        <span className="text-xs text-muted-foreground">v{pco.current_version}</span>
        <span className="text-xs text-muted-foreground">&middot;</span>
        <span className="text-xs text-muted-foreground">
          {typeLabels[pco.type] ?? pco.type}
        </span>
        {createdDate && (
          <>
            <span className="text-xs text-muted-foreground">&middot;</span>
            <span className="text-xs text-muted-foreground">Created {createdDate}</span>
          </>
        )}
      </div>

      <Inline gap="sm">
        {status === "DRAFT" && (
          <>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button size="sm" onClick={onSubmit}>
              <Send className="mr-1.5 h-4 w-4" />
              Submit to Client
            </Button>
          </>
        )}
        {status === "SUBMITTED" && (
          <Button size="sm" variant="outline" disabled>
            <Clock className="mr-1.5 h-4 w-4" />
            Awaiting Client Response
          </Button>
        )}
        {status === "REVISION_REQUESTED" && (
          <Button size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit &amp; Revise
          </Button>
        )}
        {status !== "VOID" && status !== "CONVERTED" && (
          <Button size="sm" onClick={onConvert} disabled={converting}>
            <ArrowRight className="mr-1.5 h-4 w-4" />
            {converting ? "Converting\u2026" : "Convert to Change Order"}
          </Button>
        )}
      </Inline>
    </div>
  );
}
