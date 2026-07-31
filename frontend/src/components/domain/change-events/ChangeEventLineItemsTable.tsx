"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Edit, MoreVertical, Plus, Trash2 } from "lucide-react";

import { InlineAddButton } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableRow,
} from "@/components/ds";
import { formatCurrency } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import { MoneyField } from "@/components/forms/MoneyField";
import type { ChangeEventDetailLineItem } from "@/types/change-events";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { useDropdownData } from "./change-event-form/useDropdownData";
import { VendorCombobox } from "./change-event-form/VendorCombobox";
import { ContractCombobox } from "./change-event-form/ContractCombobox";
import { UOM_OPTIONS } from "./change-event-form/types";
import {
  fetchCommitmentSovLineItems,
  findBudgetCode,
  resolveBudgetCodeFromSov,
} from "@/lib/change-events/budget-code-match";
import type { BudgetCodeOption } from "./change-event-form/types";

interface LineItemFormState {
  description: string;
  budgetCodeId: string;
  vendorId: string;
  contractValue: string; // "po-{id}" or "sub-{id}"
  unitOfMeasure: string;
  costQuantity: string;
  costUnitCost: string;
  revenueQuantity: string;
  revenueUnitCost: string;
  nonCommittedCost: string;
}

const EMPTY_FORM: LineItemFormState = {
  description: "",
  budgetCodeId: "",
  vendorId: "",
  contractValue: "",
  unitOfMeasure: "",
  costQuantity: "1",
  costUnitCost: "",
  revenueQuantity: "1",
  revenueUnitCost: "",
  nonCommittedCost: "",
};

interface ChangeEventLineItemsTableProps {
  projectId: number;
  changeEventId?: string;
  lineItems: ChangeEventDetailLineItem[];
  expectingRevenue?: boolean;
  onDeleteLineItem?: (lineItemId: string) => Promise<void>;
  onLineItemsChange?: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Returns null if the description looks like a raw ID (UUID or UUID+suffix) — legacy data guard. */
function safeDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  return UUID_RE.test(desc) ? null : desc;
}

function resolveLineItemBudgetCode(
  li: ChangeEventDetailLineItem,
  budgetCodes: BudgetCodeOption[],
): BudgetCodeOption | undefined {
  return (
    findBudgetCode(li.projectBudgetCodeId ?? null, budgetCodes) ||
    findBudgetCode(li.budgetCodeId ?? null, budgetCodes) ||
    findBudgetCode(li.budgetLine?.cost_code?.id ?? null, budgetCodes) ||
    findBudgetCode(li.budgetLine?.cost_code?.title ?? null, budgetCodes) ||
    findBudgetCode(li.budgetLine?.description ?? null, budgetCodes)
  );
}

function formatBudgetCodeText(
  li: ChangeEventDetailLineItem,
  budgetCodes: BudgetCodeOption[],
): string {
  const budgetCode = resolveLineItemBudgetCode(li, budgetCodes);
  if (budgetCode) return `${budgetCode.code} - ${budgetCode.description}`;
  if (!li.budgetLine) return "Unmapped";
  const cc = li.budgetLine.cost_code;
  if (cc?.id || cc?.title) {
    return [cc.id, cc.title].filter(Boolean).join(" - ");
  }
  return li.budgetLine.description || "Unmapped";
}

function BudgetCodeCell({
  li,
  budgetCodes,
}: {
  li: ChangeEventDetailLineItem;
  budgetCodes: BudgetCodeOption[];
}) {
  const budgetCodeText = formatBudgetCodeText(li, budgetCodes);
  return (
    <div className="w-40 truncate text-xs font-medium leading-tight" title={budgetCodeText}>
      {budgetCodeText}
    </div>
  );
}

