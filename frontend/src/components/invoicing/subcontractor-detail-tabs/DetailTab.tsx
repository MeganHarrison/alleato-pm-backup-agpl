"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  formatCurrency,
  type LineItemEdits,
  type SovLineItem,
} from "./shared";
import {
  computeLineFinancials,
  materialsCurrentlyRetained,
  workCurrentlyRetained,
} from "@/lib/invoicing/payment-application";
import { SectionRuleHeading } from "@/components/layout/spacing";

/* ─── Bulk Retainage Sidebar ─── */

function RetainageSidebar({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (type: "work" | "materials", pct: number) => void;
}) {
  const [workPct, setWorkPct] = useState("");
  const [matPct, setMatPct] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Set Retainage On All Line Items</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Work Completed</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                value={workPct}
                onChange={(e) => setWorkPct(e.target.value)}
                placeholder="10.00"
                className="h-8 w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button
                size="sm"
                onClick={() => {
                  const v = Number(workPct);
                  if (!Number.isNaN(v) && v >= 0) onApply("work", v);
                }}
              >
                Set
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Materials Stored</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                value={matPct}
                onChange={(e) => setMatPct(e.target.value)}
                placeholder="10.00"
                className="h-8 w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button
                size="sm"
                onClick={() => {
                  const v = Number(matPct);
                  if (!Number.isNaN(v) && v >= 0) onApply("materials", v);
                }}
              >
                Set
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Computed retainage helpers ─── */

const getWorkCurrentlyRetained = (li: SovLineItem) => workCurrentlyRetained(li);
const getMatCurrentlyRetained = (li: SovLineItem) =>
  materialsCurrentlyRetained(li);

/* ─── Main Component ─── */

interface DetailTabProps {
  projectId: string;
  invoiceId: number;
  lineItems: SovLineItem[];
  canEdit: boolean;
  isRetainageRelease?: boolean;
  onRefetch: () => Promise<unknown>;
}

export function DetailTab({
  projectId,
  invoiceId,
  lineItems,
  canEdit,
  isRetainageRelease = false,
  onRefetch,
}: DetailTabProps) {
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<LineItemEdits>({});
  const [busy, setBusy] = useState(false);
  const [retainageSidebarOpen, setRetainageSidebarOpen] = useState(false);

  const displayLineItems = useMemo(() => {
    if (!editing) return lineItems;
    return lineItems.map((li) => {
      const e = edits[li.id];
      if (!e) return li;
      const thisPeriod = Number(e.work_completed_period) || 0;
      const stored = Number(e.materials_stored) || 0;
      const workPct = Number(e.retainage_pct) || 0;
      const matPct = Number(e.materials_retainage_pct) || 0;
      const workReleased = Number(e.work_retainage_released) || 0;
      const matReleased = Number(e.materials_retainage_released) || 0;
      const fin = computeLineFinancials({
        scheduled_value: li.scheduled_value,
        work_completed_previous: li.work_completed_previous,
        work_completed_period: thisPeriod,
        materials_stored: stored,
        retainage_pct: workPct,
        materials_retainage_pct: matPct,
        work_retainage_released: workReleased,
        materials_retainage_released: matReleased,
        previous_work_retainage: li.previous_work_retainage,
        previous_materials_retainage: li.previous_materials_retainage,
      });
      return {
        ...li,
        work_completed_period: thisPeriod,
        materials_stored: stored,
        retainage_pct: workPct,
        materials_retainage_pct: matPct,
        retainage_amount: fin.retainage_amount,
        materials_retainage_amount: fin.materials_retainage_amount,
        work_retainage_released: workReleased,
        materials_retainage_released: matReleased,
        total_completed_stored: fin.total_completed_stored,
        work_completed_pct: fin.work_completed_pct,
        balance_to_finish: fin.balance_to_finish,
        net_amount_this_period: fin.net_amount_this_period,
      };
    });
  }, [editing, edits, lineItems]);

  const totals = displayLineItems.reduce(
    (acc, li) => {
      acc.commitmentValue += li.commitment_value ?? 0;
      acc.changeValue += li.change_value ?? 0;
      acc.scheduled += li.scheduled_value ?? 0;
      acc.previous += li.work_completed_previous ?? 0;
      acc.thisPeriod += li.work_completed_period ?? 0;
      acc.stored += li.materials_stored ?? 0;
      acc.totalCompleted += li.total_completed_stored ?? 0;
      acc.workRetainage += li.retainage_amount ?? 0;
      acc.matRetainage += li.materials_retainage_amount ?? 0;
      acc.prevWorkRet += li.previous_work_retainage ?? 0;
      acc.prevMatRet += li.previous_materials_retainage ?? 0;
      acc.workReleased += li.work_retainage_released ?? 0;
      acc.matReleased += li.materials_retainage_released ?? 0;
      acc.workCurrentlyRetained += getWorkCurrentlyRetained(li);
      acc.matCurrentlyRetained += getMatCurrentlyRetained(li);
      acc.net += li.net_amount_this_period ?? 0;
      return acc;
    },
    {
      commitmentValue: 0,
      changeValue: 0,
      scheduled: 0,
      previous: 0,
      thisPeriod: 0,
      stored: 0,
      totalCompleted: 0,
      workRetainage: 0,
      matRetainage: 0,
      prevWorkRet: 0,
      prevMatRet: 0,
      workReleased: 0,
      matReleased: 0,
      workCurrentlyRetained: 0,
      matCurrentlyRetained: 0,
      net: 0,
    },
  );

  function enterEdit() {
    const seed: LineItemEdits = {};
    for (const li of lineItems) {
      seed[li.id] = {
        work_completed_period: String(li.work_completed_period ?? 0),
        materials_stored: String(li.materials_stored ?? 0),
        retainage_pct: String(li.retainage_pct ?? 0),
        materials_retainage_pct: String(li.materials_retainage_pct ?? 0),
        work_retainage_released: String(li.work_retainage_released ?? 0),
        materials_retainage_released: String(li.materials_retainage_released ?? 0),
      };
    }
    setEdits(seed);
    setEditing(true);
  }

  function cancelEdit() {
    setEdits({});
    setEditing(false);
  }

  function applyBulkRetainage(type: "work" | "materials", pct: number) {
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[Number(id)] = {
          ...next[Number(id)],
          ...(type === "work"
            ? { retainage_pct: String(pct) }
            : { materials_retainage_pct: String(pct) }),
        };
      }
      return next;
    });
    toast.success(
      `Set ${type === "work" ? "work" : "materials"} retainage to ${pct}% on all lines`,
    );
  }

  async function saveEdits() {
    const updates = Object.entries(edits).map(([id, v]) => ({
      id: Number(id),
      work_completed_period: Number(v.work_completed_period) || 0,
      materials_stored: Number(v.materials_stored) || 0,
      retainage_pct: Number(v.retainage_pct) || 0,
      materials_retainage_pct: Number(v.materials_retainage_pct) || 0,
      work_retainage_released: Number(v.work_retainage_released) || 0,
      materials_retainage_released: Number(v.materials_retainage_released) || 0,
    }));
    setBusy(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/subcontractor/invoices/${invoiceId}/line-items`,
        {
          method: "PATCH",
          body: JSON.stringify({ updates }),
        },
      );
      toast.success("SOV updated");
      setEditing(false);
      setEdits({});
      await onRefetch();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      {isRetainageRelease && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Release of Retainage Invoice</span>
          {" — "}Enter amounts to release from previously withheld retainage. Billing fields are read-only.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionRuleHeading label="Schedule of Values (G703)" />
          <p className="text-xs text-muted-foreground">
            {lineItems.length} line item
            {lineItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && lineItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editing ? (
              <>
                {!isRetainageRelease && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRetainageSidebarOpen(true)}
                  >
                    Set Retainage
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" disabled={busy} onClick={saveEdits}>
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={enterEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                {isRetainageRelease ? "Edit Release Amounts" : "Edit SOV"}
              </Button>
            )}
          </div>
        )}
      </div>
      {lineItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No line items yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {/* Row 1: Column group headers */}
              <TableRow className="border-b-0">
                <TableHead className="w-12" rowSpan={2} />
                <TableHead className="text-center text-xs font-medium text-muted-foreground">
                  A
                </TableHead>
                <TableHead className="text-center text-xs font-medium text-muted-foreground">
                  B
                </TableHead>
                <TableHead className="text-center text-xs font-medium text-muted-foreground" />
                <TableHead className="text-center text-xs font-medium text-muted-foreground" />
                <TableHead className="text-center text-xs font-medium text-muted-foreground" />
                <TableHead className="text-center text-xs font-medium text-muted-foreground">
                  C
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="text-center text-xs font-medium text-muted-foreground"
                >
                  D &amp; E
                </TableHead>
                <TableHead className="text-center text-xs font-medium text-muted-foreground">
                  F
                </TableHead>
                <TableHead
                  colSpan={2}
                  className="text-center text-xs font-medium text-muted-foreground"
                >
                  G
                </TableHead>
                <TableHead className="text-center text-xs font-medium text-muted-foreground">
                  H
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="text-center text-xs font-medium border-l border-border"
                >
                  From Previous Application
                </TableHead>
                <TableHead
                  colSpan={4}
                  className="text-center text-xs font-medium border-l border-border"
                >
                  Retained This Period
                </TableHead>
                <TableHead
                  colSpan={2}
                  className="text-center text-xs font-medium border-l border-border"
                >
                  Released This Period
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="text-center text-xs font-medium border-l border-border"
                >
                  Currently Retained
                </TableHead>
              </TableRow>
              {/* Row 2: Column labels */}
              <TableRow>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Budget Code
                </TableHead>
                <TableHead className="text-xs">Description Of Work</TableHead>
                <TableHead className="text-xs whitespace-nowrap">
                  Line Item Type
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Commitment Value
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Change Value
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Schedule Value
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  From Previous %
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  From Previous $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  This Period
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials Stored
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Total Completed
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  %
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Balance To Finish
                </TableHead>
                {/* From Previous Application */}
                <TableHead className="text-right text-xs whitespace-nowrap border-l border-border">
                  Work $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Total
                </TableHead>
                {/* Retained This Period */}
                <TableHead className="text-right text-xs whitespace-nowrap border-l border-border">
                  Work %
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Work $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials %
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials $
                </TableHead>
                {/* Released This Period */}
                <TableHead className="text-right text-xs whitespace-nowrap border-l border-border">
                  Work $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials $
                </TableHead>
                {/* Currently Retained */}
                <TableHead className="text-right text-xs whitespace-nowrap border-l border-border">
                  Work $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Materials $
                </TableHead>
                <TableHead className="text-right text-xs whitespace-nowrap">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayLineItems.map((li, idx) => {
                const e = edits[li.id];
                const prevWork = Number(li.previous_work_retainage) || 0;
                const prevMat = Number(li.previous_materials_retainage) || 0;
                const workCurRetained = getWorkCurrentlyRetained(li);
                const matCurRetained = getMatCurrentlyRetained(li);

                return (
                  <TableRow key={li.id}>
                    <TableCell className="text-muted-foreground tabular-nums w-12">
                      {li.sort_order ?? idx + 1}
                    </TableCell>
                    {/* A: Budget Code */}
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {li.budget_code ?? "—"}
                    </TableCell>
                    {/* B: Description */}
                    <TableCell className="font-medium text-xs">
                      {li.description ?? "—"}
                    </TableCell>
                    {/* Line Item Type */}
                    <TableCell className="text-xs whitespace-nowrap">
                      {li.line_item_type ?? "SOV"}
                    </TableCell>
                    {/* Commitment Value */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {li.commitment_value != null ? formatCurrency(li.commitment_value) : "—"}
                    </TableCell>
                    {/* Change Value */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {li.change_value != null ? formatCurrency(li.change_value) : "—"}
                    </TableCell>
                    {/* C: Schedule Value */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.scheduled_value)}
                    </TableCell>
                    {/* D: From Previous % */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {li.work_completed_previous_pct != null
                        ? `${Number(li.work_completed_previous_pct).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    {/* D: From Previous $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.work_completed_previous)}
                    </TableCell>
                    {/* E: This Period */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {editing && e && !isRetainageRelease ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-24 ml-auto text-right tabular-nums text-xs"
                          value={e.work_completed_period}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                work_completed_period: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(li.work_completed_period)
                      )}
                    </TableCell>
                    {/* F: Materials Stored */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {editing && e && !isRetainageRelease ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-24 ml-auto text-right tabular-nums text-xs"
                          value={e.materials_stored}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                materials_stored: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(li.materials_stored)
                      )}
                    </TableCell>
                    {/* G: Total Completed */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.total_completed_stored)}
                    </TableCell>
                    {/* G%: Percent */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {li.work_completed_pct != null
                        ? `${Number(li.work_completed_pct).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    {/* H: Balance To Finish */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.balance_to_finish)}
                    </TableCell>
                    {/* From Previous: Work $ */}
                    <TableCell className="text-right tabular-nums text-xs border-l border-border">
                      {formatCurrency(prevWork)}
                    </TableCell>
                    {/* From Previous: Materials $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(prevMat)}
                    </TableCell>
                    {/* From Previous: Total */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(prevWork + prevMat)}
                    </TableCell>
                    {/* Retained This Period: Work % */}
                    <TableCell className="text-right tabular-nums text-xs border-l border-border">
                      {editing && e && !isRetainageRelease ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-16 ml-auto text-right tabular-nums text-xs"
                          value={e.retainage_pct}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                retainage_pct: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : li.retainage_pct != null ? (
                        `${Number(li.retainage_pct).toFixed(2)}%`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {/* Retained This Period: Work $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.retainage_amount)}
                    </TableCell>
                    {/* Retained This Period: Materials % */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {editing && e && !isRetainageRelease ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-16 ml-auto text-right tabular-nums text-xs"
                          value={e.materials_retainage_pct}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                materials_retainage_pct: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : li.materials_retainage_pct != null ? (
                        `${Number(li.materials_retainage_pct).toFixed(2)}%`
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {/* Retained This Period: Materials $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(li.materials_retainage_amount)}
                    </TableCell>
                    {/* Released This Period: Work $ */}
                    <TableCell className="text-right tabular-nums text-xs border-l border-border">
                      {editing && e ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-7 w-24 ml-auto text-right tabular-nums text-xs"
                          value={e.work_retainage_released}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                work_retainage_released: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(li.work_retainage_released)
                      )}
                    </TableCell>
                    {/* Released This Period: Materials $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {editing && e ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-7 w-24 ml-auto text-right tabular-nums text-xs"
                          value={e.materials_retainage_released}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [li.id]: {
                                ...prev[li.id],
                                materials_retainage_released: ev.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        formatCurrency(li.materials_retainage_released)
                      )}
                    </TableCell>
                    {/* Currently Retained: Work $ */}
                    <TableCell className="text-right tabular-nums text-xs border-l border-border">
                      {formatCurrency(workCurRetained)}
                    </TableCell>
                    {/* Currently Retained: Materials $ */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(matCurRetained)}
                    </TableCell>
                    {/* Currently Retained: Total */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCurrency(workCurRetained + matCurRetained)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={3} className="text-xs">
                  Total
                </TableCell>
                {/* Line Item Type - empty */}
                <TableCell />
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.commitmentValue)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.changeValue)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.scheduled)}
                </TableCell>
                {/* From Previous % */}
                <TableCell className="text-right tabular-nums text-xs">
                  {totals.scheduled > 0
                    ? `${((totals.previous / totals.scheduled) * 100).toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.previous)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.thisPeriod)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.stored)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.totalCompleted)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {totals.scheduled > 0
                    ? `${((totals.totalCompleted / totals.scheduled) * 100).toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.scheduled - totals.totalCompleted)}
                </TableCell>
                {/* From Previous totals */}
                <TableCell className="text-right tabular-nums text-xs border-l border-border">
                  {formatCurrency(totals.prevWorkRet)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.prevMatRet)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.prevWorkRet + totals.prevMatRet)}
                </TableCell>
                {/* Retained This Period totals */}
                <TableCell className="text-right tabular-nums text-xs border-l border-border" />
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.workRetainage)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs" />
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.matRetainage)}
                </TableCell>
                {/* Released This Period totals */}
                <TableCell className="text-right tabular-nums text-xs border-l border-border">
                  {formatCurrency(totals.workReleased)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.matReleased)}
                </TableCell>
                {/* Currently Retained totals */}
                <TableCell className="text-right tabular-nums text-xs border-l border-border">
                  {formatCurrency(totals.workCurrentlyRetained)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(totals.matCurrentlyRetained)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {formatCurrency(
                    totals.workCurrentlyRetained + totals.matCurrentlyRetained,
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk retainage sidebar */}
      <RetainageSidebar
        open={retainageSidebarOpen}
        onOpenChange={setRetainageSidebarOpen}
        onApply={applyBulkRetainage}
      />
    </section>
  );
}
