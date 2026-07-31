"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type {
  BudgetCodeOption,
  ChangeEventFormData,
  ChangeEventLineItem,
  CommitmentSovLineItem,
  VendorOption,
} from "./types";
import { createEmptyLineItem, isMatchCostRevenueSource } from "./types";
import { changeEventFormSchema, buildChangeEventDefaults } from "./change-event-schema";
import { apiFetch } from "@/lib/api-client";
import { useDropdownData } from "./useDropdownData";
import {
  findBudgetCode,
  resolveBudgetCodeFromSov,
} from "@/lib/change-events/budget-code-match";

// Thin adapter over the shared resolver: maps the resolution onto this form's
// line-item shape (budgetCode / description). Matching itself lives in
// @/lib/change-events/budget-code-match so the detail-page inline editor and
// this form can never drift apart again.
function resolveBudgetCodeFromItems(
  items: CommitmentSovLineItem[],
  budgetCodes: BudgetCodeOption[],
): Partial<ChangeEventLineItem> {
  const resolution = resolveBudgetCodeFromSov(items, budgetCodes);
  const updates: Partial<ChangeEventLineItem> = {};
  if (resolution.budgetCodeId) updates.budgetCode = resolution.budgetCodeId;
  if (resolution.description) updates.description = resolution.description;
  return updates;
}

interface UseChangeEventFormDataOptions {
  initialData?: Partial<ChangeEventFormData>;
  projectId: number;
}

