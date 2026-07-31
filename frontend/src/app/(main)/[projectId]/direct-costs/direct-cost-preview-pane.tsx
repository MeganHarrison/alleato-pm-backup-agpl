"use client";

import { useState, type ReactElement } from "react";
import { ArrowUpRight, CalendarClock, Check, Copy, FileText, Keyboard, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, formatDate } from "./direct-costs-table-utils";
import type { DirectCostRow } from "./direct-costs-client";

interface DirectCostPreviewPaneProps {
  directCost: DirectCostRow | null;
  onOpenDirectCostPage: (directCost: DirectCostRow) => void;
}

function statusDotColor(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-emerald-500";
    case "Revise and Resubmit":
      return "bg-rose-500";
    case "Pending":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

export function DirectCostPreviewPane({
  directCost,
  onOpenDirectCostPage,
}: DirectCostPreviewPaneProps): ReactElement {
  const [copied, setCopied] = useState(false);

  function handleCopyId() {
    if (!directCost) return;
    void navigator.clipboard.writeText(directCost.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!directCost) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm font-medium text-foreground">Direct cost preview</p>
        <p className="text-sm text-muted-foreground">Select a row to preview details here.</p>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5" />
            Arrow Up/Down: move selection
          </p>
          <p>Enter: open selected direct cost page</p>
        </div>
      </div>
    );
  }

  const title = directCost.vendor?.name ?? "Internal";
  const subtitle = directCost.invoice_number ? `Invoice #${directCost.invoice_number}` : `Direct Cost #${directCost.id.slice(0, 8)}`;

  return (
    <div className="p-6 space-y-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${statusDotColor(directCost.status)}`} />
                {directCost.status}
              </Badge>
              <Badge variant="secondary">{directCost.cost_type}</Badge>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => onOpenDirectCostPage(directCost)}
          >
            Open
            <ArrowUpRight />
          </Button>
        </div>
      </div>

      <section className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold text-foreground">Amount</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{formatAmount(directCost.total_amount)}</p>
      </section>

      <section className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold text-foreground inline-flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5" />
          Dates
        </p>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>Cost date: {formatDate(directCost.date)}</p>
          <p>Received: {formatDate(directCost.received_date)}</p>
          <p>Paid: {formatDate(directCost.paid_date)}</p>
        </div>
      </section>

      {directCost.description ? (
        <section className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold text-foreground inline-flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Description
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {directCost.description}
          </p>
        </section>
      ) : null}

      <section className="space-y-2 border-t pt-4">
        <p className="text-xs font-semibold text-foreground inline-flex items-center gap-2">
          <ReceiptText className="h-3.5 w-3.5" />
          IDs
        </p>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
              <span>Cost ID:</span>
              <span className="font-mono" title={directCost.id}>{directCost.id.slice(0, 8)}…</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleCopyId}
                aria-label="Copy cost ID"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </p>
          <p>Invoice: {directCost.invoice_number ?? "None"}</p>
        </div>
      </section>

      <section className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
        <p className="inline-flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5" />
          Arrow Up/Down: move selection
        </p>
        <p>Enter: open selected direct cost page</p>
      </section>
    </div>
  );
}
