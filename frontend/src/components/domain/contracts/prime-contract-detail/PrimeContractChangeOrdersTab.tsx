"use client";

import { useCallback, useMemo } from "react";

import { Check, Download, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import type { PrimeContractCO } from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";
import { StatusBadge } from "@/components/ds";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadPdf } from "@/hooks/use-pdf-export";
import { apiFetch } from "@/lib/api-client";

interface PrimeContractChangeOrdersTabProps {
  projectId: string;
  contractId: string;
  changeOrders: PrimeContractCO[];
  setChangeOrders: React.Dispatch<React.SetStateAction<PrimeContractCO[]>>;
  formatCurrency: (value: number | null | undefined) => string;
  onStartEditCo: (co: PrimeContractCO) => void;
  onSetDeletingCo: (co: PrimeContractCO) => void;
  onSetRejectingCoId: (id: string) => void;
  onShowRejectCoDialog: () => void;
}

function downloadPrimeContractChangeOrderPdf(
  changeOrder: Pick<PrimeContractCO, "id" | "change_order_number">,
) {
  return downloadPdf({
    endpoint: `/api/document-center/prime-contract-change-order/${changeOrder.id}/pdf`,
    filename: changeOrder.change_order_number || "prime-contract-change-order",
    errorMessage: "Failed to download change order PDF. Please try again.",
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function PrimeContractChangeOrdersTab({
  projectId,
  changeOrders,
  setChangeOrders,
  formatCurrency,
  onStartEditCo,
  onSetDeletingCo,
  onSetRejectingCoId,
  onShowRejectCoDialog,
}: PrimeContractChangeOrdersTabProps) {
  const totalChangeOrderAmount = useMemo(
    () => changeOrders.reduce((sum, co) => sum + (co.amount ?? 0), 0),
    [changeOrders],
  );

  const handleApproveCo = useCallback(async (coId: string) => {
    try {
      await apiFetch(
        `/api/projects/${projectId}/prime-contract-change-orders/${coId}/approve`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      setChangeOrders((prev) =>
        prev.map((co) =>
          co.id === coId ? { ...co, status: "approved", approved_date: new Date().toISOString() } : co,
        ),
      );
      toast.success("Change order approved");
    } catch (error) {
      console.error("Failed to approve change order:", error);
      toast.error("Failed to approve change order. Please try again.");
    }
  }, [projectId, setChangeOrders]);

  return (
    <section className="space-y-3">
      <SectionRuleHeading label="Change Orders" />
      <InlineTable variant="read" tableClassName="min-w-full">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell>Number</InlineTableHeaderCell>
            <InlineTableHeaderCell>Revision</InlineTableHeaderCell>
            <InlineTableHeaderCell>Title</InlineTableHeaderCell>
            <InlineTableHeaderCell>Status</InlineTableHeaderCell>
            <InlineTableHeaderCell>Executed</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell>Date Initiated</InlineTableHeaderCell>
            <InlineTableHeaderCell>Due Date</InlineTableHeaderCell>
            <InlineTableHeaderCell>Review Date</InlineTableHeaderCell>
            <InlineTableHeaderCell>Reviewer</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right" className="w-12">
              <span className="sr-only">Actions</span>
            </InlineTableHeaderCell>
          </InlineTableHeaderRow>
        </InlineTableHeader>

        <InlineTableBody>
          {changeOrders.length === 0 ? (
            <InlineTableRow>
              <InlineTableCell colSpan={11} className="py-5 text-sm text-muted-foreground">
                No change orders created yet.
              </InlineTableCell>
            </InlineTableRow>
          ) : (
            changeOrders.map((co) => (
              <InlineTableRow key={co.id}>
                <InlineTableCell className="font-medium text-foreground">
                  {co.change_order_number}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {co.revision ?? "—"}
                </InlineTableCell>
                <InlineTableCell className="max-w-sm">
                  <div className="text-foreground">{co.title || co.description || "—"}</div>
                </InlineTableCell>
                <InlineTableCell>
                  <StatusBadge status={co.status ?? "pending"} />
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {co.executed ? "Yes" : "—"}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  <span className={(co.amount ?? 0) < 0 ? "text-destructive" : undefined}>
                    {formatCurrency(co.amount ?? 0)}
                  </span>
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {formatShortDate(co.requested_date)}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {formatShortDate(co.due_date)}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {formatShortDate(co.review_date)}
                </InlineTableCell>
                <InlineTableCell className="text-muted-foreground">
                  {co.designated_reviewer || "—"}
                </InlineTableCell>
                <InlineTableCell align="right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenuItem onClick={() => onStartEditCo(co)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void downloadPrimeContractChangeOrderPdf(co)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                      {co.status !== "approved" && co.status !== "rejected" ? (
                        <>
                          <DropdownMenuItem onClick={() => void handleApproveCo(co.id)}>
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              onSetRejectingCoId(co.id);
                              onShowRejectCoDialog();
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onSetDeletingCo(co)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </InlineTableCell>
              </InlineTableRow>
            ))
          )}
        </InlineTableBody>

        {changeOrders.length > 0 ? (
          <tfoot>
            <tr className="border-t border-border/60">
              <td className="px-3 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground" colSpan={5}>
                Total
              </td>
              <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums">
                {formatCurrency(totalChangeOrderAmount)}
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        ) : null}
      </InlineTable>
    </section>
  );
}
