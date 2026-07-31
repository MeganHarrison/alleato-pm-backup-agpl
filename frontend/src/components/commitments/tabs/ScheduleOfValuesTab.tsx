"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { Text } from "@/components/ds/text";
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
import { SectionRuleHeading } from "@/components/layout";
import { SectionHeader, EmptyState } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { MoneyField } from "@/components/forms/MoneyField";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { BudgetCodeCreateDialog } from "@/components/budget/budget-code-create-dialog";
import type { BudgetCodeOption } from "@/components/domain/change-events/change-event-form/types";
import {
  budgetCodeTextValue,
  normalizeBudgetCodesForSelector,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";
import type { CommitmentSovLockState } from "@/lib/commitments/commitment-sov-lock";

interface LineItem {
  id: string;
  line_number?: number | null;
  budget_code?: string | null;
  project_budget_code_id?: string | null;
  description?: string | null;
  amount?: number | null;
  billed_to_date?: number | null;
  quantity?: number | null;
  uom?: string | null;
  unit_cost?: number | null;
  isNew?: boolean;
  isDirty?: boolean;
}

interface CommitmentSovSummary {
  subtotal: number;
  originalContract: number;
  approvedChanges: number;
  contractTotal: number;
  billedToDate: number;
  amountRemaining: number;
  currentRetainage: number;
  retainagePercent?: number;
}

interface ScheduleOfValuesTabProps {
  lineItems: LineItem[];
  projectId: number;
  commitmentId: string;
  commitmentType?: "subcontract" | "purchase_order" | string;
  accountingMethod?: "amount" | "unit" | "percent";
  summary?: CommitmentSovSummary;
  showHeader?: boolean;
  /**
   * Commitment status. Preserved for compatibility with older callers, but
   * `lockState` is the source of truth for editability.
   */
  status?: string | null;
  lockState?: CommitmentSovLockState | null;
  onImportComplete?: () => void | Promise<void>;
  onLineItemsChange?: (items: LineItem[]) => void;
  isLoading?: boolean;
  error?: string | null;
}

interface SaveLineItemsResponse {
  message?: string;
}

interface ImportLineItemsResponse {
  message?: string;
}

export function ScheduleOfValuesTab({
  lineItems,
  projectId,
  commitmentId,
  commitmentType,
  accountingMethod = "amount",
  showHeader = true,
  status,
  lockState,
  onImportComplete,
  onLineItemsChange,
  isLoading = false,
  error = null,
}: ScheduleOfValuesTabProps) {
  const [items, setItems] = useState<LineItem[]>(lineItems);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [budgetCodes, setBudgetCodes] = useState<BudgetCodeOption[]>([]);
  const [budgetCodesLoading, setBudgetCodesLoading] = useState(false);
  const [showCreateBudgetCode, setShowCreateBudgetCode] = useState(false);
  const [activeBudgetCodeRowId, setActiveBudgetCodeRowId] = useState<string | null>(null);

  const isApprovedStatus = (status ?? "").trim().toLowerCase() === "approved";
  const baseLockState = lockState ?? {
    locked: false,
    reason: null,
    message: null,
  };
  const approvedStatusMessage =
    "Schedule of Values is locked for approved contracts.";
  const resolvedLockState = isApprovedStatus
    ? {
        locked: true,
        reason: baseLockState.reason ?? "approved_commitment",
        message: approvedStatusMessage,
      }
    : baseLockState;
  const canEdit = !resolvedLockState.locked;
  const lockMessage =
    resolvedLockState.message ??
    "This schedule of values is locked.";

  const fetchBudgetCodes = useCallback(async () => {
    setBudgetCodesLoading(true);
    try {
      const payload = await apiFetch<{
        budgetCodes?: Array<Partial<BudgetCodeOption> & { id: string; code: string }>;
        data?: Array<Partial<BudgetCodeOption> & { id: string; code: string }>;
      }>(`/api/projects/${projectId}/budget-codes`);
      setBudgetCodes(
        normalizeBudgetCodesForSelector(payload.budgetCodes || payload.data || []),
      );
    } catch (budgetCodeError) {
      toast.error("Could not load budget codes", {
        description:
          budgetCodeError instanceof Error && budgetCodeError.message
            ? budgetCodeError.message
            : "Schedule of values lines cannot select budget codes.",
      });
      setBudgetCodes([]);
    } finally {
      setBudgetCodesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchBudgetCodes();
  }, [fetchBudgetCodes]);

  useEffect(() => {
    setItems(lineItems);
    setHasUnsavedChanges(false);
  }, [lineItems]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const amount = Number(item.amount ?? 0);
          const billed = Number(item.billed_to_date ?? 0);

          return {
            amount: acc.amount + amount,
            billed: acc.billed + billed,
          };
        },
        { amount: 0, billed: 0 },
      ),
    [items],
  );

  const amountRemaining = Math.max(totals.amount - totals.billed, 0);
  const handleBudgetCodeCreated = useCallback(
    (created: { id: string; code: string; costType: string | null; costTypeId?: string | null; description: string; fullLabel: string }) => {
      const normalized = normalizeBudgetCodesForSelector([created])[0];
      setBudgetCodes((prev) => [...prev, normalized]);
      const targetId = activeBudgetCodeRowId;
      if (targetId) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  budget_code: budgetCodeTextValue(normalized),
                  project_budget_code_id: normalized.id,
                  isDirty: true,
                }
              : item,
          ),
        );
        setHasUnsavedChanges(true);
      }
      setActiveBudgetCodeRowId(null);
    },
    [activeBudgetCodeRowId],
  );

  const handleAdd = () => {
    if (!canEdit) return;
    const nextLineNumber = (items[items.length - 1]?.line_number || items.length) + 1;
    setItems([
      ...items,
      {
        id: `temp-${Date.now()}`,
        line_number: nextLineNumber,
        description: "",
        budget_code: "",
        project_budget_code_id: null,
        amount: 0,
        billed_to_date: 0,
        isNew: true,
        isDirty: true,
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const isLocked = (item: LineItem) => Number(item.billed_to_date ?? 0) > 0;

  const updateItem = (
    id: string,
    field:
      | "budget_code"
      | "project_budget_code_id"
      | "description"
      | "amount"
      | "quantity"
      | "uom"
      | "unit_cost",
    value: string | number | undefined,
  ) => {
    if (!canEdit) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === "amount") {
          // In unit mode, amount is computed — not directly editable
          if (accountingMethod === "unit") return item;
          if (isLocked(item)) return item;
          return { ...item, amount: value === undefined ? null : Number(value), isDirty: true };
        }
        if (field === "quantity" || field === "unit_cost") {
          if (isLocked(item)) return item;
          const numValue = value === undefined || value === "" ? null : Number(value);
          const updatedItem = { ...item, [field]: numValue, isDirty: true };
          // Auto-calculate amount when in unit mode
          if (accountingMethod === "unit") {
            const qty = field === "quantity" ? numValue : (item.quantity ?? null);
            const unitCost = field === "unit_cost" ? numValue : (item.unit_cost ?? null);
            updatedItem.amount = qty !== null && unitCost !== null ? qty * unitCost : null;
          }
          return updatedItem;
        }
        return { ...item, [field]: typeof value === "string" ? value : "", isDirty: true };
      }),
    );
    setHasUnsavedChanges(true);
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && isLocked(target)) {
        toast.error("Cannot delete an invoiced SOV line. Remove the invoice first.");
        return prev;
      }
      return prev.filter((item) => item.id !== id);
    });
    setHasUnsavedChanges(true);
  };

  // Save all changes to the API
  const handleSave = useCallback(async () => {
    if (!projectId || !commitmentId) {
      toast.error("Missing project or commitment details.");
      return;
    }

    setIsSaving(true);
    try {
      // Determine the table based on commitment type
      const isSubcontract = commitmentType === "subcontract";
      const tableName = isSubcontract ? "subcontract_sov_items" : "purchase_order_sov_items";
      const fkColumn = isSubcontract ? "subcontract_id" : "purchase_order_id";

      const payload = await apiFetch<SaveLineItemsResponse>(
        `/api/projects/${projectId}/commitments/${commitmentId}/line-items`,
        {
          method: "PUT",
          body: JSON.stringify({
            lineItems: items.map((item) => ({
              id: item.id.startsWith("temp-") ? undefined : item.id,
              line_number: item.line_number,
              budget_code: item.budget_code,
              project_budget_code_id: item.project_budget_code_id ?? null,
              description: item.description,
              amount: item.amount,
              billed_to_date: item.billed_to_date,
              quantity: item.quantity,
              uom: item.uom,
              unit_cost: item.unit_cost,
            })),
            commitmentType,
          }),
        },
      );

      toast.success(payload?.message || "Line items saved successfully.");
      setHasUnsavedChanges(false);

      // Notify parent to refresh data
      if (onImportComplete) {
        await onImportComplete();
      }
      if (onLineItemsChange) {
        onLineItemsChange(items);
      }
    } catch (saveError) {
      toast.error(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : "Unable to save line items.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [commitmentId, commitmentType, items, onImportComplete, onLineItemsChange, projectId]);

  const handleImport = useCallback(async () => {
    if (!projectId || !commitmentId) {
      toast.error("Missing project or commitment details.");
      return;
    }

    const confirmed = confirm(
      "Import all budget line items into this commitment's schedule of values?",
    );
    if (!confirmed) return;

    setIsImporting(true);
    try {
      const payload = await apiFetch<ImportLineItemsResponse>(
        `/api/projects/${projectId}/commitments/${commitmentId}/line-items/import`,
        {
          method: "POST",
          body: JSON.stringify({ source: "budget" }),
        },
      );

      toast.success(
        payload?.message || "Budget line items imported successfully.",
      );
      if (onImportComplete) {
        await onImportComplete();
      }
    } catch (importError) {
      toast.error("Unable to import schedule of values from budget.");
    } finally {
      setIsImporting(false);
    }
  }, [commitmentId, onImportComplete, projectId]);

  const moveItem = (id: string, direction: "up" | "down") => {
    if (!canEdit) return;
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newItems = [...prev];
      const [removed] = newItems.splice(index, 1);
      newItems.splice(targetIndex, 0, removed);

      return newItems.map((item, idx) => ({
        ...item,
        line_number: idx + 1,
      }));
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showHeader ? <SectionHeader title="Schedule of Values" /> : null}
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {showHeader ? <SectionHeader title="Schedule of Values" /> : null}
        <Text tone="destructive">{error}</Text>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="space-y-4">
        {showHeader ? <SectionHeader title="Schedule of Values" /> : null}
        <EmptyState
          title="No SOV line items for this commitment"
          description={
            canEdit
              ? "Add line items manually or import them from the budget."
              : resolvedLockState.message ?? "This schedule of values is locked."
          }
          action={
            canEdit ? (
              <Button size="xs" onClick={handleAdd}>
                <Plus />
                Add Line Item
              </Button>
            ) : undefined
          }
        />
        {canEdit ? (
          <div className="flex justify-center -mt-4">
            <Button
              size="xs"
              variant="outline"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import from Budget"}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const totalColumns = accountingMethod === "unit" ? (canEdit ? 10 : 9) : (canEdit ? 7 : 6);
  // Leading columns before the Amount / Billed / Remaining value trio: total
  // columns minus the 3 value columns minus the trailing actions column (edit mode only).
  const totalLabelSpan = totalColumns - 3 - (canEdit ? 1 : 0);

  return (
    <div className="space-y-6">
      {showHeader ? <SectionRuleHeading label="Schedule of Values" className="[&_span]:text-primary" /> : null}
      {!canEdit ? (
        <p className="text-sm italic text-muted-foreground">
          {lockMessage}
        </p>
      ) : null}

      <InlineTable variant={canEdit ? "edit" : "read"}>
        <InlineTableHeader>
          <InlineTableHeaderRow>
            <InlineTableHeaderCell className="w-10">#</InlineTableHeaderCell>
            <InlineTableHeaderCell>Budget Code</InlineTableHeaderCell>
            <InlineTableHeaderCell>Description</InlineTableHeaderCell>
            {accountingMethod === "unit" ? (
              <>
                <InlineTableHeaderCell align="right">Qty</InlineTableHeaderCell>
                <InlineTableHeaderCell>UOM</InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">Unit Cost</InlineTableHeaderCell>
              </>
            ) : null}
            <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Billed to Date</InlineTableHeaderCell>
            <InlineTableHeaderCell align="right">Remaining</InlineTableHeaderCell>
            {canEdit ? <InlineTableHeaderCell className="w-px" /> : null}
          </InlineTableHeaderRow>
        </InlineTableHeader>
        <InlineTableBody>
          {items.map((item, index) => {
            const amount = Number(item.amount ?? 0);
            const billed = Number(item.billed_to_date ?? 0);
            const remaining = Math.max(amount - billed, 0);
            const locked = isLocked(item);
            const budgetCodeResolution = resolvePrimeCoBudgetCode(
              item.project_budget_code_id ?? item.budget_code,
              budgetCodes,
            );
            // Fallback so the read-only cell never surfaces a raw id: if the stored
            // project_budget_code_id hasn't resolved (budget codes still loading, or an
            // imported id not yet in the option list), try the human budget_code text.
            const budgetCodeResolved =
              budgetCodeResolution.isMapped || !item.budget_code
                ? budgetCodeResolution
                : resolvePrimeCoBudgetCode(item.budget_code, budgetCodes);
            const storedBudgetCodeText = item.budget_code?.trim() || "";
            const budgetCodeMapped =
              budgetCodeResolved.isMapped || Boolean(storedBudgetCodeText);
            // Read-only cell shows the full "code – description" label (the same
            // string the BudgetCodeSelector shows when picking), not just the code.
            const budgetCodeDisplay = budgetCodeResolved.isMapped
              ? budgetCodeResolved.displayLabel || budgetCodeResolved.displayCode
              : storedBudgetCodeText ||
                (budgetCodesLoading ? "Loading…" : "No budget code");

            return (
              <InlineTableRow key={item.id}>
                <InlineTableCell className="text-muted-foreground text-xs">
                  <div className="flex items-center gap-1">
                    {index + 1}
                    {locked ? (
                      <Lock
                        className="size-3 text-muted-foreground"
                        aria-label="Invoiced — amount locked"
                      />
                    ) : null}
                  </div>
                </InlineTableCell>
                <InlineTableCell className="whitespace-nowrap min-w-50">
                  {canEdit ? (
                    <BudgetCodeSelector
                      value={budgetCodeResolution.selectorValue}
                      onValueChange={(value, code) => {
                        updateItem(item.id, "project_budget_code_id", value);
                        updateItem(item.id, "budget_code", budgetCodeTextValue(code));
                      }}
                      onCreateNew={
                        !locked
                          ? () => {
                              setActiveBudgetCodeRowId(item.id);
                              setShowCreateBudgetCode(true);
                            }
                          : undefined
                      }
                      budgetCodes={budgetCodes}
                      loading={budgetCodesLoading}
                      disabled={budgetCodesLoading || locked}
                      placeholder={
                        budgetCodeResolution.isMapped
                          ? "Select budget code..."
                          : budgetCodeResolution.displayCode
                      }
                      error={!budgetCodeResolution.isMapped}
                      className="min-w-56"
                    />
                  ) : (
                    <div
                      className={
                        budgetCodeMapped
                          ? "text-sm text-foreground"
                          : "text-sm font-medium text-destructive"
                      }
                      title={
                        budgetCodeResolved.isMapped
                          ? budgetCodeResolved.displayLabel
                          : budgetCodeDisplay
                      }
                    >
                      {budgetCodeDisplay || "—"}
                    </div>
                  )}
                </InlineTableCell>
                <InlineTableCell className="min-w-50">
                  {canEdit ? (
                    <Input
                      aria-label={`Description ${index + 1}`}
                      value={item.description ?? ""}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      disabled={locked}
                    />
                  ) : (
                    <div className="text-sm leading-6 text-foreground">
                      {item.description || "—"}
                    </div>
                  )}
                </InlineTableCell>
                {accountingMethod === "unit" ? (
                  <>
                    <InlineTableCell align="right">
                      {canEdit ? (
                        <NumberInput
                          min={0}
                          step="0.01"
                          className="text-right w-24 ml-auto"
                          aria-label={`Quantity ${index + 1}`}
                          value={item.quantity ?? ""}
                          onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                          disabled={locked}
                        />
                      ) : (
                        <span className="text-sm tabular-nums text-foreground">
                          {item.quantity ?? "—"}
                        </span>
                      )}
                    </InlineTableCell>
                    <InlineTableCell>
                      {canEdit ? (
                        <Input
                          aria-label={`UOM ${index + 1}`}
                          value={item.uom ?? ""}
                          onChange={(e) => updateItem(item.id, "uom", e.target.value)}
                          disabled={locked}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {item.uom || "—"}
                        </span>
                      )}
                    </InlineTableCell>
                    <InlineTableCell align="right">
                      {canEdit ? (
                        <MoneyField
                          label={`Unit cost ${index + 1}`}
                          inline
                          showCurrency={false}
                          value={item.unit_cost ?? undefined}
                          onChange={(value) => updateItem(item.id, "unit_cost", value)}
                          disabled={locked}
                        />
                      ) : (
                        <span className="text-sm tabular-nums text-foreground">
                          {formatCurrency(item.unit_cost ?? 0)}
                        </span>
                      )}
                    </InlineTableCell>
                  </>
                ) : null}
                <InlineTableCell align="right" numeric>
                  {!canEdit || accountingMethod === "unit" ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(Number(item.amount ?? 0))}
                    </span>
                  ) : (
                    <MoneyField
                      label={`Amount ${index + 1}`}
                      inline
                      showCurrency={false}
                      value={item.amount ?? undefined}
                      onChange={(value) => updateItem(item.id, "amount", value)}
                      disabled={locked}
                    />
                  )}
                </InlineTableCell>
                <InlineTableCell align="right" numeric className="text-muted-foreground">
                  {formatCurrency(billed)}
                </InlineTableCell>
                <InlineTableCell align="right" numeric>
                  {formatCurrency(remaining)}
                </InlineTableCell>
                {canEdit ? (
                  <InlineTableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move line ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => moveItem(item.id, "up")}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move line ${index + 1} down`}
                        disabled={index === items.length - 1}
                        onClick={() => moveItem(item.id, "down")}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete line ${index + 1}`}
                        onClick={() => handleDelete(item.id)}
                        disabled={locked}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </InlineTableCell>
                ) : null}
              </InlineTableRow>
            );
          })}
        </InlineTableBody>
        <InlineTableFooter>
            <InlineTableFooterRow type="totals">
              <InlineTableFooterCell
                align="right"
                colSpan={totalLabelSpan}
                className="text-muted-foreground"
              >
                Total
              </InlineTableFooterCell>
            <InlineTableFooterCell align="right" numeric>{formatCurrency(totals.amount)}</InlineTableFooterCell>
            <InlineTableFooterCell align="right" numeric>{formatCurrency(totals.billed)}</InlineTableFooterCell>
            <InlineTableFooterCell align="right" numeric>{formatCurrency(amountRemaining)}</InlineTableFooterCell>
            {canEdit ? <InlineTableFooterCell /> : null}
          </InlineTableFooterRow>
        </InlineTableFooter>
      </InlineTable>

      {/* Actions below table, left-aligned */}
      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="xs"
            onClick={handleAdd}
            disabled={isSaving}
          >
            <Plus />
            Add Line Item
          </Button>
          <Button
            size="xs"
            variant="link"
            onClick={handleImport}
            disabled={isImporting || isSaving}
            className="px-0"
          >
            {isImporting ? "Importing..." : "Import from Budget"}
          </Button>
          {hasUnsavedChanges && (
            <Button
              size="xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      ) : null}

      <BudgetCodeCreateDialog
        open={showCreateBudgetCode}
        onOpenChange={(next) => {
          setShowCreateBudgetCode(next);
          if (!next) setActiveBudgetCodeRowId(null);
        }}
        projectId={projectId}
        onCreated={handleBudgetCodeCreated}
      />
    </div>
  );
}
