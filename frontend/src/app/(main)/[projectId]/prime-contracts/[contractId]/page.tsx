"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  CreditCard,
  DollarSign,
  Download,
  GitBranch,
  History,
  Mail,
  MoreVertical,
  Pencil,
  PenLine,
  Plus,
  RefreshCw,
} from "lucide-react";

import { appToast as toast } from "@/lib/toast/app-toast";
import { useQueryClient } from "@tanstack/react-query";

import { ContentSectionStack, PageShell, PageTabs, SectionRuleHeading } from "@/components/layout";
import { EmptyState, EstimateVersionBadge } from "@/components/ds";
import { SyncFromEstimateModal } from "@/components/domain/contracts/SyncFromEstimateModal";
import { DocumentDeliveryDialog } from "@/components/documents/DocumentDeliveryDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import { fetchWithTransientRouteRetry } from "@/lib/fetch-with-transient-route-retry";
import { apiFetch } from "@/lib/api-client";
import { useConfirm } from "@/hooks/use-confirm";
import { handleFormError } from "@/lib/handle-form-error";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  usePaymentApplications,
  useDeletePaymentApplication,
} from "@/hooks/use-payment-applications";
import { primeContractKeys } from "@/hooks/use-prime-contracts";
import { useProjectCompanies } from "@/hooks/use-project-companies";

import { EmailsClient } from "../../emails/emails-client";
import { PrimeContractOverviewTab } from "./components/PrimeContractOverviewTab";
import { PrimeContractDialogs } from "./components/PrimeContractDialogs";
import { PrimeContractEstimateImportModal } from "./components/PrimeContractEstimateImportModal";
import { ContractForm } from "@/components/domain/contracts";
import { RelatedItemsTab } from "@/components/commitments/tabs/RelatedItemsTab";
import {
  PrimeContractChangeEventsTab,
  PrimeContractChangeOrdersTab,
  PrimeContractPcosSection,
  PrimeContractInvoicesTab,
  PrimeContractPaymentsTab,
  PrimeContractFinancialMarkupTab,
  PrimeContractAdvancedSettingsTab,
  PrimeContractSovTab,
  useSovEditing,
} from "@/components/domain/contracts/prime-contract-detail";
import { resolveContractLineBudgetCode } from "@/components/domain/contracts/prime-contract-detail/budget-code-resolution";

import type { ContractFormData } from "@/components/domain/contracts/ContractForm";
import type { MarkupFormItem } from "@/components/domain/contracts/prime-contract-form/types";
import type {
  BudgetCode,
  ChangeOrderFormState,
  Contract,
  ContractLineItem,
  ContractTab,
  LineItemFormState,
  OwnerInvoiceSummary,
  Payment,
  PrimeContractCO,
  RawPrimeContractCoRow,
  VerticalMarkup,
} from "./types";
import { mapPrimeContractChangeOrders } from "./types";

// #region Types

type BudgetCodeCreateTarget =
  | { type: "line-item-form" }
  | { type: "sov-line"; lineId: string };

interface PrimeContractSettings {
  project_id: number;
  co_tier_count: 1 | 2;
  allow_standard_users_create_pcco: boolean;
  allow_standard_users_create_pco: boolean;
  sov_always_editable: boolean;
  enable_completed_work_retainage: boolean;
  enable_stored_materials_retainage: boolean;
  default_retainage_percent: number;
  show_markup_on_co_pdf: boolean;
  show_markup_on_invoice_pdf: boolean;
  default_distribution_prime_contract: string | null;
  default_distribution_pcco: string | null;
  default_distribution_pco: string | null;
}

// #endregion

// #region Helpers

const normalizeVerticalMarkupRows = (rows: VerticalMarkup[]): VerticalMarkup[] =>
  rows.map((row) => ({
    ...row,
    markup_type: row.markup_type ?? "",
    percentage: Number.isFinite(Number(row.percentage)) ? Number(row.percentage) : 0,
    compound: Boolean(row.compound),
    calculation_order: Number.isFinite(Number(row.calculation_order)) ? Number(row.calculation_order) : 0,
  }));

const toMarkupFormItems = (rows: VerticalMarkup[]): MarkupFormItem[] =>
  normalizeVerticalMarkupRows(rows)
    .sort((a, b) => a.calculation_order - b.calculation_order)
    .map((row) => ({
      id: row.id,
      markup_type: row.markup_type,
      percentage: row.percentage,
      compound: row.compound,
      calculation_order: row.calculation_order,
      display_in: "horizontal",
      maps_to: row.maps_to_budget_code_id ?? "all",
    }));

const parseBulletList = (value: string | null | undefined): string[] => {
  if (!value) return [];
  const plainText = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "");
  return plainText.split(/[\n•]+/).map((item) => item.trim()).filter((item) => item.length > 0);
};

const getTextValue = (value: string | null | undefined): { text: string; isMissing: boolean } => {
  const normalized = value
    ?.replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return { text: "—", isMissing: true };
  return { text: normalized, isMissing: false };
};