export function ChangeEventLineItemsTable({
  projectId,
  changeEventId,
  lineItems,
  expectingRevenue = true,
  onDeleteLineItem,
  onLineItemsChange,
}: ChangeEventLineItemsTableProps) {
  // Add/edit line items in a side sheet so the table keeps its scan-friendly row shape.
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ChangeEventDetailLineItem | null>(null);
  const [formState, setFormState] = useState<LineItemFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const { vendors, contracts, budgetCodes } = useDropdownData({ projectId });

  const lineItemSubtotals = useMemo(
    () =>
      lineItems.reduce(
        (acc, li) => ({
          costRom: acc.costRom + (li.costRom ?? 0),
          revenueRom: acc.revenueRom + (li.revenueRom ?? 0),
          nonCommittedCost: acc.nonCommittedCost + (li.nonCommittedCost ?? 0),
        }),
        { costRom: 0, revenueRom: 0, nonCommittedCost: 0 },
      ),
    [lineItems],
  );
  const overUnder = lineItemSubtotals.revenueRom - lineItemSubtotals.costRom;

  /**
   * Fetch the selected commitment's SOV and auto-populate the budget code, the
   * same way the new/edit ChangeEventForm does. Runs on commitment selection and
   * when opening an already-committed line that has no budget code yet. Surfaces
   * a reason when it can't resolve instead of silently leaving the field blank.
   */
  const autoPopulateBudgetCodeFromCommitment = React.useCallback(
    async (contractValue: string, opts?: { silent?: boolean }) => {
      if (!contractValue) return;
      const items = await fetchCommitmentSovLineItems(projectId, contractValue);
      const resolution = resolveBudgetCodeFromSov(items, budgetCodes);
      if (resolution.budgetCodeId) {
        setFormState((s) => ({
          ...s,
          // Don't clobber a budget code the user already chose.
          budgetCodeId: s.budgetCodeId || resolution.budgetCodeId!,
          description:
            s.description.trim() === "" && resolution.description
              ? resolution.description
              : s.description,
        }));
        return;
      }
      if (opts?.silent) return;
      if (resolution.reason === "multiple_codes") {
        toast.info(
          "This commitment has multiple budget codes — pick the one for this line.",
        );
      } else if (resolution.reason === "code_not_in_project") {
        toast.warning(
          "The commitment's budget code isn't in this project's budget. Select it manually or add it to the budget.",
        );
      } else if (resolution.reason === "no_sov") {
        toast.info(
          "This commitment has no line items to copy a budget code from — select one manually.",
        );
      }
    },
    [projectId, budgetCodes],
  );

  const closeEditor = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormState(EMPTY_FORM);
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormState(EMPTY_FORM);
    setIsAdding(true);
  };

  const openEdit = (li: ChangeEventDetailLineItem) => {
    setIsAdding(false);
    setEditingItem(li);
    const qty = li.quantity ?? 1;
    const uc = li.unitCost ?? 0;
    const contractValue =
      li.commitmentId
        ? `${li.commitmentType === "purchase_order" ? "po" : "sub"}-${li.commitmentId}`
        : "";
    setFormState({
      description: li.description ?? "",
      budgetCodeId: resolveLineItemBudgetCode(li, budgetCodes)?.id ?? li.projectBudgetCodeId ?? "",
      vendorId: li.vendor?.id ?? li.vendorId ?? "",
      contractValue,
      unitOfMeasure: li.unitOfMeasure ?? "",
      costQuantity: String(qty),
      costUnitCost: uc !== 0 ? String(uc) : li.costRom != null ? String(li.costRom) : "",
      revenueQuantity: String(qty),
      revenueUnitCost: uc !== 0 ? String(uc) : li.revenueRom != null ? String(li.revenueRom) : "",
      nonCommittedCost: li.nonCommittedCost != null && li.nonCommittedCost !== 0 ? String(li.nonCommittedCost) : "",
    });
    // Existing committed line saved without a budget code (e.g. created before
    // auto-populate worked here) — resolve it now so the field isn't blank.
    if (contractValue && !li.projectBudgetCodeId) {
      void autoPopulateBudgetCodeFromCommitment(contractValue, { silent: true });
    }
  };

  const handleSaveLineItem = async () => {
    if (!changeEventId || !formState.description.trim()) return;
    setIsSaving(true);
    try {
      const costQty = parseFloat(formState.costQuantity) || 1;
      const costUc = parseFloat(formState.costUnitCost) || 0;
      const revQty = parseFloat(formState.revenueQuantity) || 1;
      const revUc = parseFloat(formState.revenueUnitCost) || 0;
      const costRom = costQty * costUc;
      const revenueRom = revQty * revUc;

      // Parse commitment from contractValue ("po-{id}" or "sub-{id}")
      let commitmentId: string | undefined;
      let commitmentType: string | undefined;
      if (formState.contractValue) {
        const isPo = formState.contractValue.startsWith("po-");
        commitmentType = isPo ? "purchase_order" : "subcontract";
        commitmentId = formState.contractValue.replace(/^(po|sub)-/, "");
      }

      const payload: Record<string, unknown> = {
        description: formState.description.trim(),
        quantity: revQty,
        unitCost: revUc,
        costRom,
        revenueRom,
      };
      if (formState.budgetCodeId) payload.budgetCodeId = formState.budgetCodeId;
      if (formState.vendorId) payload.vendorId = formState.vendorId;
      if (formState.unitOfMeasure) payload.unitOfMeasure = formState.unitOfMeasure;
      if (commitmentId) { payload.commitmentId = commitmentId; payload.commitmentType = commitmentType; }
      if (formState.nonCommittedCost) payload.nonCommittedCost = parseFloat(formState.nonCommittedCost) || 0;

      if (editingItem) {
        await apiFetch(
          `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${editingItem.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        toast.success("Line item updated");
      } else {
        await apiFetch(
          `/api/projects/${projectId}/change-events/${changeEventId}/line-items`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        toast.success("Line item added");
      }
      closeEditor();
      onLineItemsChange?.();
    } catch (err) {
      toast.error("Line item was not saved", {
        description: err instanceof Error ? err.message : "The server did not return a usable error.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // The line-item editor uses the same fields as the change-event form.
  function renderLineItemEditor() {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Budget Code */}
          {/* Commitment */}
          <div className="space-y-1.5">
            <Label>Commitment</Label>
            <ContractCombobox
              value={formState.contractValue}
              onChange={(v) => {
                const commitment = contracts.find((c) => c.id === v);
                setFormState((s) => ({
                  ...s,
                  contractValue: v,
                  vendorId: s.vendorId || (commitment?.vendorId ? String(commitment.vendorId) : s.vendorId),
                }));
                // Auto-populate the budget code from the commitment's SOV.
                void autoPopulateBudgetCodeFromCommitment(v);
              }}
              contracts={contracts}
              disabled={!!editingItem?.commitmentId}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="li-description">Description *</Label>
            <Input
              id="li-description"
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
              placeholder="Enter description"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Budget Code</Label>
            <BudgetCodeSelector
              value={formState.budgetCodeId}
              onValueChange={(id) => setFormState((s) => ({ ...s, budgetCodeId: id }))}
              budgetCodes={budgetCodes}
              onCreateNew={() => {}}
              placeholder="Select budget code..."
              // Lock only once a code is actually resolved/chosen; never trap the
              // user on a committed line whose budget code couldn't auto-populate.
              disabled={!!formState.contractValue && !!formState.budgetCodeId}
            />
          </div>

          {/* Vendor */}
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <VendorCombobox
              value={formState.vendorId}
              onChange={(v) => setFormState((s) => ({ ...s, vendorId: v }))}
              vendors={vendors}
            />
          </div>

          {/* UOM */}
          <div className="space-y-1.5">
            <Label>Unit of Measure</Label>
            <Select
              value={formState.unitOfMeasure}
              onValueChange={(v) => setFormState((s) => ({ ...s, unitOfMeasure: v }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {UOM_OPTIONS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cost */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Cost</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="li-costQty">Quantity</Label>
              <Input
                id="li-costQty"
                type="number"
                inputMode="numeric"
                min="0"
                value={formState.costQuantity}
                onChange={(e) => setFormState((s) => ({ ...s, costQuantity: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-costUc">Unit Cost</Label>
              <MoneyField
                inline
                label="Cost Unit Cost"
                value={parseFloat(formState.costUnitCost) || undefined}
                onChange={(v) => setFormState((s) => ({ ...s, costUnitCost: v != null ? String(v) : "" }))}
                showCurrency={false}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost ROM</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm font-medium">
                {formatCurrency((parseFloat(formState.costQuantity) || 0) * (parseFloat(formState.costUnitCost) || 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Revenue</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="li-revQty">Quantity</Label>
              <Input
                id="li-revQty"
                type="number"
                inputMode="numeric"
                min="0"
                value={formState.revenueQuantity}
                onChange={(e) => setFormState((s) => ({ ...s, revenueQuantity: e.target.value }))}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="li-revUc">Unit Cost</Label>
              <MoneyField
                inline
                label="Revenue Unit Cost"
                value={parseFloat(formState.revenueUnitCost) || undefined}
                onChange={(v) => setFormState((s) => ({ ...s, revenueUnitCost: v != null ? String(v) : "" }))}
                showCurrency={false}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Revenue ROM</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm font-medium">
                {formatCurrency((parseFloat(formState.revenueQuantity) || 0) * (parseFloat(formState.revenueUnitCost) || 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Non-committed cost (only when a commitment is selected) */}
        {formState.contractValue && (
          <div className="space-y-1.5">
            <Label>Non-committed Cost</Label>
            <MoneyField
              inline
              label="Non-committed Cost"
              value={parseFloat(formState.nonCommittedCost) || undefined}
              onChange={(v) => setFormState((s) => ({ ...s, nonCommittedCost: v != null ? String(v) : "" }))}
              showCurrency={false}
              className="h-9"
            />
          </div>
        )}

      </div>
    );
  }

  const editorOpen = isAdding || editingItem !== null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionRuleHeading label="Line Items" className="mb-0 [&_span]:text-primary" />
        {changeEventId && (
          <InlineAddButton onClick={openAdd}>
            Add Line Item
          </InlineAddButton>
        )}
      </div>

      {lineItems.length > 0 ? (
        <div className="line-items-scroll-shell relative rounded-lg">
          <InlineTable
            variant="edit"
            tableClassName={cn(
              "table-fixed",
              expectingRevenue ? "w-[127.25rem] min-w-[127.25rem]" : "w-[103.25rem] min-w-[103.25rem]",
            )}
          >
            <colgroup>
              <col className="w-9" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-72" />
              <col className="w-36" />
              <col className="w-28" />
              <col className="w-44" />
              <col className="w-32" />
              {expectingRevenue && (
                <>
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-44" />
                </>
              )}
              <col className="w-32" />
              <col className="w-36" />
              <col className="w-32" />
              <col className="w-12" />
            </colgroup>

            <InlineTableHeader className="border-y-0 [&_tr]:border-b-0">
              <InlineTableRow className="border-b border-border/60 hover:bg-transparent">
                <InlineTableHeaderCell className="w-9 border-b border-border/60 px-1 py-1.5" />
                <InlineTableHeaderCell colSpan={4} className="line-item-group-end border-b border-border/60 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                  Detail
                </InlineTableHeaderCell>
                <InlineTableHeaderCell colSpan={3} className="line-item-group-end line-item-group-start border-b border-l border-border/60 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                  Cost
                </InlineTableHeaderCell>
                {expectingRevenue && (
                  <InlineTableHeaderCell colSpan={3} className="line-item-group-end line-item-group-start border-b border-l border-border/60 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                    Revenue
                  </InlineTableHeaderCell>
                )}
                <InlineTableHeaderCell colSpan={3} className="line-item-group-start border-b border-l border-border/60 px-2 py-1 text-right text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                  Summary
                </InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-12 border-b border-border/60 px-1 py-1" />
              </InlineTableRow>
              <InlineTableRow className="border-b-0 hover:bg-transparent">
                <InlineTableHeaderCell className="w-9 px-1 py-1.5" />
                <InlineTableHeaderCell className="w-40 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Commitment</InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-40 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Budget Code</InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-72 px-1 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Description</InlineTableHeaderCell>
                <InlineTableHeaderCell className="line-item-group-end w-36 px-0.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Vendor</InlineTableHeaderCell>
                <InlineTableHeaderCell className="line-item-group-start w-28 border-l border-border/60 px-2 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Qty</InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-44 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Unit Cost</InlineTableHeaderCell>
                <InlineTableHeaderCell className="line-item-group-end w-32 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Cost ROM</InlineTableHeaderCell>
                {expectingRevenue && (
                  <>
                    <InlineTableHeaderCell className="line-item-group-start w-24 border-l border-border/60 px-2 py-1.5 text-[11px] font-normal normal-case tracking-normal text-muted-foreground">UOM</InlineTableHeaderCell>
                    <InlineTableHeaderCell className="w-28 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Qty</InlineTableHeaderCell>
                    <InlineTableHeaderCell className="line-item-group-end w-44 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Unit Cost</InlineTableHeaderCell>
                  </>
                )}
                <InlineTableHeaderCell className="line-item-group-start w-32 border-l border-border/60 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Revenue ROM</InlineTableHeaderCell>
                <InlineTableHeaderCell className="line-item-group-start w-36 border-l border-border/60 px-2 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Non-committed</InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-32 px-1 py-1.5 text-right text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Over / Under</InlineTableHeaderCell>
                <InlineTableHeaderCell className="w-12 px-1 py-1.5" />
              </InlineTableRow>
            </InlineTableHeader>

            <InlineTableBody>
              {lineItems.map((li) => {
                const liOverUnder = (li.revenueRom ?? 0) - (li.costRom ?? 0);
                const commitmentLinkId = li.commitment?.id ?? li.commitmentId;
                const commitmentDisplayName =
                  li.commitment?.display_name ||
                  li.commitment?.title ||
                  li.commitment?.company_name ||
                  li.commitment?.contract_number ||
                  "--";

                return (
                  <InlineTableRow key={li.id} className="group border-b-0 bg-background transition-colors hover:bg-transparent">
                    <InlineTableCell className="w-9 px-1 py-1.5 align-top" />
                    <InlineTableCell
                      className="w-40 px-0.5 py-1.5 align-top text-[13px]"
                      title={commitmentDisplayName === "--" ? undefined : commitmentDisplayName}
                    >
                      {commitmentLinkId ? (
                        <Link
                          href={`/${projectId}/commitments/${commitmentLinkId}`}
                          className="block w-40 truncate text-primary hover:underline"
                        >
                          {commitmentDisplayName}
                        </Link>
                      ) : (
                        <span className="block w-40 truncate">{commitmentDisplayName}</span>
                      )}
                    </InlineTableCell>
                    <InlineTableCell className="w-40 px-0.5 py-1.5 align-top text-[13px]">
                      <BudgetCodeCell li={li} budgetCodes={budgetCodes} />
                    </InlineTableCell>
                    <InlineTableCell
                      className="w-72 px-1 py-1.5 align-top text-[13px]"
                      title={safeDescription(li.description) ?? undefined}
                    >
                      <span className="block w-72 truncate">
                        {safeDescription(li.description) || "--"}
                      </span>
                    </InlineTableCell>
                    <InlineTableCell className="line-item-group-end w-36 px-0.5 py-1.5 align-top text-[13px]">
                      {li.vendor?.id && li.vendor?.name ? (
                        <Link
                          href={`/directory/companies/${li.vendor.id}`}
                          className="block w-36 truncate text-primary hover:underline"
                          title={li.vendor.name}
                        >
                          {li.vendor.name}
                        </Link>
                      ) : li.commitment?.contract_company_id && li.commitment?.company_name ? (
                        <Link
                          href={`/directory/companies/${li.commitment.contract_company_id}`}
                          className="block w-36 truncate text-primary hover:underline"
                          title={li.commitment.company_name}
                        >
                          {li.commitment.company_name}
                        </Link>
                      ) : (
                        <span
                          className="block w-36 truncate"
                          title={li.vendor?.name || li.commitment?.company_name || undefined}
                        >
                          {li.vendor?.name || li.commitment?.company_name || "--"}
                        </span>
                      )}
                    </InlineTableCell>
                    <InlineTableCell className="line-item-group-start w-28 border-l border-border/60 px-2 py-1.5 align-top text-right text-[13px]">
                      {li.quantity ?? "--"}
                    </InlineTableCell>
                    <InlineTableCell className="w-44 px-1 py-1.5 align-top text-right text-[13px]">
                      {li.unitCost != null ? formatCurrency(li.unitCost) : "--"}
                    </InlineTableCell>
                    <InlineTableCell className="line-item-group-end w-32 px-1 py-1.5 align-top text-right text-[13px] font-semibold">
                      {formatCurrency(li.costRom)}
                    </InlineTableCell>
                    {expectingRevenue && (
                      <>
                        <InlineTableCell className="line-item-group-start w-24 border-l border-border/60 px-2 py-1.5 align-top text-[13px]">
                          {li.unitOfMeasure || "--"}
                        </InlineTableCell>
                        <InlineTableCell className="w-28 px-1 py-1.5 align-top text-right text-[13px]">
                          {li.quantity ?? "--"}
                        </InlineTableCell>
                        <InlineTableCell className="w-44 px-1 py-1.5 align-top text-right text-[13px]">
                          {li.unitCost != null ? formatCurrency(li.unitCost) : "--"}
                        </InlineTableCell>
                      </>
                    )}
                    <InlineTableCell className="line-item-group-start w-32 border-l border-border/60 px-1 py-1.5 align-top text-right text-[13px] font-semibold">
                      {formatCurrency(li.revenueRom)}
                    </InlineTableCell>
                    <InlineTableCell className="line-item-group-start w-36 border-l border-border/60 px-2 py-1.5 align-top text-right text-[13px] font-semibold">
                      {formatCurrency(li.nonCommittedCost ?? 0)}
                    </InlineTableCell>
                    <InlineTableCell
                      className={cn(
                        "w-32 px-1 py-1.5 align-top text-right text-[13px] font-semibold",
                        liOverUnder < 0 ? "text-destructive" : liOverUnder > 0 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {formatCurrency(liOverUnder)}
                    </InlineTableCell>
                    <InlineTableCell className="w-12 px-1 py-1.5 align-top">
                      {(onDeleteLineItem || changeEventId) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              aria-label="More line item actions"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {changeEventId && (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEdit(li); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {changeEventId && onDeleteLineItem && <DropdownMenuSeparator />}
                            {onDeleteLineItem && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => void onDeleteLineItem(li.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </InlineTableCell>
                  </InlineTableRow>
                );
              })}
              <InlineTableRow className="bg-muted/35 hover:bg-muted/35">
                <InlineTableCell className="border-t border-border px-1.5 pb-2.5 pt-4" />
                <InlineTableCell colSpan={4} className="border-t border-border px-1.5 pb-3 pt-4 text-sm font-semibold text-foreground">
                  Totals
                </InlineTableCell>
                <InlineTableCell colSpan={2} className="border-t border-border px-1.5 pb-2.5 pt-4" />
                <InlineTableCell className="border-t border-border px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground">
                  {formatCurrency(lineItemSubtotals.costRom)}
                </InlineTableCell>
                {expectingRevenue && (
                  <>
                    <InlineTableCell colSpan={3} className="border-t border-border px-1.5 pb-2.5 pt-4" />
                  </>
                )}
                <InlineTableCell className="border-t border-border px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground">
                  {formatCurrency(lineItemSubtotals.revenueRom)}
                </InlineTableCell>
                <InlineTableCell className="border-t border-border px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold text-foreground">
                  {formatCurrency(lineItemSubtotals.nonCommittedCost)}
                </InlineTableCell>
                <InlineTableCell
                  className={cn(
                    "border-t border-border px-1.5 pb-2.5 pt-4 text-right text-sm font-semibold",
                    overUnder < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatCurrency(overUnder)}
                </InlineTableCell>
                <InlineTableCell className="border-t border-border px-1.5 pb-2.5 pt-4" />
              </InlineTableRow>
            </InlineTableBody>
          </InlineTable>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <span className="text-sm text-muted-foreground">No line items added yet</span>
          {changeEventId && (
            <Button size="sm" variant="outline" onClick={openAdd}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Line Item
            </Button>
          )}
        </div>
      )}

      <Sheet
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-none md:w-140 md:max-w-none lg:w-150"
        >
          <SheetHeader className="px-6 py-5">
            <SheetTitle>{editingItem ? "Edit Line Item" : "Add Line Item"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {renderLineItemEditor()}
          </div>
          <SheetFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" size="sm" onClick={closeEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLineItem}
              disabled={isSaving || !formState.description.trim()}
            >
              {isSaving ? "Saving…" : editingItem ? "Save Changes" : "Add Line Item"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
