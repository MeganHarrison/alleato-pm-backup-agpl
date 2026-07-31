"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormGrid, FormSection } from "@/components/forms";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { buildOptions } from "@/components/forms/utils/buildOptions";
import {
  EstimateCreateSchema,
  EstimateStatuses,
  EstimateStatusLabels,
  EstimateTypes,
  EstimateTypeLabels,
} from "@/lib/schemas/estimates";
import { apiFetch } from "@/lib/api-client";

interface EstimateFormValues {
  title: string;
  estimate_number?: string | null;
  revision?: number;
  status?: "draft" | "pending_review" | "approved" | "rejected";
  estimate_type?: "asrs" | "design_build" | null;
  estimate_date?: string | null;
  location?: string | null;
  estimator?: string | null;
  project_duration_weeks?: number | null;
  project_duration_months?: number | null;
  contingency_amount?: number;
  insurance_rate?: number;
  fee_rate?: number;
  notes?: string | null;
}

const STATUS_OPTIONS = buildOptions(EstimateStatuses, EstimateStatusLabels);
const ESTIMATE_TYPE_OPTIONS = buildOptions(EstimateTypes, EstimateTypeLabels);

export default function EditEstimatePage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const estimateId = params.estimateId as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(EstimateCreateSchema) as Resolver<EstimateFormValues>,
    defaultValues: {
      title: "",
      estimate_number: "",
      revision: 1,
      status: "draft",
      estimate_type: null,
      estimate_date: undefined,
      location: "",
      estimator: "",
      project_duration_weeks: undefined,
      contingency_amount: 0,
      insurance_rate: 0.0125,
      fee_rate: 0.1,
      notes: "",
    },
  });

  // Fetch existing estimate and pre-fill form
  useEffect(() => {
    async function fetchEstimate() {
      try {
        const data = await apiFetch<EstimateFormValues & { estimate_id: number }>(
          `/api/projects/${projectId}/estimates/${estimateId}`
        );
        form.reset({
          title: data.title ?? "",
          estimate_number: data.estimate_number ?? "",
          revision: data.revision ?? 1,
          status: data.status ?? "draft",
          estimate_type: data.estimate_type ?? null,
          estimate_date: data.estimate_date ?? null,
          location: data.location ?? "",
          estimator: data.estimator ?? "",
          project_duration_weeks: data.project_duration_weeks ?? undefined,
          contingency_amount: data.contingency_amount ?? 0,
          insurance_rate: data.insurance_rate ?? 0.0125,
          fee_rate: data.fee_rate ?? 0.1,
          notes: data.notes ?? "",
        });
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load estimate"
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchEstimate();
  }, [projectId, estimateId, form]);

  const onSubmit = async (data: EstimateFormValues) => {
    try {
      await apiFetch(`/api/projects/${projectId}/estimates/${estimateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      toast.success("Estimate updated successfully");
      router.push(`/${projectId}/estimates/${estimateId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The estimate could not be saved. Please try again.";
      form.setError("root", { type: "server", message });
      toast.error("Failed to update estimate");
    }
  };

  if (loading) {
    return (
      <PageShell
        variant="form"
        title="Edit Estimate"
        onBack={() => router.back()}
        backLabel="Back"
      >
        <div className="text-muted-foreground py-8 text-center text-sm">
          Loading estimate…
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell
        variant="form"
        title="Edit Estimate"
        onBack={() => router.back()}
        backLabel="Back"
      >
        <div className="text-destructive py-8 text-center text-sm">
          {loadError}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title="Edit Estimate"
      description="Update estimate details"
      onBack={() => router.back()}
      backLabel="Back to Estimate"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <FormSection title="Basic Information">
              <FormGrid columns={2}>
                <RHFTextField
                  control={form.control}
                  name="title"
                  label="Title *"
                  placeholder="e.g., Ulta Beauty Fresno DC New RTUs R6"
                />

                <RHFTextField
                  control={form.control}
                  name="estimate_number"
                  label="Estimate Number"
                  placeholder="Optional reference number"
                />

                <RHFNumberField
                  control={form.control}
                  name="revision"
                  label="Revision"
                  min={1}
                  step={1}
                />

                <RHFSelectField
                  control={form.control}
                  name="status"
                  label="Status"
                  options={STATUS_OPTIONS}
                />

                <RHFComboboxField
                  control={form.control}
                  name="estimate_type"
                  label="Estimate Type"
                  placeholder="Select type (optional)"
                  searchPlaceholder="Search types..."
                  emptyMessage="No matching type."
                  options={ESTIMATE_TYPE_OPTIONS}
                  clearable
                />

                <RHFDateField
                  control={form.control}
                  name="estimate_date"
                  label="Date"
                  nullable
                />

                <RHFTextField
                  control={form.control}
                  name="estimator"
                  label="Estimator"
                  placeholder="Person preparing the estimate"
                />

                <RHFTextField
                  control={form.control}
                  name="location"
                  label="Location"
                  placeholder="Project location"
                />
              </FormGrid>
            </FormSection>

            <FormSection title="Project Duration & Markup Rates">
              <FormGrid columns={3}>
                <RHFNumberField
                  control={form.control}
                  name="project_duration_weeks"
                  label="Project Duration (weeks)"
                  min={1}
                  step={1}
                  placeholder="e.g., 12"
                />

                <RHFNumberField
                  control={form.control}
                  name="insurance_rate"
                  label="Insurance Rate"
                  min={0}
                  max={1}
                  step={0.0001}
                  placeholder="0.0125"
                />

                <RHFNumberField
                  control={form.control}
                  name="fee_rate"
                  label="Fee Rate"
                  min={0}
                  max={1}
                  step={0.0001}
                  placeholder="0.10"
                />

                <RHFMoneyField
                  control={form.control}
                  name="contingency_amount"
                  label="Contingency Amount"
                  min={0}
                />
              </FormGrid>
            </FormSection>

            <FormSection title="Notes">
              <RHFTextareaField
                control={form.control}
                name="notes"
                label="Notes"
                placeholder="Additional notes about this estimate..."
                rows={3}
              />
            </FormSection>

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              submitLabel="Save Changes"
              onCancel={() => router.back()}
              isSubmitting={form.formState.isSubmitting}
              stickyOnMobile
            />
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
