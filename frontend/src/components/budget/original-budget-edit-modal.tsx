"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { MoneyField } from "@/components/forms/MoneyField";
import { EmptyState, ErrorState } from "@/components/ds";
import { History, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "@/lib/api-client";
import {
  BaseSidebar,
  SidebarBody,
} from "@/components/budget/modals/BaseSidebar";
import {
  budgetRadioCardClass,
} from "@/components/budget/modals/style-tokens";
import { UNITS_OF_MEASURE, normalizeUomCode } from "@/constants/budget";

interface HistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: {
    id: string;
    email: string;
    name: string;
  };
  changed_at: string;
  change_type: "create" | "update" | "delete";
  notes: string | null;
}

interface OriginalBudgetEditModalProps {
  open: boolean;
  onClose: () => void;
  lineItem: {
    id: string;
    description: string;
    costCode: string;
    originalBudgetAmount: number;
    unitQty?: number;
    uom?: string;
    unitCost?: number;
    children?: unknown[]; // Indicates if this is a parent/aggregated row
  };
  projectId: string;
  onSave?: (data: {
    unitQty: number;
    uom: string;
    unitCost: number;
    originalBudget: number;
  }) => void | Promise<void>;
}

type CalculationMethod = "manual" | "calculated";

function getInitialCalculationMethod(lineItem: {
  unitQty?: number;
  uom?: string;
  unitCost?: number;
}): CalculationMethod {
  return lineItem.unitQty != null ||
    lineItem.unitCost != null ||
    Boolean(lineItem.uom?.trim())
    ? "calculated"
    : "manual";
}

function toEditableNumberString(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return value === 0 ? "" : String(value);
}

