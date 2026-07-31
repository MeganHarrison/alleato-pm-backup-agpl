"use client";

import { useEffect, useMemo, useState } from "react";
import { BaseSidebar, SidebarBody, SidebarFooter } from "./BaseSidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { DateField, MoneyField, SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Plus, Trash2 } from "lucide-react";
import { budgetRadioCardClass } from "./style-tokens";
import { NumberInput } from "@/components/ui/number-input";
import { format } from "date-fns";

type ForecastMethod =
  | "automatic"
  | "lump_sum"
  | "manual"
  | "monitored_resources";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ForecastEditorLineItem {
  id: string;
  description: string;
  quantity: number;
  units: string;
  unitCost: number;
  utilizationRate: number | null;
  startDate: string | null;
  endDate: string | null;
  unitsRemainingMode: "weeks" | "months";
  sortOrder: number;
}

interface ForecastToCompleteModalProps {
  open: boolean;
  onClose: () => void;
  budgetLineId: string;
  projectId: string;
  costCode?: string;
  currentData?: {
    forecastMethod: ForecastMethod;
    forecastAmount?: number;
    projectedBudget?: number;
    projectedCosts?: number;
    notes?: string;
  };
  onSave: (data: {
    budgetLineId: string;
    forecastMethod: string;
    forecastAmount: number;
    notes?: string | null;
    lineItems?: Array<{
      id?: string;
      description: string;
      quantity: number;
      units: string;
      unitCost: number;
      utilizationRate?: number | null;
      startDate?: string | null;
      endDate?: string | null;
      unitsRemainingMode?: "weeks" | "months";
      sortOrder?: number;
    }>;
  }) => Promise<void>;
}

const METHODS = [
  {
    value: "automatic" as const,
    label: "Automatic Calculation",
    description: "Projected Budget - Projected Costs.",
  },
  {
    value: "lump_sum" as const,
    label: "Lump Sum Entry",
    description: "Fixed amount to complete.",
  },
  {
    value: "manual" as const,
    label: "Manual Entry",
    description: "Build forecast from editable line items.",
  },
  {
    value: "monitored_resources" as const,
    label: "Monitored Resources",
    description: "Track time-phased resources with drawdown.",
  },
];

const UNITS_REMAINING_OPTIONS = [
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

// Creates a stable default manual-entry row.
function createDefaultManualRow(index: number): ForecastEditorLineItem {
  return {
    id: `manual-${Date.now()}-${index}`,
    description: "",
    quantity: 1,
    units: "ls",
    unitCost: 0,
    utilizationRate: null,
    startDate: null,
    endDate: null,
    unitsRemainingMode: "weeks",
    sortOrder: index,
  };
}

// Creates a stable default monitored-resource row.
function createDefaultMonitoredRow(index: number): ForecastEditorLineItem {
  return {
    id: `monitored-${Date.now()}-${index}`,
    description: "",
    quantity: 1,
    units: "weeks",
    unitCost: 0,
    utilizationRate: 100,
    startDate: null,
    endDate: null,
    unitsRemainingMode: "weeks",
    sortOrder: index,
  };
}

// Calculates monitored units remaining using non-prorated bucket logic.
function computeUnitsRemaining(
  startDate: string | null,
  endDate: string | null,
  mode: "weeks" | "months",
): number {
  if (!startDate || !endDate) {
    return 1;
  }
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 1;
  }

  const today = new Date();
  if (mode === "months") {
    const totalMonths =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth()) +
      1;
    const elapsedMonths =
      today <= start
        ? 0
        : (today.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          (today.getUTCMonth() - start.getUTCMonth());
    return Math.max(0, totalMonths - Math.max(0, elapsedMonths));
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const dayCount = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  const totalWeeks = Math.max(1, Math.ceil(dayCount / 7));
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsedWeeks =
    today <= start ? 0 : Math.floor((today.getTime() - start.getTime()) / msPerWeek);
  return Math.max(0, totalWeeks - Math.max(0, elapsedWeeks));
}

function parseStoredDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatStoredDate(value: Date | undefined): string | null {
  if (!value) return null;
  return format(value, "yyyy-MM-dd");
}

// Builds a signature string for robust unsaved-changes detection.
function buildStateSignature(state: {
  forecastMethod: ForecastMethod;
  forecastAmount: string;
  forecastNotes: string;
  lineItems: ForecastEditorLineItem[];
}): string {
  return JSON.stringify({
    forecastMethod: state.forecastMethod,
    forecastAmount: state.forecastAmount,
    forecastNotes: state.forecastNotes,
    lineItems: state.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      units: item.units,
      unitCost: item.unitCost,
      utilizationRate: item.utilizationRate,
      startDate: item.startDate,
      endDate: item.endDate,
      unitsRemainingMode: item.unitsRemainingMode,
      sortOrder: item.sortOrder,
    })),
  });
}

