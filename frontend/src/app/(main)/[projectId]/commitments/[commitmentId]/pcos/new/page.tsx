"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { ArrowLeft } from "lucide-react";

import { FormContainer, PageShell } from "@/components/layout";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormActions,
  FormGrid,
  FormSection,
  FormServerError,
} from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PCO_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "no_charge", label: "No Charge" },
  { value: "pending_in_review", label: "Pending – In Review" },
  { value: "pending_not_pricing", label: "Pending – Not Pricing" },
  { value: "pending_not_proceeding", label: "Pending – Not Proceeding" },
  { value: "pending_pricing", label: "Pending – Pricing" },
  { value: "pending_proceeding", label: "Pending – Proceeding" },
  { value: "pending_revised", label: "Pending – Revised" },
  { value: "rejected", label: "Rejected" },
  { value: "void", label: "Void" },
] as const;

const CHANGE_REASONS = [
  "Client Request",
  "Design Development",
  "Existing Condition",
  "Backcharge",
  "Allowance",
];

const STATUS_OPTIONS = PCO_STATUSES.map((status) => ({
  value: status.value,
  label: status.label,
}));

const CHANGE_REASON_OPTIONS = CHANGE_REASONS.map((reason) => ({
  value: reason,
  label: reason,
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommitmentSummary {
  id: string;
  contract_number: string | null;
  title: string | null;
  commitment_type: string | null;
  vendor_name: string | null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  number: z.string().min(1, "PCO number is required"),
  title: z.string().min(1, "Title is required").max(255),
  status: z.string(),
  description: z.string().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  revision: z.number().int().nullable().optional(),
  is_private: z.boolean(),
  executed: z.boolean(),
  signed_co_received_date: z.string().nullable().optional(),
  requested_by: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  schedule_impact: z.number().int().nullable().optional(),
  field_change: z.boolean(),
  reference: z.string().nullable().optional(),
  paid_in_full: z.boolean(),
  due_date: z.string().nullable().optional(),
  amount: z.number(),
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewCommitmentPcoPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const commitmentId = params.commitmentId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commitment, setCommitment] = useState<CommitmentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextNumber, setNextNumber] = useState("001");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: "",
      title: "",
      status: "draft",
      description: "",
      change_reason: "",
      revision: 0,
      is_private: false,
      executed: false,
      signed_co_received_date: null,
      requested_by: "",
      location: "",
      schedule_impact: null,
      field_change: false,
      reference: "",
      paid_in_full: false,
      due_date: null,
      amount: 0,
    },
  });

  // Fetch commitment details and next PCO number
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch commitment summary
        const commitData = await apiFetch<{
          id: string;
          contract_number: string;
          title: string;
          commitment_type?: string;
          type?: string;
          vendor_name?: string | null;
          vendor?: { name?: string } | null;
        }>(`/api/commitments/${commitmentId}`).catch(() => null);
        if (commitData) {
          setCommitment({
            id: commitData.id,
            contract_number: commitData.contract_number,
            title: commitData.title,
            commitment_type: commitData.commitment_type ?? commitData.type ?? null,
            vendor_name: commitData.vendor_name ?? commitData.vendor?.name ?? null,
          });
        }

        // Fetch existing PCOs to auto-generate next number
        const pcosData = await apiFetch<{ data?: unknown[] }>(
          `/api/projects/${projectId}/commitments/${commitmentId}/pcos`,
        ).catch(() => null);
        if (pcosData) {
          const pcos = pcosData.data ?? [];
          const nextNum = String(pcos.length + 1).padStart(3, "0");
          setNextNumber(nextNum);
          form.setValue("number", nextNum);
        }
      } catch {
        toast.error("Failed to load commitment details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

  }, [commitmentId, projectId]);

  type PcoStatus = "open" | "pending" | "approved" | "rejected" | "void";

  const mapStatusToApiStatus = (status: string): PcoStatus => {
    if (
      status === "open" ||
      status === "pending" ||
      status === "approved" ||
      status === "rejected" ||
      status === "void"
    ) {
      return status;
    }

    if (
      status === "draft" ||
      status === "pending_in_review" ||
      status === "pending_not_pricing" ||
      status === "pending_not_proceeding" ||
      status === "pending_pricing" ||
      status === "pending_proceeding" ||
      status === "pending_revised"
    ) {
      return "pending";
    }

    return "open";
  };

  const handleSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    try {
      await apiFetch(
        `/api/projects/${projectId}/commitments/${commitmentId}/pcos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: data.number,
            title: data.title,
            status: mapStatusToApiStatus(data.status),
            amount: data.amount,
            description: data.description || null,
            change_reason: data.change_reason || null,
            revision: data.revision ?? 0,
            is_private: data.is_private,
            executed: data.executed,
            signed_co_received_date: data.signed_co_received_date || null,
            requested_by: data.requested_by || null,
            location: data.location || null,
            schedule_impact: data.schedule_impact,
            field_change: data.field_change,
            reference: data.reference || null,
            paid_in_full: data.paid_in_full,
            due_date: data.due_date || null,
          }),
        },
      );

      toast.success("Potential change order created");
      router.push(
        `/${projectId}/commitments/${commitmentId}?tab=change-orders`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create PCO";
      form.setError("root", { type: "server", message });
      toast.error("Failed to create PCO");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      variant="form"
      title="Create Potential Change Order"
      onBack={() => router.back()}
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <CommitmentsHelpSheet buttonVariant="ghost" />
        </div>
      }
    >
      <FormContainer maxWidth="lg" withCard={false}>
        {isLoading ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              noValidate
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-8"
            >
              {/* Contract Information (read-only) */}
              <FormSection title="Contract Information">
                <FormGrid columns={2}>
                  <div className="grid gap-2">
                    <Label>Contract Company</Label>
                    <Input
                      value={commitment?.vendor_name ?? ""}
                      disabled
                      placeholder="Determined by commitment"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Contract</Label>
                    <Input
                      value={
                        commitment
                          ? `${commitment.contract_number ?? ""} — ${commitment.title ?? ""}`
                          : ""
                      }
                      disabled
                      placeholder="Linked commitment"
                    />
                  </div>
                </FormGrid>
              </FormSection>

              {/* General Information */}
              <FormSection title="General Information">
                <FormGrid columns={2}>
                  <RHFTextField
                    control={form.control}
                    name="number"
                    label="# *"
                    placeholder={nextNumber}
                  />

                  <RHFNumberField
                    control={form.control}
                    name="revision"
                    label="Revision"
                    min={0}
                    step={1}
                  />
                </FormGrid>

                <RHFTextField
                  control={form.control}
                  name="title"
                  label="Title *"
                  placeholder="Potential change order title"
                />

                <FormGrid columns={2}>
                  <RHFSelectField
                    control={form.control}
                    name="status"
                    label="Status"
                    placeholder="Select status"
                    options={STATUS_OPTIONS}
                  />

                  <RHFComboboxField
                    control={form.control}
                    name="change_reason"
                    label="Change Reason"
                    placeholder="Select reason"
                    searchPlaceholder="Search reasons..."
                    emptyMessage="No reasons found."
                    options={CHANGE_REASON_OPTIONS}
                    clearable
                  />

                  <RHFMoneyField
                    control={form.control}
                    name="amount"
                    label="Amount"
                    min={0}
                  />

                  <RHFTextField
                    control={form.control}
                    name="requested_by"
                    label="Request Received From"
                    placeholder="Name of requester"
                  />
                </FormGrid>

                <RHFTextareaField
                  control={form.control}
                  name="description"
                  label="Description"
                  placeholder="Detailed description of the change…"
                  rows={4}
                />
              </FormSection>

              {/* Dates & Details */}
              <FormSection title="Dates & Details">
                <FormGrid columns={2}>
                  <RHFDateField
                    control={form.control}
                    name="due_date"
                    label="Due Date"
                    nullable
                  />

                  <RHFDateField
                    control={form.control}
                    name="signed_co_received_date"
                    label="Signed Change Order Received Date"
                    nullable
                  />

                  <RHFNumberField
                    control={form.control}
                    name="schedule_impact"
                    label="Schedule Impact (days)"
                    step={1}
                    placeholder="days"
                  />

                  <RHFTextField
                    control={form.control}
                    name="location"
                    label="Location"
                    placeholder="Project location"
                  />

                  <RHFTextField
                    control={form.control}
                    name="reference"
                    label="Reference"
                    placeholder="External reference number"
                  />
                </FormGrid>

                <FormGrid columns={2}>
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
                onCancel={() =>
                  router.push(
                    `/${projectId}/commitments/${commitmentId}?tab=change-orders`,
                  )
                }
                isSubmitting={isSubmitting}
                submitLabel="Create"
                stickyOnMobile
              />
            </form>
          </Form>
        )}
      </FormContainer>
    </PageShell>
  );
}
