"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Trash2, Download, Check, CheckCheck, Ban, Send, RotateCcw, Plus, Save, Mail, MoreVertical } from "lucide-react";
import { appToast as toast } from "@/lib/toast/app-toast";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableRow,
} from "@/components/ds";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { StatusBadge } from "@/components/ds/status-badge";
import {
  PageShell,
  ContentSectionStack,
  DetailPanel,
  SummaryPanel,
  SummaryValueRow,
  SectionRuleHeading,
  SectionAction,
} from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import { useSendInvoiceEmail } from "@/hooks/use-invoicing";
import {
  formatCurrency,
  formatDate,
  type OwnerInvoice,
  type OwnerInvoiceLineItem,
} from "@/features/invoicing/invoicing-table-config";
import { Text } from "@/components/ds/text";
import {
  EmptyState,
  DetailField,
  DetailFieldGrid,
  EditableDetailField,
  EntityAttachments,
} from "@/components/ds";
import { apiFetch, apiFetchWithTimeout } from "@/lib/api-client";
import { usePdfExport } from "@/hooks/use-pdf-export";
import { formatPercent } from "@/lib/format";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EDITABLE_STATUSES = ["draft", "revise_and_resubmit"] as const;

function isEditable(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// Add line item schema
// ---------------------------------------------------------------------------

const addLineItemSchema = z.object({
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(100).optional(),
  scheduled_value: z.coerce.number().min(0).default(0),
  work_completed_period: z.coerce.number().min(0).default(0),
  materials_stored: z.coerce.number().min(0).default(0),
  retainage_pct: z.coerce.number().min(0).max(100).default(0),
  retainage_amount: z.coerce.number().min(0).default(0),
  retainage_released: z.coerce.number().min(0).default(0),
});

type AddLineItemValues = z.infer<typeof addLineItemSchema>;

// ---------------------------------------------------------------------------
// SOV editable cell — inline number input
// ---------------------------------------------------------------------------

interface EditableCellProps {
  value: number;
  onChange: (val: number) => void;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}

function EditableCell({ value, onChange, ariaLabel, prefix, suffix, min = 0, max, step = 0.01 }: EditableCellProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent value changes externally
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else {
      setLocalValue(String(value));
    }
  };

  return (
    <div className="flex min-w-28 items-center gap-0.5">
      {prefix && <span className="text-muted-foreground text-xs">{prefix}</span>}
      <Input
        ref={inputRef}
        type="number"
        aria-label={ariaLabel}
        value={localValue}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            inputRef.current?.blur();
          }
          if (e.key === "Escape") {
            setLocalValue(String(value));
            inputRef.current?.blur();
          }
        }}
        className="h-8 w-full bg-muted px-2 py-1 text-right text-sm tabular-nums"
      />
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derived calculation helpers
// ---------------------------------------------------------------------------

function calcTotalCompleted(item: OwnerInvoiceLineItem, overrides: Partial<SovDraft>): number {
  const wcp = overrides.work_completed_period ?? item.work_completed_period;
  const ms = overrides.materials_stored ?? item.materials_stored;
  return (item.work_completed_previous ?? 0) + wcp + ms;
}

function calcPctComplete(item: OwnerInvoiceLineItem, overrides: Partial<SovDraft>): number {
  const sv = item.scheduled_value;
  if (!sv || sv === 0) return 0;
  return (calcTotalCompleted(item, overrides) / sv) * 100;
}

function calcRetainageAmount(item: OwnerInvoiceLineItem, overrides: Partial<SovDraft>): number {
  if (overrides.retainage_amount !== undefined) return overrides.retainage_amount;
  const wcp = overrides.work_completed_period ?? item.work_completed_period;
  const pct = overrides.retainage_pct ?? item.retainage_pct;
  return wcp * (pct / 100);
}

function calcNetAmountThisPeriod(item: OwnerInvoiceLineItem, overrides: Partial<SovDraft>): number {
  const wcp = overrides.work_completed_period ?? item.work_completed_period;
  const ms = overrides.materials_stored ?? item.materials_stored;
  const retainageAmt = calcRetainageAmount(item, overrides);
  const released = overrides.retainage_released ?? item.retainage_released;
  return wcp + ms - retainageAmt + released;
}

function calcBalanceToFinish(item: OwnerInvoiceLineItem, overrides: Partial<SovDraft>): number {
  const sv = item.scheduled_value;
  const total = calcTotalCompleted(item, overrides);
  return sv - total;
}

