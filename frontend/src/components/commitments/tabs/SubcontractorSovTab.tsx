"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SectionRuleHeading } from "@/components/layout";
import { MoneyField } from "@/components/forms/MoneyField";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableFooter,
  InlineTableFooterCell,
  InlineTableFooterRow,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { cn } from "@/lib/utils";
import type { BudgetCodeOption } from "@/components/domain/change-events/change-event-form/types";
import {
  normalizeBudgetCodesForSelector,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SovSourceLine {
  id: string;
  line_number: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
  billed_to_date: number | null;
}

interface SsovLineItem {
  id: string;
  source_sov_item_id: string | null;
  line_number: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
  billed_to_date: number | null;
  isDirty?: boolean;
}

type SsovStatus = "draft" | "under_review" | "approved" | "revise_resubmit";

interface InvoiceContact {
  id: string;
  name: string;
  email: string;
}

interface SsovPermissions {
  canEdit: boolean;
  canReview: boolean;
  canSendNotification: boolean;
}

interface SubcontractorSovTabProps {
  projectId: number;
  commitmentId: string;
  onSubmitted?: () => void | Promise<void>;
  onCountChange?: (count: number) => void;
}

interface SsovPayload {
  data: {
    status: SsovStatus;
    targetAmount: number;
    sourceSov: SovSourceLine[];
    lineItems: SsovLineItem[];
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNotes: string | null;
    inviteSentAt: string | null;
    invoiceContacts: InvoiceContact[];
    permissions: SsovPermissions;
  };
}

interface SsovActionResponse {
  message?: string;
}

const STATUS_LABEL: Record<SsovStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  revise_resubmit: "Revise & Resubmit",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SubcontractorSovTab({
  projectId,
  commitmentId,
  onSubmitted,
  onCountChange,
}: SubcontractorSovTabProps) {
  const [sourceSov, setSourceSov] = useState<SovSourceLine[]>([]);
  const [items, setItems] = useState<SsovLineItem[]>([]);
  const [status, setStatus] = useState<SsovStatus>("draft");
  const [targetAmount, setTargetAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [inviteSentAt, setInviteSentAt] = useState<string | null>(null);
  const [invoiceContacts, setInvoiceContacts] = useState<InvoiceContact[]>([]);
  const [permissions, setPermissions] = useState<SsovPermissions>({
    canEdit: false,
    canReview: false,
    canSendNotification: false,
  });
  const [budgetCodes, setBudgetCodes] = useState<BudgetCodeOption[]>([]);

  const fetchSsov = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await apiFetch<SsovPayload>(
        `/api/projects/${projectId}/commitments/${commitmentId}/subcontractor-sov`,
      );

      setSourceSov(payload.data.sourceSov || []);
      setItems(payload.data.lineItems || []);
      setStatus(payload.data.status || "draft");
      setTargetAmount(payload.data.targetAmount || 0);
      setInviteSentAt(payload.data.inviteSentAt || null);
      setInvoiceContacts(payload.data.invoiceContacts || []);
      setPermissions(
        payload.data.permissions || { canEdit: false, canReview: false, canSendNotification: false },
      );
      setHasUnsavedChanges(false);
      onCountChange?.((payload.data.lineItems || []).length);
    } catch (error) {
      toast.error("Failed to load Subcontractor SOV.");
    } finally {
      setIsLoading(false);
    }
  }, [commitmentId, onCountChange, projectId]);

  useEffect(() => {
    void fetchSsov();
  }, [fetchSsov]);

  // Load budget codes so the budget-code column can show the full
  // "code – description" label (matching the selector), not just the raw code.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await apiFetch<{
          budgetCodes?: Array<Partial<BudgetCodeOption> & { id: string; code: string }>;
          data?: Array<Partial<BudgetCodeOption> & { id: string; code: string }>;
        }>(`/api/projects/${projectId}/budget-codes`);
        if (cancelled) return;
        setBudgetCodes(
          normalizeBudgetCodesForSelector(payload.budgetCodes || payload.data || []),
        );
      } catch (error) {
        // Non-fatal: budget-code cells fall back to the raw budget_code text.
        // Report the degraded state rather than swallowing it silently.
        if (!cancelled) {
          console.warn(
            "SubcontractorSovTab: failed to load budget codes for label enrichment; falling back to raw codes.",
            error,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Resolve a stored budget_code text to its full "code – description" label.
  const budgetCodeLabel = useCallback(
    (code: string | null): string => {
      if (!code) return "—";
      const resolved = resolvePrimeCoBudgetCode(code, budgetCodes);
      return resolved.isMapped
        ? resolved.displayLabel || resolved.displayCode
        : code;
    },
    [budgetCodes],
  );

  // Group children under parents
  const groups = useMemo(() => {
    return sourceSov.map((parent) => {
      const children = items.filter((i) => i.source_sov_item_id === parent.id);
      const allocated = children.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
      const remaining = Math.max(Number(parent.amount ?? 0) - allocated, 0);
      return { parent, children, allocated, remaining };
    });
  }, [sourceSov, items]);

  const orphans = useMemo(
    () => items.filter((i) => !i.source_sov_item_id || !sourceSov.some((s) => s.id === i.source_sov_item_id)),
    [items, sourceSov],
  );

  const allocatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [items],
  );
  const billedToDateTotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.billed_to_date ?? 0), 0),
    [items],
  );
  const totalRemaining = Math.max(targetAmount - allocatedTotal, 0);

  const isLocked = status === "under_review" || status === "approved" || !permissions.canEdit;
  const canSubmit =
    permissions.canEdit &&
    items.length > 0 &&
    totalRemaining === 0 &&
    (status === "draft" || status === "revise_resubmit");

  // ─── Edits ─────────────────────────────────────────────────────────────

  const updateItem = (id: string, field: "description" | "amount", value: string | number) => {
    if (isLocked) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "amount") {
          return { ...item, amount: value === "" ? null : Number(value), isDirty: true };
        }
        return { ...item, description: String(value), isDirty: true };
      }),
    );
    setHasUnsavedChanges(true);
  };

  const addChildLine = (parent: SovSourceLine) => {
    if (isLocked) return;
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source_sov_item_id: parent.id,
        line_number: prev.length + 1,
        budget_code: parent.budget_code,
        description: "",
        amount: 0,
        billed_to_date: 0,
        isDirty: true,
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const deleteLine = (id: string) => {
    if (isLocked) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    setHasUnsavedChanges(true);
  };

  // ─── Save ──────────────────────────────────────────────────────────────

  const saveLineItems = useCallback(async () => {
    setIsSaving(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/commitments/${commitmentId}/subcontractor-sov`,
        {
          method: "PUT",
          body: JSON.stringify({
            lineItems: items.map((item, index) => ({
              id: item.id.startsWith("temp-") ? undefined : item.id,
              source_sov_item_id: item.source_sov_item_id,
              line_number: item.line_number ?? index + 1,
              budget_code: item.budget_code || null,
              description: item.description || null,
              amount: item.amount ?? 0,
              billed_to_date: item.billed_to_date ?? 0,
            })),
          }),
        },
      );
      toast.success("Subcontractor SOV saved.");
      await fetchSsov();
    } catch (error) {
      toast.error("Failed to save subcontractor SOV.");
    } finally {
      setIsSaving(false);
    }
  }, [commitmentId, fetchSsov, items, projectId]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const runAction = useCallback(
    async (action: "submit" | "approve" | "reject" | "import_from_sov" | "send_notification") => {
      if (action === "submit" && !canSubmit) {
        toast.error("Remaining to Allocate must equal $0 before submitting.");
        return;
      }
      setIsSubmitting(true);
      try {
        const payload = await apiFetch<SsovActionResponse>(
          `/api/projects/${projectId}/commitments/${commitmentId}/subcontractor-sov`,
          {
            method: "POST",
            body: JSON.stringify({ action }),
          },
        );
        toast.success(payload.message || "Subcontractor SOV updated.");
        await fetchSsov();
        if (action === "submit") await onSubmitted?.();
      } catch (error) {
        toast.error("Action failed.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [canSubmit, commitmentId, fetchSsov, onSubmitted, projectId],
  );

  // ─── Loading ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SectionRuleHeading label="Subcontractor Schedule of Values" className="[&_span]:text-primary" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const colSpanFull = isLocked ? 5 : 6;

  return (
    <div className="space-y-4">
      <SectionRuleHeading label="Subcontractor Schedule of Values" className="[&_span]:text-primary" />

      {/* Status + meta */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline">{STATUS_LABEL[status]}</Badge>
          </div>
          {inviteSentAt && (
            <p className="text-xs text-muted-foreground">
              Invitation sent {new Date(inviteSentAt).toLocaleString()}
            </p>
          )}
          {invoiceContacts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Invoice contacts: {invoiceContacts.map((c) => c.email).join(", ")}
            </p>
          ) : (
            <p className="text-xs text-status-warning">
              No invoice contact set. Add one in Advanced Settings before sending an SSOV invitation.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === "under_review" && permissions.canReview && (
            <>
              <Button variant="outline" onClick={() => void runAction("reject")} disabled={isSubmitting}>
                Send Back
              </Button>
              <Button onClick={() => void runAction("approve")} disabled={isSubmitting}>
                Approve
              </Button>
            </>
          )}
          {permissions.canSendNotification && (
            <Button variant="outline" onClick={() => void runAction("send_notification")} disabled={isSubmitting}>
              Send SSOV Notification
            </Button>
          )}
          {(status === "draft" || status === "revise_resubmit") && (
            <Button onClick={() => void runAction("submit")} disabled={isSubmitting || !canSubmit || hasUnsavedChanges}>
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>

      {/* Grouped SOV → SSOV table */}
      <InlineTable variant="edit">
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell className="w-16">#</InlineTableHeaderCell>
            <InlineTableHeaderCell>Budget Code</InlineTableHeaderCell>
            <InlineTableHeaderCell>Description</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Billed To Date</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            {!isLocked && <InlineTableHeaderCell className="w-px" />}
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {groups.length === 0 && orphans.length === 0 && (
            <InlineTableRow>
              <InlineTableCell className="py-8 text-center text-muted-foreground" colSpan={colSpanFull}>
                No SOV line items on this commitment. Add SOV lines first.
              </InlineTableCell>
            </InlineTableRow>
          )}

          {groups.map(({ parent, children, allocated, remaining }) => (
            <React.Fragment key={parent.id}>
              {/* Parent SOV row */}
              <InlineTableRow type="group">
                <InlineTableCell className="font-semibold tabular-nums">{parent.line_number ?? "—"}</InlineTableCell>
                <InlineTableCell className="font-medium">{budgetCodeLabel(parent.budget_code)}</InlineTableCell>
                <InlineTableCell className="font-medium">{parent.description || "—"}</InlineTableCell>
                <InlineTableCell align="right" numeric className="text-muted-foreground">
                  {formatCurrency(parent.billed_to_date ?? 0)}
                </InlineTableCell>
                <InlineTableCell align="right" numeric className="font-semibold">
                  {formatCurrency(parent.amount ?? 0)}
                </InlineTableCell>
                {!isLocked && <InlineTableCell />}
              </InlineTableRow>

              {/* SSOV child rows */}
              {children.map((child) => (
                <InlineTableRow key={child.id}>
                  <InlineTableCell />
                  <InlineTableCell className="pl-8 text-xs text-muted-foreground">↳</InlineTableCell>
                  <InlineTableCell className="min-w-56">
                    <Input
                      value={child.description || ""}
                      onChange={(e) => updateItem(child.id, "description", e.target.value)}
                      placeholder="Line item description"
                      disabled={isLocked}
                    />
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric className="text-muted-foreground">
                    {formatCurrency(child.billed_to_date ?? 0)}
                  </InlineTableCell>
                  <InlineTableCell align="right">
                    <MoneyField
                      label="Amount"
                      inline
                      showCurrency={false}
                      value={child.amount ?? undefined}
                      onChange={(value) => updateItem(child.id, "amount", value ?? 0)}
                      disabled={isLocked}
                    />
                  </InlineTableCell>
                  {!isLocked && (
                    <InlineTableCell align="right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteLine(child.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </InlineTableCell>
                  )}
                </InlineTableRow>
              ))}

              {/* Per-parent footer: Add line + Remaining to Allocate */}
              <InlineTableRow>
                <InlineTableCell colSpan={3}>
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => addChildLine(parent)}
                      className="h-auto p-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add line item
                    </Button>
                  )}
                </InlineTableCell>
                <InlineTableCell align="right" className="text-xs text-muted-foreground">Remaining to Allocate</InlineTableCell>
                <InlineTableCell
                  align="right"
                  numeric
                  className={cn(
                    "font-semibold",
                    remaining === 0 ? "text-status-success" : "text-status-warning",
                  )}
                >
                  {formatCurrency(remaining)}
                </InlineTableCell>
                {!isLocked && <InlineTableCell />}
              </InlineTableRow>
            </React.Fragment>
          ))}

          {/* Orphans (SSOV rows with no matching parent — shouldn't happen post-backfill, but render defensively) */}
          {orphans.length > 0 && (
            <>
              <InlineTableRow className="bg-status-warning/10">
                <InlineTableCell className="text-xs font-semibold text-status-warning" colSpan={colSpanFull}>
                  Unlinked line items (no matching SOV parent)
                </InlineTableCell>
              </InlineTableRow>
              {orphans.map((child) => (
                <InlineTableRow key={child.id}>
                  <InlineTableCell numeric>{child.line_number ?? "—"}</InlineTableCell>
                  <InlineTableCell>{budgetCodeLabel(child.budget_code)}</InlineTableCell>
                  <InlineTableCell className="min-w-56">
                    <Input
                      value={child.description || ""}
                      onChange={(e) => updateItem(child.id, "description", e.target.value)}
                      disabled={isLocked}
                    />
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric className="text-muted-foreground">
                    {formatCurrency(child.billed_to_date ?? 0)}
                  </InlineTableCell>
                  <InlineTableCell align="right">
                    <MoneyField
                      label="Amount"
                      inline
                      showCurrency={false}
                      value={child.amount ?? undefined}
                      onChange={(value) => updateItem(child.id, "amount", value ?? 0)}
                      disabled={isLocked}
                    />
                  </InlineTableCell>
                  {!isLocked && (
                    <InlineTableCell align="right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteLine(child.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </InlineTableCell>
                  )}
                </InlineTableRow>
              ))}
            </>
          )}
        </InlineTableBody>
        <InlineTableFooter>
          <InlineTableFooterRow type="totals">
            <InlineTableFooterCell align="right" colSpan={3}>
              Grand Total
            </InlineTableFooterCell>
            <InlineTableFooterCell align="right" numeric>
              {formatCurrency(billedToDateTotal)}
            </InlineTableFooterCell>
            <InlineTableFooterCell align="right" numeric>
              {formatCurrency(allocatedTotal)}
            </InlineTableFooterCell>
            {!isLocked && <InlineTableFooterCell />}
          </InlineTableFooterRow>
        </InlineTableFooter>
      </InlineTable>

      {hasUnsavedChanges && !isLocked && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void saveLineItems()} disabled={isSaving || isSubmitting}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
