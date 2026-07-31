"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "@/lib/api-client";

import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  normalizePrimeContractChangeOrderStatus,
  PRIME_CONTRACT_CHANGE_ORDER_STATUSES,
  type PrimeContractChangeOrderStatus,
} from "@/lib/change-orders/prime-contract-change-order-statuses";
import { getPrimeContractPcoDisplayName } from "@/lib/prime-contract-pcos/display";

interface PrimeContractPcoResponse {
  id: string;
  title: string;
  status: PrimeContractChangeOrderStatus;
  revision: number | null;
  change_reason: string | null;
  is_private: boolean;
  description: string | null;
  executed: boolean;
  signed_co_received_date: string | null;
  request_received_from: string | null;
  location: string | null;
  schedule_impact: number | null;
  field_change: boolean;
  reference: string | null;
  paid_in_full: boolean;
  prime_contract_id: string | null;
  pco_number: string;
}

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

// Sentinel for the "no change reason" choice. Radix Select cannot use an empty
// string as an item value, so we map "" ↔ this sentinel and normalize back to
// null on submit — preserving the original PATCH payload shape.
const CHANGE_REASON_NONE = "__none__";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z.enum(
    PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((status) => status.value) as [
      PrimeContractChangeOrderStatus,
      ...PrimeContractChangeOrderStatus[],
    ],
  ),
  revision: z.number().int().min(0).nullable(),
  change_reason: z.string(),
  is_private: z.boolean(),
  description: z.string().nullable(),
  executed: z.boolean(),
  signed_co_received_date: z.string().nullable(),
  request_received_from: z.string().nullable(),
  location: z.string().nullable(),
  schedule_impact: z.number().int().nullable(),
  field_change: z.boolean(),
  reference: z.string().nullable(),
  paid_in_full: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const EMPTY_FORM: FormData = {
  title: "",
  status: "draft",
  revision: 0,
  change_reason: CHANGE_REASON_NONE,
  is_private: false,
  description: "",
  executed: false,
  signed_co_received_date: null,
  request_received_from: "",
  location: "",
  schedule_impact: null,
  field_change: false,
  reference: "",
  paid_in_full: false,
};

// Converts the API response into RHF-safe form values.
function toFormData(pco: PrimeContractPcoResponse): FormData {
  return {
    title: pco.title ?? "",
    status: normalizePrimeContractChangeOrderStatus(pco.status),
    revision: pco.revision ?? 0,
    change_reason: pco.change_reason || CHANGE_REASON_NONE,
    is_private: pco.is_private,
    description: pco.description ?? "",
    executed: pco.executed,
    signed_co_received_date: pco.signed_co_received_date ?? null,
    request_received_from: pco.request_received_from ?? "",
    location: pco.location ?? "",
    schedule_impact: pco.schedule_impact ?? null,
    field_change: pco.field_change,
    reference: pco.reference ?? "",
    paid_in_full: pco.paid_in_full,
  };
}

const changeReasonOptions = [
  { value: CHANGE_REASON_NONE, label: "None" },
  ...CHANGE_REASONS.map((reason) => ({ value: reason, label: reason })),
];

const statusOptions = PRIME_CONTRACT_CHANGE_ORDER_STATUSES.map((statusOption) => ({
  value: statusOption.value,
  label: statusOption.label,
}));

