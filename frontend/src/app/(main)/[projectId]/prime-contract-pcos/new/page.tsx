"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { FormContainer, PageShell } from "@/components/layout";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Text } from "@/components/ds/text";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import {
  PRIME_CONTRACT_CHANGE_ORDER_STATUSES,
  type PrimeContractChangeOrderStatus,
} from "@/lib/change-orders/prime-contract-change-order-statuses";
import {
  buildPrimePcoSourceTitle,
  getSourcePrimeContractIds,
  getSourcePrimeContracts,
  parseChangeEventIdsParam,
  resolveSourceChangeReason,
  resolveSourcePrimeContractId,
  sumSourceChangeEventRom,
  type PrimePcoSourceChangeEvent,
  type PrimePcoSourceContract,
  type PrimePcoSourceLineItem,
} from "@/lib/change-events/prime-pco-source";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANGE_REASONS = [
  "Allowance",
  "Backcharge",
  "Client Request",
  "Design Development",
  "Design Error",
  "Design Omission",
  "Existing Condition",
  "Field Condition",
  "Owner Request",
  "Regulatory Requirement",
  "Scope Change",
  "Unforeseen Condition",
  "Value Engineering",
  "Other",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrimeContract {
  id: string;
  contract_number: string;
  title: string | null;
  status: string | null;
  company_name?: string | null;
  contract_company?: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
}

interface CreatedPrimeContractChangeOrder {
  id: number;
}

interface PrimePcoOption {
  id: string;
  pco_number: string | null;
  title: string;
  status: string | null;
  total_amount: number | null;
  revision: number | null;
  prime_contract_id: string | null;
  linked_change_events_count?: number | null;
}

interface EmployeeOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

type ChangeEventSummary = PrimePcoSourceChangeEvent;
type AttachmentFileInfo = {
  name: string;
  size: number;
  type: string;
};

function formatMoney(value: number | string | null | undefined): string {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numeric)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatTableValue(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isChangeEventComplete(status: string | null | undefined): boolean {
  return ["closed", "converted", "complete", "completed"].includes(
    (status ?? "").toLowerCase().replace(/\s+/g, "_"),
  );
}

function normalizeSourceContract(value: unknown): PrimePcoSourceContract | null {
  if (!value || typeof value !== "object") return null;

  const contract = value as Record<string, unknown>;
  const id = contract.id;
  if (typeof id !== "string" || !id) return null;

  const client = contract.client;
  const vendor = contract.vendor;
  const contractCompany = contract.contract_company;

  return {
    id,
    contract_number:
      typeof contract.contract_number === "string"
        ? contract.contract_number
        : null,
    title: typeof contract.title === "string" ? contract.title : null,
    status: typeof contract.status === "string" ? contract.status : null,
    company_name:
      typeof contract.company_name === "string" ? contract.company_name : null,
    contract_company: contractCompany && typeof contractCompany === "object"
      ? {
          id: String((contractCompany as Record<string, unknown>).id ?? ""),
          name: String((contractCompany as Record<string, unknown>).name ?? ""),
        }
      : null,
    client: client && typeof client === "object"
      ? {
          id: String((client as Record<string, unknown>).id ?? ""),
          name: String((client as Record<string, unknown>).name ?? ""),
        }
      : null,
    vendor: vendor && typeof vendor === "object"
      ? {
          id: String((vendor as Record<string, unknown>).id ?? ""),
          name: String((vendor as Record<string, unknown>).name ?? ""),
        }
      : null,
  };
}

function normalizeSourceLineItems(value: unknown): PrimePcoSourceLineItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PrimePcoSourceLineItem | null => {
      if (!item || typeof item !== "object") return null;

      const lineItem = item as Record<string, unknown>;
      const commitment = lineItem.commitment;
      const normalizedCommitment =
        commitment && typeof commitment === "object"
          ? {
              prime_contract_id:
                typeof (commitment as Record<string, unknown>).prime_contract_id === "string"
                  ? String((commitment as Record<string, unknown>).prime_contract_id)
                  : null,
              primeContractId:
                typeof (commitment as Record<string, unknown>).primeContractId === "string"
                  ? String((commitment as Record<string, unknown>).primeContractId)
                  : null,
            }
          : null;

      return {
        contract_id:
          typeof lineItem.contractId === "string"
            ? lineItem.contractId
            : typeof lineItem.contract_id === "string"
              ? lineItem.contract_id
              : null,
        contract: normalizeSourceContract(lineItem.contract),
        commitment: normalizedCommitment,
      };
    })
    .filter((item): item is PrimePcoSourceLineItem => Boolean(item));
}