const formatStatusLabel = (status: Contract["status"]) => {
  switch (status) {
    case "out_for_signature": return "Out for Signature";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const formatDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString();
};

// #endregion

// #region Component

export default function ProjectContractDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams()! ?? new URLSearchParams();
  const params = useParams()! ?? {};
  const projectId = params.projectId as string;
  const contractId = params.contractId as string;
  const { confirm, ConfirmDialog } = useConfirm();

  useProjectTitle("Prime Contract");

  // #region State

  // ── Core state ──────────────────────────────────────────────────────────
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContractTab>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── Line items & budget codes (shared by overview tab + edit mode) ──────
  const [lineItems, setLineItems] = useState<ContractLineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(true);
  const [budgetCodes, setBudgetCodes] = useState<BudgetCode[]>([]);
  const [budgetCodesLoading, setBudgetCodesLoading] = useState(false);

  // ── SOV editing (custom hook) ────────────────────────────────────────────
  const sov = useSovEditing({ projectId, contractId, lineItems, setLineItems, budgetCodes });

  // ── Line item add dialog (used by PrimeContractDialogs) ─────────────────
  const [showAddLineItemDialog, setShowAddLineItemDialog] = useState(false);
  const [lineItemForm, setLineItemForm] = useState<LineItemFormState>({
    lineNumber: "", description: "", quantity: "1", unitCost: "0", unitOfMeasure: "", budgetCodeId: "",
  });
  const [isSubmittingLineItem, setIsSubmittingLineItem] = useState(false);
  const [lineItemToDelete, setLineItemToDelete] = useState<ContractLineItem | null>(null);
  const [isDeletingLineItem, setIsDeletingLineItem] = useState(false);
  const [showEstimateImportModal, setShowEstimateImportModal] = useState(false);
  const [showCreateBudgetCodeModal, setShowCreateBudgetCodeModal] = useState(false);
  const [budgetCodeCreateTarget, setBudgetCodeCreateTarget] = useState<BudgetCodeCreateTarget | null>(null);

  // ── Change orders ───────────────────────────────────────────────────────
  const [changeOrders, setChangeOrders] = useState<PrimeContractCO[]>([]);
  const [showNewCoDialog, setShowNewCoDialog] = useState(false);
  const [coForm, setCoForm] = useState<ChangeOrderFormState>({ change_order_number: "", description: "", amount: "" });
  const [isSubmittingCo, setIsSubmittingCo] = useState(false);
  const [showRejectCoDialog, setShowRejectCoDialog] = useState(false);
  const [rejectingCoId, setRejectingCoId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectingCo, setIsRejectingCo] = useState(false);
  const [editingCo, setEditingCo] = useState<PrimeContractCO | null>(null);
  const [editCoForm, setEditCoForm] = useState<ChangeOrderFormState>({ change_order_number: "", description: "", amount: "" });
  const [isUpdatingCo, setIsUpdatingCo] = useState(false);
  const [deletingCo, setDeletingCo] = useState<PrimeContractCO | null>(null);
  const [isDeletingCo, setIsDeletingCo] = useState(false);

  // ── Invoices (React Query) ──────────────────────────────────────────────
  const { data: paymentApplications = [], isLoading: paymentsLoading } = usePaymentApplications(Number(projectId), contractId);
  const deletePaymentApp = useDeletePaymentApplication(Number(projectId), contractId);
  const queryClient = useQueryClient();
  const { companies: projectCompanies } = useProjectCompanies(String(projectId), {
    status: "ACTIVE",
    sort: "name",
    per_page: 150,
  });
  const [ownerInvoices, setOwnerInvoices] = useState<OwnerInvoiceSummary[]>([]);
  const [ownerInvoicesLoading, setOwnerInvoicesLoading] = useState(false);

  // ── Payments received ───────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsReceivedLoading, setPaymentsReceivedLoading] = useState(false);

  // ── Vertical markups ────────────────────────────────────────────────────
  const [verticalMarkups, setVerticalMarkups] = useState<VerticalMarkup[]>([]);
  const [savedVerticalMarkups, setSavedVerticalMarkups] = useState<VerticalMarkup[]>([]);
  const [markupsLoading, setMarkupsLoading] = useState(false);
  const [markupsLoaded, setMarkupsLoaded] = useState(false);

  // ── Advanced settings ───────────────────────────────────────────────────
  const [advancedSettings, setAdvancedSettings] = useState<PrimeContractSettings | null>(null);
  const [advancedSettingsLoading, setAdvancedSettingsLoading] = useState(false);
  const [advancedSettingsSaving, setAdvancedSettingsSaving] = useState(false);
  const [contractAdvancedDraft, setContractAdvancedDraft] = useState({
    inclusions: "", exclusions: "", is_private: false, payment_terms: "", billing_schedule: "",
  });


  // ── Document / sync dialogs ─────────────────────────────────────────────
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [documentDialogTab, setDocumentDialogTab] = useState<"download" | "email">("download");
  const [isSyncFromEstimateOpen, setIsSyncFromEstimateOpen] = useState(false);

  // #endregion

  // #region Data Fetching

  const fetchContract = useCallback(async () => {
    const response = await fetchWithTransientRouteRetry(
      `/api/projects/${projectId}/contracts/${contractId}`,
    );
    if (!response.ok) {
      setError(response.status === 404 ? "Contract not found" : "Failed to load contract");
      return;
    }
    setContract(await response.json());
  }, [contractId, projectId]);

  const fetchLineItems = useCallback(async () => {
    const response = await fetchWithTransientRouteRetry(
      `/api/projects/${projectId}/contracts/${contractId}/line-items`,
    );
    if (!response.ok) {
      handleFormError(
        new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`),
        { entity: "schedule of values", action: "load" },
      );
      return;
    }
    setLineItems((await response.json()) || []);
  }, [contractId, projectId]);

  const refreshContractAfterSovMutation = useCallback(async () => {
    setLineItemsLoading(true);
    try {
      await Promise.all([
        fetchContract(),
        fetchLineItems(),
        queryClient.invalidateQueries({
          queryKey: primeContractKeys.all(Number(projectId)),
        }),
        queryClient.invalidateQueries({
          queryKey: primeContractKeys.detail(Number(projectId), contractId),
        }),
      ]);
      router.refresh();
    } finally {
      setLineItemsLoading(false);
    }
  }, [contractId, fetchContract, fetchLineItems, projectId, queryClient, router]);

  const handleSaveContractField = useCallback(
    async (field: string, value: string | number | boolean | null) => {
      await apiFetch(`/api/projects/${projectId}/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      });
      await Promise.all([
        fetchContract(),
        queryClient.invalidateQueries({
          queryKey: primeContractKeys.all(Number(projectId)),
        }),
        queryClient.invalidateQueries({
          queryKey: primeContractKeys.detail(Number(projectId), contractId),
        }),
      ]);
      router.refresh();
    },
    [contractId, fetchContract, projectId, queryClient, router],
  );

  useEffect(() => {
    const loadContract = async () => {
      try {
        setLoading(true);
        await fetchContract();
      } catch {
        setError("Failed to load contract");
      } finally {
        setLoading(false);
      }
    };
    if (contractId && projectId) loadContract();
  }, [contractId, fetchContract, projectId]);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setIsEditing(true);
  }, [searchParams]);

  useEffect(() => {
    if (!contractId || !projectId) return;
    const loadLineItems = async () => {
      try {
        setLineItemsLoading(true);
        await fetchLineItems();
      } catch (err) {
        console.error("Failed to load schedule of values:", err);
        toast.error("Failed to load schedule of values. Try refreshing the page.");
      } finally {
        setLineItemsLoading(false);
      }
    };
    loadLineItems();
  }, [contractId, fetchLineItems, projectId]);

  useEffect(() => {
    if (!projectId) return;
    const fetchBudgetCodes = async () => {
      try {
        setBudgetCodesLoading(true);
        const response = await fetchWithTransientRouteRetry(
          `/api/projects/${projectId}/budget-codes`,
        );
        if (!response.ok) throw new Error("Failed to load budget codes");
        const { budgetCodes: codes } = (await response.json()) as { budgetCodes: BudgetCode[] };
        setBudgetCodes(codes || []);
      } catch {
        setBudgetCodes([]);
      } finally {
        setBudgetCodesLoading(false);
      }
    };
    fetchBudgetCodes();
  }, [projectId]);

  useEffect(() => {
    if (!contract) return;
    const fetchChangeOrders = async () => {
      try {
        const ccoResponse = await fetchWithTransientRouteRetry(
          `/api/projects/${projectId}/prime-contract-change-orders`,
        );
        const payload:
          | { data?: RawPrimeContractCoRow[] }
          | RawPrimeContractCoRow[] = ccoResponse.ok ? await ccoResponse.json() : [];
        const rawRows: RawPrimeContractCoRow[] = Array.isArray(payload)
          ? payload
          : payload.data ?? [];
        // Scope to this prime contract via `prime_contract_id` (the canonical FK set by
        // both manual creation and PCO promotion). Filtering on the legacy `contract_id`
        // dropped promoted PCCOs, which only carry `prime_contract_id`. The mapper also
        // normalizes API column names (pcco_number/total_amount) to the tab's shape.
        setChangeOrders(mapPrimeContractChangeOrders(rawRows, String(contractId)));
      } catch (err) {
        console.error("Failed to load change orders:", err);
        toast.error("Failed to load change orders. Try refreshing the page.");
      }
    };
    fetchChangeOrders();
  }, [contract, contractId, projectId]);

  useEffect(() => {
    if (activeTab !== "payments" || !contract) return;
    const fetchPayments = async () => {
      try {
        setPaymentsReceivedLoading(true);
        const response = await fetchWithTransientRouteRetry(
          `/api/projects/${projectId}/contracts/${contractId}/payments`,
        );
        if (response.ok) setPayments((await response.json()) || []);
      } catch (err) {
        console.error("Failed to load payments:", err);
      } finally {
        setPaymentsReceivedLoading(false);
      }
    };
    fetchPayments();
  }, [activeTab, contract, contractId, projectId]);

  useEffect(() => {
    if (activeTab !== "invoices" || !contract) return;
    const fetchOwnerInvoices = async () => {
      try {
        setOwnerInvoicesLoading(true);
        const response = await fetchWithTransientRouteRetry(
          `/api/projects/${projectId}/invoicing/owner?prime_contract_id=${contractId}`,
        );
        if (!response.ok) throw new Error("Failed to load owner invoices");
        const payload = (await response.json()) as { data?: OwnerInvoiceSummary[] };
        setOwnerInvoices(payload.data ?? []);
      } catch (err) {
        console.error("Failed to load owner invoices:", err);
        toast.error("Failed to load owner invoices. Try refreshing the page.");
      } finally {
        setOwnerInvoicesLoading(false);
      }
    };
    fetchOwnerInvoices();
  }, [activeTab, contract, contractId, projectId]);

  useEffect(() => {
    if (!contract) return;
    const fetchVerticalMarkups = async () => {
      try {
        setMarkupsLoading(true);
        setMarkupsLoaded(false);
        const response = await fetchWithTransientRouteRetry(
          `/api/projects/${projectId}/vertical-markup`,
        );
        if (!response.ok) return;
        const data = await response.json();
        const fetched = normalizeVerticalMarkupRows(data.markups || []);
        setVerticalMarkups(fetched);
        setSavedVerticalMarkups(fetched);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setMarkupsLoading(false);
        setMarkupsLoaded(true);
      }
    };
    fetchVerticalMarkups();
  }, [contract, projectId]);

  useEffect(() => {
    if (!projectId || !contract) return;
    const fetchAdvancedSettings = async () => {
      try {
        setAdvancedSettingsLoading(true);
        const settings = await apiFetch<PrimeContractSettings>(
          `/api/projects/${projectId}/contracts/settings`,
        );
        setAdvancedSettings(settings);
      } catch (error) {
        handleFormError(error, {
          entity: "prime contract advanced settings",
          action: "load",
        });
      } finally {
        setAdvancedSettingsLoading(false);
      }
    };
    fetchAdvancedSettings();
  }, [projectId, contract]);

  useEffect(() => {
    if (!contract) return;
    setContractAdvancedDraft({
      inclusions: contract.inclusions ?? "",
      exclusions: contract.exclusions ?? "",
      is_private: contract.is_private,
      payment_terms: contract.payment_terms ?? "",
      billing_schedule: contract.billing_schedule ?? "",
    });
  }, [contract]);


  // #endregion

  // #region Computed Values

  const inclusionsList = useMemo(() => parseBulletList(contract?.inclusions), [contract?.inclusions]);
  const exclusionsList = useMemo(() => parseBulletList(contract?.exclusions), [contract?.exclusions]);
  const companyOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const company of projectCompanies) {
      const companyId = company.company_id || company.company?.id;
      const companyName =
        company.company?.name ??
        ("company_name" in company && typeof company.company_name === "string"
          ? company.company_name
          : null);
      if (companyId && companyName) {
        options.set(companyId, companyName);
      }
    }
    if (contract?.contractor_id && contract.contractor?.name) {
      options.set(contract.contractor_id, contract.contractor.name);
    }
    if (contract?.architect_engineer_id && contract.architect_engineer?.name) {
      options.set(contract.architect_engineer_id, contract.architect_engineer.name);
    }
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [contract, projectCompanies]);
  const existingCostCodeByLineId = useMemo(
    () => new Map(lineItems.map((item) => [item.id, item.cost_code_id ?? null])),
    [lineItems],
  );
  const historyEntries = useMemo(() => {
    if (!contract) return [] as Array<{ id: string; label: string; details: string; at: string }>;

    const entries: Array<{ id: string; label: string; details: string; at: string }> = [
      {
        id: "created",
        label: "Prime contract created",
        details: "Initial contract record was created.",
        at: contract.created_at,
      },
    ];

    if (contract.executed_at) {
      entries.push({
        id: "executed",
        label: "Prime contract executed",
        details: "Contract execution was recorded.",
        at: contract.executed_at,
      });
    }

    const createdAt = new Date(contract.created_at).getTime();
    const updatedAt = new Date(contract.updated_at).getTime();
    if (Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt - createdAt > 1000) {
      entries.push({
        id: "updated",
        label: "Prime contract updated",
        details: "Contract details were updated.",
        at: contract.updated_at,
      });
    }

    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [contract]);

  // #endregion

  // #region Handlers

  const handleBack = () => router.push(`/${projectId}/prime-contracts`);

  // ── Invoice CRUD ────────────────────────────────────────────────────────

  const handleDeleteInvoice = async (applicationId: string) => {
    const ok = await confirm({
      description: "Delete this invoice? This cannot be undone.",
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await deletePaymentApp.mutateAsync(applicationId);
  };

  // ── Change Order CRUD (for dialogs) ─────────────────────────────────────

  const handleCreateCo = async () => {
    if (!coForm.change_order_number || !coForm.description || !coForm.amount) { toast.error("CO number, description, and amount are required"); return; }
    setIsSubmittingCo(true);
    try {
      const newCo = await apiFetch<PrimeContractCO>(`/api/projects/${projectId}/prime-contract-change-orders`, {
        method: "POST",
        body: JSON.stringify({ contract_id: contractId, prime_contract_id: contractId, title: coForm.description, description: coForm.description, total_amount: parseFloat(coForm.amount) }),
      });
      setChangeOrders((prev) => [...prev, newCo]);
      setShowNewCoDialog(false);
      setCoForm({ change_order_number: "", description: "", amount: "" });
      toast.success("Change order created successfully");
    } catch { toast.error("Failed to create change order"); } finally { setIsSubmittingCo(false); }
  };

  const handleStartEditCo = (co: PrimeContractCO) => {
    setEditingCo(co);
    setEditCoForm({ change_order_number: co.change_order_number || "", description: co.description || "", amount: String(co.amount ?? "") });
  };

  const handleUpdateCo = async () => {
    if (!editingCo) return;
    if (!editCoForm.change_order_number || !editCoForm.description || !editCoForm.amount) { toast.error("CO number, description, and amount are required"); return; }
    setIsUpdatingCo(true);
    try {
      const updated = await apiFetch<PrimeContractCO>(`/api/projects/${projectId}/prime-contract-change-orders/${editingCo.id}`, {
        method: "PUT",
        body: JSON.stringify({ pcco_number: editCoForm.change_order_number, title: editCoForm.description, description: editCoForm.description, total_amount: parseFloat(editCoForm.amount) }),
      });
      setChangeOrders((prev) => prev.map((co) => (co.id === editingCo.id ? { ...co, ...updated } : co)));
      setEditingCo(null);
      toast.success("Change order updated");
    } catch { toast.error("Failed to update change order"); } finally { setIsUpdatingCo(false); }
  };

  const handleDeleteCo = async () => {
    if (!deletingCo) return;
    setIsDeletingCo(true);
    try {
      await apiFetch(`/api/projects/${projectId}/prime-contract-change-orders/${deletingCo.id}`, { method: "DELETE" });
      setChangeOrders((prev) => prev.filter((co) => co.id !== deletingCo.id));
      setDeletingCo(null);
      toast.success("Change order deleted");
    } catch { toast.error("Failed to delete change order"); } finally { setIsDeletingCo(false); }
  };

  const handleRejectCo = async () => {
    if (!rejectingCoId || !rejectionReason.trim()) { toast.error("Rejection reason is required"); return; }
    setIsRejectingCo(true);
    try {
      await apiFetch(`/api/projects/${projectId}/prime-contract-change-orders/${rejectingCoId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      setChangeOrders((prev) => prev.map((co) => co.id === rejectingCoId ? { ...co, status: "rejected", rejection_reason: rejectionReason } : co));
      setShowRejectCoDialog(false);
      setRejectingCoId(null);
      setRejectionReason("");
      toast.success("Change order rejected");
    } catch { toast.error("Failed to reject change order"); } finally { setIsRejectingCo(false); }
  };

  // ── Budget code creation ────────────────────────────────────────────────

  const handleBudgetCodeCreated = async (budgetCodeId: string) => {
    try {
      setBudgetCodesLoading(true);
      const { budgetCodes: codes } = await apiFetch<{ budgetCodes: BudgetCode[] }>(
        `/api/projects/${projectId}/budget-codes`,
      );
      setBudgetCodes(codes || []);
      const createdBudgetCode = (codes || []).find((code) => code.id === budgetCodeId);
      const costCodeId = createdBudgetCode?.costCodeId ?? null;
      if (budgetCodeCreateTarget?.type === "sov-line") {
        sov.setSovDraftItems((prev) => sov.normalizeSovDraftItems(prev.map((item) => item.id === budgetCodeCreateTarget.lineId ? { ...item, cost_code_id: costCodeId } : item)));
        sov.setSovDraftBudgetCodeIds((prev) => ({ ...prev, [budgetCodeCreateTarget.lineId]: budgetCodeId }));
      } else {
        setLineItemForm((prev) => ({ ...prev, budgetCodeId }));
      }
    } finally { setBudgetCodesLoading(false); setBudgetCodeCreateTarget(null); }
  };

  const handleRequestCreateBudgetCodeForLineItemForm = () => { setBudgetCodeCreateTarget({ type: "line-item-form" }); setShowCreateBudgetCodeModal(true); };
  const handleRequestCreateBudgetCodeForSovLine = (lineId: string) => { setBudgetCodeCreateTarget({ type: "sov-line", lineId }); setShowCreateBudgetCodeModal(true); };

  // ── Line item add (dialog) ──────────────────────────────────────────────

  const handleAddLineItem = async () => {
    if (!lineItemForm.lineNumber || !lineItemForm.description) { toast.error("Line number and description are required"); return; }
    const selectedBudgetCode = budgetCodes.find((code) => code.id === lineItemForm.budgetCodeId);
    const costCodeId = selectedBudgetCode?.costCodeId ? String(selectedBudgetCode.costCodeId) : null;
    if (!selectedBudgetCode) { toast.error("Please select a budget code before adding a line item."); return; }
    setIsSubmittingLineItem(true);
    try {
      await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/line-items`, {
        method: "POST",
        body: JSON.stringify({ line_number: parseInt(lineItemForm.lineNumber, 10), description: lineItemForm.description, quantity: parseFloat(lineItemForm.quantity) || 0, unit_cost: parseFloat(lineItemForm.unitCost) || 0, unit_of_measure: lineItemForm.unitOfMeasure || null, cost_code_id: costCodeId, budget_code_id: selectedBudgetCode.id }),
      });
      const refreshedItems = await apiFetch<ContractLineItem[]>(
        `/api/projects/${projectId}/contracts/${contractId}/line-items`,
      );
      setLineItems(refreshedItems || []);
      setLineItemForm({ lineNumber: "", description: "", quantity: "1", unitCost: "0", unitOfMeasure: "", budgetCodeId: "" });
      setShowAddLineItemDialog(false);
    } catch (err) { handleFormError(err, { entity: "line item", action: "create" }); } finally { setIsSubmittingLineItem(false); }
  };

  const handleDeleteLineItem = async () => {
    if (!lineItemToDelete) return;
    setIsDeletingLineItem(true);
    try {
      await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/line-items/${lineItemToDelete.id}`, { method: "DELETE" });
      await refreshContractAfterSovMutation();
      toast.success("Line item deleted");
    } catch (error) {
      await refreshContractAfterSovMutation().catch(() => undefined);
      handleFormError(error, { entity: "line item", action: "delete" });
    } finally { setIsDeletingLineItem(false); setLineItemToDelete(null); }
  };

  // ── Inline edit submit ──────────────────────────────────────────────────

  const syncProjectMarkupsFromEdit = async (markups: MarkupFormItem[]) => {
    const sorted = [...markups].sort((a, b) => a.calculation_order - b.calculation_order);
    const savedIds = new Set(savedVerticalMarkups.map((markup) => markup.id));
    const submittedSavedIds = new Set(
      sorted.filter((markup) => savedIds.has(markup.id)).map((markup) => markup.id),
    );

    for (const markup of savedVerticalMarkups) {
      if (submittedSavedIds.has(markup.id)) continue;
      await apiFetch(`/api/projects/${projectId}/vertical-markup?markupId=${markup.id}`, {
        method: "DELETE",
      });
    }

    const existingMarkups = sorted
      .filter((markup) => savedIds.has(markup.id))
      .map((markup, index) => ({
        id: markup.id,
        markup_type: markup.markup_type.trim(),
        percentage: Number(markup.percentage),
        compound: Boolean(markup.compound),
        calculation_order: index + 1,
      }));

    if (existingMarkups.length > 0) {
      await apiFetch(`/api/projects/${projectId}/vertical-markup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markups: existingMarkups }),
      });
    }

    for (const [index, markup] of sorted.entries()) {
      if (savedIds.has(markup.id)) continue;
      await apiFetch(`/api/projects/${projectId}/vertical-markup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markup_type: markup.markup_type.trim(),
          percentage: Number(markup.percentage),
          compound: Boolean(markup.compound),
          calculation_order: index + 1,
        }),
      });
    }

    const refreshed = await apiFetch<{ markups?: VerticalMarkup[] }>(
      `/api/projects/${projectId}/vertical-markup`,
    );
    const refreshedMarkups = normalizeVerticalMarkupRows(refreshed.markups || []);
    setVerticalMarkups(refreshedMarkups);
    setSavedVerticalMarkups(refreshedMarkups);
  };

  const handleInlineEditSubmit = async (data: ContractFormData) => {
    if (!contract) { toast.error("Contract data is not loaded"); return; }
    setIsSavingEdit(true);
    try {
      await syncProjectMarkupsFromEdit(data.markups || []);
      const sovItems = (data.sovItems || []).filter((item) => !item.isGroup);
      const sovTotal = sovItems.reduce((sum, item) => sum + (data.accountingMethod === "unit_quantity" ? (item.quantity ?? 0) * (item.unitCost ?? 0) : item.amount || 0), 0);
      await apiFetch(`/api/projects/${projectId}/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          contract_number: data.number, title: data.title, client_id: data.ownerCompanyId || null, contractor_id: data.contractorId || null, architect_engineer_id: data.architectEngineerId || null,
          contract_company_id: data.ownerCompanyId || data.contractCompanyId || null, description: data.description, status: data.status || "draft", executed: data.executed ?? false, executed_at: (data.executed ?? false) ? (contract.executed_at ?? new Date().toISOString()) : null, original_contract_value: sovTotal,
          start_date: data.startDate?.toISOString().split("T")[0] || null, end_date: data.estimatedCompletionDate?.toISOString().split("T")[0] || null,
          substantial_completion_date: data.substantialCompletionDate?.toISOString().split("T")[0] || null, actual_completion_date: data.actualCompletionDate?.toISOString().split("T")[0] || null,
          signed_contract_received_date: data.signedContractReceivedDate?.toISOString().split("T")[0] || null, contract_termination_date: data.contractTerminationDate?.toISOString().split("T")[0] || null,
          retention_percentage: data.defaultRetainage || 0, payment_terms: data.paymentTerms || null, billing_schedule: data.billingSchedule || null,
          is_private: data.isPrivate || false, inclusions: data.inclusions || null, exclusions: data.exclusions || null,
          allowed_user_ids: data.allowedUsers && data.allowedUsers.length > 0 ? data.allowedUsers : [],
          allow_sov_view: data.allowedUsersCanSeeSov || false,
        }),
      });
      const budgetCodesPayload = await apiFetch<{ budgetCodes: Array<{ id: string; costCodeId?: string | null }> }>(
        `/api/projects/${projectId}/budget-codes`,
      ).catch(() => ({ budgetCodes: [] }));
      const budgetCodeIdToCostCode = new Map<string, string | null>((budgetCodesPayload.budgetCodes || []).map((code: { id: string; costCodeId?: string | null }) => [code.id, code.costCodeId ?? null]));
      const existingMarkupLineItemsByType = new Map(
        lineItems
          .filter((item) => item.markup_type)
          .map((item) => [item.markup_type as string, item]),
      );
      // Auto-sort SOV line items by cost code (ascending) before assigning
      // line numbers, so the saved order is grouped by budget/cost code.
      // Unmapped lines (no resolvable cost code) sort to the bottom.
      const costCodeForSort = (item: (typeof sovItems)[number]): string | null =>
        (item.budgetCodeId ? budgetCodeIdToCostCode.get(item.budgetCodeId) : null) ??
        existingCostCodeByLineId.get(item.id) ??
        null;
      const sortedSovItems = [...sovItems].sort((a, b) => {
        const ca = costCodeForSort(a);
        const cb = costCodeForSort(b);
        if (ca === cb) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true });
      });
      const itemsToPersist = sortedSovItems.map((item, index) => {
        const budgetCodeId = item.budgetCodeId || "";
        const existingMarkupLineItem =
          item.isMarkup && item.markupType
            ? existingMarkupLineItemsByType.get(item.markupType)
            : undefined;
        const itemId = existingMarkupLineItem?.id ?? item.id;
        const costCodeId = item.isMarkup
          ? null
          : budgetCodeIdToCostCode.get(budgetCodeId) ?? existingCostCodeByLineId.get(item.id) ?? null;
        const quantity = data.accountingMethod === "unit_quantity" && !item.isMarkup ? item.quantity ?? 0 : 1;
        const unitCost = data.accountingMethod === "unit_quantity" && !item.isMarkup ? item.unitCost ?? 0 : item.amount || 0;
        return {
          id: itemId,
          line_number: index + 1,
          description: item.description || `Line ${index + 1}`,
          cost_code_id: costCodeId,
          budget_code_id: budgetCodeId || null,
          quantity,
          unit_cost: unitCost,
          unit_of_measure: item.unitOfMeasure || null,
          markup_type: item.isMarkup ? (item.markupType ?? null) : null,
        };
      });
      const existingIds = new Set(lineItems.map((item) => item.id));
      const incomingIds = new Set(itemsToPersist.map((item) => item.id));
      const updates = itemsToPersist.filter((item) => existingIds.has(item.id));
      const creates = itemsToPersist.filter((item) => !existingIds.has(item.id));
      const deletions = lineItems.filter((item) => !incomingIds.has(item.id)).map((item) => item.id);
      for (const item of updates) {
        try {
          await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/line-items/${item.id}`, {
            method: "PUT",
            body: JSON.stringify({
              line_number: item.line_number,
              description: item.description,
              cost_code_id: item.cost_code_id,
              budget_code_id: item.budget_code_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              unit_of_measure: item.unit_of_measure,
              markup_type: item.markup_type,
            }),
          });
        } catch (error) {
          throw new Error(
            `Could not save "${item.description || `Line ${item.line_number}`}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      for (const lineItemId of deletions) {
        try {
          await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/line-items/${lineItemId}`, { method: "DELETE" });
        } catch (error) {
          throw new Error(
            `Could not remove line item: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      for (const item of creates) {
        try {
          await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/line-items`, {
            method: "POST",
            body: JSON.stringify({
              line_number: item.line_number,
              description: item.description,
              cost_code_id: item.cost_code_id,
              budget_code_id: item.budget_code_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              unit_of_measure: item.unit_of_measure,
              markup_type: item.markup_type,
            }),
          });
        } catch (error) {
          throw new Error(
            `Could not add "${item.description || `Line ${item.line_number}`}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      toast.success("Contract updated successfully");
      setIsEditing(false);
      router.refresh();
    } catch (err) { handleFormError(err, { entity: "contract", action: "update" }); } finally { setIsSavingEdit(false); }
  };

  // #endregion

  // #region Render

  if (loading) {
    return (
      <PageShell variant="detailXWide" title="Prime Contract" description="Loading contract details...">
        <Skeleton className="h-96" />
      </PageShell>
    );
  }

  if (error || !contract) {
    return (
      <PageShell variant="detailXWide" title="Prime Contract" description="Unable to load contract" onBack={handleBack}>
        <Card className="p-[var(--card-padding)]">
          <div className="flex items-center gap-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error || "Contract not found"}</p>
          </div>
          <Button variant="outline" onClick={handleBack} className="mt-[var(--group-gap)]">
            <ArrowLeft />
            Back to Contracts
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (isEditing) {
    if (!markupsLoaded) {
      return (
        <PageShell
          variant="form"
          title={`Edit: ${contract.contract_number || contract.title}`}
          description="Loading financial markup before editing..."
          onBack={() => setIsEditing(false)}
          backLabel="Cancel Edit"
        >
          <Skeleton className="h-96" />
        </PageShell>
      );
    }

    // Include ALL line items (including legacy markup_type-tagged rows) as regular
    // editable SOV lines. Markups are no longer auto-applied, so previously
    // auto-generated markup lines must surface here — otherwise they'd be absent
    // from the form and silently deleted on the next save. On save they persist
    // with markup_type=null, permanently converting them to regular line items.
    const sovItems = lineItems.map((item) => {
      const budgetCodeResolution = resolveContractLineBudgetCode(item, budgetCodes);
      return {
        id: item.id, budgetCodeId: budgetCodeResolution.budgetCodeId, budgetCodeLabel: budgetCodeResolution.budgetCode?.fullLabel ?? (item.cost_code ? `${item.cost_code.code} ${item.cost_code.name}` : undefined),
        description: item.description, amount: item.total_cost, quantity: item.quantity, unitCost: item.unit_cost, unitOfMeasure: item.unit_of_measure ?? undefined, billedToDate: 0, amountRemaining: item.total_cost,
      };
    });
    const initialData: Partial<ContractFormData> = {
      number: contract.contract_number || "", title: contract.title, status: contract.status, executed: contract.executed,
      ownerCompanyId: contract.client_id != null ? String(contract.client_id) : contract.contract_company_id != null ? String(contract.contract_company_id) : undefined,
      contractorId: contract.contractor_id || undefined, architectEngineerId: contract.architect_engineer_id || undefined, contractCompanyId: contract.contract_company_id || undefined,
      description: contract.description || "", originalAmount: contract.original_contract_value, revisedAmount: contract.revised_contract_value,
      startDate: contract.start_date ? new Date(contract.start_date) : undefined, estimatedCompletionDate: contract.end_date ? new Date(contract.end_date) : undefined,
      substantialCompletionDate: contract.substantial_completion_date ? new Date(contract.substantial_completion_date) : undefined,
      actualCompletionDate: contract.actual_completion_date ? new Date(contract.actual_completion_date) : undefined,
      signedContractReceivedDate: contract.signed_contract_received_date ? new Date(contract.signed_contract_received_date) : undefined,
      contractTerminationDate: contract.contract_termination_date ? new Date(contract.contract_termination_date) : undefined,
      defaultRetainage: contract.retention_percentage, paymentTerms: contract.payment_terms || "", billingSchedule: contract.billing_schedule || "",
      isPrivate: contract.is_private,
      allowedUsers: (contract as { allowed_user_ids?: string[] }).allowed_user_ids ?? [],
      allowedUsersCanSeeSov: (contract as { allow_sov_view?: boolean }).allow_sov_view ?? false,
      inclusions: contract.inclusions || "", exclusions: contract.exclusions || "", sovItems,
      markups: toMarkupFormItems(verticalMarkups),
    };
    return (
      <PageShell variant="form" title={`Edit: ${contract.contract_number || contract.title}`} description="Update contract details, financial markup, and SOV line items" onBack={() => setIsEditing(false)} backLabel="Cancel Edit"
        actions={<Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel Edit</Button>}>
        <ContractForm initialData={initialData} onSubmit={handleInlineEditSubmit} onCancel={() => setIsEditing(false)} isSubmitting={isSavingEdit} mode="edit" projectId={projectId} />
      </PageShell>
    );
  }

  const approvedChangeOrdersAmount =
    changeOrders.length > 0
      ? changeOrders.reduce((sum, co) => {
          const status = (co.status || "").toLowerCase();
          return status === "approved" ? sum + (Number(co.amount) || 0) : sum;
        }, 0)
      : Number(contract.approved_change_orders) || 0;

  return (
    <PageShell
      variant="dashboard"
      eyebrow={
        <span className="inline-flex items-center gap-2">
          {contract.contract_number ? `#${contract.contract_number}` : `#${contract.id.slice(0, 8)}`}
          {contract.estimate_id != null && (
            <EstimateVersionBadge
              projectId={projectId}
              estimateId={contract.estimate_id}
              estimateVersion={contract.estimate_version ?? null}
              lastSyncedAt={contract.last_synced_from_estimate_at ?? null}
            />
          )}
        </span>
      }
      title={contract.title}
      onBack={() => router.push(`/${projectId}/prime-contracts`)}
      actions={
        <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">Create<ChevronDown className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/${projectId}/change-events/new?contractId=${contractId}`)}><GitBranch className="h-4 w-4 mr-2" />Create Change Event</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/${projectId}/prime-contracts/${contractId}/change-orders/pcos/new`)}><PenLine className="h-4 w-4 mr-2" />Create Potential Change Order</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("invoices")}><DollarSign className="h-4 w-4 mr-2" />Create Invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("payments")}><CreditCard className="h-4 w-4 mr-2" />Create Payment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDocumentDialogTab("email"); setIsDocumentDialogOpen(true); }}><Mail className="h-4 w-4 mr-2" />Email Contract</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {contract.estimate_id != null && (
                  <DropdownMenuItem
                    disabled={contract.executed || !["draft", "out_for_signature"].includes(contract.status)}
                    onClick={() => setIsSyncFromEstimateOpen(true)}
                    title={
                      contract.executed
                        ? "Contract is executed — SOV cannot be changed"
                        : !["draft", "out_for_signature"].includes(contract.status)
                          ? `Contract is ${contract.status} — only Draft and Out for Signature can be resynced`
                          : undefined
                    }
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync from Estimate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { setDocumentDialogTab("download"); setIsDocumentDialogOpen(true); }}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDocumentDialogTab("email"); setIsDocumentDialogOpen(true); }}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      }
    >
      <PageTabs
        variant="inline"
        tabs={[
          { label: "General", href: "overview", isActive: activeTab === "overview" },
          { label: "SOV", href: "schedule-of-values", isActive: activeTab === "schedule-of-values", count: lineItems.length || undefined },
          { label: "Change Orders", href: "change-orders", isActive: activeTab === "change-orders", count: changeOrders.length || undefined },
          { label: "Invoices", href: "invoices", isActive: activeTab === "invoices", count: paymentApplications.length || undefined },
          { label: "Payments Received", href: "payments", isActive: activeTab === "payments", count: payments.length || undefined },
          { label: "Related Items", href: "related-items", isActive: activeTab === "related-items" },
          { label: "Emails", href: "emails", isActive: activeTab === "emails" },
          { label: "Change History", href: "history", isActive: activeTab === "history" },
          { label: "Financial Markup", href: "financial-markup", isActive: activeTab === "financial-markup" },
          { label: "Advanced Settings", href: "advanced-settings", isActive: activeTab === "advanced-settings" },
        ]}
        onTabClick={(href) => setActiveTab(href as ContractTab)}
      />

      <ContentSectionStack className="pt-3">
        {activeTab === "overview" && (
          <PrimeContractOverviewTab
            contract={contract} changeOrders={changeOrders} projectId={String(projectId)}
            companyOptions={companyOptions}
            formatDate={formatDate} getTextValue={getTextValue} inclusionsList={inclusionsList} exclusionsList={exclusionsList}
            formatStatusLabel={formatStatusLabel} formatCurrency={formatCurrency} lineItemsLoading={lineItemsLoading} lineItems={lineItems}
            budgetCodes={budgetCodes}
            financialMarkupSection={
              <PrimeContractFinancialMarkupTab
                projectId={projectId}
                budgetCodes={budgetCodes}
                verticalMarkups={verticalMarkups}
                setVerticalMarkups={setVerticalMarkups}
                savedVerticalMarkups={savedVerticalMarkups}
                setSavedVerticalMarkups={setSavedVerticalMarkups}
                markupsLoading={markupsLoading}
                variant="compact"
              />
            }
            sovDraftBudgetCodeIds={sov.sovDraftBudgetCodeIds} isSovEditing={sov.isSovEditing} isSavingSovChanges={sov.isSavingSovChanges}
            sovDraftItems={sov.sovDraftItems} onStartSovEdit={sov.handleStartSovEdit} onCancelSovEdit={sov.handleCancelSovEdit} onSaveSovEdit={sov.handleSaveSovEdit}
            onAddSovLine={sov.handleAddSovLine} onAddSovGroup={sov.handleAddSovGroup} onUpdateSovLine={sov.handleUpdateSovLine}
            onUpdateSovLineBudgetCode={sov.handleUpdateSovLineBudgetCode} onRemoveSovLine={sov.handleRemoveSovLine} onReorderSovLines={sov.handleReorderSovLines}
            onRequestCreateBudgetCode={handleRequestCreateBudgetCodeForSovLine} onSaveContractField={handleSaveContractField} onDeleteSovLine={sov.handleDeleteSovLine}
            onImportEstimateToSov={() => setShowEstimateImportModal(true)}
          />
        )}

        {activeTab === "schedule-of-values" && (
          <PrimeContractSovTab
            formatCurrency={formatCurrency}
            lineItemsLoading={lineItemsLoading}
            lineItems={lineItems}
            budgetCodes={budgetCodes}
            sovDraftBudgetCodeIds={sov.sovDraftBudgetCodeIds}
            isSovEditing={sov.isSovEditing}
            isSavingSovChanges={sov.isSavingSovChanges}
            sovDraftItems={sov.sovDraftItems}
            onStartSovEdit={sov.handleStartSovEdit}
            onCancelSovEdit={sov.handleCancelSovEdit}
            onSaveSovEdit={sov.handleSaveSovEdit}
            onAddSovLine={sov.handleAddSovLine}
            onAddSovGroup={sov.handleAddSovGroup}
            onUpdateSovLine={sov.handleUpdateSovLine}
            onUpdateSovLineBudgetCode={sov.handleUpdateSovLineBudgetCode}
            onRemoveSovLine={sov.handleRemoveSovLine}
            onReorderSovLines={sov.handleReorderSovLines}
            onRequestCreateBudgetCode={handleRequestCreateBudgetCodeForSovLine}
            onDeleteSovLine={sov.handleDeleteSovLine}
            onImportEstimateToSov={() => setShowEstimateImportModal(true)}
            invoicedAmount={contract.invoiced_amount}
            approvedChangesAmount={approvedChangeOrdersAmount}
          />
        )}

        {activeTab === "change-orders" && (
          <ContentSectionStack>
            <PrimeContractChangeOrdersTab
              projectId={projectId} contractId={contractId} changeOrders={changeOrders}
              setChangeOrders={setChangeOrders} formatCurrency={formatCurrency}
              onStartEditCo={handleStartEditCo}
              onSetDeletingCo={setDeletingCo} onSetRejectingCoId={setRejectingCoId} onShowRejectCoDialog={() => setShowRejectCoDialog(true)}
            />
            <PrimeContractPcosSection
              projectId={projectId}
              contractId={contractId}
              formatCurrency={formatCurrency}
            />
            <PrimeContractChangeEventsTab
              projectId={projectId}
              contractId={contractId}
              formatCurrency={formatCurrency}
            />
          </ContentSectionStack>
        )}

        {activeTab === "invoices" && (
          <PrimeContractInvoicesTab
            projectId={projectId} contractId={contractId} contract={contract} paymentApplications={paymentApplications}
            changeOrders={changeOrders}
            ownerInvoices={ownerInvoices} paymentsLoading={paymentsLoading} ownerInvoicesLoading={ownerInvoicesLoading}
            onDeleteInvoice={handleDeleteInvoice} formatCurrency={formatCurrency}
          />
        )}

        {activeTab === "payments" && (
          <PrimeContractPaymentsTab
            projectId={projectId} contractId={contractId} payments={payments} paymentsReceivedLoading={paymentsReceivedLoading}
            setPayments={setPayments} setContract={setContract} formatCurrency={formatCurrency}
          />
        )}

        {activeTab === "related-items" && (
          <RelatedItemsTab
            commitmentId={contractId}
            projectId={Number(projectId)}
            commitmentType="subcontract"
            apiBasePath={`/api/projects/${projectId}/contracts/${contractId}/related-items`}
            entityLabel="prime contract"
          />
        )}

        {activeTab === "emails" && (
          <EmailsClient projectId={Number(projectId)} embedded />
        )}

        {activeTab === "history" && (
          <div>
            <SectionRuleHeading label="Change History" />
            {historyEntries.length === 0 ? (
              <EmptyState
                icon={<History />}
                title="No changes recorded"
                description="No lifecycle events are available for this contract yet."
              />
            ) : (
              // @ui-exception prime-contract-history-timeline
              // Intentional deviation: no shared timeline/list primitive currently supports the
              // contract history row layout (label + timestamp + details), so this local shell
              // remains until a reusable history component is extracted.
              <div className="divide-y divide-border rounded-md border border-border">
                {historyEntries.map((entry) => (
                  <div key={entry.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "financial-markup" && (
          <PrimeContractFinancialMarkupTab
            projectId={projectId} budgetCodes={budgetCodes} verticalMarkups={verticalMarkups}
            setVerticalMarkups={setVerticalMarkups} savedVerticalMarkups={savedVerticalMarkups}
            setSavedVerticalMarkups={setSavedVerticalMarkups} markupsLoading={markupsLoading}
          />
        )}

        {activeTab === "advanced-settings" && (
          <PrimeContractAdvancedSettingsTab
            projectId={projectId} contractId={contractId} advancedSettings={advancedSettings}
            setAdvancedSettings={setAdvancedSettings} advancedSettingsLoading={advancedSettingsLoading}
            advancedSettingsSaving={advancedSettingsSaving} setAdvancedSettingsSaving={setAdvancedSettingsSaving}
            contractAdvancedDraft={contractAdvancedDraft} setContract={setContract}
            changeOrderCount={changeOrders.length}
          />
        )}
      </ContentSectionStack>

      <PrimeContractDialogs
        showAddLineItemDialog={showAddLineItemDialog} setShowAddLineItemDialog={setShowAddLineItemDialog}
        lineItemForm={lineItemForm} setLineItemForm={setLineItemForm} budgetCodes={budgetCodes} budgetCodesLoading={budgetCodesLoading}
        setShowCreateBudgetCodeModal={setShowCreateBudgetCodeModal} onRequestCreateBudgetCode={handleRequestCreateBudgetCodeForLineItemForm}
        showCreateBudgetCodeModal={showCreateBudgetCodeModal} projectId={projectId} handleBudgetCodeCreated={handleBudgetCodeCreated}
        isSubmittingLineItem={isSubmittingLineItem} handleAddLineItem={handleAddLineItem} formatCurrency={formatCurrency}
        showNewCoDialog={showNewCoDialog} setShowNewCoDialog={setShowNewCoDialog} coForm={coForm} setCoForm={setCoForm}
        isSubmittingCo={isSubmittingCo} handleCreateCo={handleCreateCo} showRejectCoDialog={showRejectCoDialog}
        setShowRejectCoDialog={setShowRejectCoDialog} setRejectingCoId={setRejectingCoId} rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason} isRejectingCo={isRejectingCo} handleRejectCo={handleRejectCo}
        lineItemToDelete={lineItemToDelete} setLineItemToDelete={setLineItemToDelete} isDeletingLineItem={isDeletingLineItem}
        handleDeleteLineItem={handleDeleteLineItem} editingCo={editingCo} setEditingCo={setEditingCo} editCoForm={editCoForm}
        setEditCoForm={setEditCoForm} isUpdatingCo={isUpdatingCo} handleUpdateCo={handleUpdateCo} deletingCo={deletingCo}
        setDeletingCo={setDeletingCo} isDeletingCo={isDeletingCo} handleDeleteCo={handleDeleteCo}
      />

      {contract ? (
        <DocumentDeliveryDialog
          open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen} initialTab={documentDialogTab}
          recordType="prime-contract" recordId={contract.id} number={contract.contract_number || "Prime Contract"} title={contract.title}
        />
      ) : null}
      <PrimeContractEstimateImportModal
        open={showEstimateImportModal}
        onOpenChange={setShowEstimateImportModal}
        projectId={projectId}
        contractId={contractId}
        budgetCodes={budgetCodes}
        existingLineItems={lineItems}
        onImported={(items) => setLineItems((prev) => [...prev, ...items])}
      />
      <SyncFromEstimateModal
        open={isSyncFromEstimateOpen}
        onOpenChange={setIsSyncFromEstimateOpen}
        projectId={projectId}
        contractId={contractId}
        onSuccess={() => {
          // Refetch contract + SOV by triggering query invalidation; the page also
          // self-fetches on mount, so a hard refetch is sufficient for the SOV tab.
          queryClient.invalidateQueries({ queryKey: ["prime-contract", contractId] });
          router.refresh();
        }}
      />
      {ConfirmDialog}
    </PageShell>
  );
  // #endregion
}
// #endregion
