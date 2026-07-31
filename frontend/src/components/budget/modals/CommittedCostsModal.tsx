"use client";

import { useState, useEffect } from "react";
import {
  BaseSidebar,
  SidebarBody,
  SidebarStats,
} from "./BaseSidebar";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds/inline-table";
import { apiFetch } from "@/lib/api-client";
import { BudgetDrilldownRecordLink } from "./BudgetDrilldownRecordLink";

interface Commitment {
  id: string;
  commitmentNumber: string;
  vendor: string | null;
  description: string;
  amount: number;
  status: string;
  type: "subcontract" | "purchase_order" | "change_order";
  executedDate: string | null;
  changeOrders: number;
  detailHref?: string | null;
}

interface CommittedCostsModalProps {
  open: boolean;
  onClose: () => void;
  costCode: string;
  budgetLineId: string;
  projectId: string;
}

export function CommittedCostsModal({
  open,
  onClose,
  costCode,
  budgetLineId,
  projectId,
}: CommittedCostsModalProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCommitments();
    }
  }, [open, budgetLineId, projectId]);

  const fetchCommitments = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/projects/${projectId}/budget/commitments?budgetLineId=${budgetLineId}&costCode=${encodeURIComponent(costCode)}&status=approved,complete`;
      const data = await apiFetch<{ commitments: Commitment[] }>(url);
      setCommitments(data.commitments || []);
    } catch (error) {
      console.error("Failed to fetch committed costs:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch committed costs");
      setCommitments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    const isNegative = value < 0;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));

    if (isNegative) {
      return `($${formatted})`;
    }
    return `$${formatted}`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const totalAmount = commitments.reduce((sum, c) => sum + c.amount, 0);

  return (
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Committed Costs"
      size="xl"
    >
      <SidebarBody className="bg-background">
        <div className="p-4 sm:p-6 space-y-3">
          <SidebarStats
            summary={
              <>
                {costCode ? `${costCode} · ` : ""}
                {commitments.length} commitment
                {commitments.length === 1 ? "" : "s"}
              </>
            }
            value={formatCurrency(totalAmount)}
          />

          {/* Commitments Table */}
          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>Number</InlineTableHeaderCell>
                <InlineTableHeaderCell>Type</InlineTableHeaderCell>
                <InlineTableHeaderCell>Vendor</InlineTableHeaderCell>
                <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                <InlineTableHeaderCell align="center">COs</InlineTableHeaderCell>
                <InlineTableHeaderCell>Executed</InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    Loading commitments...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : commitments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    No committed costs found for this cost code.
                  </td>
                </tr>
              ) : (
                commitments.map((commitment) => (
                  <InlineTableRow key={commitment.id}>
                    <InlineTableCell>
                      <BudgetDrilldownRecordLink href={commitment.detailHref}>
                        {commitment.commitmentNumber}
                      </BudgetDrilldownRecordLink>
                    </InlineTableCell>
                    <InlineTableCell>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-border bg-muted text-foreground">
                        {commitment.type === "subcontract"
                          ? "SC"
                          : commitment.type === "change_order"
                            ? "CO"
                            : "PO"}
                      </span>
                    </InlineTableCell>
                    <InlineTableCell>
                      {commitment.vendor || ""}
                    </InlineTableCell>
                    <InlineTableCell
                      className="max-w-xs truncate"
                      title={commitment.description}
                    >
                      {commitment.description}
                    </InlineTableCell>
                    <InlineTableCell align="right" numeric className="font-semibold">
                      {formatCurrency(commitment.amount)}
                    </InlineTableCell>
                    <InlineTableCell align="center">
                      {commitment.changeOrders > 0 ? (
                        <span className="text-foreground text-xs font-medium">
                          {commitment.changeOrders}
                        </span>
                      ) : null}
                    </InlineTableCell>
                    <InlineTableCell>
                      {formatDate(commitment.executedDate)}
                    </InlineTableCell>
                  </InlineTableRow>
                ))
              )}
            </InlineTableBody>
          </InlineTable>
        </div>
      </SidebarBody>

    </BaseSidebar>
  );
}
