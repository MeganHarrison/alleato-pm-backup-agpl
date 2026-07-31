"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useCompanyContacts } from "@/hooks/use-company-contacts";
import { useProjectUsers } from "@/hooks/use-project-users";
import {
  CreateSubcontractSchema,
  type AccountingMethodValues,
  type CreateSubcontractInput,
  type SovLineItem,
} from "@/lib/schemas/create-subcontract-schema";
import type { AttachmentItem, BudgetCode, VendorOption } from "./types";
import {
  reconcileSovBudgetCodes,
  synthesizeMissingBudgetCodes,
} from "./sovBudgetCodeReconciliation";
import { apiFetchWithTransientRouteRetry } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

interface UseSubcontractFormStateOptions {
  projectId: number;
  initialData?: Partial<CreateSubcontractInput> & { sovLines?: SovLineItem[] };
  mode: "create" | "edit";
}

function buildDefaults(initialData?: Partial<CreateSubcontractInput>) {
  return {
    contractNumber: initialData?.contractNumber || "",
    status: initialData?.status || "Draft",
    executed: initialData?.executed ?? false,
    accountingMethod: initialData?.accountingMethod || "amount_based",
    sov: initialData?.sov || [],
    privacy: initialData?.privacy || {
      isPrivate: true,
      nonAdminUserIds: [],
      allowNonAdminViewSovItems: false,
    },
    title: initialData?.title || "",
    contractCompanyId: initialData?.contractCompanyId || "",
    description: initialData?.description || "",
    inclusions: initialData?.inclusions || "",
    exclusions: initialData?.exclusions || "",
    defaultRetainagePercent: initialData?.defaultRetainagePercent,
    dates: initialData?.dates || {
      startDate: undefined,
      estimatedCompletionDate: undefined,
      actualCompletionDate: undefined,
      contractDate: undefined,
      signedContractReceivedDate: undefined,
      issuedOnDate: undefined,
    },
    invoiceContactIds: initialData?.invoiceContactIds || [],
    attachments: [],
  } satisfies CreateSubcontractInput;
}