// Prime contract PCO edit page for updating General form fields.
export default function EditPrimeContractPcoPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; pcoId: string; contractId?: string }>()!;

  const projectId = params.projectId;
  const pcoId = params.pcoId;
  const contractIdFromRoute = typeof params.contractId === "string" ? params.contractId : null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pcoNumber, setPcoNumber] = useState("");
  const [primeContractId, setPrimeContractId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  });

  // Builds canonical detail route for this PCO while preserving nested contract context.
  const buildDetailPath = useCallback(
    (contextPrimeContractId: string | null | undefined) => {
      const resolvedContractId = contractIdFromRoute ?? contextPrimeContractId ?? null;
      if (resolvedContractId) {
        return `/${projectId}/prime-contracts/${resolvedContractId}/change-orders/pcos/${pcoId}`;
      }
      return `/${projectId}/prime-contract-pcos/${pcoId}`;
    },
    [contractIdFromRoute, pcoId, projectId],
  );

  // Loads current PCO values into the edit form.
  const loadPco = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<PrimeContractPcoResponse>(
        `/api/projects/${projectId}/prime-contract-pcos/${pcoId}`,
      );
      setPcoNumber(data.pco_number);
      setPrimeContractId(data.prime_contract_id);
      form.reset(toFormData(data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load prime contract PCO");
      router.push(`/${projectId}/prime-contract-pcos`);
    } finally {
      setIsLoading(false);
    }
  }, [form, pcoId, projectId, router]);

  useEffect(() => {
    void loadPco();
  }, [loadPco]);

  // Handles patch update and returns to detail page on success.
  const handleSave: SubmitHandler<FormData> = useCallback(
    async (values) => {
      setIsSaving(true);
      try {
        const payload = {
          title: values.title.trim(),
          status: values.status,
          revision: Number.isFinite(values.revision) ? values.revision : 0,
          change_reason:
            values.change_reason === CHANGE_REASON_NONE
              ? null
              : values.change_reason.trim() || null,
          is_private: values.is_private,
          description: values.description?.trim() || null,
          executed: values.executed,
          signed_co_received_date: values.signed_co_received_date || null,
          request_received_from: values.request_received_from?.trim() || null,
          location: values.location?.trim() || null,
          schedule_impact: values.schedule_impact ?? null,
          field_change: values.field_change,
          reference: values.reference?.trim() || null,
          paid_in_full: values.paid_in_full,
        };

        await apiFetch(`/api/projects/${projectId}/prime-contract-pcos/${pcoId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        toast.success("Prime Contract PCO updated");
        router.push(buildDetailPath(primeContractId));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save prime contract PCO";
        form.setError("root", { type: "server", message });
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [buildDetailPath, form, pcoId, primeContractId, projectId, router],
  );

  if (isLoading) {
    return (
      <PageShell
        variant="form"
        title="Edit Prime Contract PCO"
        onBack={() => router.push(buildDetailPath(null))}
      >
        <FormContainer maxWidth="lg" withCard={false}>
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </FormContainer>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title={`Edit ${getPrimeContractPcoDisplayName({ pcoNumber })}`}
      onBack={() => router.push(buildDetailPath(primeContractId))}
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(handleSave)}
            className="space-y-8"
          >
            <FormSection title="General">
              <FormGrid columns={2}>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">#</Label>
                  <Input value={pcoNumber || ""} placeholder="Auto-generated" disabled />
                </div>

                <RHFTextField
                  control={form.control}
                  name="title"
                  label="Title *"
                  placeholder="PCO title"
                />

                <RHFSelectField
                  control={form.control}
                  name="status"
                  label="Status"
                  options={statusOptions}
                />

                <RHFNumberField
                  control={form.control}
                  name="revision"
                  label="Revision"
                  min={0}
                  step={1}
                />

                <RHFSelectField
                  control={form.control}
                  name="change_reason"
                  label="Change Reason"
                  placeholder="Select reason"
                  options={changeReasonOptions}
                />

                <RHFDateField
                  control={form.control}
                  name="signed_co_received_date"
                  label="Signed Change Order Received Date"
                  nullable
                />

                <RHFTextField
                  control={form.control}
                  name="request_received_from"
                  label="Request Received From"
                />

                <RHFTextField
                  control={form.control}
                  name="location"
                  label="Location"
                />

                <RHFNumberField
                  control={form.control}
                  name="schedule_impact"
                  label="Schedule Impact (days)"
                  min={0}
                  step={1}
                />

                <RHFTextField
                  control={form.control}
                  name="reference"
                  label="Reference"
                />
              </FormGrid>

              <RHFTextareaField
                control={form.control}
                name="description"
                label="Description"
                rows={4}
              />

              <FormGrid columns={3}>
                <RHFCheckboxField
                  control={form.control}
                  name="is_private"
                  label="Private"
                />
                <RHFCheckboxField
                  control={form.control}
                  name="executed"
                  label="Executed"
                />
                <RHFCheckboxField
                  control={form.control}
                  name="field_change"
                  label="Field Change"
                />
                <RHFCheckboxField
                  control={form.control}
                  name="paid_in_full"
                  label="Paid in Full"
                />
              </FormGrid>
            </FormSection>

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              onCancel={() => router.push(buildDetailPath(primeContractId))}
              isSubmitting={isSaving}
              submitLabel="Save"
            />
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
