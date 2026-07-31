"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BaseSidebar,
  SidebarBody,
  SidebarFooter,
  SidebarStats,
  SidebarTabs,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, X, Send, Ban, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface BudgetModificationLine {
  id: string;
  costCodeId: string;
  costTypeId: string;
  costTypeCode?: string;
  subJobId: string | null;
  amount: number;
  description: string | null;
  costCodeTitle: string;
}

interface BudgetModification {
  id: string;
  number: string;
  title: string;
  reason: string | null;
  amount: number;
  status: "draft" | "pending" | "approved" | "void";
  effectiveDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  lines: BudgetModificationLine[];
}

interface BudgetModificationsModalProps {
  open: boolean;
  onClose: () => void;
  budgetLineId: string;
  projectId: string;
  costCode?: string;
  onModificationChanged?: () => void;
}

type StatusFilter = "all" | "approved" | "pending" | "draft" | "void";

export function BudgetModificationsModal({
  open,
  onClose,
  budgetLineId,
  projectId,
  costCode,
  onModificationChanged,
}: BudgetModificationsModalProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "details">("summary");
  const [modifications, setModifications] = useState<BudgetModification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [voidDialogModId, setVoidDialogModId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const fetchModifications = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const url = `/api/projects/${projectId}/budget/modifications?budgetLineId=${budgetLineId}${statusParam}`;
      const data = await apiFetch<{ modifications?: BudgetModification[] }>(url);
      setModifications(data.modifications || []);
    } catch (error) {
      console.error("Failed to fetch budget modifications:", error);
      toast.error("Failed to load budget modifications");
    } finally {
      setLoading(false);
    }
  }, [projectId, budgetLineId, statusFilter]);

  useEffect(() => {
    if (open) {
      fetchModifications();
    }
  }, [open, fetchModifications]);

  const handleAction = async (
    modificationId: string,
    action: "submit" | "approve" | "reject" | "void",
  ) => {
    if (action === "void") {
      setVoidDialogModId(modificationId);
      setVoidReason("");
      return;
    }
    setActionLoading(modificationId);
    try {
      const result = await apiFetch<{ message: string }>(
        `/api/projects/${projectId}/budget/modifications`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modificationId, action }),
        },
      );
      toast.success(result.message);

      await fetchModifications();

      if (action === "approve") {
        onModificationChanged?.();
      }
    } catch (error) {
      toast.error(`Failed to ${action} modification`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidDialogModId || !voidReason.trim()) return;
    setActionLoading(voidDialogModId);
    setVoidDialogModId(null);
    try {
      const result = await apiFetch<{ message: string }>(
        `/api/projects/${projectId}/budget/modifications`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modificationId: voidDialogModId,
            action: "void",
            voidedReason: voidReason.trim(),
          }),
        },
      );
      toast.success(result.message);
      await fetchModifications();
      onModificationChanged?.();
    } catch (error) {
      toast.error("Failed to void modification");
    } finally {
      setActionLoading(null);
      setVoidReason("");
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
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border border-border bg-muted text-foreground">
        {status.toUpperCase()}
      </span>
    );
  };

  const getAvailableActions = (
    status: string,
  ): Array<{
    action: "submit" | "approve" | "reject" | "void";
    label: string;
    icon: React.ReactNode;
    variant: "default" | "outline" | "destructive";
  }> => {
    switch (status) {
      case "draft":
        return [
          {
            action: "submit",
            label: "Submit",
            icon: <Send className="h-3 w-3" />,
            variant: "default",
          },
        ];
      case "pending":
        return [
          {
            action: "approve",
            label: "Approve",
            icon: <Check className="h-3 w-3" />,
            variant: "default",
          },
          {
            action: "reject",
            label: "Reject",
            icon: <X className="h-3 w-3" />,
            variant: "outline",
          },
        ];
      case "approved":
        return [
          {
            action: "void",
            label: "Void",
            icon: <Ban className="h-3 w-3" />,
            variant: "destructive",
          },
        ];
      default:
        return [];
    }
  };

  const approvedTotal = modifications
    .filter((m) => m.status === "approved")
    .reduce((sum, m) => sum + m.amount, 0);

  const pendingTotal = modifications
    .filter((m) => m.status === "pending")
    .reduce((sum, m) => sum + m.amount, 0);

  // Build a human-readable budget code label for transfer table cells.
  const formatBudgetLineLabel = (line: BudgetModificationLine | null): string => {
    if (!line) return "";
    const codeWithType = line.costTypeCode
      ? `${line.costCodeId}.${line.costTypeCode}`
      : line.costCodeId;
    return line.costCodeTitle
      ? `${codeWithType}-${line.costCodeTitle}`
      : codeWithType;
  };

  type TransferRow = {
    id: string;
    date: string;
    from: string;
    to: string;
    notes: string;
    amount: number;
  };

  // Normalize modifications into transfer-like rows: Date | From | To | Notes | Amount.
  const transferRows: TransferRow[] = modifications.map((mod) => {
    const negativeLine =
      mod.lines.find((line) => line.amount < 0) || null;
    const positiveLine =
      mod.lines.find((line) => line.amount > 0) || null;

    const sourceLine = negativeLine || (positiveLine && mod.lines.length === 1 ? positiveLine : null);
    const destinationLine = positiveLine || (negativeLine && mod.lines.length === 1 ? negativeLine : null);

    const amount = positiveLine
      ? Math.abs(positiveLine.amount)
      : negativeLine
        ? Math.abs(negativeLine.amount)
        : Math.abs(mod.amount);

    return {
      id: mod.id,
      date: formatDate(mod.effectiveDate || mod.createdAt),
      from: formatBudgetLineLabel(sourceLine),
      to: formatBudgetLineLabel(destinationLine),
      notes: (mod.reason || mod.title || "").trim(),
      amount,
    };
  });

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "details", label: "Details" },
  ];

  return (
    <>
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Budget Modifications"
      size="xl"
    >
      <SidebarTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as "summary" | "details")}
      />

      <SidebarBody className="bg-background">
        {activeTab === "summary" ? (
          <div className="p-4 sm:p-6 space-y-3">
            <SidebarStats
              summary={
                <>
                  {costCode ? `${costCode} · ` : ""}
                  {modifications.length} modification
                  {modifications.length === 1 ? "" : "s"} ·{" "}
                  {formatCurrency(pendingTotal)} pending
                </>
              }
              value={formatCurrency(approvedTotal)}
            />

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  "all",
                  "approved",
                  "pending",
                  "draft",
                  "void",
                ] as StatusFilter[]
              ).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "ghost"}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-medium rounded-full transition-all h-auto",
                    statusFilter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted",
                  )}
                >
                  {status === "all"
                    ? "All"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              {loading ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading modifications...
                </div>
              ) : transferRows.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No budget modifications found
                  {statusFilter !== "all"
                    ? ` with status "${statusFilter}"`
                    : " for this cost code"}
                  .
                </div>
              ) : (
                <InlineTable variant="read">
                  <InlineTableHeader>
                    <InlineTableHeaderRow>
                      <InlineTableHeaderCell className="w-28">Date</InlineTableHeaderCell>
                      <InlineTableHeaderCell>From</InlineTableHeaderCell>
                      <InlineTableHeaderCell>To</InlineTableHeaderCell>
                      <InlineTableHeaderCell>Notes</InlineTableHeaderCell>
                      <InlineTableHeaderCell align="right" className="w-40">
                        Amount
                      </InlineTableHeaderCell>
                    </InlineTableHeaderRow>
                  </InlineTableHeader>
                  <InlineTableBody>
                    {transferRows.map((row) => (
                      <InlineTableRow key={row.id}>
                        <InlineTableCell className="whitespace-nowrap">
                          {row.date}
                        </InlineTableCell>
                        <InlineTableCell className="max-w-75 truncate">
                          {row.from}
                        </InlineTableCell>
                        <InlineTableCell className="max-w-75 truncate">
                          {row.to}
                        </InlineTableCell>
                        <InlineTableCell className="max-w-65 truncate">
                          {row.notes}
                        </InlineTableCell>
                        <InlineTableCell
                          align="right"
                          numeric
                          className="font-semibold tabular-nums"
                        >
                          {formatCurrency(row.amount)}
                        </InlineTableCell>
                      </InlineTableRow>
                    ))}
                  </InlineTableBody>
                </InlineTable>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-3">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : modifications.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                <p className="text-muted-foreground">No modifications found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {modifications.map((mod) => (
                  <div
                    key={mod.id}
                    className="rounded-lg border border-border bg-background"
                  >
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">
                            {mod.number}
                          </span>
                          {getStatusBadge(mod.status)}
                        </div>
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            mod.amount < 0
                              ? "text-destructive"
                              : "text-foreground",
                          )}
                        >
                          {formatCurrency(mod.amount)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {mod.title}
                      </p>
                    </div>

                    <div className="border-t border-border">
                      <InlineTable variant="read">
                        <InlineTableHeader>
                          <InlineTableHeaderRow>
                          <InlineTableHeaderCell>Cost Code</InlineTableHeaderCell>
                          <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                          <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                          <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                          <InlineTableHeaderCell align="right">Actions</InlineTableHeaderCell>
                        </InlineTableHeaderRow>
                      </InlineTableHeader>
                      <InlineTableBody>
                          {mod.lines.map((line) => (
                            <InlineTableRow key={line.id}>
                              <InlineTableCell className="font-medium">
                                {line.costCodeId}
                              </InlineTableCell>
                              <InlineTableCell>
                                {line.description || line.costCodeTitle || ""}
                              </InlineTableCell>
                              <InlineTableCell
                                align="right"
                                numeric
                                className={cn(
                                  "font-semibold",
                                  line.amount < 0
                                    ? "text-destructive"
                                    : "text-foreground",
                                )}
                              >
                                {formatCurrency(line.amount)}
                              </InlineTableCell>
                              <InlineTableCell>{getStatusBadge(mod.status)}</InlineTableCell>
                              <InlineTableCell align="right">
                                <div className="flex justify-end gap-2">
                                  {getAvailableActions(mod.status).map(
                                    ({ action, label, icon, variant }) => (
                                      <Button
                                        key={action}
                                        size="sm"
                                        variant={variant}
                                        onClick={() => handleAction(mod.id, action)}
                                        disabled={actionLoading === mod.id}
                                        className="h-7 text-xs gap-1"
                                      >
                                        {actionLoading === mod.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          icon
                                        )}
                                        {label}
                                      </Button>
                                    ),
                                  )}
                                </div>
                              </InlineTableCell>
                            </InlineTableRow>
                          ))}
                        </InlineTableBody>
                      </InlineTable>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SidebarBody>

      <SidebarFooter>
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </SidebarFooter>
    </BaseSidebar>

    {/* Void Reason Dialog */}
    <Dialog
      open={!!voidDialogModId}
      onOpenChange={(open) => {
        if (!open) {
          setVoidDialogModId(null);
          setVoidReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Modification</DialogTitle>
          <DialogDescription>
            Provide a reason for voiding this modification. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="void-reason">Reason <span className="text-destructive">*</span></Label>
          <Textarea
            id="void-reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Describe why this modification is being voided..."
            rows={4}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setVoidDialogModId(null);
              setVoidReason("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!voidReason.trim()}
            onClick={handleConfirmVoid}
          >
            Void Modification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