export function useChangeEventFormData({
  initialData,
  projectId,
}: UseChangeEventFormDataOptions) {
  const form = useForm<ChangeEventFormData>({
    resolver: zodResolver(changeEventFormSchema),
    defaultValues: buildChangeEventDefaults(initialData),
  });

  const lineItemArray = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const [nextNumber, setNextNumber] = React.useState<string>("");

  // Fetch the predicted next number on mount (create mode only)
  React.useEffect(() => {
    if (initialData?.contractNumber || initialData?.number) return;
    apiFetch<{ number: string }>(`/api/projects/${projectId}/change-events/next-number`)
      .then((res) => setNextNumber(res.number))
      .catch(() => setNextNumber(""));
  }, [projectId, initialData?.contractNumber, initialData?.number]);

  const [showCreateBudgetCodeModal, setShowCreateBudgetCodeModal] =
    React.useState(false);
  const [targetBudgetCodeRowIndex, setTargetBudgetCodeRowIndex] =
    React.useState<number | null>(null);
  const [commitmentLineItemsMap, setCommitmentLineItemsMap] = React.useState<
    Record<string, CommitmentSovLineItem[]>
  >({});

  // Dropdown data from separate hook
  const {
    vendors,
    setVendors,
    contracts,
    budgetCodes,
    primeContractOptions,
    primeContractSelectOptions,
    fetchBudgetCodes,
  } = useDropdownData({ projectId });

  // ── Reactive money computations ──
  // Cost ROM = cost qty × cost unit cost; Revenue ROM = revenue qty × revenue
  // unit cost (or mirrors cost when the revenue source is "match cost");
  // Non-committed = cost ROM − revenue ROM when the line has no commitment.
  // This replaces the imperative recompute that used to live in updateLineItem
  // so the computed columns (which ARE persisted to the server) stay correct.
  // Guarded to only run on the four editable numeric inputs, so setting the
  // computed fields below never re-triggers itself.
  React.useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (!name) return;
      const match = /^lineItems\.(\d+)\.(costQuantity|costUnitCost|revenueQuantity|revenueUnitCost)$/.exec(
        name,
      );
      if (!match) return;
      const index = Number(match[1]);
      const item = values.lineItems?.[index];
      if (!item) return;

      const costRom = Number(item.costQuantity || 0) * Number(item.costUnitCost || 0);
      const matchCost = isMatchCostRevenueSource(values.lineItemRevenueSource);
      const revenueRom = matchCost
        ? costRom
        : Number(item.revenueQuantity || 0) * Number(item.revenueUnitCost || 0);

      form.setValue(`lineItems.${index}.costRom`, costRom, { shouldDirty: true });
      form.setValue(`lineItems.${index}.revenueRom`, revenueRom, { shouldDirty: true });

      if (!item.contract) {
        form.setValue(
          `lineItems.${index}.nonCommittedCost`,
          costRom - revenueRom,
          { shouldDirty: true },
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // On mount (edit mode): fetch SOV items for any committed line items that are
  // missing a budget code and don't yet have cached SOV data. This ensures the
  // re-resolve effect below can run once the data arrives.
  const fetchedOnMountRef = React.useRef<Set<string>>(new Set());
  const initialLineItems = initialData?.lineItems;
  React.useEffect(() => {
    if (!initialLineItems) return;
    const ids = initialLineItems
      .filter((item) => item.commitmentId && !item.budgetCode)
      .map((item) => String(item.contract || item.commitmentId))
      .filter((id) => id && !fetchedOnMountRef.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((commitmentId) => {
      fetchedOnMountRef.current.add(commitmentId);
      const rawId = commitmentId.replace(/^(po|sub)-/, "");
      apiFetch<{ data: CommitmentSovLineItem[] }>(
        `/api/projects/${projectId}/commitments/${rawId}/line-items`,
      )
        .then((data) => {
          const items: CommitmentSovLineItem[] = data.data || [];
          setCommitmentLineItemsMap((prev) => ({ ...prev, [commitmentId]: items }));
        })
        .catch(() => {
          setCommitmentLineItemsMap((prev) => ({ ...prev, [commitmentId]: [] }));
        });
    });
  }, [initialLineItems, projectId]);

  // On mount (edit mode): ensure every saved line item's vendor appears in the
  // vendor dropdown. The vendor list is derived from active commitments that
  // have a company_name; a saved vendor whose commitment is inactive/voided or
  // whose company_name is null in the view would otherwise be absent, so the
  // Vendor combobox would render an empty "Select vendor..." placeholder on
  // edit even though vendor_id is stored — the exact edit-form-blank symptom
  // the FK gate targets. Inject each saved vendor using the name carried on the
  // line item (companies.name), falling back to the matching contract's vendor
  // name. Runs once contracts are available; setVendors dedupes by id.
  React.useEffect(() => {
    if (!initialLineItems || initialLineItems.length === 0) return;
    const savedVendors = new Map<string, string>();
    for (const item of initialLineItems) {
      const vendorId = item.vendor ? String(item.vendor) : "";
      if (!vendorId || savedVendors.has(vendorId)) continue;
      const fromContract = contracts.find(
        (c) => String(c.vendorId ?? "") === vendorId,
      )?.vendorName;
      savedVendors.set(vendorId, item.vendorName || fromContract || "Saved vendor");
    }
    if (savedVendors.size === 0) return;
    setVendors((prev) => {
      const existing = new Set(prev.map((v) => v.id));
      const additions: VendorOption[] = [];
      savedVendors.forEach((vendorName, id) => {
        if (!existing.has(id)) additions.push({ id, vendor_name: vendorName });
      });
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [initialLineItems, contracts, setVendors]);

  // Re-resolve budget codes for committed line items that are still missing one.
  // Handles two failure modes:
  //   1. Race condition — budgetCodes loaded after commitment was selected
  //   2. Edit form — existing line item has a commitment but budget_code_id was null in DB
  // Runs whenever budgetCodes or commitmentLineItemsMap becomes available.
  //
  // FK RESOLUTION PRESERVED: change_event_line_items.budget_code_id targets
  // budget_lines.id, but the dropdown/value we store is project_budget_codes.id.
  // resolveBudgetCodeFromSov maps via budget_lines.project_budget_code_id →
  // project_budget_codes.id (see @/lib/change-events/budget-code-match). Do not
  // change this mapping.
  React.useEffect(() => {
    if (budgetCodes.length === 0) return;

    const items = form.getValues("lineItems");
    items.forEach((item, index) => {
      if (!item.commitmentId || item.budgetCode) return;
      const cached = commitmentLineItemsMap[item.contract];
      if (!cached || cached.length === 0) return;
      const updates = resolveBudgetCodeFromItems(cached, budgetCodes);
      if (!updates.budgetCode) return;
      form.setValue(`lineItems.${index}`, { ...item, ...updates }, { shouldDirty: true });
    });
  }, [budgetCodes, commitmentLineItemsMap, form]);

  // ── Update helpers ──

  // Writes a single line-item field. Numeric edits are handled by the RHF number
  // / money field wrappers directly (which trigger the recompute subscription
  // above); this helper is used by the commitment / budget-code / vendor / UOM
  // combobox cells whose selection must be written imperatively.
  const updateLineItem = React.useCallback(
    (index: number, key: keyof ChangeEventLineItem, value: string | number) => {
      form.setValue(
        `lineItems.${index}.${key}` as `lineItems.${number}.${keyof ChangeEventLineItem}`,
        value as never,
        { shouldDirty: true },
      );
    },
    [form],
  );

  // ── Commitment change handlers ──

  const handleCommitmentChange = React.useCallback(
    async (rowIndex: number, commitmentId: string) => {
      const commitment = contracts.find((c) => c.id === commitmentId);

      // Ensure the commitment's vendor appears in the dropdown list.
      // The vendor list is built from contracts that have a company_name; if
      // company_name is null in the view, the vendor was silently excluded.
      // Add it here using the contract's own vendorName so the combobox can
      // display it immediately after selection.
      if (commitment?.vendorId) {
        setVendors((prev) => {
          if (prev.some((v) => v.id === commitment.vendorId)) return prev;
          return [
            ...prev,
            {
              id: String(commitment.vendorId),
              vendor_name: commitment.vendorName || "Unknown Vendor",
            },
          ];
        });
      }

      const current = form.getValues(`lineItems.${rowIndex}`);
      const nextRow: ChangeEventLineItem = {
        ...current,
        contract: commitmentId,
        commitmentId: commitmentId || undefined,
        commitmentLineItemId: "",
      };
      if (commitment?.vendorId) {
        nextRow.vendor = String(commitment.vendorId);
      }
      // Immediately populate description from commitment title (same pattern as vendor)
      if (commitment?.title && !nextRow.description) {
        nextRow.description = commitment.title;
      }
      form.setValue(`lineItems.${rowIndex}`, nextRow, { shouldDirty: true });

      if (!commitmentId) return;

      if (commitmentLineItemsMap[commitmentId] !== undefined) {
        const items = commitmentLineItemsMap[commitmentId];
        const updates = resolveBudgetCodeFromItems(items, budgetCodes);
        if (Object.keys(updates).length > 0) {
          const row = form.getValues(`lineItems.${rowIndex}`);
          form.setValue(
            `lineItems.${rowIndex}`,
            { ...row, ...updates },
            { shouldDirty: true },
          );
        }
        return;
      }

      const rawId = commitmentId.replace(/^(po|sub)-/, "");
      try {
        const data = await apiFetch<{ data: CommitmentSovLineItem[] }>(
          `/api/projects/${projectId}/commitments/${rawId}/line-items`,
        );
        const items: CommitmentSovLineItem[] = data.data || [];
        setCommitmentLineItemsMap((prev) => ({ ...prev, [commitmentId]: items }));

        const updates = resolveBudgetCodeFromItems(items, budgetCodes);
        if (Object.keys(updates).length > 0) {
          const row = form.getValues(`lineItems.${rowIndex}`);
          form.setValue(
            `lineItems.${rowIndex}`,
            { ...row, ...updates },
            { shouldDirty: true },
          );
        }
      } catch {
        setCommitmentLineItemsMap((prev) => ({ ...prev, [commitmentId]: [] }));
      }
    },
    [contracts, commitmentLineItemsMap, budgetCodes, projectId, setVendors, form],
  );

  const handleCommitmentLineItemChange = React.useCallback(
    (rowIndex: number, commitmentId: string, sovLineItemId: string) => {
      const items = commitmentLineItemsMap[commitmentId] || [];
      const selectedItem = items.find((i) => i.id === sovLineItemId);
      const current = form.getValues(`lineItems.${rowIndex}`);
      const nextRow: ChangeEventLineItem = {
        ...current,
        commitmentLineItemId: sovLineItemId,
      };
      if (selectedItem?.budget_code) {
        const bc = findBudgetCode(selectedItem.budget_code, budgetCodes);
        if (bc) nextRow.budgetCode = bc.id;
      }
      if (selectedItem?.description) {
        nextRow.description = selectedItem.description;
      }
      form.setValue(`lineItems.${rowIndex}`, nextRow, { shouldDirty: true });
    },
    [commitmentLineItemsMap, budgetCodes, form],
  );

  // ── CSV import ──

  const csvInputRef = React.useRef<HTMLInputElement>(null);

  const handleCsvImport = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) || "";
        const rows = text.split(/\r?\n/).filter((r) => r.trim());
        if (rows.length < 2) return;
        const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
        const newItems: ChangeEventLineItem[] = [];
        let unresolvedBudgetCodes = 0;
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const get = (aliases: string[]) => {
            for (const a of aliases) {
              const idx = headers.indexOf(a);
              if (idx !== -1) return cols[idx] || "";
            }
            return "";
          };
          const costQty = Number(get(["cost qty", "cost quantity", "qty", "quantity"])) || 1;
          const costUnit = Number(get(["cost unit cost", "unit cost", "unit_cost", "cost"])) || 0;
          const costRom = costQty * costUnit;
          const revenueQty = Number(get(["revenue qty", "revenue quantity"])) || costQty;
          const revenueUnit = Number(get(["revenue unit cost"])) || costUnit;
          const rawBudgetCode = get(["budget code", "budget_code", "code"]);
          const matchedBudgetCode = findBudgetCode(rawBudgetCode, budgetCodes);
          if (rawBudgetCode && !matchedBudgetCode) {
            unresolvedBudgetCodes += 1;
          }
          newItems.push({
            ...createEmptyLineItem(),
            budgetCode: matchedBudgetCode?.id || "",
            description: get(["description", "desc"]),
            costQuantity: costQty,
            costUnitCost: costUnit,
            costRom,
            nonCommittedCost: costRom - (revenueQty * revenueUnit),
            revenueQuantity: revenueQty,
            revenueUnitCost: revenueUnit,
            revenueRom: revenueQty * revenueUnit,
            revenueUnitOfMeasure: get(["uom", "unit of measure", "unit"]),
          });
        }
        if (newItems.length > 0) {
          const existing = form.getValues("lineItems");
          const shouldReplace =
            existing.length === 1 &&
            !existing[0].description &&
            !existing[0].budgetCode;
          lineItemArray.replace(shouldReplace ? newItems : [...existing, ...newItems]);
          toast.success(`Imported ${newItems.length} line item${newItems.length !== 1 ? "s" : ""} from CSV`);
          if (unresolvedBudgetCodes > 0) {
            toast.warning(
              `${unresolvedBudgetCodes} budget code${unresolvedBudgetCodes !== 1 ? "s" : ""} could not be matched. Select them before saving.`,
            );
          }
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [budgetCodes, form, lineItemArray],
  );

  // ── Add from commitment ──

  const handleAddAllCommitmentLineItems = React.useCallback(
    async (commitmentId: string) => {
      if (!commitmentId) return;
      const rawId = commitmentId.replace(/^(po|sub)-/, "");
      let items: CommitmentSovLineItem[] = commitmentLineItemsMap[commitmentId] || [];
      if (items.length === 0) {
        try {
          const data = await apiFetch<{ data: CommitmentSovLineItem[] }>(
            `/api/projects/${projectId}/commitments/${rawId}/line-items`,
          );
          items = data.data || [];
          setCommitmentLineItemsMap((prev) => ({ ...prev, [commitmentId]: items }));
        } catch {
          toast.error("Failed to load commitment line items");
          return;
        }
      }
      if (items.length === 0) {
        toast.error("No line items found for this commitment");
        return;
      }
      const commitment = contracts.find((c) => c.id === commitmentId);
      const newRows: ChangeEventLineItem[] = items.map((li) => {
        const bc = findBudgetCode(li.budget_code, budgetCodes);
        return {
          ...createEmptyLineItem(),
          budgetCode: bc?.id || "",
          description: li.description || "",
          vendor: commitment?.vendorId || "",
          contract: commitmentId,
          commitmentId: commitmentId,
          commitmentLineItemId: li.id,
        };
      });
      const existing = form.getValues("lineItems");
      const shouldReplace =
        existing.length === 1 &&
        !existing[0].description &&
        !existing[0].budgetCode;
      lineItemArray.replace(shouldReplace ? newRows : [...existing, ...newRows]);
      toast.success(
        `Added ${newRows.length} line item${newRows.length !== 1 ? "s" : ""} from commitment`,
      );
    },
    [commitmentLineItemsMap, contracts, budgetCodes, projectId, form, lineItemArray],
  );

  // ── Line item CRUD ──

  const addLineItem = React.useCallback(() => {
    lineItemArray.append(createEmptyLineItem());
  }, [lineItemArray]);

  const removeLineItem = React.useCallback(
    (index: number) => {
      if (lineItemArray.fields.length > 1) {
        lineItemArray.remove(index);
      } else {
        lineItemArray.replace([createEmptyLineItem()]);
      }
    },
    [lineItemArray],
  );

  // ── Budget code created handler ──

  const handleBudgetCodeCreated = React.useCallback(
    async (budgetCodeId: string) => {
      await fetchBudgetCodes();
      if (targetBudgetCodeRowIndex !== null && budgetCodeId) {
        updateLineItem(targetBudgetCodeRowIndex, "budgetCode", budgetCodeId);
      }
      setTargetBudgetCodeRowIndex(null);
      toast.success("Budget code created successfully");
    },
    [fetchBudgetCodes, targetBudgetCodeRowIndex, updateLineItem],
  );

  return {
    form,
    lineItemFields: lineItemArray.fields,
    nextNumber,
    updateLineItem,
    vendors,
    contracts,
    budgetCodes,
    primeContractOptions,
    primeContractSelectOptions,
    commitmentLineItemsMap,
    showCreateBudgetCodeModal,
    setShowCreateBudgetCodeModal,
    targetBudgetCodeRowIndex,
    setTargetBudgetCodeRowIndex,
    handleCommitmentChange,
    handleCommitmentLineItemChange,
    handleAddAllCommitmentLineItems,
    addLineItem,
    removeLineItem,
    csvInputRef,
    handleCsvImport,
    handleBudgetCodeCreated,
  };
}
