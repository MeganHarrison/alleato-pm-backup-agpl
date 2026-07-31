"use client";

import { useState, useEffect } from "react";
import {
  BaseSidebar,
  SidebarBody,
  SidebarStats,
} from "./BaseSidebar";
import { Button } from "@/components/ui/button";
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

interface PendingCostChange {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: string;
  type: "commitment" | "commitment_change_order";
  commitmentType?: "subcontract" | "purchase_order";
  requestedDate: string;
  detailHref?: string | null;
}

interface PendingCostChangesModalProps {
  open: boolean;
  onClose: () => void;
  budgetLineId: string;
  projectId: string;
  costCode?: string;
}

export function PendingCostChangesModal({
  open,
  onClose,
  budgetLineId,
  projectId,
  costCode,
}: PendingCostChangesModalProps) {
  const [changes, setChanges] = useState<PendingCostChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<
    "all" | "commitment" | "change_order"
  >("all");

  useEffect(() => {
    if (open) {
      fetchPendingCostChanges();
    }
  }, [open, budgetLineId, projectId, typeFilter]);

  const fetchPendingCostChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/projects/${projectId}/budget/pending-cost-changes?budgetLineId=${budgetLineId}${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`;
      const data = await apiFetch<{ changes: PendingCostChange[] }>(url);
      setChanges(data.changes || []);
    } catch (error) {
      console.error("Failed to fetch pending cost changes:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch pending cost changes");
      setChanges([]);
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

  const getTypeBadge = (change: PendingCostChange) => {
    const label =
      change.type === "commitment_change_order"
        ? "CO"
        : change.commitmentType === "subcontract"
          ? "SUB"
          : "PO";

    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-border bg-muted text-foreground">
        {label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-border bg-muted text-foreground">
        {status.replace(/_/g, " ").toUpperCase()}
      </span>
    );
  };

  const totalAmount = changes.reduce((sum, c) => sum + c.amount, 0);

  return (
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Pending Cost Changes"
      size="xl"
    >
      <SidebarBody className="bg-background">
        <div className="p-4 sm:p-6 space-y-3">
          <SidebarStats
            summary={
              <>
                {costCode ? `${costCode} · ` : ""}
                {changes.length} pending cost change
                {changes.length === 1 ? "" : "s"}
              </>
            }
            value={formatCurrency(totalAmount)}
          />

          {/* Type Filter */}
          <div className="flex gap-2">
            {(["all", "commitment", "change_order"] as const).map((type) => (
              <Button
                key={type}
                type="button"
                variant={typeFilter === type ? "default" : "ghost"}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-full transition-all h-auto",
                  typeFilter === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted",
                )}
              >
                {type === "all"
                  ? "All"
                  : type === "commitment"
                    ? "Commitments"
                    : "COs"}
              </Button>
            ))}
          </div>

            <InlineTable variant="read">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell>Number</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Type</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Status</InlineTableHeaderCell>
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
                      Loading pending cost changes...
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
                ) : changes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      No pending cost changes found for this cost code.
                    </td>
                  </tr>
                ) : (
                  changes.map((change) => (
                    <InlineTableRow key={change.id}>
                      <InlineTableCell>
                        <BudgetDrilldownRecordLink href={change.detailHref}>
                          {change.number}
                        </BudgetDrilldownRecordLink>
                      </InlineTableCell>
                      <InlineTableCell>{getTypeBadge(change)}</InlineTableCell>
                      <InlineTableCell
                        className="max-w-xs truncate"
                        title={change.description}
                      >
                        {change.description}
                      </InlineTableCell>
                      <InlineTableCell>
                        {getStatusBadge(change.status)}
                      </InlineTableCell>
                      <InlineTableCell
                        align="right"
                        numeric
                        className={cn(
                          "font-semibold",
                          change.amount < 0
                            ? "text-destructive"
                            : "text-foreground",
                        )}
                      >
                        {formatCurrency(change.amount)}
                      </InlineTableCell>
                      <InlineTableCell>
                        {formatDate(change.requestedDate)}
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
