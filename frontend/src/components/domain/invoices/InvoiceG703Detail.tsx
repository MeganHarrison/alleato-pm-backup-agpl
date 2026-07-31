"use client";

import { useState, useCallback, useMemo } from "react";
import { Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentApplicationLineItem } from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";
import { SectionRuleHeading } from "@/components/layout/spacing";

interface InvoiceG703DetailProps {
  lineItems: PaymentApplicationLineItem[];
  onSave: (items: Partial<PaymentApplicationLineItem>[]) => Promise<void>;
  isReadOnly?: boolean;
  canEditRetainage?: boolean;
  retainageEditBlockReason?: string | null;
}

interface EditableValues {
  [id: string]: {
    work_completed_this_period: number;
    materials_stored: number;
    retainage_this_period_work_pct: number;
    retainage_this_period_work: number;
    retainage_this_period_materials_pct: number;
    retainage_this_period_materials: number;
    retainage_released_work: number;
    retainage_released_materials: number;
  };
}

interface SetRetainageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (workPct: number, materialsPct: number) => void;
}

function SetRetainageDialog({ open, onOpenChange, onApply }: SetRetainageDialogProps) {
  const [workPct, setWorkPct] = useState("0");
  const [materialsPct, setMaterialsPct] = useState("0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Retainage on All Line Items</DialogTitle>
          <DialogDescription>
            Enter percentages to apply to every line item&apos;s work completed and materials stored amounts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-work-pct">Work Completed Retainage (%)</Label>
            <Input
              id="set-work-pct"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={workPct}
              onChange={(e) => setWorkPct(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-mat-pct">Materials Stored Retainage (%)</Label>
            <Input
              id="set-mat-pct"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={materialsPct}
              onChange={(e) => setMaterialsPct(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(parseFloat(workPct) || 0, parseFloat(materialsPct) || 0);
              onOpenChange(false);
            }}
          >
            Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function InvoiceG703Detail({
  lineItems,
  onSave,
  isReadOnly = false,
  canEditRetainage = true,
  retainageEditBlockReason = null,
}: InvoiceG703DetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState<EditableValues>({});
  const [setRetainageOpen, setSetRetainageOpen] = useState(false);

  const handleEdit = useCallback(() => {
    const values: EditableValues = {};
    for (const li of lineItems) {
      values[li.id] = {
        work_completed_this_period: li.work_completed_this_period,
        materials_stored: li.materials_stored,
        retainage_this_period_work_pct: li.retainage_this_period_work_pct,
        retainage_this_period_work: li.retainage_this_period_work,
        retainage_this_period_materials_pct: li.retainage_this_period_materials_pct,
        retainage_this_period_materials: li.retainage_this_period_materials,
        retainage_released_work: li.retainage_released_work,
        retainage_released_materials: li.retainage_released_materials,
      };
    }
    setEditValues(values);
    setIsEditing(true);
  }, [lineItems]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValues({});
  }, []);

  const handleValueChange = useCallback(
    (id: string, field: keyof EditableValues[string], rawValue: string) => {
      const numValue = Number.parseFloat(rawValue);
      const val = Number.isNaN(numValue) ? 0 : numValue;

      setEditValues((prev) => {
        const current = prev[id] ?? {};
        const updated: EditableValues[string] = { ...current, [field]: val };

        // Work retainage $ ↔ %
        if (field === "retainage_this_period_work_pct") {
          const work = current.work_completed_this_period ?? 0;
          updated.retainage_this_period_work = roundCurrency(work * (val / 100));
        } else if (field === "retainage_this_period_work") {
          const work = current.work_completed_this_period ?? 0;
          updated.retainage_this_period_work_pct = work > 0 ? (val / work) * 100 : 0;
        }

        // Materials retainage $ ↔ %
        if (field === "retainage_this_period_materials_pct") {
          const mats = current.materials_stored ?? 0;
          updated.retainage_this_period_materials = roundCurrency(mats * (val / 100));
        } else if (field === "retainage_this_period_materials") {
          const mats = current.materials_stored ?? 0;
          updated.retainage_this_period_materials_pct = mats > 0 ? (val / mats) * 100 : 0;
        }

        return { ...prev, [id]: updated };
      });
    },
    [],
  );

  const getEffectiveValues = useCallback(
    (li: PaymentApplicationLineItem) => {
      const edited = isEditing ? editValues[li.id] : null;
      const workThisPeriod =
        edited?.work_completed_this_period ?? li.work_completed_this_period;
      const materialsStored =
        edited?.materials_stored ?? li.materials_stored;
      const retainageWorkPct =
        edited?.retainage_this_period_work_pct ??
        li.retainage_this_period_work_pct;
      const retainageMaterialsPct =
        edited?.retainage_this_period_materials_pct ??
        li.retainage_this_period_materials_pct;
      const retainageReleasedWork =
        edited?.retainage_released_work ?? li.retainage_released_work;
      const retainageReleasedMaterials =
        edited?.retainage_released_materials ?? li.retainage_released_materials;
      const totalCompleted =
        li.work_completed_previous + workThisPeriod + materialsStored;
      const retainageThisPeriodWork =
        edited?.retainage_this_period_work !== undefined
          ? edited.retainage_this_period_work
          : roundCurrency(workThisPeriod * (retainageWorkPct / 100));
      const retainageThisPeriodMaterials =
        edited?.retainage_this_period_materials !== undefined
          ? edited.retainage_this_period_materials
          : roundCurrency(materialsStored * (retainageMaterialsPct / 100));
      const currentRetainage =
        li.retainage_previous_work +
        li.retainage_previous_materials +
        retainageThisPeriodWork +
        retainageThisPeriodMaterials -
        retainageReleasedWork -
        retainageReleasedMaterials;

      return {
        workThisPeriod,
        materialsStored,
        totalCompleted,
        percentComplete:
          li.scheduled_value > 0
            ? (totalCompleted / li.scheduled_value) * 100
            : 0,
        balanceToFinish: li.scheduled_value - totalCompleted,
        retainageWorkPct,
        retainageMaterialsPct,
        retainageThisPeriodWork,
        retainageThisPeriodMaterials,
        retainageReleasedWork,
        retainageReleasedMaterials,
        currentRetainage,
      };
    },
    [editValues, isEditing],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates = lineItems.map((li) => {
        const effective = getEffectiveValues(li);
        return {
          id: li.id,
          work_completed_this_period: effective.workThisPeriod,
          materials_stored: effective.materialsStored,
          retainage_this_period_work_pct: effective.retainageWorkPct,
          retainage_this_period_work: effective.retainageThisPeriodWork,
          retainage_this_period_materials_pct: effective.retainageMaterialsPct,
          retainage_this_period_materials: effective.retainageThisPeriodMaterials,
          retainage_released_work: effective.retainageReleasedWork,
          retainage_released_materials: effective.retainageReleasedMaterials,
          total_completed: effective.totalCompleted,
          percent_complete: effective.percentComplete,
          balance_to_finish: effective.balanceToFinish,
        };
      });

      await onSave(updates);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [getEffectiveValues, lineItems, onSave]);

  const handleSetRetainage = useCallback(
    (workPct: number, materialsPct: number) => {
      const values: EditableValues = {};
      for (const li of lineItems) {
        const work = li.work_completed_this_period;
        const mats = li.materials_stored;
        values[li.id] = {
          work_completed_this_period: work,
          materials_stored: mats,
          retainage_this_period_work_pct: workPct,
          retainage_this_period_work: roundCurrency(work * (workPct / 100)),
          retainage_this_period_materials_pct: materialsPct,
          retainage_this_period_materials: roundCurrency(mats * (materialsPct / 100)),
          retainage_released_work: li.retainage_released_work,
          retainage_released_materials: li.retainage_released_materials,
        };
      }
      setEditValues(values);
      setIsEditing(true);
    },
    [lineItems],
  );

  const handleReleaseAllRetainage = useCallback(() => {
    const values: EditableValues = {};
    for (const li of lineItems) {
      values[li.id] = {
        work_completed_this_period: li.work_completed_this_period,
        materials_stored: li.materials_stored,
        retainage_this_period_work_pct: li.retainage_this_period_work_pct,
        retainage_this_period_work: li.retainage_this_period_work,
        retainage_this_period_materials_pct: li.retainage_this_period_materials_pct,
        retainage_this_period_materials: li.retainage_this_period_materials,
        retainage_released_work:
          (li.retainage_previous_work ?? 0) + (li.retainage_this_period_work ?? 0),
        retainage_released_materials:
          (li.retainage_previous_materials ?? 0) + (li.retainage_this_period_materials ?? 0),
      };
    }
    setEditValues(values);
    setIsEditing(true);
  }, [lineItems]);

  const totals = useMemo(() => {
    let scheduledValue = 0;
    let previousApp = 0;
    let thisPeriod = 0;
    let materialsStored = 0;
    let totalComplete = 0;
    let balance = 0;
    let retainage = 0;

    for (const li of lineItems) {
      const effective = getEffectiveValues(li);
      scheduledValue += li.scheduled_value;
      previousApp += li.work_completed_previous;
      thisPeriod += effective.workThisPeriod;
      materialsStored += effective.materialsStored;
      totalComplete += effective.totalCompleted;
      balance += effective.balanceToFinish;
      retainage += effective.currentRetainage;
    }

    return {
      scheduledValue,
      previousApp,
      thisPeriod,
      materialsStored,
      totalComplete,
      percentComplete: pct(totalComplete, scheduledValue),
      balance,
      retainage,
    };
  }, [getEffectiveValues, lineItems]);

  const sorted = useMemo(
    () => [...lineItems].sort((a, b) => a.sort_order - b.sort_order),
    [lineItems],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <SectionRuleHeading label="AIA G703 — Schedule of Values" />
          {!isReadOnly && !canEditRetainage && retainageEditBlockReason ? (
            <p className="text-xs text-muted-foreground">
              {retainageEditBlockReason}
            </p>
          ) : null}
        </div>
        {!isReadOnly ? (
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSetRetainageOpen(true)}
                >
                  Set Retainage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReleaseAllRetainage}
                >
                  Release All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleEdit}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <SetRetainageDialog
        open={setRetainageOpen}
        onOpenChange={setSetRetainageOpen}
        onApply={handleSetRetainage}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                A: Item #
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                Budget Code
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-44">
                B: Description
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                C: Scheduled Value
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                D: Previous App
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                E: This Period
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                F: Materials Stored
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                G: Total Complete
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                %: G/C
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                H: Balance
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground min-w-56">
                Retainage
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((li) => {
              const effective = getEffectiveValues(li);

              return (
                <tr key={li.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-foreground tabular-nums">
                    {li.item_number}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {li.budget_code ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {li.description}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">
                    {formatCurrency(li.scheduled_value)}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">
                    {formatCurrency(li.work_completed_previous)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        className="ml-auto h-7 w-28 text-right text-sm"
                        value={editValues[li.id]?.work_completed_this_period ?? 0}
                        onChange={(e) =>
                          handleValueChange(
                            li.id,
                            "work_completed_this_period",
                            e.target.value,
                          )
                        }
                      />
                    ) : (
                      <span className="tabular-nums">
                        {formatCurrency(effective.workThisPeriod)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        className="ml-auto h-7 w-28 text-right text-sm"
                        value={editValues[li.id]?.materials_stored ?? 0}
                        onChange={(e) =>
                          handleValueChange(
                            li.id,
                            "materials_stored",
                            e.target.value,
                          )
                        }
                      />
                    ) : (
                      <span className="tabular-nums">
                        {formatCurrency(effective.materialsStored)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">
                    {formatCurrency(effective.totalCompleted)}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">
                    {pct(effective.totalCompleted, li.scheduled_value)}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">
                    {formatCurrency(effective.balanceToFinish)}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Work %
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`Work retainage percent for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={
                              editValues[li.id]?.retainage_this_period_work_pct ?? 0
                            }
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_this_period_work_pct",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Work $</span>
                          <Input
                            type="number"
                            min={0}
                            aria-label={`Work retainage amount for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={editValues[li.id]?.retainage_this_period_work ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_this_period_work",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Mat %
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`Materials retainage percent for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={
                              editValues[li.id]?.retainage_this_period_materials_pct ?? 0
                            }
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_this_period_materials_pct",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mat $</span>
                          <Input
                            type="number"
                            min={0}
                            aria-label={`Materials retainage amount for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={editValues[li.id]?.retainage_this_period_materials ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_this_period_materials",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Rel W
                          </span>
                          <Input
                            type="number"
                            min={0}
                            aria-label={`Work retainage released for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={editValues[li.id]?.retainage_released_work ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_released_work",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-[56px_1fr] items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Rel M
                          </span>
                          <Input
                            type="number"
                            min={0}
                            aria-label={`Materials retainage released for item ${li.sort_order ?? li.id}`}
                            className="h-7 text-right text-sm"
                            disabled={!canEditRetainage}
                            value={
                              editValues[li.id]?.retainage_released_materials ?? 0
                            }
                            onChange={(e) =>
                              handleValueChange(
                                li.id,
                                "retainage_released_materials",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="border-t border-border pt-2 text-right">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Current Retained
                          </div>
                          <div className="tabular-nums text-sm font-medium text-foreground">
                            {formatCurrency(effective.currentRetainage)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-right">
                        <div className="tabular-nums text-foreground">
                          {formatCurrency(effective.currentRetainage)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {effective.retainageWorkPct.toFixed(2)}% work /{" "}
                          {effective.retainageMaterialsPct.toFixed(2)}% materials
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={cn("border-t-2 border-border bg-muted font-semibold")}>
              <td className="px-3 py-2" colSpan={3}>
                Totals
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.scheduledValue)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.previousApp)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.thisPeriod)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.materialsStored)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.totalComplete)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totals.percentComplete}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.balance)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(totals.retainage)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
