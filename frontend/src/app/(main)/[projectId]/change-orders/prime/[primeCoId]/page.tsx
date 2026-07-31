"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Edit,
  FileDown,
  FileUp,
  Link2,
  List,
  Mail,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import {
  DetailField,
  DetailFieldGrid,
  EmptyState,
  EntityAttachments,
  ErrorState,
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
  StatusBadge,
} from "@/components/ds";
import { ChangeEventRelatedItemsTab } from "@/components/domain/change-events/ChangeEventRelatedItemsTab";
import { DocumentDeliveryDialog } from "@/components/documents/DocumentDeliveryDialog";
import type {
  ChangeEventRelatedItem,
  ChangeEventRelatedItemOption,
} from "@/types/change-events";
import { useVerticalMarkup } from "@/hooks/use-vertical-markup";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ContentSectionStack,
  DetailLayout,
  DetailPanel,
  LabelValueRow,
  PageTabs,
  PageShell,
  SectionRuleHeading,
  SummaryValueRow,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { usePdfExport } from "@/hooks/use-pdf-export";
import { cn } from "@/lib/utils";
import {
  normalizePrimeContractChangeOrderStatus,
  PRIME_CONTRACT_CHANGE_ORDER_STATUSES,
} from "@/lib/change-orders/prime-contract-change-order-statuses";
import { BudgetCodeSelector } from "@/components/budget/budget-code-selector";
import type { BudgetCodeOption } from "@/components/domain/change-events/change-event-form/types";
import {
  budgetCodeTextValue,
  normalizeBudgetCodesForSelector,
  resolvePrimeCoBudgetCode,
} from "@/lib/budget/budget-code-selection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id: number;
  pcco_id: number;
  pco_id: number | null;
  description: string | null;
  quantity: number | null;
  unit_cost: number | null;
  line_amount: number | null;
  cost_code: string | null;
  uom: string | null;
  created_at: string | null;
}

interface ContractInfo {
  id: string;
  contract_number: string;
  title: string | null;
  original_contract_value: number | null;
  revised_contract_value: number | null;
}

interface PrimeCO {
  id: number;
  pcco_number: string | null;
  title: string;
  description: string | null;
  status: string | null;
  total_amount: number | null;
  contract_id: string | null;
  prime_contract_id: string | null;
  executed: boolean | null;
  revision: number | null;
  change_reason: string | null;
  is_private: boolean | null;
  schedule_impact: number | null;
  field_change: boolean | null;
  reference: string | null;
  paid_in_full: boolean | null;
  signed_co_received_date: string | null;
  request_received_from: string | null;
  location: string | null;
  due_date: string | null;
  invoiced_date: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  contract_company: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string | null;
  project_id: number | null;
  rejection_reason: string | null;
  designated_reviewer: string | null;
  reviewed_by: string | null;
  review_date: string | null;
  revised_substantial_completion_date: string | null;
  line_items: LineItem[];
  contract: ContractInfo | null;
}

interface PrimeContractOption {
  id: string;
  contract_number: string;
  title: string | null;
}

