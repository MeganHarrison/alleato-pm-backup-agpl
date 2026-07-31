"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { arrayMove } from "@dnd-kit/sortable";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useProjectCompanies } from "@/hooks/use-project-companies";
import { useProjectUsers } from "@/hooks/use-project-users";
import { getAutoFillData, isDevelopment } from "@/lib/dev-autofill";
import { apiFetch, apiFetchWithTransientRouteRetry } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { createClient } from "@/lib/supabase/client";
import type { EstimateWorkbookImportRow } from "@/lib/prime-contracts/estimate-workbook-sov";

import type {
  BudgetCode,
  ContractFormData,
  MarkupFormItem,
  SOVLineItem,
} from "./types";

const DEFAULT_MARKUPS: MarkupFormItem[] = [
  {
    id: "markup-default-1",
    markup_type: "insurance",
    percentage: 1.35,
    compound: true,
    calculation_order: 1,
    display_in: "horizontal",
    maps_to: "all",
  },
  {
    id: "markup-default-2",
    markup_type: "fee",
    percentage: 10,
    compound: true,
    calculation_order: 2,
    display_in: "horizontal",
    maps_to: "all",
  },
];

// Permissive schema: only Contract # and Title are required (identical to the
// legacy inline validation). `.passthrough()` keeps every other field — SOV
// items, dates, markups, privacy — untouched so zodResolver never strips or
// coerces the payload the create/update handlers rely on. The `.refine` checks
// the trimmed value without mutating the stored (untrimmed) string.
const contractFormSchema = z
  .object({
    number: z
      .string()
      .refine((value) => value.trim().length > 0, "Contract # is required."),
    title: z
      .string()
      .refine((value) => value.trim().length > 0, "Title is required."),
  })
  .passthrough();

interface PrimeContractFormStateArgs {
  initialData?: Partial<ContractFormData>;
  projectId: string;
  mode?: "create" | "edit";
  onSubmit: (data: ContractFormData, attachmentFiles?: File[]) => Promise<void>;
}

function buildDefaultValues(
  initialData?: Partial<ContractFormData>,
): ContractFormData {
  // Markups live in their own state (they are not RHF fields), so keep them out
  // of the form store to avoid a stale duplicate.
  const { markups: _markups, ...rest } = initialData ?? {};
  void _markups;
  return {
    number: "",
    title: "",
    status: "draft",
    executed: false,
    isPrivate: false,
    accountingMethod: "amount",
    sovItems: [],
    ...rest,
  } as ContractFormData;
}