function toPrimeContractOption(contract: PrimePcoSourceContract): PrimeContract {
  return {
    id: contract.id,
    contract_number: contract.contract_number ?? "Prime Contract",
    title: contract.title,
    status: contract.status ?? null,
    company_name: contract.company_name ?? null,
    contract_company: contract.contract_company ?? null,
    client: contract.client ?? null,
    vendor: contract.vendor ?? null,
  };
}

function contractPartyName(contract: PrimeContract): string | null {
  return (
    contract.contract_company?.name ??
    contract.client?.name ??
    contract.vendor?.name ??
    contract.company_name ??
    null
  );
}

function contractOptionLabel(contract: PrimeContract): string {
  return [`#${contract.contract_number}`, contract.title, contractPartyName(contract)]
    .filter(Boolean)
    .join(" — ");
}

/** Read-only informational field (auto-generated / auto-filled values). */
function ReadOnlyField({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Input value={value} placeholder={placeholder} disabled />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  prime_contract_id: z.string().uuid("Select a prime contract"),
  title: z.string().min(1, "Title is required").max(255),
  status: z.enum(PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((status) => status.value) as [
    PrimeContractChangeOrderStatus,
    ...PrimeContractChangeOrderStatus[],
  ]),
  revision: z.number().int().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  designated_reviewer: z.string().max(255).nullable().optional(),
  review_date: z.string().nullable().optional(),
  reviewed_by: z.string().max(255).nullable().optional(),
  is_private: z.boolean(),
  description: z.string().max(5000).nullable().optional(),
  executed: z.boolean(),
  signed_co_received_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  invoiced_date: z.string().nullable().optional(),
  paid_date: z.string().nullable().optional(),
  revised_substantial_completion_date: z.string().nullable().optional(),
  request_received_from: z.string().max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  schedule_impact: z.number().int().nullable().optional(),
  field_change: z.boolean(),
  reference: z.string().max(255).nullable().optional(),
  paid_in_full: z.boolean(),
  // CO linkage is handled as side state, not a direct form field.
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewPrimeContractPcoPage() {
  const router = useRouter();
  const params = useParams()!;
  const searchParams = useSearchParams()!;
  const projectId = params.projectId as string;
  const contractIdFromRoute =
    typeof params.contractId === "string" ? params.contractId : null;
  const contractIdFromQuery = searchParams.get("contractId");
  const contractContextId = contractIdFromRoute ?? contractIdFromQuery;

  const changeEventIdsParam = searchParams.get("changeEventIds");
  const changeEventIds = parseChangeEventIdsParam(changeEventIdsParam);
  const hasChangeEvents = changeEventIds.length > 0;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contracts, setContracts] = useState<PrimeContract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(true);
  const [changeEvents, setChangeEvents] = useState<ChangeEventSummary[]>([]);
  const [isLoadingChangeEvents, setIsLoadingChangeEvents] = useState(false);
  const [sourceChangeEventError, setSourceChangeEventError] = useState<string | null>(null);
  const [potentialChangeOrders, setPotentialChangeOrders] = useState<PrimePcoOption[]>([]);
  const [isLoadingPcos, setIsLoadingPcos] = useState(false);
  const [selectedPcoIds, setSelectedPcoIds] = useState<string[]>([]);
  const [pcoSelectOpen, setPcoSelectOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentFileInfo, setAttachmentFileInfo] = useState<AttachmentFileInfo[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      prime_contract_id: "",
      title: "",
      status: "draft",
      revision: null,
      change_reason: null,
      total_amount: null,
      designated_reviewer: null,
      review_date: null,
      reviewed_by: null,
      is_private: false,
      description: "",
      executed: false,
      signed_co_received_date: null,
      due_date: null,
      invoiced_date: null,
      paid_date: null,
      revised_substantial_completion_date: null,
      request_received_from: null,
      location: null,
      schedule_impact: null,
      field_change: false,
      reference: null,
      paid_in_full: false,
    },
  });

  const selectedContractId = form.watch("prime_contract_id");
  const selectedContract = contracts.find((c) => c.id === selectedContractId);
  const contractCompany =
    selectedContract?.contract_company?.name ??
    selectedContract?.client?.name ??
    selectedContract?.vendor?.name ??
    selectedContract?.company_name ??
    null;
  const selectedPotentialChangeOrders = useMemo(
    () => potentialChangeOrders.filter((pco) => selectedPcoIds.includes(pco.id)),
    [potentialChangeOrders, selectedPcoIds],
  );
  const selectedPcoLabel = useMemo(() => {
    if (selectedPotentialChangeOrders.length === 0) return "Select potential change orders";
    if (selectedPotentialChangeOrders.length === 1) {
      const [pco] = selectedPotentialChangeOrders;
      return [pco.pco_number ? `#${pco.pco_number}` : "PCO", pco.title]
        .filter(Boolean)
        .join(" - ");
    }
    return `${selectedPotentialChangeOrders.length} PCOs selected`;
  }, [selectedPotentialChangeOrders]);

  const contractOptions = useMemo(
    () =>
      contracts.map((c) => ({
        value: c.id,
        label: contractOptionLabel(c),
      })),
    [contracts],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => {
        const name =
          [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
          "Unnamed employee";
        return { value: name, label: name };
      }),
    [employees],
  );

  // ── Fetch prime contracts ──────────────────────────────────────────
  useEffect(() => {
    const fetchContracts = async () => {
      setIsLoadingContracts(true);
      try {
        const data = await apiFetch<PrimeContract[]>(
          `/api/projects/${projectId}/contracts`,
        );
        setContracts(data);
      } catch {
        toast.error("Could not load prime contracts.");
      } finally {
        setIsLoadingContracts(false);
      }
    };
    fetchContracts();
  }, [projectId]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const data = await apiFetch<EmployeeOption[]>(
          `/api/projects/${projectId}/employees`,
        );
        setEmployees(data);
      } catch {
        toast.error("Could not load employees.");
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    void fetchEmployees();
  }, [projectId]);

  // ── Fetch change event details for pre-fill ────────────────────────
  const applyChangeEventDefaults = useCallback(
    (events: ChangeEventSummary[], contractList: PrimeContract[]) => {
      if (events.length === 0) return;

      const sourceContractId = resolveSourcePrimeContractId(
        events,
        new Set(contractList.map((contract) => contract.id)),
      );
      if (sourceContractId) {
        form.setValue("prime_contract_id", sourceContractId, {
          shouldValidate: true,
        });
      }

      const sourceReason = resolveSourceChangeReason(events, CHANGE_REASONS);
      if (sourceReason) {
        form.setValue("change_reason", sourceReason, {
          shouldValidate: true,
        });
      }

      form.setValue("title", buildPrimePcoSourceTitle(events), {
        shouldValidate: true,
      });

      // Prefill the Amount from the source change events' Revenue ROM so the
      // user isn't forced to retype it. Only when the user is creating from
      // change events and hasn't selected existing PCOs to sum instead.
      if (selectedPcoIds.length === 0) {
        form.setValue("total_amount", sumSourceChangeEventRom(events), {
          shouldValidate: true,
        });
      }
    },
    [form, selectedPcoIds.length],
  );

  useEffect(() => {
    if (!hasChangeEvents) return;
    if (form.getValues("title")) return;

    form.setValue(
      "title",
      changeEventIds.length === 1
        ? "PCO for change event"
        : `PCO for ${changeEventIds.length} change events`,
      { shouldValidate: true },
    );
  }, [changeEventIds.length, form, hasChangeEvents]);

  useEffect(() => {
    if (!hasChangeEvents) return;

    const fetchChangeEvents = async () => {
      setIsLoadingChangeEvents(true);
      setSourceChangeEventError(null);
      try {
        const results = await Promise.all(
          changeEventIds.map(async (id) => {
            try {
              const data = await apiFetch<Record<string, unknown>>(
                `/api/projects/${projectId}/change-events/${id}`,
              );
              return {
                id: String(data.id),
                number: data.number ? String(data.number) : null,
                title: String(data.title ?? ""),
                type: data.type ? String(data.type) : null,
                reason: data.reason ? String(data.reason) : null,
                scope: data.scope ? String(data.scope) : null,
                status: data.status ? String(data.status) : null,
                origin: data.origin ? String(data.origin) : null,
                workflowStage: data.workflowStage
                  ? String(data.workflowStage)
                  : data.workflow_stage
                    ? String(data.workflow_stage)
                    : null,
                rom:
                  data.totals &&
                  typeof data.totals === "object" &&
                  "revenueRom" in data.totals
                    ? String(
                        (data.totals as Record<string, unknown>).revenueRom ??
                          0,
                      )
                    : null,
                prime_contract_id: data.prime_contract_id
                  ? String(data.prime_contract_id)
                  : data.primeContractId
                    ? String(data.primeContractId)
                    : null,
                prime_contract: normalizeSourceContract(
                  data.prime_contract ?? data.primeContract,
                ),
                line_items: normalizeSourceLineItems(
                  data.line_items ?? data.lineItems,
                ),
              } as ChangeEventSummary;
            } catch {
              return null;
            }
          }),
        );
        const resolvedEvents = results.filter(Boolean) as ChangeEventSummary[];
        setChangeEvents(resolvedEvents);
        const sourceContractId = getSourcePrimeContractIds(resolvedEvents)[0];
        if (sourceContractId && !form.getValues("prime_contract_id")) {
          form.setValue("prime_contract_id", sourceContractId, {
            shouldValidate: true,
          });
        }
        if (resolvedEvents.length !== changeEventIds.length) {
          setSourceChangeEventError(
            `Loaded ${resolvedEvents.length} of ${changeEventIds.length} source change events.`,
          );
        }
      } catch {
        setSourceChangeEventError("Could not load source change events.");
        toast.error("Could not load source change events.");
      } finally {
        setIsLoadingChangeEvents(false);
      }
    };

    fetchChangeEvents();

  }, [form, projectId, changeEventIdsParam]);

  useEffect(() => {
    if (changeEvents.length === 0) return;

    const sourceContracts = getSourcePrimeContracts(changeEvents);
    if (sourceContracts.length === 0) return;

    setContracts((current) => {
      const currentIds = new Set(current.map((contract) => contract.id));
      const missingContracts = sourceContracts.filter(
        (contract) => !currentIds.has(contract.id),
      );

      if (missingContracts.length === 0) return current;

      return [
        ...missingContracts.map(toPrimeContractOption),
        ...current,
      ];
    });
  }, [changeEvents]);

  useEffect(() => {
    if (!hasChangeEvents || changeEvents.length === 0) return;
    if (form.getValues("prime_contract_id")) return;

    const sourceContractIds = getSourcePrimeContractIds(changeEvents);
    if (sourceContractIds.length === 0) return;

    const sourceContractId = sourceContractIds[0];

    if (sourceContractId) {
      form.setValue("prime_contract_id", sourceContractId, {
        shouldValidate: true,
      });
    }
  }, [changeEvents, form, hasChangeEvents]);

  useEffect(() => {
    if (
      hasChangeEvents &&
      changeEvents.length > 0 &&
      contracts.length > 0 &&
      !isLoadingContracts &&
      !isLoadingChangeEvents
    ) {
      applyChangeEventDefaults(changeEvents, contracts);
    }
  }, [
    hasChangeEvents,
    changeEvents,
    contracts,
    isLoadingContracts,
    isLoadingChangeEvents,
    applyChangeEventDefaults,
  ]);

  useEffect(() => {
    if (!contractContextId || contracts.length === 0) return;
    const hasMatchingContract = contracts.some((c) => c.id === contractContextId);
    if (hasMatchingContract) {
      form.setValue("prime_contract_id", contractContextId, {
        shouldValidate: true,
      });
    }
  }, [contractContextId, contracts, form]);

  useEffect(() => {
    setSelectedPcoIds([]);
    setPcoSelectOpen(false);
    // In the change-event flow the Amount is prefilled from the source events'
    // Revenue ROM (see applyChangeEventDefaults); don't clobber it when the
    // prime contract auto-populates. Only the select-existing-PCO flow resets.
    if (!hasChangeEvents) {
      form.setValue("total_amount", null);
    }

    if (!selectedContractId) {
      setPotentialChangeOrders([]);
      return;
    }

    let active = true;
    const fetchPotentialChangeOrders = async () => {
      setIsLoadingPcos(true);
      try {
        const data = await apiFetch<
          PrimePcoOption[] | { data?: PrimePcoOption[] }
        >(
          `/api/projects/${projectId}/prime-contract-pcos?prime_contract_id=${selectedContractId}`,
        );
        if (!active) return;

        const rows = Array.isArray(data) ? data : data.data ?? [];
        setPotentialChangeOrders(
          rows.filter(
            (pco) =>
              pco.prime_contract_id === selectedContractId &&
              Number(pco.linked_change_events_count ?? 0) > 0,
          ),
        );
      } catch {
        if (!active) return;
        setPotentialChangeOrders([]);
        toast.error("Could not load potential change orders.");
      } finally {
        if (active) setIsLoadingPcos(false);
      }
    };

    void fetchPotentialChangeOrders();

    return () => {
      active = false;
    };
  }, [form, projectId, selectedContractId, hasChangeEvents]);

  useEffect(() => {
    if (selectedPotentialChangeOrders.length === 0) return;

    const totalAmount = selectedPotentialChangeOrders.reduce(
      (total, pco) => total + Number(pco.total_amount ?? 0),
      0,
    );
    form.setValue("total_amount", totalAmount, { shouldValidate: true });

    if (
      selectedPotentialChangeOrders.length === 1 &&
      !form.getValues("title")
    ) {
      form.setValue("title", selectedPotentialChangeOrders[0].title, {
        shouldValidate: true,
      });
    }
  }, [form, selectedPotentialChangeOrders]);

  const toggleSelectedPco = useCallback((pcoId: string) => {
    setSelectedPcoIds((current) =>
      current.includes(pcoId)
        ? current.filter((id) => id !== pcoId)
        : [...current, pcoId],
    );
  }, []);

  const formatPcoOptionLabel = useCallback((pco: PrimePcoOption) => {
    return [pco.pco_number ? `#${pco.pco_number}` : "PCO", pco.title]
      .filter(Boolean)
      .join(" - ");
  }, []);

  const handleAttachmentFilesSelected = useCallback((files: File[]) => {
    setAttachmentFiles((previous) => [...previous, ...files]);
  }, []);

  const handleAttachmentInfoChange = useCallback((files: AttachmentFileInfo[]) => {
    setAttachmentFileInfo(files);
    setAttachmentFiles((previous) =>
      previous.filter((file) =>
        files.some(
          (selectedFile) =>
            selectedFile.name === file.name &&
            selectedFile.size === file.size &&
            selectedFile.type === file.type,
        ),
      ),
    );
  }, []);

  const uploadAttachments = useCallback(
    async (params: {
      entityType: "prime_contract_pco" | "prime_contract_change_order";
      entityId: string | number;
    }) => {
      if (attachmentFiles.length === 0) return 0;

      const uploadPath =
        params.entityType === "prime_contract_pco"
          ? `/api/projects/${projectId}/prime-contract-pcos/${params.entityId}/attachments`
          : `/api/projects/${projectId}/prime-contract-change-orders/${params.entityId}/attachments`;

      const results = await Promise.allSettled(
        attachmentFiles.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          await apiFetch(uploadPath, {
            method: "POST",
            body: formData,
          });
        }),
      );

      return results.filter((result) => result.status === "rejected").length;
    },
    [attachmentFiles, projectId],
  );

  const createPrimeContractChangeOrder = useCallback(
    async (data: FormData) => {
      const created = await apiFetch<CreatedPrimeContractChangeOrder>(
        `/api/projects/${projectId}/prime-contract-change-orders`,
        {
          method: "POST",
          body: JSON.stringify({
            title: data.title,
            prime_contract_id: data.prime_contract_id,
            status: data.status,
            total_amount: data.total_amount ?? 0,
            executed: data.executed,
            description: data.description || null,
            change_reason: data.change_reason || null,
            designated_reviewer: data.designated_reviewer || null,
            review_date: data.review_date || null,
            reviewed_by: data.reviewed_by || null,
            request_received_from: data.request_received_from || null,
            due_date: data.due_date || null,
            invoiced_date: data.invoiced_date || null,
            paid_date: data.paid_date || null,
            schedule_impact: data.schedule_impact ?? null,
            revised_substantial_completion_date:
              data.revised_substantial_completion_date || null,
            location: data.location || null,
            reference: data.reference || null,
            field_change: data.field_change,
            is_private: data.is_private,
            paid_in_full: data.paid_in_full,
            contract_company: contractCompany,
          }),
        },
      );

      return created.id;
    },
    [contractCompany, projectId],
  );

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    try {
      if (hasChangeEvents) {
        const result = await apiFetch<{ pco?: { id?: string } }>(
          `/api/projects/${projectId}/change-events/add-to-pco`,
          {
            method: "POST",
            body: JSON.stringify({
              change_event_ids: changeEventIds,
              pco_type: "prime",
              create_new: {
                title: data.title,
                prime_contract_id: data.prime_contract_id,
                description: data.description || null,
                status: data.status,
                change_reason: data.change_reason || null,
                revision: data.revision ?? null,
                schedule_impact: data.schedule_impact ?? null,
                due_date: data.due_date || null,
                request_received_from: data.request_received_from || null,
                location: data.location || null,
                field_change: data.field_change,
                reference: data.reference || null,
                is_private: data.is_private,
                executed: data.executed,
                signed_co_received_date: data.signed_co_received_date || null,
                paid_in_full: data.paid_in_full,
              },
            }),
          },
        );

        const pcoId = result.pco?.id;
        if (pcoId) {
          const failedUploads = await uploadAttachments({
            entityType: "prime_contract_pco",
            entityId: pcoId,
          });

          if (failedUploads > 0) {
            toast.warning(
              `Prime Contract PCO created, but ${failedUploads} attachment${failedUploads === 1 ? "" : "s"} failed to upload.`,
            );
          } else {
            toast.success("Prime Contract PCO created");
          }
        } else {
          toast.warning(
            "Prime Contract PCO created, but attachments could not be uploaded because the new PCO ID was not returned.",
          );
        }

        router.push(
          pcoId
            ? `/${projectId}/prime-contract-pcos/${pcoId}`
            : `/${projectId}/prime-contract-pcos`,
        );
        return;
      }

      if (selectedPcoIds.length === 0) {
        toast.error("Select at least one potential change order.");
        return;
      }

      const promotedToCoId = await createPrimeContractChangeOrder(data);

      const linkResults = await Promise.allSettled(
        selectedPcoIds.map((pcoId) =>
          apiFetch(`/api/projects/${projectId}/prime-contract-pcos/${pcoId}`, {
            method: "PATCH",
            body: JSON.stringify({
              promoted_to_co_id: promotedToCoId,
            }),
          }),
        ),
      );

      const failedLinks = linkResults.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failedLinks > 0) {
        throw new Error(
          `Failed to link ${failedLinks} potential change order${failedLinks === 1 ? "" : "s"}.`,
        );
      }

      toast.success("Prime Contract Change Order created");
      const failedUploads = await uploadAttachments({
        entityType: "prime_contract_change_order",
        entityId: promotedToCoId,
      });
      if (failedUploads > 0) {
        toast.warning(
          `Change order created, but ${failedUploads} attachment${failedUploads === 1 ? "" : "s"} failed to upload.`,
        );
      }
      router.push(`/${projectId}/change-orders/prime/${promotedToCoId}`);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Unknown create error";
      form.setError("root", {
        type: "server",
        message: `Prime Contract Change Order was not created: ${detail}`,
      });
      toast.error(`Prime Contract Change Order was not created: ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    if (contractContextId) {
      router.push(`/${projectId}/prime-contracts/${contractContextId}`);
    } else {
      router.push(`/${projectId}/prime-contract-pcos`);
    }
  }, [contractContextId, projectId, router]);

  const isLoading = isLoadingContracts || isLoadingChangeEvents;
  const hasMissingSourceChangeEvents =
    hasChangeEvents && !isLoadingChangeEvents && changeEvents.length !== changeEventIds.length;

  const statusOptions = PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((s) => ({
    value: s.value,
    label: s.label,
  }));

  return (
    <PageShell
      variant="form"
      title="New Prime Contract Potential Change Order"
      description={
        hasChangeEvents
          ? "Create a potential change order from linked change events."
          : "Assemble an official change order from linked potential change orders."
      }
      onBack={() => router.back()}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <Text tone="muted">Loading…</Text>
        </div>
      ) : (
        <FormContainer maxWidth="lg" withCard={false}>
          <Form {...form}>
            <form
              noValidate
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-8"
            >
              <FormSection title="Overview">
                <FormGrid columns={2}>
                  <ReadOnlyField
                    label={hasChangeEvents ? "PCO Number" : "PCCO Number"}
                    value="Auto-generated on save"
                  />

                  <RHFTextField
                    control={form.control}
                    name="title"
                    label="Title *"
                    placeholder="Change order title"
                  />

                  <RHFComboboxField
                    control={form.control}
                    name="prime_contract_id"
                    label="Contract *"
                    placeholder="Select a contract"
                    searchPlaceholder="Search contracts..."
                    emptyMessage="No contracts found."
                    options={contractOptions}
                    selectedLabel={
                      selectedContract
                        ? contractOptionLabel(selectedContract)
                        : undefined
                    }
                  />

                  <ReadOnlyField
                    label="Contract Company"
                    value={contractCompany ?? ""}
                    placeholder="Auto-filled from contract"
                  />

                  {!hasChangeEvents && (
                    <div className="grid gap-2">
                      <Label className="text-sm font-medium">
                        Potential Change Orders *
                      </Label>
                      <Popover
                        open={Boolean(selectedContractId) && pcoSelectOpen}
                        onOpenChange={(open) => {
                          if (!selectedContractId || isLoadingPcos) {
                            setPcoSelectOpen(false);
                            return;
                          }
                          setPcoSelectOpen(open);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            disabled={!selectedContractId || isLoadingPcos}
                            className={cn(
                              "w-full justify-between font-normal",
                              selectedPotentialChangeOrders.length === 0 &&
                                "text-muted-foreground",
                            )}
                          >
                            <span className="truncate">
                              {isLoadingPcos ? "Loading PCOs..." : selectedPcoLabel}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0"
                          align="start"
                          style={{ width: "var(--radix-popover-trigger-width)" }}
                        >
                          <Command>
                            <CommandInput placeholder="Search potential change orders..." />
                            <CommandList>
                              <CommandEmpty>
                                {selectedContractId
                                  ? "No linked potential change orders found."
                                  : "Select a contract first."}
                              </CommandEmpty>
                              <CommandGroup>
                                {potentialChangeOrders.map((pco) => {
                                  const isSelected = selectedPcoIds.includes(pco.id);
                                  return (
                                    <CommandItem
                                      key={pco.id}
                                      value={formatPcoOptionLabel(pco)}
                                      onSelect={() => toggleSelectedPco(pco.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          isSelected ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <div className="flex min-w-0 flex-col">
                                        <span className="truncate">
                                          {formatPcoOptionLabel(pco)}
                                        </span>
                                        {pco.status && (
                                          <span className="text-xs text-muted-foreground">
                                            {pco.status}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <RHFNumberField
                    control={form.control}
                    name="revision"
                    label="Revision"
                    min={0}
                    step={1}
                  />

                  <RHFSelectField
                    control={form.control}
                    name="status"
                    label="Status"
                    placeholder="Select status"
                    options={statusOptions}
                  />
                </FormGrid>

                <RHFTextareaField
                  control={form.control}
                  name="description"
                  label="Description"
                  placeholder="Describe the change order..."
                  rows={4}
                />

                <FormGrid columns={2}>
                  <RHFDateField
                    control={form.control}
                    name="signed_co_received_date"
                    label="Signed Change Order Received Date"
                    nullable
                  />
                </FormGrid>

                <FormGrid columns={3}>
                  <RHFCheckboxField
                    control={form.control}
                    name="field_change"
                    label="Field Change"
                  />
                  <RHFCheckboxField
                    control={form.control}
                    name="executed"
                    label="Executed"
                  />
                  <RHFCheckboxField
                    control={form.control}
                    name="is_private"
                    label="Private"
                  />
                </FormGrid>
              </FormSection>

              {!hasChangeEvents && (
                <FormSection title="Approval">
                  <FormGrid columns={2}>
                    <RHFComboboxField
                      control={form.control}
                      name="designated_reviewer"
                      label="Designated Reviewer"
                      placeholder="Select an employee"
                      searchPlaceholder="Search employees..."
                      emptyMessage="No employee found."
                      options={employeeOptions}
                      selectedLabel={form.watch("designated_reviewer") ?? undefined}
                      disabled={isLoadingEmployees}
                      clearable
                    />

                    <RHFComboboxField
                      control={form.control}
                      name="reviewed_by"
                      label="Reviewer"
                      placeholder="Select an employee"
                      searchPlaceholder="Search employees..."
                      emptyMessage="No employee found."
                      options={employeeOptions}
                      selectedLabel={form.watch("reviewed_by") ?? undefined}
                      disabled={isLoadingEmployees}
                      clearable
                    />

                    <RHFDateField
                      control={form.control}
                      name="review_date"
                      label="Review Date"
                      nullable
                    />
                  </FormGrid>
                </FormSection>
              )}

              <FormSection title="Schedule">
                <FormGrid columns={3}>
                  <RHFDateField
                    control={form.control}
                    name="due_date"
                    label="Due Date"
                    nullable
                  />

                  <RHFDateField
                    control={form.control}
                    name="revised_substantial_completion_date"
                    label="Revised Substantial Completion Date"
                    nullable
                  />

                  <RHFNumberField
                    control={form.control}
                    name="schedule_impact"
                    label="Schedule Impact (days)"
                    step={1}
                  />
                </FormGrid>
              </FormSection>

              <FormSection title="Financial">
                <FormGrid columns={3}>
                  <RHFMoneyField
                    control={form.control}
                    name="total_amount"
                    label="Amount"
                  />

                  <RHFDateField
                    control={form.control}
                    name="invoiced_date"
                    label="Invoice Date"
                    nullable
                  />

                  <RHFDateField
                    control={form.control}
                    name="paid_date"
                    label="Paid Date"
                    nullable
                  />
                </FormGrid>
              </FormSection>

              <FormSection title="Attachments">
                <FileUploadField
                  value={attachmentFileInfo}
                  onChange={handleAttachmentInfoChange}
                  onFilesSelected={handleAttachmentFilesSelected}
                  multiple
                  variant="minimal"
                />
              </FormSection>

              {hasChangeEvents && (
                <FormSection
                  title={`Source Change Event${changeEventIds.length === 1 ? "" : "s"} (${changeEventIds.length})`}
                >
                  {isLoadingChangeEvents ? (
                    <InfoAlert variant="info" className="text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading source change events...
                    </InfoAlert>
                  ) : sourceChangeEventError ? (
                    <InfoAlert variant="error" className="text-sm">
                      {sourceChangeEventError} The PCO cannot be created until every selected source event is loaded.
                    </InfoAlert>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-full divide-y divide-border/60">
                        <div className="grid grid-cols-9 gap-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                          <div>Number</div>
                          <div>Title</div>
                          <div>Scope</div>
                          <div>Type</div>
                          <div>Reason</div>
                          <div>Status</div>
                          <div>Origin</div>
                          <div>Complete</div>
                          <div className="text-right">ROM</div>
                        </div>
                        {changeEvents.map((ce) => (
                          <div
                            key={ce.id}
                            className="grid grid-cols-9 gap-4 py-2.5 text-sm text-foreground/80"
                          >
                            <div className="truncate font-medium text-foreground">
                              <Link
                                href={`/${projectId}/change-events/${ce.id}`}
                                className="transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                {ce.number ? `CE ${ce.number}` : "CE"}
                              </Link>
                            </div>
                            <div className="truncate">{ce.title}</div>
                            <div className="truncate">{formatTableValue(ce.scope)}</div>
                            <div className="truncate">{formatTableValue(ce.type)}</div>
                            <div className="truncate">{formatTableValue(ce.reason)}</div>
                            <div className="truncate">{formatTableValue(ce.status)}</div>
                            <div className="truncate">{formatTableValue(ce.origin)}</div>
                            <div>
                              {isChangeEventComplete(ce.status) ? "Yes" : "No"}
                            </div>
                            <div className="text-right tabular-nums">
                              {formatMoney(ce.rom)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </FormSection>
              )}

              <FormServerError message={form.formState.errors.root?.message} />

              <FormActions
                onCancel={handleCancel}
                isSubmitting={isSubmitting}
                submitLabel="Create"
                submitDisabled={
                  isLoading ||
                  hasMissingSourceChangeEvents ||
                  (!hasChangeEvents && selectedPcoIds.length === 0)
                }
                stickyOnMobile
              />
            </form>
          </Form>
        </FormContainer>
      )}
    </PageShell>
  );
}