interface EmployeeOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ProjectEmail {
  id: number;
  subject: string;
  from_email: string | null;
  from_name: string | null;
  body: string | null;
  status: string;
  sent_at: string | null;
  received_at: string | null;
  has_attachments: boolean | null;
  to_list: string[] | null;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Edit schema
// ---------------------------------------------------------------------------

const editSchema = z.object({
  pcco_number: z.string().min(1, "Number is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  total_amount: z.number(),
  prime_contract_id: z.string().nullable().optional(),
  revision: z.number().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  is_private: z.boolean().optional(),
  schedule_impact: z.number().nullable().optional(),
  field_change: z.boolean().optional(),
  reference: z.string().nullable().optional(),
  paid_in_full: z.boolean().optional(),
  signed_co_received_date: z.string().nullable().optional(),
  request_received_from: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  executed: z.boolean().optional(),
  contract_company: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  designated_reviewer: z.string().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  review_date: z.string().nullable().optional(),
  revised_substantial_completion_date: z.string().nullable().optional(),
});

type FormData = z.infer<typeof editSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}


function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const CHANGE_REASONS = [
  "Client Request",
  "Design Error",
  "Design Omission",
  "Field Condition",
  "Owner Request",
  "Regulatory Requirement",
  "Scope Change",
  "Unforeseen Condition",
  "Value Engineering",
  "Other",
];

// ---------------------------------------------------------------------------
// Change History Timeline
// ---------------------------------------------------------------------------

interface HistoryEntry {
  label: string;
  date: string;
  note?: string;
  variant: "default" | "success" | "destructive";
}

function ChangeHistoryTimeline({ co }: { co: PrimeCO }) {
  const entries: HistoryEntry[] = [];
  const createdByLabel = co.created_by_name || co.created_by;

  if (co.created_at) {
    entries.push({
      label: "Created",
      date: co.created_at,
      note: createdByLabel ? `by ${createdByLabel}` : undefined,
      variant: "default",
    });
  }

  if (co.submitted_at) {
    entries.push({ label: "Submitted", date: co.submitted_at, variant: "default" });
  }

  if (co.approved_at) {
    entries.push({ label: "Approved", date: co.approved_at, variant: "success" });
  }

  if (co.status === "rejected" && co.rejection_reason) {
    const rejectionDate = co.review_date ?? co.created_at;
    if (rejectionDate) {
      entries.push({
        label: "Rejected",
        date: rejectionDate,
        note: co.rejection_reason,
        variant: "destructive",
      });
    }
  }

  // Sort chronologically, oldest first
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<List />}
        title="No change history"
        description="A log of changes to this record will appear here"
      />
    );
  }

  const variantClasses: Record<HistoryEntry["variant"], string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.label}
          className="flex items-start gap-3 rounded-md border border-border p-3 text-sm"
        >
          <span
            className={`mt-0.5 inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${variantClasses[entry.variant]}`}
          >
            {entry.label}
          </span>
          <div className="min-w-0 flex-1">
            {entry.note && (
              <p className="text-foreground">{entry.note}</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(entry.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

function resolveLineItemBudgetCodeDisplay(
  item: Pick<LineItem, "cost_code">,
  budgetCodes: BudgetCodeOption[],
) {
  return resolvePrimeCoBudgetCode(item.cost_code, budgetCodes);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrimeContractCODetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const params = useParams()!;
  const projectId = params.projectId as string;
  const primeCoId = params.primeCoId as string;

  const { confirm, ConfirmDialog } = useConfirm();
  const [isLoading, setIsLoading] = useState(true);
  const [co, setCo] = useState<PrimeCO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [primeContracts, setPrimeContracts] = useState<PrimeContractOption[]>(
    [],
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [reviewerSelectOpen, setReviewerSelectOpen] = useState(false);
  const [reviewedBySelectOpen, setReviewedBySelectOpen] = useState(false);
  const [budgetCodes, setBudgetCodes] = useState<BudgetCodeOption[]>([]);
  const [budgetCodesLoading, setBudgetCodesLoading] = useState(false);

  const { exportPdf: handleExportPdf } = usePdfExport({
    endpoint: `/api/projects/${projectId}/prime-contract-change-orders/${primeCoId}/pdf`,
    filename: `prime-contract-change-order-${co?.pcco_number || primeCoId}`,
  });


  const [emails, setEmails] = useState<ProjectEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);

  // Related Items
  const [relatedItems, setRelatedItems] = useState<ChangeEventRelatedItem[]>([]);
  const [relatedItemsLoading, setRelatedItemsLoading] = useState(true);

  // Line Items (inline CRUD)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(true);
  const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null);
  const [addingLineItem, setAddingLineItem] = useState(false);
  const [lineItemForm, setLineItemForm] = useState({
    description: "",
    cost_code: "",
    quantity: "",
    uom: "",
    unit_cost: "",
  });
  const [lineItemSaving, setLineItemSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      pcco_number: "",
      title: "",
      description: "",
      status: "draft",
      total_amount: 0,
      prime_contract_id: null,
      revision: 0,
      change_reason: null,
      is_private: false,
      schedule_impact: null,
      field_change: false,
      reference: null,
      paid_in_full: false,
      signed_co_received_date: null,
      request_received_from: null,
      location: null,
      due_date: null,
      executed: false,
      contract_company: null,
      rejection_reason: null,
      designated_reviewer: null,
      reviewed_by: null,
      review_date: null,
      revised_substantial_completion_date: null,
    },
  });

  const apiBase = `/api/projects/${projectId}/prime-contract-change-orders/${primeCoId}`;

  const formatEmployeeName = useCallback((employee: EmployeeOption) => {
    return [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Unnamed employee";
  }, []);

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    setEmailsError(null);

    try {
      const res = await fetch(`${apiBase}/emails`);
      if (!res.ok) {
        throw new Error("Failed to fetch emails");
      }
      const json = (await res.json()) as {
        data?: ProjectEmail[];
      };
      setEmails(json.data ?? []);
    } catch (err) {
      setEmailsError(
        err instanceof Error ? err.message : "Failed to load emails",
      );
    } finally {
      setEmailsLoading(false);
    }
  }, [apiBase]);

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
    } catch (err) {
      toast.error("Could not load budget codes", {
        description:
          err instanceof Error && err.message
            ? err.message
            : "Prime change-order line items cannot select budget codes.",
      });
      setBudgetCodes([]);
    } finally {
      setBudgetCodesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setEmployeesLoading(true);
      try {
        const data = await apiFetch<EmployeeOption[]>(
          `/api/projects/${projectId}/employees`,
        );
        setEmployees(data);
      } catch {
        toast.error("Could not load employees.");
      } finally {
        setEmployeesLoading(false);
      }
    };

    void fetchEmployees();
  }, [projectId]);

  // ---- Vertical Markup ----------------------------------------------------
  const { markupRows } = useVerticalMarkup(
    projectId ? Number(projectId) : undefined,
  );

  // ---- Line Items CRUD -----------------------------------------------------
  const fetchLineItems = useCallback(async () => {
    setLineItemsLoading(true);
    try {
      const res = await fetch(`${apiBase}/line-items`);
      if (!res.ok) throw new Error("Failed to fetch line items");
      const json = await res.json();
      setLineItems(json.data ?? []);
    } catch (err) {
      console.error("Failed to fetch line items:", err);
    } finally {
      setLineItemsLoading(false);
    }
  }, [apiBase]);

  const resetLineItemForm = useCallback(() => {
    setLineItemForm({
      description: "",
      cost_code: "",
      quantity: "",
      uom: "",
      unit_cost: "",
    });
  }, []);

  const startAddLineItem = useCallback(() => {
    setEditingLineItemId(null);
    resetLineItemForm();
    setAddingLineItem(true);
  }, [resetLineItemForm]);

  const startEditLineItem = useCallback((item: LineItem) => {
    setAddingLineItem(false);
    setEditingLineItemId(item.id);
    setLineItemForm({
      description: item.description ?? "",
      cost_code: item.cost_code ?? "",
      quantity: item.quantity != null ? String(item.quantity) : "",
      uom: item.uom ?? "",
      unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
    });
  }, []);

  const cancelLineItemEdit = useCallback(() => {
    setAddingLineItem(false);
    setEditingLineItemId(null);
    resetLineItemForm();
  }, [resetLineItemForm]);

  const handleSaveLineItem = useCallback(async () => {
    setLineItemSaving(true);
    try {
      const budgetCodeResolution = resolvePrimeCoBudgetCode(
        lineItemForm.cost_code,
        budgetCodes,
      );
      const payload = {
        description: lineItemForm.description || null,
        cost_code: budgetCodeResolution.storedCode,
        quantity: lineItemForm.quantity ? Number(lineItemForm.quantity) : 0,
        uom: lineItemForm.uom || null,
        unit_cost: lineItemForm.unit_cost ? Number(lineItemForm.unit_cost) : 0,
      };

      if (editingLineItemId) {
        // Update existing
        const res = await fetch(
          `${apiBase}/line-items/${editingLineItemId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Update failed" }));
          throw new Error(err.error || "Failed to update line item");
        }
        toast.success("Line item updated");
      } else {
        // Create new
        const res = await fetch(`${apiBase}/line-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Create failed" }));
          throw new Error(err.error || "Failed to create line item");
        }
        toast.success("Line item added");
      }

      cancelLineItemEdit();
      fetchLineItems();
    } catch (err) {
      toast.error("Failed to save line item");
    } finally {
      setLineItemSaving(false);
    }
  }, [
    apiBase,
    editingLineItemId,
    lineItemForm,
    budgetCodes,
    cancelLineItemEdit,
    fetchLineItems,
  ]);

  const handleDeleteLineItem = useCallback(
    async (lineItemId: number) => {
      try {
        const res = await fetch(`${apiBase}/line-items/${lineItemId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Delete failed" }));
          throw new Error(err.error || "Failed to delete line item");
        }
        toast.success("Line item deleted");
        fetchLineItems();
      } catch (err) {
        toast.error("Failed to delete line item");
      }
    },
    [apiBase, fetchLineItems],
  );

  const computedLineItemAmount =
    (lineItemForm.quantity ? Number(lineItemForm.quantity) : 0) *
    (lineItemForm.unit_cost ? Number(lineItemForm.unit_cost) : 0);

  const selectedLineItemBudgetCode = resolvePrimeCoBudgetCode(
    lineItemForm.cost_code,
    budgetCodes,
  );

  const handleLineItemBudgetCodeChange = useCallback(
    (_value: string, code: BudgetCodeOption) => {
      setLineItemForm((f) => ({
        ...f,
        cost_code: budgetCodeTextValue(code),
      }));
    },
    [],
  );

  // ---- Related Items -------------------------------------------------------
  const fetchRelatedItems = useCallback(async () => {
    setRelatedItemsLoading(true);
    try {
      const res = await fetch(`${apiBase}/related-items`);
      if (!res.ok) throw new Error("Failed to fetch related items");
      const json = await res.json();
      setRelatedItems(json.data ?? []);
    } catch (err) {
      console.error("Failed to fetch related items:", err);
    } finally {
      setRelatedItemsLoading(false);
    }
  }, [apiBase]);

  const fetchRelatedItemOptions = useCallback(
    async (type: string, search: string): Promise<ChangeEventRelatedItemOption[]> => {
      const params = new URLSearchParams({ type, search });
      const res = await fetch(`${apiBase}/related-items/options?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    [apiBase],
  );

  const linkRelatedItem = useCallback(
    async (relatedType: string, relatedId: string): Promise<void> => {
      const res = await fetch(`${apiBase}/related-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedType, relatedId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Link failed" }));
        throw new Error(err.error || "Failed to link item");
      }
      await fetchRelatedItems();
    },
    [apiBase, fetchRelatedItems],
  );

  const unlinkRelatedItem = useCallback(
    async (relatedItemId: string): Promise<void> => {
      const prev = relatedItems;
      setRelatedItems((items) => items.filter((i) => i.id !== relatedItemId));
      const res = await fetch(`${apiBase}/related-items/${relatedItemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setRelatedItems(prev);
        const err = await res.json().catch(() => ({ error: "Unlink failed" }));
        throw new Error(err.error || "Failed to unlink item");
      }
    },
    [apiBase, relatedItems],
  );

  // ---- Fetch data ----------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [data, contractsData] = await Promise.all([
          apiFetch(apiBase) as Promise<typeof co>,
          apiFetch(`/api/projects/${projectId}/contracts`).catch(() => null),
        ]);
        setCo(data);
        if (contractsData) {
          setPrimeContracts(
            (contractsData as PrimeContractOption[]).map((c) => ({
              id: c.id,
              contract_number: c.contract_number,
              title: c.title,
            })),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    fetchEmails();
    fetchLineItems();
    fetchRelatedItems();
    fetchBudgetCodes();
  }, [
    apiBase,
    projectId,
    fetchEmails,
    fetchLineItems,
    fetchRelatedItems,
    fetchBudgetCodes,
  ]);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setIsEditing(true);
  }, [searchParams]);

  useEffect(() => {
    if (!co) return;
    form.reset({
      pcco_number: co.pcco_number || "",
      title: co.title || "",
      description: co.description || "",
      status: normalizePrimeContractChangeOrderStatus(co.status),
      total_amount: co.total_amount ?? 0,
      prime_contract_id: co.prime_contract_id ?? null,
      revision: co.revision ?? 0,
      change_reason: co.change_reason ?? null,
      is_private: co.is_private ?? false,
      schedule_impact: co.schedule_impact ?? null,
      field_change: co.field_change ?? false,
      reference: co.reference ?? null,
      paid_in_full: co.paid_in_full ?? false,
      signed_co_received_date: co.signed_co_received_date ?? null,
      request_received_from: co.request_received_from ?? null,
      location: co.location ?? null,
      due_date: co.due_date ?? null,
      executed: co.executed ?? false,
      contract_company: co.contract_company ?? null,
      rejection_reason: co.rejection_reason ?? null,
      designated_reviewer: co.designated_reviewer ?? null,
      reviewed_by: co.reviewed_by ?? null,
      review_date: co.review_date ?? null,
      revised_substantial_completion_date: co.revised_substantial_completion_date ?? null,
    });
    // Explicitly set status after reset — shadcn Select doesn't always pick up
    // the value from form.reset() when the field was previously untouched.
    form.setValue("status", normalizePrimeContractChangeOrderStatus(co.status));
  }, [co, form]);

  // ---- Handlers ------------------------------------------------------------
  const handleBack = useCallback(() => {
    router.push(`/${projectId}/change-orders?tab=prime`);
  }, [router, projectId]);

  const handleSave: SubmitHandler<FormData> = async (data) => {
    setIsSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Failed to update",
        );
      }
      const updated = await res.json();
      // Re-fetch full data to get line_items and contract
      const fullRes = await fetch(apiBase);
      if (fullRes.ok) {
        setCo(await fullRes.json());
      } else {
        setCo({ ...co!, ...updated });
      }
      setIsEditing(false);
      toast.success("Change order updated");
    } catch (err) {
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!co) return;
    const ok = await confirm({
      description: `Delete change order ${co.pcco_number || co.title}?`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await apiFetch(apiBase, { method: "DELETE" });
      toast.success("Change order deleted");
      router.push(`/${projectId}/change-orders?tab=prime`);
    } catch (err) {
      toast.error("Could not delete change order", {
        description:
          err instanceof Error && err.message
            ? err.message
            : "The server did not return a delete reason.",
      });
    }
  }, [co, apiBase, router, projectId, confirm]);

  const handleApprove = useCallback(async () => {
    if (!co) return;
    try {
      const res = await fetch(`${apiBase}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      const updated = await res.json();
      setCo((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success("Change order approved");
    } catch (err) {
      toast.error("Failed to approve");
    }
  }, [co, apiBase]);

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleReject = useCallback(async () => {
    if (!co || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }
      const updated = await res.json();
      setCo((prev) => (prev ? { ...prev, ...updated } : prev));
      setShowRejectDialog(false);
      setRejectionReason("");
      toast.success("Change order rejected");
    } catch (err) {
      toast.error("Failed to reject");
    }
  }, [co, apiBase, rejectionReason]);

  // ---- Vertical markup (must be before early returns) ----------------------
  const lineItemsTotal =
    lineItems.reduce((sum, li) => sum + (li.line_amount ?? 0), 0);

  const MARKUP_LABELS: Record<string, string> = {
    insurance: "Insurance",
    bond: "Bond",
    fee: "Contractor Fee",
    overhead: "Overhead",
    custom: "Custom",
  };

  const computedMarkups = useMemo(() => {
    if (markupRows.length === 0) return [];
    const sorted = [...markupRows].sort(
      (a, b) => a.calculation_order - b.calculation_order,
    );
    let runningBase = lineItemsTotal;
    return sorted.map((markup) => {
      const amount = runningBase * (markup.percentage / 100);
      if (markup.compound) {
        runningBase += amount;
      }
      return { ...markup, amount };
    });
  }, [markupRows, lineItemsTotal]);

  const markupTotal = useMemo(
    () => computedMarkups.reduce((sum, m) => sum + m.amount, 0),
    [computedMarkups],
  );

  const grandTotal = lineItemsTotal + markupTotal;

  // ---- Loading state -------------------------------------------------------
  if (isLoading) {
    return (
      <PageShell variant="detail" title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </PageShell>
    );
  }

  // ---- Error state ---------------------------------------------------------
  if (error || !co) {
    return (
      <PageShell variant="detail" title="Error" onBack={handleBack}>
        <ErrorState
          error={error || "Prime contract change order not found"}
        />
        <div className="-mt-10 flex justify-center">
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Change Orders
          </Button>
        </div>
      </PageShell>
    );
  }

  // ---- Edit mode -----------------------------------------------------------
  if (isEditing) {
    return (
      <PageShell
        variant="form"
        title={`Edit ${co.pcco_number || `PCCO #${co.id}`}`}
        onBack={() => setIsEditing(false)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={form.handleSubmit(handleSave)}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="space-y-8"
          >
            {/* General Information */}
            <section className="space-y-4">
              <SectionRuleHeading
                label="General Information"
                className="[&_span]:text-primary"
              />
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pcco_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>#</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 002" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revision</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contract_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Company</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="e.g. Vargo, LLC"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prime_contract_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(val === "__none__" ? null : val)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Not assigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Not assigned</SelectItem>
                          {primeContracts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.contract_number} — {c.title || "Untitled"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={normalizePrimeContractChangeOrderStatus(
                          field.value || co?.status,
                        )}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="change_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Change Reason</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(val === "__none__" ? null : val)
                        }
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {CHANGE_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={4}
                          placeholder="Describe the change..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Financial & Schedule */}
            <section className="space-y-4">
              <SectionRuleHeading
                label="Financial & Schedule"
                className="[&_span]:text-primary"
              />
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schedule_impact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Impact (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            )
                          }
                          placeholder="days"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="request_received_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Received From</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Person or company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Reference #"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <RHFDateField
                  control={form.control}
                  name="due_date"
                  label="Due Date"
                  nullable
                />
                <RHFDateField
                  control={form.control}
                  name="signed_co_received_date"
                  label="Signed CO Received Date"
                  nullable
                />
                <FormField
                  control={form.control}
                  name="designated_reviewer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designated Reviewer</FormLabel>
                      <Popover
                        open={reviewerSelectOpen}
                        onOpenChange={setReviewerSelectOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={reviewerSelectOpen}
                              disabled={employeesLoading}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <span className="truncate">
                                {employeesLoading
                                  ? "Loading employees..."
                                  : field.value || "Select an employee"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0"
                          align="start"
                          style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                          <Command>
                            <CommandInput placeholder="Search employees..." />
                            <CommandList>
                              <CommandEmpty>No employee found.</CommandEmpty>
                              <CommandGroup>
                                {employees.map((employee) => {
                                  const employeeName = formatEmployeeName(employee);
                                  return (
                                    <CommandItem
                                      key={employee.id}
                                      value={employeeName}
                                      onSelect={() => {
                                        field.onChange(employeeName);
                                        setReviewerSelectOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === employeeName
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate">
                                        {employeeName}
                                      </span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <RHFDateField
                  control={form.control}
                  name="review_date"
                  label="Review Date"
                  nullable
                />
                <FormField
                  control={form.control}
                  name="reviewed_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reviewed By</FormLabel>
                      <Popover
                        open={reviewedBySelectOpen}
                        onOpenChange={setReviewedBySelectOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={reviewedBySelectOpen}
                              disabled={employeesLoading}
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <span className="truncate">
                                {employeesLoading
                                  ? "Loading employees..."
                                  : field.value || "Select an employee"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0"
                          align="start"
                          style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                          <Command>
                            <CommandInput placeholder="Search employees..." />
                            <CommandList>
                              <CommandEmpty>No employee found.</CommandEmpty>
                              <CommandGroup>
                                {employees.map((employee) => {
                                  const employeeName = formatEmployeeName(employee);
                                  return (
                                    <CommandItem
                                      key={employee.id}
                                      value={employeeName}
                                      onSelect={() => {
                                        field.onChange(employeeName);
                                        setReviewedBySelectOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === employeeName
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      <span className="truncate">
                                        {employeeName}
                                      </span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <RHFDateField
                  control={form.control}
                  name="revised_substantial_completion_date"
                  label="Revised Substantial Completion Date"
                  nullable
                />
                <FormField
                  control={form.control}
                  name="rejection_reason"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Rejection Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ""}
                          rows={3}
                          placeholder="Reason for rejection..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Flags */}
            <section className="space-y-4">
              <SectionRuleHeading
                label="Flags"
                className="[&_span]:text-primary"
              />
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="is_private"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Private</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="executed"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Executed</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="field_change"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Field Change
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paid_in_full"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Paid In Full
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </form>
        </Form>
      </PageShell>
    );
  }

  // ---- View mode -----------------------------------------------------------
  const pageTitle = co.pcco_number
    ? `PCO for ${co.pcco_number} — ${co.title || "Untitled"}`
    : co.title || "Untitled Prime Contract CO";

  const changeOrderAmount = Number(co.total_amount) || 0;
  const changeOrderStatus = (co.status || "").toLowerCase();
  const approvedAmount = changeOrderStatus === "approved" ? changeOrderAmount : 0;
  const pendingAmount = ["draft", "proposed", "pending"].includes(changeOrderStatus)
    ? changeOrderAmount
    : 0;
  const varianceAmount = changeOrderAmount - lineItemsTotal;
  const hasInlineLineItemTable = lineItems.length > 0 || addingLineItem;
  const shouldUseMobileLineItemList =
    lineItems.length > 0 && !addingLineItem && editingLineItemId == null;
  const renderDateOrDash = (value: string | null | undefined) =>
    value ? formatDate(value) : <span className="text-muted-foreground/60">—</span>;

  return (
    <>
      <PageShell
        variant="detail"
        title={pageTitle}
        onBack={handleBack}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleApprove}>
                <Check className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRejectDialog(true)}>
                <X className="mr-2 h-4 w-4" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeliveryDialogOpen(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Email PDF
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/projects/${projectId}/prime-contract-change-orders/export?status=${co.status}`}
                  download
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Export CSV
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        contentClassName="space-y-0"
      >
        <PageTabs
          variant="inline"
          tabs={[
            { label: "General", href: "general", isActive: activeTab === "general" },
            { label: `Related (${relatedItems.length})`, href: "related", isActive: activeTab === "related" },
            { label: `Emails (${emails.length})`, href: "emails", isActive: activeTab === "emails" },
            { label: "History", href: "history", isActive: activeTab === "history" },
          ]}
          onTabClick={(href) => setActiveTab(href)}
        />

        <div>
          {activeTab === "general" && (
            <ContentSectionStack>
              <DetailLayout
                sidebarAt="lg"
                sidebar={
                  <div className="space-y-8">
                    <DetailPanel>
                      <SectionRuleHeading
                        label="Financial Summary"
                        className="mb-6 pb-0"
                      />
                      <dl className="space-y-3 text-sm">
                        <SummaryValueRow
                          label="Change Order Amount"
                          value={formatCurrency(changeOrderAmount)}
                        />
                        <SummaryValueRow
                          label="Line Items Total"
                          value={formatCurrency(lineItemsTotal)}
                        />
                        <SummaryValueRow
                          label="Variance"
                          value={formatCurrency(varianceAmount)}
                        />
                        <SummaryValueRow
                          label="Approved Amount"
                          value={formatCurrency(approvedAmount)}
                        />
                        <SummaryValueRow
                          label="Pending Amount"
                          value={formatCurrency(pendingAmount)}
                        />
                        <SummaryValueRow
                          label="Schedule Impact"
                          value={
                            co.schedule_impact != null
                              ? `${co.schedule_impact} days`
                              : "—"
                          }
                          bold
                          border
                        />
                      </dl>
                    </DetailPanel>

                    <DetailPanel>
                      <SectionRuleHeading
                        label="Key Dates"
                        className="mb-6 pb-0"
                      />
                      <dl className="space-y-3 text-sm">
                        <LabelValueRow label="Date Created">
                          {renderDateOrDash(co.created_at)}
                        </LabelValueRow>
                        <LabelValueRow
                          label="Created By"
                          valueClassName="break-all sm:break-words"
                        >
                          {co.created_by_name || co.created_by || "—"}
                        </LabelValueRow>
                        <LabelValueRow label="Submitted">
                          {renderDateOrDash(co.submitted_at)}
                        </LabelValueRow>
                        <LabelValueRow label="Approved">
                          {renderDateOrDash(co.approved_at)}
                        </LabelValueRow>
                        <LabelValueRow label="Due Date">
                          {renderDateOrDash(co.due_date)}
                        </LabelValueRow>
                        <LabelValueRow label="Invoiced Date">
                          {renderDateOrDash(co.invoiced_date)}
                        </LabelValueRow>
                        <LabelValueRow label="Signed CO Received Date">
                          {renderDateOrDash(co.signed_co_received_date)}
                        </LabelValueRow>
                        <LabelValueRow label="Review Date">
                          {renderDateOrDash(co.review_date)}
                        </LabelValueRow>
                        <LabelValueRow label="Revised Substantial Completion">
                          {renderDateOrDash(co.revised_substantial_completion_date)}
                        </LabelValueRow>
                      </dl>
                    </DetailPanel>
                  </div>
                }
                footer={
                  <>
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionRuleHeading
                          label="Line Items"
                          className="flex-1 [&_span]:text-primary"
                        />
                      </div>

                      {lineItemsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <Skeleton className="h-4 w-6" />
                              <Skeleton className="h-4 flex-1" />
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-12" />
                              <Skeleton className="h-4 w-16" />
                              <Skeleton className="h-4 w-24" />
                            </div>
                          ))}
                        </div>
                      ) : hasInlineLineItemTable ? (
                        <div className="space-y-4">
                          {shouldUseMobileLineItemList ? (
                            <div className="divide-y divide-border/60 border-y border-border/60 md:hidden">
                              {lineItems.map((item, idx) => {
                                const budgetCodeResolution =
                                  resolveLineItemBudgetCodeDisplay(item, budgetCodes);
                                return (
                                  <div key={item.id} className="space-y-3 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0 space-y-1">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                          Line {idx + 1}
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                          {item.description || "—"}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                        {formatCurrency(item.line_amount)}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <LabelValueRow label="Budget Code">
                                        <span
                                          className={
                                            budgetCodeResolution.isMapped
                                              ? undefined
                                              : "text-muted-foreground"
                                          }
                                        >
                                          {budgetCodeResolution.displayCode}
                                        </span>
                                      </LabelValueRow>
                                      <LabelValueRow label="Quantity">
                                        {item.quantity ?? "—"}
                                      </LabelValueRow>
                                      <LabelValueRow label="UOM">
                                        {item.uom || "—"}
                                      </LabelValueRow>
                                      <LabelValueRow label="Unit Cost">
                                        {item.unit_cost != null
                                          ? formatCurrency(item.unit_cost)
                                          : "—"}
                                      </LabelValueRow>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 pt-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => startEditLineItem(item)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteLineItem(item.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                              {computedMarkups.length > 0 ? (
                                <div className="space-y-2 py-4">
                                  <LabelValueRow label="Subtotal">
                                    {formatCurrency(lineItemsTotal)}
                                  </LabelValueRow>
                                  {computedMarkups.map((markup) => (
                                    <LabelValueRow
                                      key={markup.id}
                                      label={
                                        MARKUP_LABELS[markup.markup_type] ??
                                        markup.markup_type
                                      }
                                    >
                                      {markup.percentage}% · {formatCurrency(markup.amount)}
                                    </LabelValueRow>
                                  ))}
                                </div>
                              ) : null}
                              <div className="py-4">
                                <LabelValueRow
                                  label="Total"
                                  valueClassName="text-base font-semibold"
                                >
                                  {formatCurrency(grandTotal)}
                                </LabelValueRow>
                              </div>
                            </div>
                          ) : null}

                          <div
                            className={cn(
                              "overflow-x-auto",
                              shouldUseMobileLineItemList ? "hidden md:block" : "block",
                            )}
                          >
                            <InlineTable variant="read">
                              <InlineTableHeader>
                                <InlineTableHeaderRow>
                                  <InlineTableHeaderCell>#</InlineTableHeaderCell>
                                  <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                                  <InlineTableHeaderCell>Cost Code</InlineTableHeaderCell>
                                  <InlineTableHeaderCell align="right">Qty</InlineTableHeaderCell>
                                  <InlineTableHeaderCell>UOM</InlineTableHeaderCell>
                                  <InlineTableHeaderCell align="right">Unit Cost</InlineTableHeaderCell>
                                  <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
                                  <InlineTableHeaderCell className="w-20" />
                                </InlineTableHeaderRow>
                              </InlineTableHeader>
                              <InlineTableBody>
                                {lineItems.map((item, idx) =>
                                  editingLineItemId === item.id ? (
                                    <InlineTableRow key={item.id} className="bg-muted/50">
                                      <InlineTableCell className="text-muted-foreground">
                                        {idx + 1}
                                      </InlineTableCell>
                                      <InlineTableCell className="pr-2">
                                        <Input
                                          value={lineItemForm.description}
                                          onChange={(e) =>
                                            setLineItemForm((f) => ({
                                              ...f,
                                              description: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                          placeholder="Description"
                                          className="h-8"
                                        />
                                      </InlineTableCell>
                                      <InlineTableCell className="pr-2">
                                        <BudgetCodeSelector
                                          value={selectedLineItemBudgetCode.selectorValue}
                                          onValueChange={handleLineItemBudgetCodeChange}
                                          budgetCodes={budgetCodes}
                                          loading={budgetCodesLoading}
                                          placeholder={
                                            selectedLineItemBudgetCode.isMapped
                                              ? "Select budget code..."
                                              : selectedLineItemBudgetCode.displayCode
                                          }
                                          error={!selectedLineItemBudgetCode.isMapped}
                                          className="h-8 min-w-48 px-3"
                                        />
                                      </InlineTableCell>
                                      <InlineTableCell className="pr-2">
                                        <Input
                                          type="number"
                                          value={lineItemForm.quantity}
                                          onChange={(e) =>
                                            setLineItemForm((f) => ({
                                              ...f,
                                              quantity: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                          placeholder=""
                                          className="h-8 w-20 text-right"
                                        />
                                      </InlineTableCell>
                                      <InlineTableCell className="pr-2">
                                        <Input
                                          value={lineItemForm.uom}
                                          onChange={(e) =>
                                            setLineItemForm((f) => ({
                                              ...f,
                                              uom: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                          placeholder="UOM"
                                          className="h-8 w-20"
                                        />
                                      </InlineTableCell>
                                      <InlineTableCell className="pr-2">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={lineItemForm.unit_cost}
                                          onChange={(e) =>
                                            setLineItemForm((f) => ({
                                              ...f,
                                              unit_cost: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                          placeholder=""
                                          className="h-8 w-28 text-right"
                                        />
                                      </InlineTableCell>
                                      <InlineTableCell align="right" className="text-muted-foreground">
                                        {formatCurrency(computedLineItemAmount)}
                                      </InlineTableCell>
                                      <InlineTableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => void handleSaveLineItem()}
                                            disabled={lineItemSaving}
                                          >
                                            <Check className="h-4 w-4 text-primary" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={cancelLineItemEdit}
                                            disabled={lineItemSaving}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </InlineTableCell>
                                    </InlineTableRow>
                                  ) : (
                                    <InlineTableRow key={item.id}>
                                      <InlineTableCell className="text-muted-foreground">
                                        {idx + 1}
                                      </InlineTableCell>
                                      <InlineTableCell>
                                        {item.description || "—"}
                                      </InlineTableCell>
                                      <InlineTableCell>
                                        {(() => {
                                          const resolution = resolveLineItemBudgetCodeDisplay(
                                            item,
                                            budgetCodes,
                                          );
                                          return (
                                            <span
                                              title={resolution.displayLabel}
                                              className={
                                                resolution.isMapped
                                                  ? undefined
                                                  : "text-muted-foreground"
                                              }
                                            >
                                              {resolution.displayCode}
                                            </span>
                                          );
                                        })()}
                                      </InlineTableCell>
                                      <InlineTableCell align="right">
                                        {item.quantity ?? "—"}
                                      </InlineTableCell>
                                      <InlineTableCell>{item.uom || "—"}</InlineTableCell>
                                      <InlineTableCell align="right">
                                        {item.unit_cost != null
                                          ? formatCurrency(item.unit_cost)
                                          : "—"}
                                      </InlineTableCell>
                                      <InlineTableCell align="right">
                                        {formatCurrency(item.line_amount)}
                                      </InlineTableCell>
                                      <InlineTableCell align="right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => startEditLineItem(item)}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() =>
                                              handleDeleteLineItem(item.id)
                                            }
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </InlineTableCell>
                                    </InlineTableRow>
                                  ),
                                )}
                                {addingLineItem && (
                                  <InlineTableRow className="bg-muted/50">
                                    <InlineTableCell className="text-muted-foreground">
                                      {lineItems.length + 1}
                                    </InlineTableCell>
                                    <InlineTableCell className="pr-2">
                                      <Input
                                        value={lineItemForm.description}
                                        onChange={(e) =>
                                          setLineItemForm((f) => ({
                                            ...f,
                                            description: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                        placeholder="Description"
                                        className="h-8"
                                        autoFocus
                                      />
                                    </InlineTableCell>
                                    <InlineTableCell className="pr-2">
                                      <BudgetCodeSelector
                                        value={selectedLineItemBudgetCode.selectorValue}
                                        onValueChange={handleLineItemBudgetCodeChange}
                                        budgetCodes={budgetCodes}
                                        loading={budgetCodesLoading}
                                        placeholder="Select budget code..."
                                        error={
                                          Boolean(lineItemForm.cost_code) &&
                                          !selectedLineItemBudgetCode.isMapped
                                        }
                                        className="h-8 min-w-48 px-3"
                                      />
                                    </InlineTableCell>
                                    <InlineTableCell className="pr-2">
                                      <Input
                                        type="number"
                                        value={lineItemForm.quantity}
                                        onChange={(e) =>
                                          setLineItemForm((f) => ({
                                            ...f,
                                            quantity: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                        placeholder=""
                                        className="h-8 w-20 text-right"
                                      />
                                    </InlineTableCell>
                                    <InlineTableCell className="pr-2">
                                      <Input
                                        value={lineItemForm.uom}
                                        onChange={(e) =>
                                          setLineItemForm((f) => ({
                                            ...f,
                                            uom: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                        placeholder="UOM"
                                        className="h-8 w-20"
                                      />
                                    </InlineTableCell>
                                    <InlineTableCell className="pr-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={lineItemForm.unit_cost}
                                        onChange={(e) =>
                                          setLineItemForm((f) => ({
                                            ...f,
                                            unit_cost: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSaveLineItem(); } if (e.key === "Escape") cancelLineItemEdit(); }}
                                        placeholder=""
                                        className="h-8 w-28 text-right"
                                      />
                                    </InlineTableCell>
                                    <InlineTableCell align="right" className="text-muted-foreground">
                                      {formatCurrency(computedLineItemAmount)}
                                    </InlineTableCell>
                                    <InlineTableCell align="right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => void handleSaveLineItem()}
                                          disabled={lineItemSaving}
                                        >
                                          <Check className="h-4 w-4 text-primary" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={cancelLineItemEdit}
                                          disabled={lineItemSaving}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </InlineTableCell>
                                  </InlineTableRow>
                                )}
                                {computedMarkups.length > 0 && (
                                  <>
                                    <InlineTableRow>
                                      <InlineTableCell
                                        colSpan={6}
                                        align="right"
                                        className="text-xs font-medium text-muted-foreground"
                                      >
                                        Subtotal
                                      </InlineTableCell>
                                      <InlineTableCell align="right" className="text-xs font-medium">
                                        {formatCurrency(lineItemsTotal)}
                                      </InlineTableCell>
                                      <InlineTableCell />
                                    </InlineTableRow>
                                    {computedMarkups.map((markup) => (
                                      <InlineTableRow key={markup.id} type="markup">
                                        <InlineTableCell />
                                        <InlineTableCell
                                          colSpan={4}
                                          className="text-sm text-muted-foreground"
                                        >
                                          {MARKUP_LABELS[markup.markup_type] ??
                                            markup.markup_type}
                                        </InlineTableCell>
                                        <InlineTableCell align="right" className="text-sm text-muted-foreground">
                                          {markup.percentage}%
                                        </InlineTableCell>
                                        <InlineTableCell align="right" className="text-sm">
                                          {formatCurrency(markup.amount)}
                                        </InlineTableCell>
                                        <InlineTableCell />
                                      </InlineTableRow>
                                    ))}
                                  </>
                                )}
                              </InlineTableBody>
                              <InlineTableFooter>
                                <InlineTableFooterRow type="totals">
                                  <InlineTableFooterCell colSpan={7}>
                                    <div className="flex justify-between">
                                      <span>Total</span>
                                      <span>{formatCurrency(grandTotal)}</span>
                                    </div>
                                  </InlineTableFooterCell>
                                  <InlineTableFooterCell />
                                </InlineTableFooterRow>
                              </InlineTableFooter>
                            </InlineTable>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={<List />}
                          title="No line items"
                          description="Add cost line items to this change order"
                          action={
                            <Button size="sm" variant="outline" onClick={startAddLineItem}>
                              <Plus />
                              Add Line Item
                            </Button>
                          }
                        />
                      )}
                    </section>

                    <section className="space-y-4">
                      <SectionRuleHeading label="Attachments" className="[&_span]:text-primary" />
                      <EntityAttachments
                        entityType="change_order"
                        entityId={primeCoId}
                        projectId={projectId}
                        showLabel={false}
                      />
                    </section>
                  </>
                }
              >
                <section>
                  <DetailPanel className="space-y-8">
                    <SectionRuleHeading
                      label="General Information"
                      className="[&_span]:text-primary"
                    />
                    <DetailFieldGrid columns={2} className="gap-x-10 gap-y-5">
                      <DetailField label="#">
                        {co.pcco_number || "—"}
                      </DetailField>
                      <DetailField label="Revision">
                        {co.revision ?? 0}
                      </DetailField>
                      <DetailField label="Title">
                        {co.title || "—"}
                      </DetailField>
                      <DetailField label="Change Reason">
                        {co.change_reason || "—"}
                      </DetailField>
                      <DetailField label="Status">
                        <StatusBadge status={co.status || "Unknown"} />
                      </DetailField>
                      <DetailField label="Executed">
                        {co.executed ? "Yes" : "No"}
                      </DetailField>
                      <DetailField label="Contract Company">
                        {co.contract_company || "—"}
                      </DetailField>
                      <DetailField label="Private">
                        {co.is_private ? "Yes" : "No"}
                      </DetailField>
                      <DetailField label="Contract">
                        {co.contract ? (
                          <Button
                            type="button"
                            variant="link"
                            className="inline-flex h-auto min-w-0 max-w-full flex-wrap items-start justify-start gap-1 whitespace-normal p-0 text-left text-primary"
                            onClick={() =>
                              router.push(
                                `/${projectId}/prime-contracts/${co.contract!.id}`,
                              )
                            }
                          >
                            <Link2 className="h-3 w-3" />
                            {co.contract.contract_number} —{" "}
                            {co.contract.title || "Prime"}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </DetailField>
                      <DetailField label="Field Change">
                        {co.field_change ? "Yes" : "No"}
                      </DetailField>
                      <DetailField label="Request Received From">
                        {co.request_received_from || "—"}
                      </DetailField>
                      <DetailField label="Paid In Full">
                        {co.paid_in_full ? "Yes" : "No"}
                      </DetailField>
                      <DetailField label="Location">
                        {co.location || "—"}
                      </DetailField>
                      <DetailField label="Reference">
                        {co.reference || "—"}
                      </DetailField>
                      {co.designated_reviewer && (
                        <DetailField label="Designated Reviewer">
                          {co.designated_reviewer}
                        </DetailField>
                      )}
                      {co.reviewed_by && (
                        <DetailField label="Reviewed By">
                          {co.reviewed_by}
                        </DetailField>
                      )}
                      <DetailField
                        label="Description"
                        span={2}
                      >
                        <span className="whitespace-pre-wrap leading-relaxed">
                          {co.description || "Not set"}
                        </span>
                      </DetailField>
                    </DetailFieldGrid>
                    {co.status === "rejected" && co.rejection_reason && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                        <p className="mb-1 text-xs font-medium uppercase text-destructive">
                          Rejection Reason
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {co.rejection_reason}
                        </p>
                      </div>
                    )}
                  </DetailPanel>
                </section>
              </DetailLayout>
            </ContentSectionStack>
          )}

          {activeTab === "related" && (
            <ChangeEventRelatedItemsTab
              relatedItems={relatedItems}
              isLoading={relatedItemsLoading}
              onFetchOptions={fetchRelatedItemOptions}
              onLink={linkRelatedItem}
              onUnlink={unlinkRelatedItem}
            />
          )}

          {activeTab === "emails" && (
            emailsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : emailsError ? (
              <p className="text-sm text-destructive">{emailsError}</p>
            ) : emails.length === 0 ? (
              <EmptyState
                icon={<Mail />}
                title="No emails"
                description="Send the current change order PDF to owner contacts or manually entered recipients."
                action={
                  <Button size="sm" onClick={() => setDeliveryDialogOpen(true)}>
                    <Mail />
                    Email change order
                  </Button>
                }
              />
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <SectionRuleHeading
                    label="Email History"
                    className="flex-1 [&_span]:text-primary"
                  />
                  <Button size="sm" onClick={() => setDeliveryDialogOpen(true)}>
                    <Mail />
                    Email change order
                  </Button>
                </div>
                <div className="divide-y divide-border/60 border-y border-border/60 md:hidden">
                  {emails.map((email) => {
                    const sentDate =
                      email.sent_at ?? email.received_at ?? email.created_at;
                    const preview = stripHtml(email.body).slice(0, 120);

                    return (
                      <div key={email.id} className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {email.subject || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sentDate ? formatDate(sentDate) : "—"}
                            </p>
                          </div>
                          <StatusBadge status={email.status || "Unknown"} />
                        </div>
                        <LabelValueRow label="Recipients">
                          {email.to_list?.length ? email.to_list.join(", ") : "—"}
                        </LabelValueRow>
                        <LabelValueRow label="Preview">
                          <span className="text-muted-foreground">
                            {preview || "—"}
                          </span>
                        </LabelValueRow>
                        {email.has_attachments ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Paperclip className="h-3.5 w-3.5" />
                            Attachments included
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <InlineTable variant="read">
                    <InlineTableHeader>
                      <InlineTableHeaderRow>
                        <InlineTableHeaderCell>Subject</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Recipients</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Preview</InlineTableHeaderCell>
                        <InlineTableHeaderCell>Date</InlineTableHeaderCell>
                        <InlineTableHeaderCell className="w-10" />
                      </InlineTableHeaderRow>
                    </InlineTableHeader>
                    <InlineTableBody>
                      {emails.map((email) => {
                        const sentDate =
                          email.sent_at ?? email.received_at ?? email.created_at;
                        const preview = stripHtml(email.body).slice(0, 120);

                        return (
                          <InlineTableRow key={email.id}>
                            <InlineTableCell className="max-w-sm truncate font-medium">
                              {email.subject || "—"}
                            </InlineTableCell>
                            <InlineTableCell className="max-w-xs truncate">
                              {email.to_list?.length
                                ? email.to_list.join(", ")
                                : "—"}
                            </InlineTableCell>
                            <InlineTableCell>
                              <StatusBadge status={email.status || "Unknown"} />
                            </InlineTableCell>
                            <InlineTableCell className="max-w-md truncate text-muted-foreground">
                              {preview || "—"}
                            </InlineTableCell>
                            <InlineTableCell className="whitespace-nowrap text-muted-foreground">
                              {sentDate ? formatDate(sentDate) : "—"}
                            </InlineTableCell>
                            <InlineTableCell>
                              {email.has_attachments ? (
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : null}
                            </InlineTableCell>
                          </InlineTableRow>
                        );
                      })}
                    </InlineTableBody>
                  </InlineTable>
                </div>
              </section>
            )
          )}

          {activeTab === "history" && (
            <ChangeHistoryTimeline co={co} />
          )}
        </div>
      </PageShell>

      {ConfirmDialog}

      <DocumentDeliveryDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        recordType="prime-contract-change-order"
        recordId={String(co.id)}
        number={co.pcco_number || `PCCO-${co.id}`}
        title={co.title || "Prime Contract Change Order"}
        initialTab="email"
        allowedTabs={["email"]}
        onEmailSent={() => void fetchEmails()}
      />

      {/* Rejection dialog */}
      <Modal
        open={showRejectDialog}
        onOpenChange={(open) => {
          setShowRejectDialog(open);
          if (!open) setRejectionReason("");
        }}
      >
        <ModalContent className="sm:max-w-md">
          <ModalHeader>
            <ModalTitle>Reject Change Order</ModalTitle>
            <ModalDescription>
              Please provide a reason for rejecting this change order.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              Reject
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