export function useSubcontractFormState({
  projectId,
  initialData,
  mode,
}: UseSubcontractFormStateOptions) {
  // --- Core form state ---
  const [sovLines, setSovLines] = React.useState<SovLineItem[]>(
    initialData?.sovLines || [],
  );
  const [attachments, setAttachments] = React.useState<AttachmentItem[]>(
    (initialData?.attachments || []).map((a) => ({
      name: a.name,
      size: a.size ?? 0,
      type: a.type ?? "",
    })),
  );
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = React.useState<File[]>([]);
  const [budgetCodes, setBudgetCodes] = React.useState<BudgetCode[]>([]);
  const [loadingBudgetCodes, setLoadingBudgetCodes] = React.useState(true);
  const [vendorOptions, setVendorOptions] = React.useState<VendorOption[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = React.useState(true);

  // --- RHF ---
  const methods = useForm<CreateSubcontractInput>({
    resolver: zodResolver(CreateSubcontractSchema) as never,
    reValidateMode: "onBlur",
    defaultValues: buildDefaults(initialData),
  });
  const { setValue, control, reset } = methods;
  const contractCompanyId = useWatch({ control, name: "contractCompanyId" });
  const accountingMethod = useWatch({ control, name: "accountingMethod" });

  // --- Auto-generate contract number in create mode ---
  React.useEffect(() => {
    if (mode !== "create" || initialData?.contractNumber) return;

    const generate = async () => {
      try {
        const payload = await apiFetchWithTransientRouteRetry<
          | { data?: Array<{ contract_number?: string | null }> }
          | Array<{ contract_number?: string | null }>
        >(`/api/projects/${projectId}/subcontracts`);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.data)
            ? payload.data
            : [];

        // Parse existing SC-### numbers and find the highest
        const SC_RE = /^SC-(\d+)$/i;
        let max = 0;
        for (const row of rows) {
          const match = SC_RE.exec(row.contract_number ?? "");
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
          }
        }

        const next = `SC-${String(max + 1).padStart(3, "0")}`;
        setValue("contractNumber", next, { shouldDirty: false });
      } catch (error) {
        reportNonCriticalFailure({
          area: "subcontract-form",
          operation: "generate-contract-number",
          error,
          userVisibleFallback: "Contract number could not be generated automatically.",
          metadata: { projectId, mode },
        });
      }
    };

    generate();
  }, [projectId, mode, initialData?.contractNumber, setValue]);

  // --- Fetch companies (contract companies) ---
  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoadingVendors(true);
        const data = await apiFetchWithTransientRouteRetry<
          Array<{ id: string; name: string }>
        >(
          `/api/companies`,
        );
        setVendorOptions(
          (data || []).map((c) => ({
            value: c.id,
            label: c.name,
            companyId: c.id,
          })),
        );
      } catch {
        setVendorOptions([]);
      } finally {
        setIsLoadingVendors(false);
      }
    };
    fetchCompanies();
  }, [projectId]);

  // --- Project users ---
  const { users: projectUsers, isLoading: isLoadingUsers } = useProjectUsers(
    String(projectId),
  );
  const userOptions = React.useMemo(
    () =>
      projectUsers.map((user) => ({
        value: user.id,
        label:
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.email ||
          "Unknown User",
      })),
    [projectUsers],
  );

  // --- Invoice contacts ---
  const {
    options: invoiceContactOptions,
    isLoading: isLoadingContacts,
    refetch: refetchContacts,
  } = useCompanyContacts({
    vendorId: contractCompanyId || undefined,
    enabled: !!contractCompanyId,
  });

  // Clear invoice contacts whenever the contract company changes (including to empty).
  // Skip the first run so we don't wipe pre-filled contacts when an existing record loads.
  const prevContractCompanyIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const prev = prevContractCompanyIdRef.current;
    if (prev === null) {
      prevContractCompanyIdRef.current = contractCompanyId || "";
      return;
    }
    if (prev !== (contractCompanyId || "")) {
      setValue("invoiceContactIds", []);
      prevContractCompanyIdRef.current = contractCompanyId || "";
    }
  }, [contractCompanyId, setValue]);

  const selectedVendor = React.useMemo(
    () => vendorOptions.find((vendor) => vendor.value === contractCompanyId) ?? null,
    [contractCompanyId, vendorOptions],
  );

  // --- Reset on edit ---
  React.useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    reset(buildDefaults(initialData));
    setSovLines(initialData.sovLines || []);
    setAttachments(
      (initialData.attachments || []).map((a) => ({
        name: a.name,
        size: a.size ?? 0,
        type: a.type ?? "",
      })),
    );
  }, [initialData, mode, reset]);

  // --- Fetch budget codes ---
  React.useEffect(() => {
    const fetchBudgetCodes = async () => {
      if (!projectId) return;
      try {
        setLoadingBudgetCodes(true);
        const data = await apiFetchWithTransientRouteRetry<{ budgetCodes: BudgetCode[] }>(
          `/api/projects/${projectId}/budget-codes`,
        );
        setBudgetCodes(data.budgetCodes || []);
      } catch {
        setBudgetCodes([]);
      } finally {
        setLoadingBudgetCodes(false);
      }
    };
    fetchBudgetCodes();
  }, [projectId]);

  // --- Sync attachments from initialData ---
  React.useEffect(() => {
    if (!initialData?.attachments) return;
    setAttachments(
      initialData.attachments.map((a) => ({
        name: a.name,
        size: a.size ?? 0,
        type: a.type ?? "",
      })),
    );
  }, [initialData?.attachments]);

  // --- Reconcile SOV budget codes ---
  React.useEffect(() => {
    setSovLines((prevLines) => {
      const { lines, changed } = reconcileSovBudgetCodes(prevLines, budgetCodes);
      return changed ? lines : prevLines;
    });
  }, [budgetCodes]);

  // --- Add synthetic budget codes from SOV ---
  // Without this, an SOV row whose stored `budget_code` text no longer exists
  // in `project_budget_codes` would render with an empty BudgetCodeSelector on
  // edit. Synthesizing a placeholder option preserves the value.
  React.useEffect(() => {
    const synthetic = synthesizeMissingBudgetCodes(sovLines, budgetCodes);
    if (synthetic.length > 0) setBudgetCodes((prev) => [...prev, ...synthetic]);
  }, [budgetCodes, sovLines]);

  // --- Seed initial SOV line ---
  React.useEffect(() => {
    if (sovLines.length > 0) return;
    const isUnitQuantity = accountingMethod === "unit_quantity";
    setSovLines([
      {
        lineNumber: 1,
        budgetCodeId: "",
        budgetCodeLabel: "",
        description: "",
        amount: 0,
        quantity: 1,
        unitCost: isUnitQuantity ? 0 : undefined,
        unitOfMeasure: isUnitQuantity ? "" : undefined,
        billedToDate: 0,
      } as SovLineItem,
    ]);
  }, [sovLines.length, accountingMethod]);

  // --- Accounting method toggle ---
  const toggleAccountingMethod = React.useCallback(() => {
    const nextMethod =
      accountingMethod === "unit_quantity" ? "amount_based" : "unit_quantity";
    const updatedItems = sovLines.map((item) => {
      if (item.isGroup) return item;
      if (nextMethod === "unit_quantity") {
        const quantity = item.quantity ?? 1;
        let unitCost = item.unitCost;
        if (unitCost === undefined || unitCost === null) {
          unitCost = (item.amount || 0) / quantity;
        }
        return { ...item, quantity, unitCost, unitOfMeasure: item.unitOfMeasure || "", amount: quantity * unitCost };
      }
      const amount = (item.quantity ?? 1) * (item.unitCost ?? 0);
      return { ...item, amount: amount || item.amount || 0, quantity: item.quantity, unitCost: item.unitCost, unitOfMeasure: item.unitOfMeasure };
    });
    setValue("accountingMethod", nextMethod as (typeof AccountingMethodValues)[number]);
    setSovLines(updatedItems);
  }, [accountingMethod, sovLines, setValue]);

  // --- Attachment handlers ---
  const handleAttachmentListChange = React.useCallback(
    (nextAttachments: Array<{ name: string; size: number; type: string; url?: string }>) => {
      setAttachments(nextAttachments);
      setPendingAttachmentFiles((prev) =>
        prev.filter((file) => nextAttachments.some((a) => a.name === file.name && a.size === file.size)),
      );
    },
    [],
  );

  const handleFilesSelected = React.useCallback((selectedFiles: File[]) => {
    setPendingAttachmentFiles((prev) => {
      const next = [...prev];
      for (const file of selectedFiles) {
        if (!next.some((c) => c.name === file.name && c.size === file.size && c.lastModified === file.lastModified)) {
          next.push(file);
        }
      }
      return next;
    });
  }, []);

  return {
    methods,
    sovLines,
    setSovLines,
    attachments,
    pendingAttachmentFiles,
    budgetCodes,
    setBudgetCodes,
    loadingBudgetCodes,
    vendorOptions,
    isLoadingVendors,
    accountingMethod,
    toggleAccountingMethod,
    userOptions,
    isLoadingUsers,
    invoiceContactOptions,
    isLoadingContacts,
    refetchContacts,
    vendorId: contractCompanyId || null,
    vendorCompanyId: selectedVendor?.companyId ?? null,
    handleAttachmentListChange,
    handleFilesSelected,
  };
}
