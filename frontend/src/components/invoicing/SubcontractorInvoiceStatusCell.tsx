"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSubcontractorInvoiceWorkflowAction } from "@/hooks/use-subcontractor-invoices";
import { getSubcontractorInvoiceStatusTransitions } from "@/lib/invoicing/subcontractor-invoice-status-transitions";

import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

export function SubcontractorInvoiceStatusCell({
  projectId,
  invoiceId,
  status,
}: {
  projectId: string;
  invoiceId: number;
  status: string;
}): React.ReactElement {
  const transitions = getSubcontractorInvoiceStatusTransitions(status);
  const workflow = useSubcontractorInvoiceWorkflowAction(projectId);
  const isPending =
    workflow.isPending && workflow.variables?.invoiceId === invoiceId;

  // No valid transitions → plain read-only badge (approved/paid/void/etc.).
  if (transitions.length === 0) {
    return <InvoiceStatusBadge status={status} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          "group inline-flex items-center gap-1 rounded-md outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        aria-label={`Change status from ${status}`}
      >
        <InvoiceStatusBadge status={status} />
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {transitions.map((transition) => (
          <DropdownMenuItem
            key={transition.action}
            disabled={isPending}
            onSelect={() =>
              workflow.mutate({ invoiceId, action: transition.action })
            }
          >
            {transition.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
