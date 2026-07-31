"use client";

import { useState, useEffect } from "react";
import {
  BaseSidebar,
  SidebarBody,
  SidebarStats,
  SidebarTabs,
} from "./BaseSidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

interface DirectCostItem {
  id: string;
  description: string;
  amount: number;
  status: "pending" | "revise_and_resubmit" | "approved";
  incurredDate: string | null;
  vendor: string | null;
  invoiceNumber: string | null;
  costType: string | null;
  payments: number;
  detailHref?: string | null;
}

interface DirectCostsModalProps {
  open: boolean;
  onClose: () => void;
  costCode: string;
  budgetLineId: string;
  projectId: string;
}

export function DirectCostsModal({
  open,
  onClose,
  costCode,
  budgetLineId,
  projectId,
}: DirectCostsModalProps) {
  const [activeTab, setActiveTab] = useState<"costs" | "summary">("costs");
  const [costs, setCosts] = useState<DirectCostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayments, setShowPayments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved"
  >("all");

  useEffect(() => {
    if (open) {
      fetchCosts();
    }
  }, [open, budgetLineId, projectId, statusFilter]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const url = `/api/projects/${projectId}/budget/direct-costs?budgetLineId=${budgetLineId}&costCode=${encodeURIComponent(costCode)}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`;
      const data = await apiFetch<{ costs: DirectCostItem[] }>(url);
      setCosts(data.costs || []);
    } catch (error) {
      console.error("Failed to fetch direct costs:", error);
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
    const displayName: Record<string, string> = {
      approved: "APPROVED",
      pending: "PENDING",
      revise_and_resubmit: "REVISE",
    };

    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-border bg-muted text-foreground">
        {displayName[status] || status.toUpperCase()}
      </span>
    );
  };

  const totalAmount = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const totalPayments = costs.reduce((sum, cost) => sum + cost.payments, 0);

  const tabs = [
    { id: "costs", label: "Direct Costs" },
    { id: "summary", label: "Summary" },
  ];

  return (
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Direct Costs"
      size="xl"
    >
      <SidebarTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as "costs" | "summary")}
      />

      {/* Filters */}
      <div className="px-4 sm:px-8 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(["all", "approved", "pending"] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant={statusFilter === status ? "default" : "ghost"}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-full transition-all h-auto",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted",
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="show-payments"
              checked={showPayments}
              onCheckedChange={setShowPayments}
            />
            <Label
              htmlFor="show-payments"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Show Payments
            </Label>
          </div>
        </div>
      </div>

      <SidebarBody className="bg-background">
        {activeTab === "costs" ? (
          <div className="p-4 sm:p-6 space-y-3">
            <SidebarStats
              summary={
                <>
                  {costCode ? `${costCode} · ` : ""}
                  {costs.length} cost{costs.length === 1 ? "" : "s"}
                  {showPayments
                    ? ` · ${formatCurrency(totalPayments)} paid`
                    : ""}
                </>
              }
              value={formatCurrency(totalAmount)}
            />

            {/* Costs Table */}
            <InlineTable variant="read">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Type</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                  <InlineTableHeaderCell>Vendor</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                  {showPayments && (
                    <InlineTableHeaderCell align="right">Payments</InlineTableHeaderCell>
                  )}
                  <InlineTableHeaderCell>Date</InlineTableHeaderCell>
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={showPayments ? 7 : 6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Loading costs...
                    </td>
                  </tr>
                ) : costs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showPayments ? 7 : 6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      No direct costs found for this cost code.
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <InlineTableRow key={cost.id}>
                      <InlineTableCell
                        className="max-w-xs truncate"
                        title={cost.description || ""}
                      >
                        <BudgetDrilldownRecordLink href={cost.detailHref}>
                          {cost.description || cost.invoiceNumber || "Open direct cost"}
                        </BudgetDrilldownRecordLink>
                      </InlineTableCell>
                      <InlineTableCell>
                        {cost.costType || ""}
                      </InlineTableCell>
                      <InlineTableCell>
                        {getStatusBadge(cost.status)}
                      </InlineTableCell>
                      <InlineTableCell>
                        {cost.vendor || ""}
                      </InlineTableCell>
                      <InlineTableCell align="right" numeric className="font-semibold">
                        {formatCurrency(cost.amount)}
                      </InlineTableCell>
                      {showPayments && (
                        <InlineTableCell align="right" numeric className="font-medium">
                          {formatCurrency(cost.payments)}
                        </InlineTableCell>
                      )}
                      <InlineTableCell>
                        {formatDate(cost.incurredDate)}
                      </InlineTableCell>
                    </InlineTableRow>
                  ))
                )}
              </InlineTableBody>
            </InlineTable>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            <SidebarStats
              summary={
                <>
                  {costCode ? `${costCode} · ` : ""}by status
                </>
              }
              value={formatCurrency(totalAmount)}
            />

            <InlineTable variant="read">
              <InlineTableHeader>
                <InlineTableHeaderRow>
                  <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">Count</InlineTableHeaderCell>
                  <InlineTableHeaderCell align="right">Total Amount</InlineTableHeaderCell>
                </InlineTableHeaderRow>
              </InlineTableHeader>
              <InlineTableBody>
                {(["approved", "pending", "revise_and_resubmit"] as const).map(
                  (status) => {
                    const statusCosts = costs.filter((c) => c.status === status);
                    const statusTotal = statusCosts.reduce(
                      (sum, c) => sum + c.amount,
                      0,
                    );

                    return (
                      <InlineTableRow key={status}>
                        <InlineTableCell>{getStatusBadge(status)}</InlineTableCell>
                        <InlineTableCell align="right">
                          {statusCosts.length}
                        </InlineTableCell>
                        <InlineTableCell align="right" numeric className="font-semibold">
                          {formatCurrency(statusTotal)}
                        </InlineTableCell>
                      </InlineTableRow>
                    );
                  },
                )}
              </InlineTableBody>
            </InlineTable>
          </div>
        )}
      </SidebarBody>

    </BaseSidebar>
  );
}