// ---------------------------------------------------------------------------
// SOV Draft state type (per-row editable fields keyed by item id)
// ---------------------------------------------------------------------------

interface SovDraft {
  work_completed_period: number;
  materials_stored: number;
  retainage_pct: number;
  retainage_amount: number;
  retainage_released: number;
}

type SovDraftMap = Record<number, Partial<SovDraft>>;

// ---------------------------------------------------------------------------
// SOV Table component
// ---------------------------------------------------------------------------

interface SovTableProps {
  lineItems: OwnerInvoiceLineItem[];
  editable: boolean;
  draftMap: SovDraftMap;
  onDraftChange: (itemId: number, field: keyof SovDraft, value: number) => void;
}

function SovTable({ lineItems, editable, draftMap, onDraftChange }: SovTableProps) {
  if (lineItems.length === 0) {
    return (
      <EmptyState
        title="No line items found"
        description="No schedule of values line items have been added to this invoice."
      />
    );
  }

  return (
    <InlineTable variant="edit">
        <InlineTableHeader>
          <InlineTableRow>
            <InlineTableHeaderCell className="min-w-40">Description</InlineTableHeaderCell>
            <InlineTableHeaderCell>Category</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Scheduled Value</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Prev Work</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-32 text-right">Work This Period</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-32 text-right">Materials Stored</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Total Comp. &amp; Stored</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-20 text-right">% Complete</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-32 text-right">Retainage %</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Retainage $</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-32 text-right">Retainage Released</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Net This Period</InlineTableHeaderCell>
            <InlineTableHeaderCell className="min-w-28 text-right">Balance to Finish</InlineTableHeaderCell>
          </InlineTableRow>
        </InlineTableHeader>
        <InlineTableBody>
          {lineItems.map((item) => {
            const overrides = draftMap[item.id] ?? {};
            const totalCompleted = calcTotalCompleted(item, overrides);
            const pctComplete = calcPctComplete(item, overrides);
            const retainageAmt = calcRetainageAmount(item, overrides);
            const netThisPeriod = calcNetAmountThisPeriod(item, overrides);
            const balance = calcBalanceToFinish(item, overrides);
            const rowLabel = item.description || "line item";

            return (
              <InlineTableRow key={item.id}>
                <InlineTableCell className="font-medium text-sm">
                  {item.description || "—"}
                </InlineTableCell>
                <InlineTableCell>
                  <span className="text-sm capitalize">
                    {item.category?.replace(/_/g, " ") || "—"}
                  </span>
                </InlineTableCell>
                <InlineTableCell className="text-right tabular-nums text-sm">
                  {formatCurrency(item.scheduled_value)}
                </InlineTableCell>
                <InlineTableCell className="text-right tabular-nums text-sm">
                  {formatCurrency(item.work_completed_previous)}
                </InlineTableCell>

                {/* Editable: Work Completed This Period */}
                <InlineTableCell className="text-right">
                  {editable ? (
                    <EditableCell
                      value={overrides.work_completed_period ?? item.work_completed_period}
                      onChange={(val) => onDraftChange(item.id, "work_completed_period", val)}
                      ariaLabel={`Work completed this period for ${rowLabel}`}
                      prefix="$"
                    />
                  ) : (
                    <span className="tabular-nums text-sm">{formatCurrency(item.work_completed_period)}</span>
                  )}
                </InlineTableCell>

                {/* Editable: Materials Stored */}
                <InlineTableCell className="text-right">
                  {editable ? (
                    <EditableCell
                      value={overrides.materials_stored ?? item.materials_stored}
                      onChange={(val) => onDraftChange(item.id, "materials_stored", val)}
                      ariaLabel={`Materials stored for ${rowLabel}`}
                      prefix="$"
                    />
                  ) : (
                    <span className="tabular-nums text-sm">{formatCurrency(item.materials_stored)}</span>
                  )}
                </InlineTableCell>

                {/* Read-only calculated */}
                <InlineTableCell className="text-right tabular-nums text-sm">
                  {formatCurrency(totalCompleted)}
                </InlineTableCell>
                <InlineTableCell className="text-right tabular-nums text-sm">
                  {formatPercent(pctComplete)}
                </InlineTableCell>

                {/* Editable: Retainage % */}
                <InlineTableCell className="text-right">
                  {editable ? (
                    <EditableCell
                      value={overrides.retainage_pct ?? item.retainage_pct}
                      onChange={(pct) => {
                        const wcp = overrides.work_completed_period ?? item.work_completed_period;
                        onDraftChange(item.id, "retainage_pct", pct);
                        onDraftChange(item.id, "retainage_amount", wcp * (pct / 100));
                      }}
                      ariaLabel={`Retainage percent for ${rowLabel}`}
                      suffix="%"
                      max={100}
                      step={0.1}
                    />
                  ) : (
                    <span className="tabular-nums text-sm">
                      {formatPercent(item.retainage_pct ?? 0, 2)}
                    </span>
                  )}
                </InlineTableCell>

                {/* Editable: Retainage $ */}
                <InlineTableCell className="text-right">
                  {editable ? (
                    <EditableCell
                      value={overrides.retainage_amount ?? retainageAmt}
                      onChange={(amt) => {
                        const wcp = overrides.work_completed_period ?? item.work_completed_period;
                        onDraftChange(item.id, "retainage_amount", amt);
                        onDraftChange(item.id, "retainage_pct", wcp > 0 ? (amt / wcp) * 100 : 0);
                      }}
                      ariaLabel={`Retainage amount for ${rowLabel}`}
                      prefix="$"
                    />
                  ) : (
                    <span className="tabular-nums text-sm">{formatCurrency(retainageAmt)}</span>
                  )}
                </InlineTableCell>

                {/* Editable: Retainage Released */}
                <InlineTableCell className="text-right">
                  {editable ? (
                    <EditableCell
                      value={overrides.retainage_released ?? item.retainage_released}
                      onChange={(val) => onDraftChange(item.id, "retainage_released", val)}
                      ariaLabel={`Retainage released for ${rowLabel}`}
                      prefix="$"
                    />
                  ) : (
                    <span className="tabular-nums text-sm">{formatCurrency(item.retainage_released)}</span>
                  )}
                </InlineTableCell>

                {/* Calculated: Net this period */}
                <InlineTableCell className="text-right tabular-nums text-sm font-medium">
                  {formatCurrency(netThisPeriod)}
                </InlineTableCell>

                {/* Calculated: Balance to finish */}
                <InlineTableCell className="text-right tabular-nums text-sm">
                  {formatCurrency(balance)}
                </InlineTableCell>
              </InlineTableRow>
            );
          })}
        </InlineTableBody>
      </InlineTable>
  );
}