function parseNumberOrDefault(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function OriginalBudgetEditModal({
  open,
  onClose,
  lineItem,
  projectId,
  onSave,
}: OriginalBudgetEditModalProps) {
  const currentBudgetValue = Number(lineItem?.originalBudgetAmount ?? 0);
  const isAggregatedRow = Boolean(
    lineItem.children && lineItem.children.length > 0,
  );
  const [activeTab, setActiveTab] = useState<"original" | "history">(
    "original",
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [calculationMethod, setCalculationMethod] =
    useState<CalculationMethod>(getInitialCalculationMethod(lineItem));
  const [unitQty, setUnitQty] = useState(toEditableNumberString(lineItem.unitQty));
  const [uom, setUom] = useState(normalizeUomCode(lineItem.uom));
  const [unitCost, setUnitCost] = useState(toEditableNumberString(lineItem.unitCost));
  const [originalBudget, setOriginalBudget] = useState(
    toEditableNumberString(lineItem.originalBudgetAmount),
  );


  const hasChanges =
    parseNumberOrDefault(unitQty, lineItem.unitQty ?? 0) !== (lineItem.unitQty ?? 0) ||
    uom !== normalizeUomCode(lineItem.uom) ||
    parseNumberOrDefault(unitCost, lineItem.unitCost ?? 0) !== (lineItem.unitCost ?? 0) ||
    parseNumberOrDefault(originalBudget, lineItem.originalBudgetAmount) !==
      lineItem.originalBudgetAmount;

  // Calculate original budget when inputs change
  useEffect(() => {
    if (calculationMethod === "calculated") {
      const qty = parseFloat(unitQty);
      const cost = parseFloat(unitCost);
      if (Number.isFinite(qty) && Number.isFinite(cost)) {
        setOriginalBudget((qty * cost).toFixed(2));
      } else {
        setOriginalBudget("");
      }
    }
  }, [unitQty, unitCost, calculationMethod]);

  // Reset form when sidebar opens. `lineItem` is intentionally excluded from the
  // dependency array: the parent creates a new object literal on every render, so
  // including it would reset the user's edits whenever React Query refetches. The
  // component is conditionally rendered only while selectedLineItem is non-null and
  // always unmounts on cancel, so `open` transitioning false→true is the only signal
  // we need.
  useEffect(() => {
    if (open) {
      setCalculationMethod(getInitialCalculationMethod(lineItem));
      setUnitQty(toEditableNumberString(lineItem.unitQty));
      setUom(normalizeUomCode(lineItem.uom));
      setUnitCost(toEditableNumberString(lineItem.unitCost));
      setOriginalBudget(toEditableNumberString(lineItem.originalBudgetAmount));
    }
  }, [open]); // intentionally omit lineItem — see comment above

  // Fetch history when history tab is active
  useEffect(() => {
    if (!open || activeTab !== "history") return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<{ history: HistoryEntry[] }>(
          `/api/projects/${projectId}/budget/lines/${lineItem.id}/history`,
        );
        setHistory(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, activeTab, lineItem.id, projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        unitQty: parseNumberOrDefault(unitQty, 0),
        uom,
        unitCost: parseNumberOrDefault(unitCost, 0),
        originalBudget: parseNumberOrDefault(originalBudget, 0),
      };

      if (onSave) {
        await onSave(data);
      }

      onClose();
    } catch (err) {
      console.error("Failed to save original budget:", err);
      // Intentionally swallowed: onSave callback handles error notifications
    } finally {
      setSaving(false);
    }
  };

  const formatFieldName = (fieldName: string) => {
    const fieldMap: Record<string, string> = {
      quantity: "Unit Qty",
      unit_qty: "Unit Qty",
      unit_cost: "Unit Cost",
      original_budget_amount: "Original Budget",
      originalBudgetAmount: "Original Budget",
      description: "Description",
      uom: "UOM",
      deleted: "Status",
    };
    return fieldMap[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: string | null) => {
    if (value === null || value === "") return "Empty";

    if (
      fieldName === "unit_cost" ||
      fieldName === "original_budget_amount" ||
      fieldName === "originalBudgetAmount"
    ) {
      const num = parseFloat(value);
      return `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (fieldName === "quantity" || fieldName === "unit_qty") {
      const num = parseFloat(value);
      return num.toLocaleString("en-US");
    }

    return value;
  };

  const formatCurrencyDisplay = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "$0.00";
    return `$${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <BaseSidebar
      open={open}
      onClose={onClose}
      title="Original Budget Amount"
      subtitle={lineItem.costCode}
      size="xl"
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "original" | "history")}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="px-4 sm:px-8 pt-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="original">
              Original Budget
            </TabsTrigger>
            <TabsTrigger value="history">
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <SidebarBody className="bg-background">
          <TabsContent value="original" className="m-0">
            <div className="space-y-6 p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Line Item
              </p>
              <p className="text-sm font-semibold text-foreground">
                {lineItem.description}
              </p>
            </div>

            {lineItem.children && lineItem.children.length > 0 && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-4">
                <p className="text-sm font-semibold text-status-warning">
                  Aggregated Budget Line
                </p>
                <p className="mt-1 text-xs text-status-warning">
                  This is a parent row with {lineItem.children.length} child
                  line item{lineItem.children.length !== 1 ? "s" : ""}. Edit a
                  child line item to change Original Budget values.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Budget</span>
              <span className="text-2xl font-semibold text-foreground">
                {currentBudgetValue.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </span>
            </div>

            {!isAggregatedRow && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Calculation Method
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose how this budget line is derived.
                  </p>
                </div>
                <RadioGroup
                  value={calculationMethod}
                  onValueChange={(value) =>
                    setCalculationMethod(value as CalculationMethod)
                  }
                  className="space-y-2"
                >
                  <label
                    htmlFor="budget-calc-manual"
                    className={budgetRadioCardClass(calculationMethod === "manual")}
                  >
                    <RadioGroupItem
                      id="budget-calc-manual"
                      value="manual"
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-foreground">Manual</div>
                      <p className="text-xs text-muted-foreground">
                        Enter a fixed amount directly.
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="budget-calc-calculated"
                    className={budgetRadioCardClass(calculationMethod === "calculated")}
                  >
                    <RadioGroupItem
                      id="budget-calc-calculated"
                      value="calculated"
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-foreground">
                        Calculated
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Qty × Unit Cost = Budget
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {!isAggregatedRow && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label
                      htmlFor="budget-unit-qty"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Unit Qty
                    </Label>
                    <NumberInput
                      id="budget-unit-qty"
                      value={unitQty}
                      onChange={(e) => setUnitQty(e.target.value)}
                      className="mt-1"
                      disabled={calculationMethod === "manual"}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="budget-uom"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      UOM
                    </Label>
                    <Select
                      value={uom || "__none"}
                      onValueChange={(value) =>
                        setUom(value === "__none" ? "" : value)
                      }
                      disabled={calculationMethod === "manual"}
                    >
                      <SelectTrigger id="budget-uom" className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Select</SelectItem>
                        {UNITS_OF_MEASURE.map((option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.code} - {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="budget-unit-cost"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Unit Cost
                    </Label>
                    <MoneyField
                      label="Unit Cost"
                      value={unitCost ? parseFloat(unitCost) : undefined}
                      onChange={(val) => setUnitCost(String(val ?? ""))}
                      placeholder=""
                      inline
                      showCurrency={false}
                      className="mt-1"
                      disabled={calculationMethod === "manual"}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="budget-original-amount"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Original Budget
                    </Label>
                    <MoneyField
                      label="Original Budget"
                      value={originalBudget ? parseFloat(originalBudget) : undefined}
                      onChange={(val) => setOriginalBudget(String(val ?? ""))}
                      placeholder=""
                      inline
                      showCurrency={false}
                      className="mt-1 bg-muted/50 font-semibold"
                      disabled={calculationMethod === "calculated"}
                    />
                  </div>
                </div>

                {calculationMethod === "calculated" && (
                  <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-foreground">
                    <span className="font-medium">Formula:</span>{" "}
                    {unitQty || "0"} × {formatCurrencyDisplay(unitCost)} ={" "}
                    {formatCurrencyDisplay(originalBudget)}
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>
                {isAggregatedRow ? "Close" : "Cancel"}
              </Button>
              {!isAggregatedRow && (
                <Button onClick={handleSave} disabled={saving || !hasChanges}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="m-0">
            <div className="space-y-4 p-6">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && <ErrorState error={error} />}

            {!loading && !error && history.length === 0 && (
              <EmptyState
                icon={<History />}
                title="No history yet"
                description="Changes to this budget line will appear here."
              />
            )}

            {!loading && !error && history.length > 0 && (
              <div className="overflow-hidden">
                <div className="divide-y divide-border">
                  {history.map((entry) => (
                    <div key={entry.id} className="space-y-1 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {entry.changed_by.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.changed_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="text-sm text-foreground">
                        {entry.change_type === "create" && (
                          <>
                            Created {formatFieldName(entry.field_name)}:{" "}
                            <span className="font-medium">
                              {formatValue(entry.field_name, entry.new_value)}
                            </span>
                          </>
                        )}
                        {entry.change_type === "delete" && "Deleted this line item"}
                        {entry.change_type === "update" && (
                          <>
                            Changed {formatFieldName(entry.field_name)} from{" "}
                            <span className="line-through">
                              {formatValue(entry.field_name, entry.old_value)}
                            </span>{" "}
                            to{" "}
                            <span className="font-medium">
                              {formatValue(entry.field_name, entry.new_value)}
                            </span>
                          </>
                        )}
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-muted-foreground">
                          Notes: {entry.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </TabsContent>
        </SidebarBody>
      </Tabs>
    </BaseSidebar>
  );
}