// Renders method-specific forecast editors and persists FTC data for one budget line.
export function ForecastToCompleteModal({
  open,
  onClose,
  budgetLineId,
  projectId,
  currentData,
  onSave,
}: ForecastToCompleteModalProps) {
  const [activeTab, setActiveTab] = useState("forecast");
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod>("automatic");
  const [forecastAmount, setForecastAmount] = useState<string>("");
  const [forecastNotes, setForecastNotes] = useState("");
  const [lineItems, setLineItems] = useState<ForecastEditorLineItem[]>([]);
  const [initialSignature, setInitialSignature] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFocusRowId, setPendingFocusRowId] = useState<string | null>(null);

  const projectedBudget = currentData?.projectedBudget || 0;
  const projectedCosts = currentData?.projectedCosts || 0;

  // Computes the working FTC amount from selected method and editor rows.
  const calculatedForecast = useMemo(() => {
    if (forecastMethod === "automatic") {
      return Math.max(0, projectedBudget - projectedCosts);
    }

    if (forecastMethod === "manual") {
      return lineItems.reduce(
        (sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitCost),
        0,
      );
    }

    if (forecastMethod === "monitored_resources") {
      return lineItems.reduce((sum, item) => {
        const unitsRemaining = computeUnitsRemaining(
          item.startDate,
          item.endDate,
          item.unitsRemainingMode,
        );
        const utilization = item.utilizationRate == null ? 100 : item.utilizationRate;
        const calculatedUnitCost = Math.max(0, item.unitCost) * (Math.max(0, utilization) / 100);
        return sum + calculatedUnitCost * unitsRemaining;
      }, 0);
    }

    return parseFloat(forecastAmount) || 0;
  }, [forecastMethod, forecastAmount, lineItems, projectedBudget, projectedCosts]);

  const estimatedCostAtCompletion = projectedCosts + calculatedForecast;
  const projectedOverUnder = projectedBudget - estimatedCostAtCompletion;

  // Loads latest saved forecast details for this line.
  const loadForecastDetail = async () => {
    setIsLoading(true);
    try {
      const detail = await apiFetch<{
        forecastMethod?: ForecastMethod;
        forecastAmount?: number;
        notes?: string | null;
        lineItems?: Array<{
          id?: string;
          description?: string;
          quantity?: number;
          units?: string | null;
          unitCost?: number;
          utilizationRate?: number | null;
          startDate?: string | null;
          endDate?: string | null;
          unitsRemainingMode?: "weeks" | "months" | null;
          sortOrder?: number;
        }>;
      }>(
        `/api/projects/${projectId}/budget/forecast?budgetLineId=${budgetLineId}`,
      );

      const method = detail.forecastMethod ?? currentData?.forecastMethod ?? "automatic";
      const amount =
        typeof detail.forecastAmount === "number"
          ? detail.forecastAmount
          : (currentData?.forecastAmount ?? 0);
      const normalizedRows = (detail.lineItems || []).map((item, index) => ({
        id: item.id || `loaded-${index}-${Date.now()}`,
        description: item.description || "",
        quantity: Number(item.quantity ?? 1),
        units: item.units || (method === "manual" ? "ls" : "weeks"),
        unitCost: Number(item.unitCost ?? 0),
        utilizationRate: item.utilizationRate ?? (method === "monitored_resources" ? 100 : null),
        startDate: item.startDate ?? null,
        endDate: item.endDate ?? null,
        unitsRemainingMode: item.unitsRemainingMode ?? "weeks",
        sortOrder: item.sortOrder ?? index,
      }));

      setForecastMethod(method);
      setForecastAmount(String(amount));
      setForecastNotes(detail.notes ?? currentData?.notes ?? "");
      setLineItems(normalizedRows);
      setActiveTab("forecast");
      setInitialSignature(
        buildStateSignature({
          forecastMethod: method,
          forecastAmount: String(amount),
          forecastNotes: detail.notes ?? currentData?.notes ?? "",
          lineItems: normalizedRows,
        }),
      );
    } catch {
      const fallbackMethod = currentData?.forecastMethod ?? "automatic";
      const fallbackAmount = String(currentData?.forecastAmount ?? 0);
      const fallbackNotes = currentData?.notes ?? "";
      setForecastMethod(fallbackMethod);
      setForecastAmount(fallbackAmount);
      setForecastNotes(fallbackNotes);
      setLineItems([]);
      setInitialSignature(
        buildStateSignature({
          forecastMethod: fallbackMethod,
          forecastAmount: fallbackAmount,
          forecastNotes: fallbackNotes,
          lineItems: [],
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadForecastDetail();
    }
  }, [open, budgetLineId, projectId]);

  // Syncs editor rows when the method switches to a line-item mode.
  useEffect(() => {
    if (forecastMethod === "manual" && lineItems.length === 0) {
      setLineItems([createDefaultManualRow(0)]);
    }
    if (forecastMethod === "monitored_resources" && lineItems.length === 0) {
      setLineItems([createDefaultMonitoredRow(0)]);
    }
    if (forecastMethod === "lump_sum" && !forecastAmount) {
      setForecastAmount("0");
    }
  }, [forecastMethod, lineItems.length, forecastAmount]);

  useEffect(() => {
    if (!pendingFocusRowId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLInputElement>(
        `[data-forecast-description="${pendingFocusRowId}"]`,
      );
      target?.focus();
      target?.select();
      setPendingFocusRowId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [lineItems, pendingFocusRowId]);

  const hasChanges =
    buildStateSignature({
      forecastMethod,
      forecastAmount,
      forecastNotes,
      lineItems,
    }) !== initialSignature;

  // Updates one line-item field while preserving list order.
  const updateLineItem = (
    id: string,
    updates: Partial<ForecastEditorLineItem>,
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  // Removes one line-item row and keeps at least one row in line-item modes.
  const removeLineItem = (id: string) => {
    setLineItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length > 0) {
        return next.map((item, index) => ({ ...item, sortOrder: index }));
      }
      if (forecastMethod === "manual") {
        return [createDefaultManualRow(0)];
      }
      if (forecastMethod === "monitored_resources") {
        return [createDefaultMonitoredRow(0)];
      }
      return [];
    });
  };

  // Adds a new line-item row for manual or monitored forecasting.
  const addLineItem = () => {
    setLineItems((prev) => {
      const index = prev.length;
      const next =
        forecastMethod === "manual"
          ? createDefaultManualRow(index)
          : createDefaultMonitoredRow(index);
      setPendingFocusRowId(next.id);
      return [...prev, next];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        budgetLineId,
        forecastMethod,
        forecastAmount: calculatedForecast,
        notes: forecastNotes.trim() || null,
        lineItems:
          forecastMethod === "manual" || forecastMethod === "monitored_resources"
            ? lineItems.map((item, index) => ({
                id: UUID_REGEX.test(item.id) ? item.id : undefined,
                description: item.description,
                quantity: item.quantity,
                units: item.units,
                unitCost: item.unitCost,
                utilizationRate:
                  forecastMethod === "monitored_resources"
                    ? item.utilizationRate
                    : null,
                startDate:
                  forecastMethod === "monitored_resources" ? item.startDate : null,
                endDate:
                  forecastMethod === "monitored_resources" ? item.endDate : null,
                unitsRemainingMode:
                  forecastMethod === "monitored_resources"
                    ? item.unitsRemainingMode
                    : undefined,
                sortOrder: index,
              }))
            : [],
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    if (confirm("You have unsaved changes. Are you sure you want to close?")) {
      onClose();
    }
  };

  // Formats currency consistently for the forecast panel.
  const formatCurrency = (value: number): string => {
    const isNegative = value < 0;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return isNegative ? `($${formatted})` : `$${formatted}`;
  };

  return (
    <BaseSidebar open={open} onClose={handleClose} title="Forecast To Complete" size="lg">
      {/* Single view — no tabs. A "History" tab existed but led to a
          "coming soon" placeholder (noise-gate rule 18: no destination →
          no affordance). Restore tabs only when history ships. */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <SidebarBody>
          <TabsContent value="forecast" className="space-y-6 px-4 py-4 sm:px-6">
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Forecast context
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Projected Budget</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(projectedBudget)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Projected Costs</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(projectedCosts)}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  Forecast Method
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose how this line should forecast to complete.
                </p>
              </div>
              <RadioGroup
                value={forecastMethod}
                onValueChange={(value) => setForecastMethod(value as ForecastMethod)}
                className="grid gap-3 sm:grid-cols-2"
                disabled={isLoading}
              >
                {METHODS.map((method) => (
                  <label
                    key={method.value}
                    htmlFor={method.value}
                    className={budgetRadioCardClass(forecastMethod === method.value)}
                  >
                    <RadioGroupItem value={method.value} id={method.value} />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-medium text-foreground">
                        {method.label}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {method.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </section>

            {forecastMethod === "lump_sum" && (
              <section className="space-y-2">
                <Label htmlFor="forecastAmount" className="text-sm font-medium text-foreground">
                  Forecast Amount
                </Label>
                <MoneyField
                  label="Forecast Amount"
                  value={forecastAmount ? parseFloat(forecastAmount) : undefined}
                  onChange={(value) => setForecastAmount(String(value ?? ""))}
                  placeholder=""
                  inline
                  showCurrency={false}
                />
              </section>
            )}

            {(forecastMethod === "manual" || forecastMethod === "monitored_resources") && (
              <section className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">
                    {forecastMethod === "manual"
                      ? "Manual Forecast Line Items"
                      : "Monitored Resource Line Items"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {forecastMethod === "manual"
                      ? "Add the remaining scope that still needs to be completed."
                      : "Track remaining time-phased work and its drawdown."}
                  </p>
                </div>

                <div className="overflow-hidden rounded-md border border-border/60">
                  {lineItems.map((item) => {
                    const unitsRemaining = computeUnitsRemaining(
                      item.startDate,
                      item.endDate,
                      item.unitsRemainingMode,
                    );
                    const utilization = item.utilizationRate == null ? 100 : item.utilizationRate;
                    const calculatedUnitCost = item.unitCost * (utilization / 100);
                    const monitoredAmount = calculatedUnitCost * unitsRemaining;
                    const manualAmount = item.quantity * item.unitCost;
                    const rowAmount =
                      forecastMethod === "monitored_resources"
                        ? monitoredAmount
                        : manualAmount;

                    return (
                      <div
                        key={item.id}
                        className="space-y-3 border-b border-border/60 px-3 py-3 last:border-b-0 sm:px-4"
                      >
                        <div className="grid grid-cols-12 gap-2">
                          <Input
                            data-forecast-description={item.id}
                            className="col-span-12 md:col-span-4"
                            placeholder="Description"
                            value={item.description}
                            onChange={(event) =>
                              updateLineItem(item.id, { description: event.target.value })
                            }
                          />

                          {forecastMethod === "manual" ? (
                            <>
                              <NumberInput
                                className="col-span-4 md:col-span-2"
                                placeholder="Qty"
                                value={String(item.quantity)}
                                onChange={(event) =>
                                  updateLineItem(item.id, {
                                    quantity: Math.max(0, Number(event.target.value) || 0),
                                  })
                                }
                                decimals={0}
                                aria-label={`Quantity for ${item.description || "forecast line item"}`}
                              />
                              <Input
                                className="col-span-4 md:col-span-2"
                                placeholder="Units"
                                value={item.units}
                                onChange={(event) =>
                                  updateLineItem(item.id, { units: event.target.value })
                                }
                              />
                              <MoneyField
                                className="col-span-4 md:col-span-2"
                                label={`Unit cost for ${item.description || "forecast line item"}`}
                                value={item.unitCost}
                                onChange={(value) =>
                                  updateLineItem(item.id, {
                                    unitCost: Math.max(0, value ?? 0),
                                  })
                                }
                                inline
                                showCurrency={false}
                              />
                            </>
                          ) : (
                            <>
                              <DateField
                                className="col-span-6 md:col-span-2"
                                label="Start date"
                                hideLabel
                                value={parseStoredDate(item.startDate)}
                                onChange={(value) =>
                                  updateLineItem(item.id, {
                                    startDate: formatStoredDate(value),
                                  })
                                }
                                placeholder="Start date"
                              />
                              <DateField
                                className="col-span-6 md:col-span-2"
                                label="End date"
                                hideLabel
                                value={parseStoredDate(item.endDate)}
                                onChange={(value) =>
                                  updateLineItem(item.id, {
                                    endDate: formatStoredDate(value),
                                  })
                                }
                                placeholder="End date"
                              />
                              <SelectField
                                className="col-span-4 md:col-span-2"
                                label="Units remaining mode"
                                hideLabel
                                options={UNITS_REMAINING_OPTIONS}
                                value={item.unitsRemainingMode}
                                onValueChange={(value) =>
                                  updateLineItem(item.id, {
                                    unitsRemainingMode: value as "weeks" | "months",
                                    units: value,
                                  })
                                }
                                placeholder="Units"
                              />
                              <NumberInput
                                className="col-span-4 md:col-span-1"
                                placeholder="%"
                                value={String(item.utilizationRate ?? 100)}
                                onChange={(event) =>
                                  updateLineItem(item.id, {
                                    utilizationRate: Math.max(
                                      0,
                                      Math.min(100, Number(event.target.value) || 0),
                                    ),
                                  })
                                }
                                decimals={0}
                                aria-label={`Utilization rate for ${item.description || "forecast line item"}`}
                              />
                              <MoneyField
                                className="col-span-4 md:col-span-1"
                                label={`Unit cost for ${item.description || "forecast line item"}`}
                                value={item.unitCost}
                                onChange={(value) =>
                                  updateLineItem(item.id, {
                                    unitCost: Math.max(0, value ?? 0),
                                  })
                                }
                                inline
                                showCurrency={false}
                              />
                              <div className="col-span-12 md:col-span-2 text-xs text-muted-foreground flex items-center">
                                {unitsRemaining} units remaining
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-muted-foreground">
                            Line Total{" "}
                            <span className="ml-2 font-semibold text-foreground">
                              {formatCurrency(rowAmount)}
                            </span>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Line Item
                </Button>
              </section>
            )}

            <section className="space-y-2">
              <Label htmlFor="forecastNotes" className="text-sm font-medium text-foreground">
                Notes
              </Label>
              <Textarea
                id="forecastNotes"
                value={forecastNotes}
                onChange={(event) => setForecastNotes(event.target.value)}
                className="mt-1 min-h-24"
                placeholder="Add context for this forecast."
              />
            </section>

            <section className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Forecast impact</p>
                <p className="text-sm text-muted-foreground">
                  Review the resulting total before saving.
                </p>
              </div>
              <div className="overflow-hidden rounded-md border border-border/60">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Forecast To Complete</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(calculatedForecast)}
                  </span>
                </div>
                <div className="border-t border-border/60" />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Est. Cost at Completion</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(estimatedCostAtCompletion)}
                  </span>
                </div>
                <div className="border-t border-border/60" />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Projected Over / Under</span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      projectedOverUnder < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatCurrency(projectedOverUnder)}
                  </span>
                </div>
              </div>
            </section>
          </TabsContent>
        </SidebarBody>
      </Tabs>

      <SidebarFooter>
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          {activeTab === "forecast" && (
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading || !hasChanges}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </SidebarFooter>
    </BaseSidebar>
  );
}