export function usePrimeContractFormState({
  initialData,
  projectId,
  mode = "edit",
  onSubmit,
}: PrimeContractFormStateArgs) {
  const form = useForm<ContractFormData>({
    // Single narrowing cast: the schema is intentionally `.passthrough()` so it
    // never strips/coerces the payload, which makes its inferred output a
    // {number,title} + index-signature type. ContractFormData is assignable to
    // that, so a single cast narrows it without a double type-escape.
    resolver: zodResolver(contractFormSchema) as Resolver<ContractFormData>,
    defaultValues: buildDefaultValues(initialData),
    mode: "onSubmit",
  });

  const { getValues, setValue } = form;

  // Live views of the array/complex fields the SOV + attachment surfaces read.
  const watchedSovItems = (form.watch("sovItems") ?? []) as SOVLineItem[];
  const watchedAccountingMethod = form.watch("accountingMethod") ?? "amount";
  const watchedAttachments = form.watch("attachments") ?? [];
  const watchedOwnerCompanyId = form.watch("ownerCompanyId");

  const setSovItems = React.useCallback(
    (updater: (prev: SOVLineItem[]) => SOVLineItem[]) => {
      const prev = (getValues("sovItems") ?? []) as SOVLineItem[];
      setValue("sovItems", updater(prev), { shouldDirty: true });
    },
    [getValues, setValue],
  );

  const [pendingAttachmentFiles, setPendingAttachmentFiles] = React.useState<
    File[]
  >([]);
  const [budgetCodes, setBudgetCodes] = React.useState<BudgetCode[]>([]);
  const budgetCodesRef = React.useRef<BudgetCode[]>([]);
  const [loadingBudgetCodes, setLoadingBudgetCodes] = React.useState(true);
  const [openBudgetCodePopover, setOpenBudgetCodePopover] = React.useState<
    string | null
  >(null);
  const [budgetCodeSearchQuery, setBudgetCodeSearchQuery] = React.useState("");
  const [showCreateBudgetCodeModal, setShowCreateBudgetCodeModal] =
    React.useState(false);
  const [showImportEstimateWorkbook, setShowImportEstimateWorkbook] =
    React.useState(false);
  const [newBudgetCodeData, setNewBudgetCodeData] = React.useState({
    costCodeId: "",
    costType: "",
  });
  const [availableCostCodes, setAvailableCostCodes] = React.useState<
    Array<{
      id: string;
      title: string | null;
      status: string | null;
      division_title: string | null;
    }>
  >([]);
  const [loadingCostCodes, setLoadingCostCodes] = React.useState(false);
  const [expandedDivisions, setExpandedDivisions] = React.useState<Set<string>>(
    new Set(),
  );
  const [groupedCostCodes, setGroupedCostCodes] = React.useState<
    Record<
      string,
      Array<{
        id: string;
        title: string | null;
        status: string | null;
        division_title: string | null;
      }>
    >
  >({});
  const [showImportFromBudget, setShowImportFromBudget] = React.useState(false);
  const [markups, setMarkups] = React.useState<MarkupFormItem[]>(
    initialData?.markups ?? (mode === "create" ? DEFAULT_MARKUPS : []),
  );
  const initialMarkupsKey = React.useMemo(
    () => JSON.stringify(initialData?.markups ?? null),
    [initialData?.markups],
  );
  const [selectedSovItems, setSelectedSovItems] = React.useState<Set<string>>(
    new Set(),
  );
  const [isCreating, setIsCreating] = React.useState(false);

  // Company pickers (Owner/Client, Contractor, Architect/Engineer) must be
  // scoped to this project's directory — the companies assigned to the project
  // in `project_companies` — not the entire ERP-synced company list. Request a
  // full page (max the API allows) sorted by name so the whole project
  // directory is available without pagination in the dropdown.
  const {
    companies: projectCompanies,
    isLoading: companiesLoading,
    error: companiesError,
  } = useProjectCompanies(projectId, { per_page: 150, sort: "name" });

  // Keep `value` as the global company id (companies.id) so the stored
  // client_id / contractor_id / architect_engineer_id remain consistent with
  // the create/update handlers and edit-mode preselection.
  const companyOptions = React.useMemo(
    () =>
      projectCompanies
        .filter((pc) => Boolean(pc.company_id))
        .map((pc) => ({
          value: pc.company_id,
          label: pc.company?.name ?? "Unnamed company",
        })),
    [projectCompanies],
  );

  const { users: projectUsers } = useProjectUsers(projectId);
  const userOptions = projectUsers.map((u) => ({
    value: u.id,
    label:
      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
      u.email ||
      "Unnamed",
  }));

  React.useEffect(() => {
    if (companiesError) {
      console.error("[ContractForm] Failed to load companies:", companiesError);
      toast.error("Could not load company options", {
        description: companiesError.message,
      });
    }
  }, [companiesError]);

  // Owner/Client drives the contract company id (kept in sync, same as legacy).
  React.useEffect(() => {
    if (!watchedOwnerCompanyId) return;
    if (getValues("contractCompanyId") === watchedOwnerCompanyId) return;
    setValue("contractCompanyId", watchedOwnerCompanyId, { shouldDirty: true });
  }, [watchedOwnerCompanyId, getValues, setValue]);

  React.useEffect(() => {
    const nextMarkups = JSON.parse(initialMarkupsKey) as
      | MarkupFormItem[]
      | null;
    if (!nextMarkups) return;
    setMarkups(nextMarkups);
  }, [initialMarkupsKey]);

  React.useEffect(() => {
    if (mode !== "create" || initialData?.number) return;

    const fetchNextContractNumber = async () => {
      try {
        const contracts = await apiFetch<Array<{ contract_number: string }>>(
          `/api/projects/${projectId}/contracts`,
        );
        const nums = (contracts ?? [])
          .map((c) => {
            const match = /^PC-(\d+)$/.exec(c.contract_number ?? "");
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n) => n > 0);
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        if (!getValues("number")) {
          setValue("number", `PC-${String(next).padStart(3, "0")}`, {
            shouldDirty: false,
          });
        }
      } catch (error) {
        reportNonCriticalFailure({
          area: "prime-contract-create",
          operation: "prefill-next-contract-number",
          error,
          userVisibleFallback:
            "Contract number auto-fill failed; the field remains editable.",
          metadata: { projectId },
        });
      }
    };

    void fetchNextContractNumber();
  }, [mode, projectId, initialData?.number, getValues, setValue]);

  const fetchBudgetCodes = React.useCallback(async () => {
    if (!projectId) return [];
    try {
      setLoadingBudgetCodes(true);
      const { budgetCodes } = await apiFetchWithTransientRouteRetry<{
        budgetCodes: BudgetCode[];
      }>(`/api/projects/${projectId}/budget-codes`);
      const nextBudgetCodes = budgetCodes || [];
      budgetCodesRef.current = nextBudgetCodes;
      setBudgetCodes(nextBudgetCodes);
      return nextBudgetCodes;
    } catch (error) {
      console.error("[ContractForm] Failed to load budget codes:", error);
      toast.error("Failed to load budget codes");
      budgetCodesRef.current = [];
      setBudgetCodes([]);
      return [];
    } finally {
      setLoadingBudgetCodes(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void fetchBudgetCodes();
  }, [fetchBudgetCodes]);

  // For create mode: fetch existing project markups; use defaults only if none exist
  React.useEffect(() => {
    if (mode !== "create") return;
    const fetchExistingMarkups = async () => {
      try {
        const { markups: existing } = await apiFetch<{
          markups: Array<{
            id: string;
            markup_type: string;
            percentage: number;
            compound: boolean;
            calculation_order: number;
            maps_to_budget_code_id?: string | null;
          }>;
        }>(`/api/projects/${projectId}/vertical-markup`);
        if (existing && existing.length > 0) {
          setMarkups(
            existing.map((m) => ({
              id: m.id,
              markup_type: m.markup_type,
              percentage: m.percentage,
              compound: m.compound,
              calculation_order: m.calculation_order,
              display_in: "horizontal" as const,
              maps_to: m.maps_to_budget_code_id ?? "all",
            })),
          );
        }
        // If no existing markups, DEFAULT_MARKUPS (set in useState) are kept
      } catch (error) {
        reportNonCriticalFailure({
          area: "prime-contract-create",
          operation: "load-existing-markups",
          error,
          userVisibleFallback:
            "Financial markup defaults remain available when saved project markups cannot be loaded.",
          metadata: { projectId },
        });
      }
    };
    void fetchExistingMarkups();
  }, [mode, projectId]);

  // Auto-map fee → 55-0500 and insurance → 55-0050 once budget codes load
  React.useEffect(() => {
    if (budgetCodes.length === 0) return;
    const feeCode = budgetCodes.find((c) => c.code === "55-0500");
    const insuranceCode = budgetCodes.find((c) => c.code === "55-0050");
    if (!feeCode && !insuranceCode) return;
    setMarkups((prev) =>
      prev.map((m) => {
        if (m.maps_to !== "all") return m;
        if (m.markup_type === "fee" && feeCode)
          return { ...m, maps_to: feeCode.id };
        if (m.markup_type === "insurance" && insuranceCode)
          return { ...m, maps_to: insuranceCode.id };
        return m;
      }),
    );
  }, [budgetCodes]);

  // Financial markups are NO LONGER auto-applied to the SOV. The markup editor
  // still persists rates to the project-level `vertical_markup` config, but it
  // never generates synthetic SOV line items. Insurance/fee/etc. must be entered
  // as regular SOV line items by the user. This is intentionally always empty so
  // auto-application cannot happen on any SOV.
  const computedMarkupSovItems = React.useMemo((): SOVLineItem[] => [], []);

  // SOV items for display: user-entered items only (no auto-computed markup rows)
  const sovDisplayItems = React.useMemo(
    () => [...watchedSovItems],
    [watchedSovItems],
  );

  React.useEffect(() => {
    const fetchCostCodes = async () => {
      if (!showCreateBudgetCodeModal) return;

      try {
        setLoadingCostCodes(true);
        const supabaseClient = createClient();
        // NOTE: cost_codes.id is the human-readable code number (e.g. "03-010"),
        // NOT a UUID. Always render it as the code, never as a fallback.
        const { data, error } = await supabaseClient
          .from("cost_codes")
          .select("id, title, status, division_title")
          .eq("status", "Active")
          .order("id", { ascending: true });

        if (error) {
          return;
        }

        const codes = data || [];
        setAvailableCostCodes(codes);

        const grouped = codes.reduce(
          (acc: Record<string, typeof codes>, code: (typeof codes)[number]) => {
            const divisionKey = code.division_title || "Other";
            if (!acc[divisionKey]) {
              acc[divisionKey] = [];
            }
            acc[divisionKey].push(code);
            return acc;
          },
          {} as Record<string, typeof codes>,
        );

        setGroupedCostCodes(grouped);
      } catch (error) {
        console.error("Failed to fetch form data:", error);
      } finally {
        setLoadingCostCodes(false);
      }
    };

    void fetchCostCodes();
  }, [showCreateBudgetCodeModal]);

  // Validated-submit handler — passed to `form.handleSubmit(...)` by the form.
  // Number/Title are enforced by the Zod resolver; the $0-approval business rule
  // stays here (cross-field) so behavior is identical to the legacy handler.
  const submitHandler = React.useCallback(
    async (values: ContractFormData) => {
      if (values.status === "approved") {
        const baseItems = (values.sovItems || []).filter(
          (item) => !item.isGroup && !item.isMarkup,
        );
        const sovTotal = baseItems.reduce((sum, item) => {
          if (values.accountingMethod === "unit_quantity") {
            return sum + (item.quantity ?? 0) * (item.unitCost ?? 0);
          }
          return sum + (item.amount || 0);
        }, 0);
        if (sovTotal <= 0) {
          toast.error(
            "Cannot approve a contract with $0 value. Add SOV line items with amounts before approving.",
          );
          return;
        }
      }

      const submitData: ContractFormData = {
        ...values,
        // Markups are never auto-applied to the SOV — persist only user-entered lines.
        sovItems: [...(values.sovItems || [])],
        markups,
      };
      try {
        await onSubmit(submitData, pendingAttachmentFiles);
      } catch (error) {
        form.setError("root", {
          type: "server",
          message:
            error instanceof Error
              ? error.message
              : "The contract could not be saved. Please try again.",
        });
      }
    },
    [markups, onSubmit, pendingAttachmentFiles, form],
  );

  const getCostTypeLabel = React.useCallback((type: string) => {
    const types: Record<string, string> = {
      R: "Contract Revenue",
      E: "Equipment",
      X: "Expense",
      L: "Labor",
      M: "Material",
      S: "Subcontract",
    };
    return types[type] || type;
  }, []);

  const toggleDivision = React.useCallback((division: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(division)) {
        next.delete(division);
      } else {
        next.add(division);
      }
      return next;
    });
  }, []);

  const handleCreateBudgetCode = React.useCallback(async () => {
    try {
      setIsCreating(true);

      const selectedCostCode = availableCostCodes.find(
        (cc) => cc.id === newBudgetCodeData.costCodeId,
      );
      if (!selectedCostCode) {
        toast.error("Please select a cost code");
        return;
      }

      const { budgetCode } = await apiFetch<{ budgetCode: BudgetCode }>(
        `/api/projects/${projectId}/budget-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            cost_code_id: newBudgetCodeData.costCodeId,
            cost_type_id: newBudgetCodeData.costType,
            description: selectedCostCode.title || null,
          }),
        },
      );

      setBudgetCodes((prev) => {
        const next = [...prev, budgetCode];
        budgetCodesRef.current = next;
        return next;
      });

      const accountingMethod = getValues("accountingMethod");
      setSovItems((items) => {
        const firstEmptyRow = items.find((row) => !row.budgetCodeId);

        if (firstEmptyRow) {
          return items.map((row) =>
            row.id === firstEmptyRow.id
              ? {
                  ...row,
                  budgetCodeId: budgetCode.id,
                  budgetCodeLabel: budgetCode.fullLabel,
                }
              : row,
          );
        }

        const newLine: SOVLineItem = {
          id: `sov-${Date.now()}`,
          budgetCodeId: budgetCode.id,
          budgetCodeLabel: budgetCode.fullLabel,
          description: "",
          amount: 0,
          quantity: accountingMethod === "unit_quantity" ? 1 : undefined,
          unitCost: accountingMethod === "unit_quantity" ? 0 : undefined,
          unitOfMeasure: accountingMethod === "unit_quantity" ? "" : undefined,
          billedToDate: 0,
          amountRemaining: 0,
        };
        return [...items, newLine];
      });

      setShowCreateBudgetCodeModal(false);
      setNewBudgetCodeData({ costCodeId: "", costType: "" });
      toast.success("Budget code created and added to form");
    } catch (error) {
      toast.error(
        `Failed to create budget code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreating(false);
    }
  }, [availableCostCodes, newBudgetCodeData, projectId, getValues, setSovItems]);

  const handleBudgetCodeSelect = React.useCallback(
    (rowId: string, code: BudgetCode) => {
      setSovItems((items) =>
        items.map((row) =>
          row.id === rowId
            ? { ...row, budgetCodeId: code.id, budgetCodeLabel: code.fullLabel }
            : row,
        ),
      );
      setOpenBudgetCodePopover(null);
    },
    [setSovItems],
  );

  const addSOVLine = React.useCallback(() => {
    const isUnitQuantity = getValues("accountingMethod") === "unit_quantity";
    setSovItems((items) => {
      const newLine: SOVLineItem = {
        id: `sov-${Date.now()}`,
        budgetCodeId: "",
        budgetCodeLabel: "",
        description: "",
        amount: 0,
        quantity: isUnitQuantity ? 1 : undefined,
        unitCost: isUnitQuantity ? 0 : undefined,
        unitOfMeasure: isUnitQuantity ? "" : undefined,
        billedToDate: 0,
        amountRemaining: 0,
      };
      return [...items, newLine];
    });
  }, [getValues, setSovItems]);

  const addSOVGroup = React.useCallback(() => {
    setSovItems((items) => {
      const newGroup: SOVLineItem = {
        id: `sov-group-${Date.now()}`,
        isGroup: true,
        description: "New Group",
        amount: 0,
        billedToDate: 0,
        amountRemaining: 0,
      };
      return [...items, newGroup];
    });
  }, [setSovItems]);

  const updateSOVLine = React.useCallback(
    (id: string, updates: Partial<SOVLineItem>) => {
      const isUnitQuantity = getValues("accountingMethod") === "unit_quantity";
      setSovItems((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                amount:
                  isUnitQuantity && (updates.quantity || updates.unitCost)
                    ? (updates.quantity ?? item.quantity ?? 0) *
                      (updates.unitCost ?? item.unitCost ?? 0)
                    : (updates.amount ?? item.amount),
              }
            : item,
        ),
      );
    },
    [getValues, setSovItems],
  );

  const removeSOVLine = React.useCallback(
    (id: string) => {
      setSovItems((items) => items.filter((item) => item.id !== id));
      setSelectedSovItems((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [setSovItems],
  );

  const reorderSovLine = React.useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;
      setSovItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newIndex = items.findIndex((item) => item.id === overId);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    },
    [setSovItems],
  );

  const toggleSovItemSelection = React.useCallback((id: string) => {
    setSelectedSovItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSovItems = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        const nonGroupIds = ((getValues("sovItems") ?? []) as SOVLineItem[])
          .filter((item) => !item.isGroup)
          .map((item) => item.id);
        setSelectedSovItems(new Set(nonGroupIds));
      } else {
        setSelectedSovItems(new Set());
      }
    },
    [getValues],
  );

  const bulkRemoveSovLines = React.useCallback(() => {
    setSovItems((items) => items.filter((item) => !selectedSovItems.has(item.id)));
    setSelectedSovItems(new Set());
  }, [selectedSovItems, setSovItems]);

  const toggleSovAccountingMethod = React.useCallback(() => {
    const nextMethod =
      getValues("accountingMethod") === "unit_quantity"
        ? "amount"
        : "unit_quantity";

    setSovItems((items) =>
      items.map((item) => {
        if (item.isGroup) return item;

        if (nextMethod === "unit_quantity") {
          const quantity = item.quantity ?? 1;
          const unitCost = item.unitCost ?? item.amount ?? 0;
          return {
            ...item,
            quantity,
            unitCost,
            unitOfMeasure: item.unitOfMeasure ?? "",
            amount: quantity * unitCost,
          };
        }

        const amount = item.amount ?? (item.quantity ?? 0) * (item.unitCost ?? 0);
        return { ...item, amount };
      }),
    );
    setValue("accountingMethod", nextMethod, { shouldDirty: true });
  }, [getValues, setValue, setSovItems]);

  const handleImportFromBudgetSuccess = React.useCallback(
    (items: unknown[]) => {
      const importedItems = Array.isArray(items) ? items : [];
      if (importedItems.length === 0) return;

      let unmappedCount = 0;
      const mapped: SOVLineItem[] = importedItems.map((raw, index) => {
        const item = raw as {
          costCode?: string;
          costCodeDescription?: string;
          description?: string;
          originalBudgetAmount?: number;
          costType?: string;
        };

        const fallbackLabel = item.costCode
          ? item.costCodeDescription
            ? `${item.costCode} - ${item.costCodeDescription}`
            : item.costCode
          : "";

        const matchingCode =
          budgetCodes.find(
            (bc) =>
              bc.code === item.costCode &&
              (item.costType ? bc.costType === item.costType : true),
          ) ?? budgetCodes.find((bc) => bc.code === item.costCode);

        if (!matchingCode) unmappedCount++;

        return {
          id: `sov-import-${Date.now()}-${index}`,
          budgetCodeId: matchingCode?.id ?? "",
          budgetCodeLabel: matchingCode?.fullLabel ?? fallbackLabel,
          description:
            item.costCodeDescription || item.description || item.costCode || "",
          amount: item.originalBudgetAmount || 0,
          billedToDate: 0,
          amountRemaining: item.originalBudgetAmount || 0,
        };
      });

      setSovItems((prev) => [...prev, ...mapped]);

      if (unmappedCount > 0) {
        toast.warning(
          `${unmappedCount} item${unmappedCount !== 1 ? "s" : ""} could not be matched to a budget code — please select manually before saving.`,
        );
      } else {
        toast.success(
          `Imported ${mapped.length} SOV line item${mapped.length === 1 ? "" : "s"}`,
        );
      }
    },
    [budgetCodes, setSovItems],
  );

  const handleImportEstimateWorkbookSuccess = React.useCallback(
    (rows: EstimateWorkbookImportRow[]) => {
      if (rows.length === 0) return;

      const activeBudgetCodes = budgetCodesRef.current;
      let unmappedCount = 0;
      const mapped: SOVLineItem[] = rows.map((row, index) => {
        const matchingCode =
          activeBudgetCodes.find(
            (code) =>
              (code.costCodeId === row.costCode ||
                code.code === row.costCode) &&
              (row.costTypeCode ? code.costType === row.costTypeCode : true),
          ) ??
          activeBudgetCodes.find(
            (code) =>
              code.costCodeId === row.costCode ||
              code.code === row.costCode,
          );

        if (!matchingCode) unmappedCount++;

        const quantity =
          row.unitQty && row.unitQty > 0 ? row.unitQty : undefined;
        const unitCost = quantity ? row.budgetAmount / quantity : undefined;

        return {
          id: `sov-estimate-import-${Date.now()}-${index}`,
          budgetCodeId: matchingCode?.id ?? "",
          budgetCodeLabel:
            matchingCode?.fullLabel ??
            `${row.costCode}${row.costTypeCode ? `.${row.costTypeCode}` : ""}`,
          description: row.workDescription
            ? `${row.description} - ${row.workDescription}`
            : row.description,
          amount: row.budgetAmount,
          quantity,
          unitCost,
          unitOfMeasure: row.unitOfMeasure ?? undefined,
          billedToDate: 0,
          amountRemaining: row.budgetAmount,
        };
      });

      setSovItems((prev) => [...prev, ...mapped]);

      if (unmappedCount > 0) {
        toast.warning(
          `${unmappedCount} estimate row${unmappedCount === 1 ? "" : "s"} could not be matched to active project budget codes. Select the missing budget codes before saving.`,
        );
      } else {
        toast.success(
          `Imported ${mapped.length} estimate row${mapped.length === 1 ? "" : "s"} to SOV`,
        );
      }
    },
    [setSovItems],
  );

  const handleAttachmentListChange = React.useCallback(
    (nextFiles: NonNullable<ContractFormData["attachments"]>) => {
      const remaining = new Set(
        nextFiles.map((file) => `${file.name}:${file.size}:${file.type || ""}`),
      );

      setValue("attachments", nextFiles, { shouldDirty: true });
      setPendingAttachmentFiles((prev) =>
        prev.filter((file) =>
          remaining.has(`${file.name}:${file.size}:${file.type || ""}`),
        ),
      );
    },
    [setValue],
  );

  const handleFilesSelected = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const current = getValues("attachments") ?? [];
      setValue(
        "attachments",
        [
          ...current,
          ...files.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
          })),
        ],
        { shouldDirty: true },
      );
      setPendingAttachmentFiles((prev) => [...prev, ...files]);
    },
    [getValues, setValue],
  );

  const handleAutoFill = React.useCallback(() => {
    if (!isDevelopment) return;
    const autoFillData = getAutoFillData("primeContract");
    form.reset(
      { ...getValues(), ...autoFillData } as ContractFormData,
      { keepDefaultValues: true },
    );
  }, [form, getValues]);

  const filteredBudgetCodes = React.useMemo(
    () =>
      budgetCodes.filter((code) =>
        code.fullLabel
          .toLowerCase()
          .includes(budgetCodeSearchQuery.toLowerCase()),
      ),
    [budgetCodeSearchQuery, budgetCodes],
  );

  const isUnitQuantityMode = watchedAccountingMethod === "unit_quantity";
  const sovColumnCount = isUnitQuantityMode ? 9 : 7;

  const sovTotals = React.useMemo(() => {
    // Include both user items and computed markup items in totals
    const items = sovDisplayItems.filter((item) => !item.isGroup);
    return {
      amount: items.reduce((sum, item) => sum + (item.amount || 0), 0),
      billedToDate: items.reduce(
        (sum, item) => sum + (item.billedToDate || 0),
        0,
      ),
      amountRemaining: items.reduce(
        (sum, item) => sum + ((item.amount || 0) - (item.billedToDate || 0)),
        0,
      ),
    };
  }, [sovDisplayItems]);

  // Legacy-shaped view for the SOV + attachment surfaces (they read only these).
  const formData: Partial<ContractFormData> = {
    accountingMethod: watchedAccountingMethod,
    sovItems: watchedSovItems,
    attachments: watchedAttachments,
  };

  return {
    form,
    submitHandler,
    formData,
    budgetCodes,
    loadingBudgetCodes,
    openBudgetCodePopover,
    budgetCodeSearchQuery,
    showCreateBudgetCodeModal,
    newBudgetCodeData,
    availableCostCodes,
    loadingCostCodes,
    expandedDivisions,
    groupedCostCodes,
    showImportFromBudget,
    showImportEstimateWorkbook,
    companyOptions,
    companiesLoading,
    userOptions,
    isCreating,
    filteredBudgetCodes,
    isUnitQuantityMode,
    sovColumnCount,
    sovTotals,
    getCostTypeLabel,
    toggleDivision,
    handleCreateBudgetCode,
    handleBudgetCodeSelect,
    addSOVLine,
    addSOVGroup,
    updateSOVLine,
    removeSOVLine,
    reorderSovLine,
    selectedSovItems,
    toggleSovItemSelection,
    toggleAllSovItems,
    bulkRemoveSovLines,
    toggleSovAccountingMethod,
    handleImportFromBudgetSuccess,
    handleImportEstimateWorkbookSuccess,
    handleAttachmentListChange,
    handleFilesSelected,
    handleAutoFill,
    setOpenBudgetCodePopover,
    setBudgetCodeSearchQuery,
    setShowCreateBudgetCodeModal,
    setNewBudgetCodeData,
    setShowImportFromBudget,
    setShowImportEstimateWorkbook,
    fetchBudgetCodes,
    markups,
    setMarkups,
    sovDisplayItems,
    computedMarkupSovItems,
  };
}
