"use client";

import { useState, useEffect } from "react";
import { BaseSidebar, SidebarBody, SidebarStats } from "./BaseSidebar";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds/inline-table";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { BudgetDrilldownRecordLink } from "./BudgetDrilldownRecordLink";

interface PendingChangeOrder {
  id: string;
  changeOrderNumber: string;
  description: string;
  amount: number;
  status: string;
  requestedDate: string;
  requestedBy: string | null;
  contractNumber: string;
  detailHref?: string | null;
}

interface PendingBudgetChangesModalProps {
  open: boolean;
  onClose: () => void;
  budgetLineId: string;
  projectId: string;
  costCode?: string;
}

export function PendingBudgetChangesModal({
  open,
  onClose,
  budgetLineId,
  projectId,
  costCode,
}: PendingBudgetChangesModalProps) {
  const [changeOrders, setChangeOrders] = useState<PendingChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPendingChanges();
    }
  }, [open, budgetLineId, projectId]);

  const fetchPendingChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/projects/${projectId}/budget/change-orders?budgetLineId=${budgetLineId}&status=pending`;
      const data = await apiFetch<{ changeOrders: PendingChangeOrder[] }>(url);
      setChangeOrders(data.changeOrders || []);
    } catch (error) {
      console.error("Failed to fetch pending budget changes:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch pending budget changes");
      setChangeOrders([]);
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

  const getStatusBadge = (status: string) => {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-1 text-xs font-semibold text-foreground">
        {status.replace("pending_", "").replace(/_/g, " ").toUpperCase()}
      </span>
    );
  };

  const totalAmount = changeOrders.reduce((sum, co) => sum + co.amount, 0);

  return (
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Pending Budget Changes"
      size="xl"
    >
      <SidebarBody className="bg-background">
        <div className="p-4 sm:p-6 space-y-3">
          <SidebarStats
            summary={
              <>
                {costCode ? `${costCode} · ` : ""}
                {changeOrders.length} pending budget change
                {changeOrders.length === 1 ? "" : "s"}
              </>
            }
            value={formatCurrency(totalAmount)}
          />

          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>CO Number</InlineTableHeaderCell>
                <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                <InlineTableHeaderCell>Contract</InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                <InlineTableHeaderCell>Requested</InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    Loading pending changes...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-destructive"
                  >
                    {error}
                  </td>
                </tr>
              ) : changeOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    No pending budget changes found for this cost code.
                  </td>
                </tr>
              ) : (
                changeOrders.map((co) => (
                  <InlineTableRow key={co.id}>
                    <InlineTableCell>
                      <BudgetDrilldownRecordLink href={co.detailHref}>
                        {co.changeOrderNumber}
                      </BudgetDrilldownRecordLink>
                    </InlineTableCell>
                    <InlineTableCell
                      className="max-w-xs truncate"
                      title={co.description}
                    >
                      {co.description}
                    </InlineTableCell>
                    <InlineTableCell>{getStatusBadge(co.status)}</InlineTableCell>
                    <InlineTableCell>
                      {co.contractNumber}
                    </InlineTableCell>
                    <InlineTableCell
                      align="right"
                      numeric
                      className={cn(
                        "font-semibold",
                        co.amount < 0
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {formatCurrency(co.amount)}
                    </InlineTableCell>
                    <InlineTableCell>
                      {formatDate(co.requestedDate)}
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