// ---------------------------------------------------------------------------
// Add Line Item dialog
// ---------------------------------------------------------------------------

interface AddLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  invoiceId: number;
  onSuccess: (item: OwnerInvoiceLineItem) => void;
}

function AddLineItemDialog({ open, onOpenChange, projectId, invoiceId, onSuccess }: AddLineItemDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<AddLineItemValues>({
    resolver: zodResolver(addLineItemSchema) as Resolver<AddLineItemValues>,
    defaultValues: {
      description: "",
      category: "",
      scheduled_value: 0,
      work_completed_period: 0,
      materials_stored: 0,
      retainage_pct: 0,
      retainage_amount: 0,
      retainage_released: 0,
    },
  });

  const onSubmit = async (values: AddLineItemValues) => {
    setIsSaving(true);
    try {
      const body = await apiFetch<{ data: OwnerInvoiceLineItem }>(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/line-items`,
        {
          method: "POST",
          body: JSON.stringify(values),
        },
      );
      toast.success("Line item added");
      form.reset();
      onOpenChange(false);
      onSuccess(body.data);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to add line item");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Add Line Item</ModalTitle>
        </ModalHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                placeholder="Line item description"
                {...form.register("description")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-category">Category</Label>
              <Input
                id="add-category"
                placeholder="e.g. labor, materials"
                {...form.register("category")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-scheduled-value">Scheduled Value ($)</Label>
              <Input
                id="add-scheduled-value"
                type="number"
                min={0}
                step={0.01}
                {...form.register("scheduled_value")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-work-period">Work Completed This Period ($)</Label>
              <Input
                id="add-work-period"
                type="number"
                min={0}
                step={0.01}
                {...form.register("work_completed_period")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-materials">Materials Stored ($)</Label>
              <Input
                id="add-materials"
                type="number"
                min={0}
                step={0.01}
                {...form.register("materials_stored")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-retainage-pct">Retainage (%)</Label>
              <Input
                id="add-retainage-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                {...form.register("retainage_pct")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-retainage-released">Retainage Released ($)</Label>
              <Input
                id="add-retainage-released"
                type="number"
                min={0}
                step={0.01}
                {...form.register("retainage_released")}
              />
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add Line Item"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Invoice Detail Page
// ---------------------------------------------------------------------------

/**
 * Invoice Detail Page
 *
 * Displays detailed information about a specific owner invoice
 * including an editable SOV grid (when status is draft or revise_and_resubmit).
 * Metadata fields are edited inline on the page; status transitions run through
 * the workflow actions (Submit / Approve / Revise / Void).
 */
export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = parseInt(params.projectId as string);
  const invoiceId = parseInt(params.invoiceId as string);
  useProjectTitle("Invoice Details");

  const [invoice, setInvoice] = useState<OwnerInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [approveAsNotedDialogOpen, setApproveAsNotedDialogOpen] = useState(false);
  const [isApprovingAsNoted, setIsApprovingAsNoted] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [addLineItemOpen, setAddLineItemOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const sendInvoiceEmail = useSendInvoiceEmail(String(projectId));

  // SOV draft state — tracks unsaved edits keyed by line item id
  const [sovDraft, setSovDraft] = useState<SovDraftMap>({});
  const [isSavingSOV, setIsSavingSOV] = useState(false);

  const hasSovChanges = Object.keys(sovDraft).length > 0;

  // Fetch invoice details
  const fetchInvoice = useCallback(async () => {
    if (!projectId || !invoiceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetchWithTimeout<{ data: OwnerInvoice }>(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}`,
        undefined,
        15_000,
      );
      if (!data?.data) {
        setError("Invoice not found");
      } else {
        setInvoice(data.data);
        // Reset draft on fresh load
        setSovDraft({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invoice");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Inline field save — PATCH a single field, then refresh. Throws on failure
  // so EditableDetailField reverts the field and toasts the error.
  const handleSaveField = useCallback(
    async (field: string, value: string | null) => {
      await apiFetch(`/api/projects/${projectId}/invoicing/owner/${invoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      await fetchInvoice();
    },
    [projectId, invoiceId, fetchInvoice],
  );

  // SOV draft change handler
  const handleDraftChange = useCallback(
    (itemId: number, field: keyof SovDraft, value: number) => {
      setSovDraft((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [field]: value },
      }));
    },
    [],
  );

  // Save SOV changes via PATCH bulk endpoint
  const handleSaveSOV = async () => {
    if (!hasSovChanges) return;

    setIsSavingSOV(true);
    try {
      const updates = Object.entries(sovDraft).map(([idStr, fields]) => ({
        id: parseInt(idStr, 10),
        ...fields,
      }));

      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/line-items`,
        {
          method: "PATCH",
          body: JSON.stringify({ updates }),
        },
      );

      toast.success("Schedule of Values saved");
      // Refresh invoice to get server-computed values
      await fetchInvoice();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Failed to save changes";
      toast.error(message);
    } finally {
      setIsSavingSOV(false);
    }
  };

  // Discard draft changes
  const handleDiscardSOV = () => {
    setSovDraft({});
  };

  // Action handlers
  const handleBack = () => {
    router.push(`/${projectId}/invoices`);
  };

  const handleSubmit = async () => {
    if (!invoice) return;

    // Prompt to save unsaved SOV changes first
    if (hasSovChanges) {
      toast.warning("You have unsaved SOV changes. Please save or discard them before submitting.");
      return;
    }

    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/submit`,
        {
          method: "POST",
        },
      );

      toast.success("Invoice submitted successfully");
      await fetchInvoice();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to submit invoice");
    }
  };

  const handleRevise = async () => {
    if (!invoice) return;

    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/revise`,
        { method: "POST" },
      );

      toast.success("Invoice returned for revision");
      await fetchInvoice();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to request revision");
    }
  };

  const handleApprove = async () => {
    if (!invoice) return;

    try {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/approve`,
        {
          method: "POST",
        },
      );

      toast.success("Invoice approved successfully");
      await fetchInvoice();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to approve invoice");
    }
  };

  const handleApproveAsNoted = async () => {
    if (!invoice) return;
    try {
      setIsApprovingAsNoted(true);
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/approve-as-noted`,
        { method: "POST" },
      );
      toast.success("Invoice approved as noted");
      setApproveAsNotedDialogOpen(false);
      await fetchInvoice();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to approve invoice as noted");
    } finally {
      setIsApprovingAsNoted(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    try {
      setIsVoiding(true);
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}/void`,
        {
          method: "POST",
          body: JSON.stringify({ reason: voidReason.trim() || undefined }),
        },
      );
      toast.success("Invoice voided");
      setVoidDialogOpen(false);
      setVoidReason("");
      await fetchInvoice();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to void invoice");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    try {
      setIsDeleting(true);
      await apiFetch(
        `/api/projects/${projectId}/invoicing/owner/${invoiceId}`,
        {
          method: "DELETE",
        },
      );

      toast.success("Invoice deleted successfully");
      router.push(`/${projectId}/invoices`);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to delete invoice");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const { exportPdf: handleExportPDF } = usePdfExport({
    endpoint: `/api/projects/${projectId}/invoicing/owner/${invoiceId}/pdf`,
    filename: `invoice-${invoice?.invoice_number || invoiceId}`,
  });

  const openEmailDialog = () => {
    const invoiceNumber = invoice?.invoice_number || invoice?.id || "";
    setEmailTo("");
    setEmailCc("");
    setEmailSubject(`Invoice #${invoiceNumber}`);
    setEmailMessage(`Please find attached invoice #${invoiceNumber}.`);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    const toArr = emailTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ccArr = emailCc
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (toArr.length === 0) {
      toast.error("At least one recipient is required");
      return;
    }

    try {
      await sendInvoiceEmail.mutateAsync({
        invoiceId: invoice.id,
        to: toArr,
        cc: ccArr.length > 0 ? ccArr : undefined,
        subject: emailSubject || undefined,
        message: emailMessage || undefined,
      });
      setEmailDialogOpen(false);
    } catch (error) {
      reportNonCriticalFailure({
        area: "owner-invoice-detail",
        operation: "send-invoice-email",
        error,
        userVisibleFallback: "Invoice email was not sent.",
        metadata: { invoiceId: invoice.id, projectId },
      });
    }
  };

  const handleLineItemAdded = (item: OwnerInvoiceLineItem) => {
    setInvoice((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        owner_invoice_line_items: [
          ...(prev.owner_invoice_line_items ?? []),
          item,
        ],
      };
    });
  };

  // Calculate totals (prefer draft values for real-time summary)
  const lineItems = invoice?.owner_invoice_line_items ?? [];

  // Pre-fill retainage_released for every line item to equal its held retainage
  const handleReleaseAllRetainage = useCallback(() => {
    setSovDraft((prev) => {
      const next: SovDraftMap = { ...prev };
      for (const item of lineItems) {
        const existingOverrides = prev[item.id] ?? {};
        const retainageHeld =
          existingOverrides.retainage_amount !== undefined
            ? existingOverrides.retainage_amount
            : (item.retainage_amount ?? 0);
        next[item.id] = {
          ...existingOverrides,
          retainage_released: retainageHeld,
        };
      }
      return next;
    });
  }, [lineItems]);

  const sovTotals = lineItems.reduce(
    (acc, item) => {
      const overrides = sovDraft[item.id] ?? {};
      acc.scheduledValue += item.scheduled_value;
      acc.workPrevious += item.work_completed_previous ?? 0;
      acc.workThisPeriod += overrides.work_completed_period ?? item.work_completed_period;
      acc.materialsStored += overrides.materials_stored ?? item.materials_stored;
      acc.retainageAmount += calcRetainageAmount(item, overrides);
      acc.netThisPeriod += calcNetAmountThisPeriod(item, overrides);
      return acc;
    },
    {
      scheduledValue: 0,
      workPrevious: 0,
      workThisPeriod: 0,
      materialsStored: 0,
      retainageAmount: 0,
      netThisPeriod: 0,
    },
  );

  const totalCompleted = sovTotals.workPrevious + sovTotals.workThisPeriod + sovTotals.materialsStored;
  const pctComplete = sovTotals.scheduledValue > 0
    ? (totalCompleted / sovTotals.scheduledValue) * 100
    : 0;

  const invoiceEditable = invoice ? isEditable(invoice.status) : false;

  if (isLoading) {
    return (
      <PageShell variant="detail" title="Invoice Details" onBack={() => router.back()}>
        <div className="flex justify-center items-center h-64">
          <Text tone="muted">Loading invoice...</Text>
        </div>
      </PageShell>
    );
  }

  if (error || !invoice) {
    return (
      <PageShell variant="detail" title="Invoice Details" onBack={() => router.back()}>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Text tone="destructive">{error || "Invoice not found"}</Text>
          <Button onClick={handleBack}>
            <ArrowLeft />
            Back to Invoices
          </Button>
        </div>
      </PageShell>
    );
  }

  const canVoid = invoice.status !== "paid" && invoice.status !== "void";
  const canDelete = !["approved", "approved_as_noted", "paid"].includes(invoice.status);

  return (
    <>
      <PageShell
        variant="detailWide"
        title={`Invoice ${invoice.invoice_number || invoice.id}`}
        description={invoice.contract_number ?? invoice.prime_contract_id ?? undefined}
        statusBadge={<StatusBadge status={invoice.status} type="invoice" />}
        onBack={() => router.back()}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Primary workflow action(s) for the current status */}
            {(invoice.status === "draft" || invoice.status === "revise_and_resubmit") && (
              <Button size="sm" onClick={handleSubmit}>
                <Send />
                Submit for Approval
              </Button>
            )}
            {invoice.status === "under_review" && (
              <>
                <Button size="sm" onClick={handleApprove}>
                  <Check />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApproveAsNotedDialogOpen(true)}
                >
                  <CheckCheck />
                  Approve as Noted
                </Button>
                <Button variant="outline" size="sm" onClick={handleRevise}>
                  <RotateCcw />
                  Revise &amp; Resubmit
                </Button>
              </>
            )}

            {/* Secondary + destructive actions collapse into an overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openEmailDialog}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email Invoice
                </DropdownMenuItem>
                {(canVoid || canDelete) && <DropdownMenuSeparator />}
                {canVoid && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isVoiding}
                    onClick={() => setVoidDialogOpen(true)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Void
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
        <ContentSectionStack className="pt-3">
          {/* Invoice Information */}
          <DetailPanel>
            <SectionRuleHeading label="Invoice Information" />
            <DetailFieldGrid columns={2}>
              {invoiceEditable ? (
                <EditableDetailField
                  label="Invoice Number"
                  type="text"
                  value={invoice.invoice_number ?? ""}
                  emptyPlaceholder="Add number"
                  onSave={(v) => handleSaveField("invoice_number", v || null)}
                />
              ) : (
                <DetailField label="Invoice Number">
                  {invoice.invoice_number || String(invoice.id)}
                </DetailField>
              )}

              <DetailField label="Invoice Date">
                {formatDate(invoice.created_at)}
              </DetailField>

              {invoiceEditable ? (
                <EditableDetailField
                  label="Period Start"
                  type="date"
                  value={invoice.period_start ? invoice.period_start.slice(0, 10) : ""}
                  display={invoice.period_start ? formatDate(invoice.period_start) : undefined}
                  emptyPlaceholder="Set date"
                  onSave={(v) => handleSaveField("period_start", v || null)}
                />
              ) : invoice.period_start ? (
                <DetailField label="Period Start">
                  {formatDate(invoice.period_start)}
                </DetailField>
              ) : null}

              {invoiceEditable ? (
                <EditableDetailField
                  label="Period End"
                  type="date"
                  value={invoice.period_end ? invoice.period_end.slice(0, 10) : ""}
                  display={invoice.period_end ? formatDate(invoice.period_end) : undefined}
                  emptyPlaceholder="Set date"
                  onSave={(v) => handleSaveField("period_end", v || null)}
                />
              ) : invoice.period_end ? (
                <DetailField label="Period End">
                  {formatDate(invoice.period_end)}
                </DetailField>
              ) : null}

              {invoice.due_date ? (
                <DetailField label="Due Date">
                  {formatDate(invoice.due_date)}
                </DetailField>
              ) : null}

              {invoiceEditable ? (
                <EditableDetailField
                  label="Notes"
                  type="textarea"
                  span={2}
                  value={invoice.notes ?? ""}
                  emptyPlaceholder="Add notes"
                  onSave={(v) => handleSaveField("notes", v || null)}
                />
              ) : invoice.notes ? (
                <DetailField label="Notes" span={2}>
                  {invoice.notes}
                </DetailField>
              ) : null}
            </DetailFieldGrid>
          </DetailPanel>

          {/* Schedule of Values */}
          <section>
            <SectionRuleHeading
              label="Schedule of Values"
              actions={
                invoiceEditable ? (
                  <>
                    <SectionAction
                      onClick={handleReleaseAllRetainage}
                      title="Pre-fills retainage released = retainage held for all line items"
                    >
                      Release All Retainage
                    </SectionAction>
                    <SectionAction onClick={() => setAddLineItemOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add Line Item
                    </SectionAction>
                  </>
                ) : undefined
              }
            />
            {invoiceEditable && hasSovChanges && (
              <div className="mb-3 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardSOV}
                  disabled={isSavingSOV}
                >
                  Discard Changes
                </Button>
                <Button size="sm" onClick={handleSaveSOV} disabled={isSavingSOV}>
                  <Save />
                  {isSavingSOV ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
            <SovTable
              lineItems={lineItems}
              editable={invoiceEditable}
              draftMap={sovDraft}
              onDraftChange={handleDraftChange}
            />
          </section>

          {/* Invoice Totals */}
          {lineItems.length > 0 && (
            <section>
              <SectionRuleHeading label="Invoice Totals" />
              <SummaryPanel className="ml-auto max-w-md">
                <div className="space-y-2.5">
                  <SummaryValueRow label="Scheduled Value" value={formatCurrency(sovTotals.scheduledValue)} />
                  <SummaryValueRow label="Work from Previous Applications" value={formatCurrency(sovTotals.workPrevious)} />
                  <SummaryValueRow label="Work Completed This Period" value={formatCurrency(sovTotals.workThisPeriod)} />
                  <SummaryValueRow label="Materials Presently Stored" value={formatCurrency(sovTotals.materialsStored)} />
                  <SummaryValueRow label="Total Completed & Stored" value={formatCurrency(totalCompleted)} />
                  <SummaryValueRow label="% Complete" value={formatPercent(pctComplete)} />
                  <SummaryValueRow label="Less Retainage" value={`-${formatCurrency(sovTotals.retainageAmount)}`} />
                  <SummaryValueRow
                    label="Net Amount This Period"
                    value={formatCurrency(sovTotals.netThisPeriod)}
                    bold
                    border
                  />
                </div>
              </SummaryPanel>
            </section>
          )}

          {/* Attachments */}
          <section>
            <SectionRuleHeading label="Attachments" />
            <EntityAttachments
              entityType="invoice"
              entityId={String(invoiceId)}
              projectId={projectId}
              showLabel={false}
            />
          </section>
        </ContentSectionStack>
      </PageShell>

      {/* Email Invoice Dialog */}
      <Modal open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Email Invoice</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">To *</Label>
              <Input
                id="email-to"
                type="text"
                placeholder="recipient@example.com, another@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
              <Text size="sm" tone="muted">
                Comma-separated list of email addresses.
              </Text>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-cc">CC</Label>
              <Input
                id="email-cc"
                type="text"
                placeholder="cc@example.com"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                rows={4}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={sendInvoiceEmail.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSendEmail()}
              disabled={sendInvoiceEmail.isPending}
            >
              <Send />
              {sendInvoiceEmail.isPending ? "Sending..." : "Send"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice{" "}
              {invoice?.invoice_number || invoice?.id}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve as Noted Confirmation */}
      <AlertDialog open={approveAsNotedDialogOpen} onOpenChange={setApproveAsNotedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve as Noted</AlertDialogTitle>
            <AlertDialogDescription>
              Approve invoice {invoice?.invoice_number || invoice?.id} as noted? This
              marks the invoice as approved with noted exceptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleApproveAsNoted()}
              disabled={isApprovingAsNoted}
            >
              {isApprovingAsNoted ? "Approving..." : "Approve as Noted"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation */}
      <AlertDialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) setVoidReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Void invoice {invoice?.invoice_number || invoice?.id}? This marks the
              invoice as void and cannot be reversed through the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="void-reason">Reason (optional)</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Why is this invoice being voided?"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleVoid()}
              disabled={isVoiding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isVoiding ? "Voiding..." : "Void Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Line Item Dialog */}
      <AddLineItemDialog
        open={addLineItemOpen}
        onOpenChange={setAddLineItemOpen}
        projectId={projectId}
        invoiceId={invoiceId}
        onSuccess={handleLineItemAdded}
      />
    </>
  );
}
